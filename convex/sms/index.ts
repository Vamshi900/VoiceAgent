import type { SmsProvider } from "./types";
import { StubSmsProvider } from "./stub";
import { TwilioSmsProvider } from "./twilio";

export type { SmsProvider, SmsResult } from "./types";

/** Returns Twilio provider if creds are set, otherwise the console stub. */
export function getSmsProvider(): SmsProvider {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (sid && token && from) {
    return new TwilioSmsProvider(sid, token, from);
  }

  console.warn("[SMS] No Twilio credentials — using stub provider");
  return new StubSmsProvider();
}
