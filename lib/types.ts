/* ── Shared front-end types ───────────────────────────────────── */

/** Call lifecycle statuses */
export type CallStatus =
  | "IDLE"
  | "DIALING"
  | "RINGING"
  | "LIVE"
  | "COMPLETED"
  | "FAILED";

/** Call types the operator can initiate */
export type CallType = "FEEDBACK" | "PROMOTION";

/** Roles that can appear in the transcript */
export type TranscriptRole = "agent" | "customer" | "system" | "operator";

/** A single transcript line */
export interface TranscriptEntry {
  id: string;
  role: TranscriptRole;
  text: string;
  timestamp: number;
}

/** Operator instruction sent mid-call */
export interface OperatorInstruction {
  id: string;
  content: string;
  status: "pending" | "applied" | "rejected";
  createdAt: number;
}

/** Offer state tracked during a promotional call */
export interface OfferState {
  baseAmount: number;
  requestedAmount: number | null;
  approvedAmount: number | null;
  code: string | null;
}

/** Full call session model used by the Zustand store */
export interface CallSession {
  id: string;
  phoneNumber: string;
  type: CallType;
  status: CallStatus;
  offer: OfferState | null;
  transcript: TranscriptEntry[];
  instructions: OperatorInstruction[];
  startedAt: string | null;
  endedAt: string | null;
}

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
