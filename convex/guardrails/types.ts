/** Guardrail provider interface — checks agent output before sending to user */
export interface GuardrailProvider {
  check(text: string): Promise<GuardrailResult>;
}

export interface GuardrailResult {
  safe: boolean;
  flags: string[];
  sanitized: string;
}
