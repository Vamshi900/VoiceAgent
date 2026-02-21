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
    const result = await client.action(api.functions.sms.sendSms, {
      to: body.phone ?? body.to,
      body: body.message ?? body.body ?? `Your discount code: ${body.code ?? "N/A"}`,
    });

    return NextResponse.json({
      callSessionId: params.id,
      sent: result.success ?? true,
      messageId: result.messageId,
      error: result.error,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send SMS" },
      { status: 500 }
    );
  }
}
