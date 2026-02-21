import type { SmsProvider, SmsResult } from "./types";

/** Production SMS provider using Twilio REST API */
export class TwilioSmsProvider implements SmsProvider {
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor(accountSid: string, authToken: string, fromNumber: string) {
    this.accountSid = accountSid;
    this.authToken = authToken;
    this.fromNumber = fromNumber;
  }

  async send(to: string, body: string): Promise<SmsResult> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;

    const params = new URLSearchParams({
      To: to,
      From: this.fromNumber,
      Body: body,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + btoa(`${this.accountSid}:${this.authToken}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[Twilio SMS] Error:", error);
      return { success: false, messageId: null, error };
    }

    const data = await response.json();
    return {
      success: true,
      messageId: data.sid,
    };
  }
}
