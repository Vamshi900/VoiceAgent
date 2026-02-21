import { NextResponse } from "next/server";
import type {
  IntelligenceTurnRequest,
  IntelligenceTurnResponse
} from "../../../../lib/intelligence";

export async function POST(request: Request) {
  const body = (await request.json()) as IntelligenceTurnRequest;

  // Simple stub: pick option B if user mentions "B" or "CVS",
  // otherwise echo the previous selection or null.
  const text = body.userUtterance.toLowerCase();

  const pickedB = text.includes("option b") || text.includes("b ") || text.includes("cvs");
  const selectedOptionId =
    pickedB || body.memory.previousSelection === "B" ? "B" : body.memory.previousSelection;

  const response: IntelligenceTurnResponse = {
    callSessionId: body.callSessionId,
    turnId: body.turnId,
    selectedOptionId: selectedOptionId ?? null,
    agentReplyText:
      selectedOptionId === "B"
        ? "Great, I’ll enroll you in Option B: a $25 discount at a CVS about 5 miles from you, valid at CVS locations nationwide. I just need to confirm that this is the best phone number to text your discount code to."
        : "Thanks for letting me know. Could you confirm whether you prefer Option A, B, or C?",
    discount:
      selectedOptionId === "B"
        ? {
            amount: 25,
            provider: "CVS",
            validRegion: "NATIONAL"
          }
        : undefined,
    updatedMemory: {
      ...body.memory,
      previousSelection: selectedOptionId ?? body.memory.previousSelection
    }
  };

  return NextResponse.json(response);
}

