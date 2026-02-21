import { NextResponse } from "next/server";

type Params = {
  params: {
    id: string;
  };
};

export async function POST(request: Request, { params }: Params) {
  const body = await request.json();

  // In a real implementation, this would send the instruction to the agent via Convex.
  const response = {
    callSessionId: params.id,
    received: {
      content: body.content,
      structuredPayload: body.structuredPayload ?? null
    }
  };

  return NextResponse.json(response);
}

