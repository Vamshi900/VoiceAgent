import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import type { CallStatus } from "../../../../lib/types";

export async function POST(request: Request) {
  // In a real implementation, this would trigger a Twilio outbound call,
  // initialize Convex session, and wire MiniMax agent. For now we just
  // return a synthetic session id and DIALING status.
  const body = await request.json();
  const callSessionId = nanoid();
  const status: CallStatus = "DIALING";

  const response = {
    callSessionId,
    status,
    echo: {
      phoneNumber: body.phoneNumber,
      callType: body.callType,
      baseOffer: body.baseOffer
    }
  };

  return NextResponse.json(response);
}

