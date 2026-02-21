import type { GuardrailProvider } from "./types";
import { LocalGuardrailProvider } from "./local";
import { ArmorIqGuardrailProvider } from "./armoriq";

export type { GuardrailProvider, GuardrailResult } from "./types";

/** Returns ArmorIQ provider if configured, otherwise the local blocklist. */
export function getGuardrailProvider(): GuardrailProvider {
  const apiKey = process.env.ARMORIQ_API_KEY;
  const endpoint = process.env.ARMORIQ_ENDPOINT;

  if (apiKey && endpoint) {
    return new ArmorIqGuardrailProvider(apiKey, endpoint);
  }

  return new LocalGuardrailProvider();
}
