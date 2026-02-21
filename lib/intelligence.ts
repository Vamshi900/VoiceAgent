/* ── Intelligence turn types ──────────────────────────────────── */
/* These mirror the I/O spec contract between LiveKit ↔ Convex.   */

export type InsuranceOptionId = "A" | "B" | "C";

export interface InsuranceOption {
  id: InsuranceOptionId;
  label: string;
  location: string;
  discountAmount: number;
  validRegion: "LOCAL" | "NATIONAL" | "CALIFORNIA";
}

export interface IntelligenceMemory {
  doctorRecommendation: string;
  patientLocation: string;
  preferredChannel: "SMS" | "EMAIL";
  previousSelection: InsuranceOptionId | null;
}

/** Sent from voice layer → intelligence layer each turn */
export interface IntelligenceTurnRequest {
  callSessionId: string;
  turnId: string;
  userUtterance: string;
  speaker: "customer" | "agent";
  availableOptions: InsuranceOption[];
  memory: IntelligenceMemory;
  agentGuidelines: string[];
}

/** Returned from intelligence layer → voice layer each turn */
export interface IntelligenceTurnResponse {
  callSessionId: string;
  turnId: string;
  selectedOptionId: InsuranceOptionId | null;
  agentReplyText: string;
  discount?: {
    amount: number;
    provider: string;
    validRegion: "LOCAL" | "NATIONAL" | "CALIFORNIA";
  };
  updatedMemory: IntelligenceMemory;
}
