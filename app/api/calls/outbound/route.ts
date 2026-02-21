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
    const res = await fetch(`${CONVEX_SITE_URL}/session/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prospectPhone: body.phoneNumber,
        callType: body.callType,
        campaignId: body.campaignId,
        livekitRoomId: body.livekitRoomId,
        twilioCallSid: body.twilioCallSid,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Unknown error" }));
      return NextResponse.json(err, { status: res.status });
    }

    const data = await res.json();

    // Map Convex response to what the frontend store expects
    return NextResponse.json({
      callSessionId: data.sessionId,
      status: "DIALING",
      prospectName: data.prospectName,
      openingLine: data.openingLine,
      callPhase: data.callPhase,
      centers: data.centers,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start session" },
      { status: 500 }
    );
  }
}
