import type { SmsProvider, SmsResult } from "./types";

/** Development stub — logs SMS to console instead of sending */
export class StubSmsProvider implements SmsProvider {
  async send(to: string, body: string): Promise<SmsResult> {
    console.log(`[SMS STUB] To: ${to}`);
    console.log(`[SMS STUB] Body: ${body}`);
    console.log("[SMS STUB] ---");
    return {
      success: true,
      messageId: `stub_${Date.now()}`,
    };
  }
}
