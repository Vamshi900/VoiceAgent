import { NextResponse } from "next/server";

type Params = {
  params: {
    id: string;
  };
};

export async function POST(_request: Request, { params }: Params) {
  // Placeholder: would tell Twilio to hang up and persist final summary.
  return NextResponse.json({ callSessionId: params.id, status: "COMPLETED" });
}

