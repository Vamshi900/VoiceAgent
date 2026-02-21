import type { GuardrailProvider, GuardrailResult } from "./types";

/** Keyword/regex blocklist guardrail — runs locally, no external calls */
const BLOCKED_PATTERNS: Array<{ pattern: RegExp; flag: string }> = [
  { pattern: /\b(guaranteed|guarantee)\b/i, flag: "unsupported_guarantee" },
  { pattern: /\b(free|no cost|zero cost)\b/i, flag: "misleading_pricing" },
  { pattern: /\b(diagnos(e|is|tic))\b/i, flag: "medical_diagnosis" },
  { pattern: /\b(prescri(be|ption))\b/i, flag: "medical_prescription" },
  { pattern: /\b(sue|lawsuit|legal action)\b/i, flag: "legal_threat" },
  { pattern: /\b(competitor\s+\w+\s+(sucks|bad|worse|terrible))\b/i, flag: "competitor_disparagement" },
];

/** Phrases the agent should never reveal */
const REDACT_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[REDACTED SSN]" },
  { pattern: /\b\d{16}\b/g, replacement: "[REDACTED CARD]" },
];

export class LocalGuardrailProvider implements GuardrailProvider {
  async check(text: string): Promise<GuardrailResult> {
    const flags: string[] = [];
    let sanitized = text;

    // Check blocked patterns
    for (const { pattern, flag } of BLOCKED_PATTERNS) {
      if (pattern.test(text)) {
        flags.push(flag);
      }
    }

    // Redact sensitive data
    for (const { pattern, replacement } of REDACT_PATTERNS) {
      sanitized = sanitized.replace(pattern, replacement);
    }

    return {
      safe: flags.length === 0,
      flags,
      sanitized,
    };
  }
}
