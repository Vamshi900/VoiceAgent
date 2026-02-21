import { NextResponse } from "next/server";

const CONVEX_SITE_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;

export async function POST(request: Request) {
  const body = await request.json();

  if (!CONVEX_SITE_URL) {
    return NextResponse.json(
      { error: "CONVEX_SITE_URL not configured" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(`${CONVEX_SITE_URL}/intelligence/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: body.callSessionId ?? body.sessionId,
        utterance: body.userUtterance ?? body.utterance,
        callPhase: body.callPhase ?? "qa",
        isSilence: body.isSilence ?? false,
        metadata: body.metadata ?? {
          turnId: body.turnId,
          callDuration: body.callDuration ?? 0,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Unknown error" }));
      return NextResponse.json(err, { status: res.status });
    }

    const data = await res.json();

    return NextResponse.json({
      callSessionId: body.callSessionId ?? body.sessionId,
      turnId: body.turnId,
      agentReplyText: data.agentReply,
      callPhase: data.callPhase,
      action: data.action,
      actionData: data.actionData,
      offerState: data.offerState,
      escalate: data.escalate,
      escalateReason: data.escalateReason,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Intelligence turn failed" },
      { status: 500 }
    );
  }
}
