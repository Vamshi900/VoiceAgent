/* ── Shared front-end types ───────────────────────────────────── */

/** Call lifecycle statuses (UI-level) */
export type CallStatus =
  | "IDLE"
  | "DIALING"
  | "RINGING"
  | "LIVE"
  | "COMPLETED"
  | "FAILED";

/** Roles that can appear in the transcript */
export type TranscriptRole = "agent" | "user" | "system" | "operator";

/* ── Call phase (Convex intelligence layer) ───────────────────── */

export type CallPhase =
  | "pending"
  | "dialing"
  | "opening"
  | "presenting"
  | "qa"
  | "booking"
  | "confirming"
  | "escalation"
  | "closing"
  | "ended";

/* ── Intelligence turn action ─────────────────────────────────── */

export type TurnAction =
  | "none"
  | "hold"
  | "escalate"
  | "end_call"
  | "send_dtmf"
  | "transfer_cold";
