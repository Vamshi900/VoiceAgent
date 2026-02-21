import type { GuardrailProvider, GuardrailResult } from "./types";

/**
 * External guardrail API integration (ArmorIQ or similar service).
 * Stub implementation — replace with real API call when ready.
 */
export class ArmorIqGuardrailProvider implements GuardrailProvider {
  private apiKey: string;
  private endpoint: string;

  constructor(apiKey: string, endpoint: string) {
    this.apiKey = apiKey;
    this.endpoint = endpoint;
  }

  async check(text: string): Promise<GuardrailResult> {
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text, context: "outbound_sales_call" }),
      });

      if (!response.ok) {
        console.error("[ArmorIQ] API error, falling back to pass-through");
        return { safe: true, flags: [], sanitized: text };
      }

      const data = await response.json();
      return {
        safe: data.safe ?? true,
        flags: data.flags ?? [],
        sanitized: data.sanitized ?? text,
      };
    } catch (error) {
      console.error("[ArmorIQ] Network error, falling back to pass-through:", error);
      return { safe: true, flags: [], sanitized: text };
    }
  }
}
