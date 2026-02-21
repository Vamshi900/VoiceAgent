import { NextResponse } from "next/server";

const CONVEX_SITE_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;

type Params = {
  params: {
    id: string;
  };
};

export async function POST(request: Request, { params }: Params) {
  if (!CONVEX_SITE_URL) {
    return NextResponse.json(
      { error: "CONVEX_SITE_URL not configured" },
      { status: 500 }
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // Body is optional
  }

  try {
    const res = await fetch(`${CONVEX_SITE_URL}/session/end`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: params.id,
        endReason: body.endReason ?? "operator_ended",
        finalDuration: body.finalDuration,
        recordingUrl: body.recordingUrl,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Unknown error" }));
      return NextResponse.json(err, { status: res.status });
    }

    const data = await res.json();

    return NextResponse.json({
      callSessionId: params.id,
      status: "COMPLETED",
      outcome: data.outcome,
      summary: data.summary,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to end session" },
      { status: 500 }
    );
  }
}
