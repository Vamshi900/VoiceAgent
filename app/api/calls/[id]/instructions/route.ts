import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

type Params = {
  params: {
    id: string;
  };
};

export async function POST(request: Request, { params }: Params) {
  if (!CONVEX_URL) {
    return NextResponse.json(
      { error: "CONVEX_URL not configured" },
      { status: 500 }
    );
  }

  const body = await request.json();
  const client = new ConvexHttpClient(CONVEX_URL);

  try {
    // Determine instruction type from payload
    const type = body.type ?? "free_form";
    const payload: Record<string, unknown> = {};

    if (type === "offer_adjustment") {
      payload.newOfferAmount = body.newOfferAmount ?? body.structuredPayload?.newOfferAmount;
      payload.centerId = body.centerId ?? body.structuredPayload?.centerId;
    } else if (type === "free_form") {
      payload.instructionText = body.content ?? body.instructionText;
    } else if (type === "escalate_now" || type === "end_call") {
      payload.reason = body.reason ?? body.content;
    }

    const result = await client.mutation(
      api.functions.operator.sendInstruction,
      {
        sessionId: params.id as any,
        type: type as any,
        payload: payload as any,
      }
    );

    return NextResponse.json({
      callSessionId: params.id,
      instructionId: result.instructionId,
      status: result.status,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send instruction" },
      { status: 500 }
    );
  }
}
