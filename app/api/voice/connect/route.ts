import { NextResponse } from "next/server";

/**
 * POST /api/voice/connect
 *
 * Triggers the voice pipeline (LiveKit + Twilio) for an existing Convex session.
 * Called by the frontend after createSession returns a Convex session ID.
 *
 * Body: { convexSessionId, phoneNumber, callType? }
 * Calls the Python API at VOICE_API_URL/v1/calls/outbound
 */

const VOICE_API_URL = process.env.VOICE_API_URL || "http://localhost:8000";
const API_AUTH_TOKEN = process.env.API_AUTH_TOKEN || "";

export async function POST(request: Request) {
  const body = await request.json();
  const { convexSessionId, phoneNumber } = body;

  if (!convexSessionId || !phoneNumber) {
    return NextResponse.json(
      { error: "convexSessionId and phoneNumber are required" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(`${VOICE_API_URL}/v1/calls/outbound`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_AUTH_TOKEN}`,
      },
      body: JSON.stringify({
        to: phoneNumber,
        convex_session_id: convexSessionId,
        context: {
          convex_session_id: convexSessionId,
          phone: phoneNumber,
        },
        metadata: {
          convex_session_id: convexSessionId,
          source: "operator_dashboard",
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Voice API error" }));
      return NextResponse.json(err, { status: res.status });
    }

    const data = await res.json();

    return NextResponse.json({
      callId: data.call_id,
      roomName: data.room_name,
      status: data.status,
      convexSessionId,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to connect voice" },
      { status: 500 }
    );
  }
}
