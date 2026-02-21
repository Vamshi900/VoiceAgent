import { NextResponse } from "next/server";

type Params = {
  params: {
    id: string;
  };
};

export async function POST(_request: Request, { params }: Params) {
  // Placeholder: would send SMS/email with discount code.
  return NextResponse.json({ callSessionId: params.id, sent: true });
}

