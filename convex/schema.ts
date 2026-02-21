import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  /* ── Prospects ──────────────────────────────────────────────── */
  prospects: defineTable({
    name: v.string(),
    phone: v.string(),
    zip: v.optional(v.string()),
    insurance: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("booked"),
      v.literal("declined"),
      v.literal("completed"),
      v.literal("do_not_call"),
      v.literal("callback"),
    ),
    callAttempts: v.number(),
    lastCalledAt: v.optional(v.number()),
    maxAttempts: v.number(),
    externalCrmId: v.optional(v.string()),
  }).index("by_phone", ["phone"])
    .index("by_status", ["status"]),

  /* ── Imaging Centers ────────────────────────────────────────── */
  centers: defineTable({
    name: v.string(),
    address: v.string(),
    phone: v.string(),
    hours: v.string(),
    discountAmount: v.number(),
    distanceTier: v.union(
      v.literal("close"),
      v.literal("medium"),
      v.literal("far"),
    ),
    basePrice: v.number(),
    availableSlots: v.array(
      v.object({
        date: v.string(),
        time: v.string(),
        available: v.boolean(),
      }),
    ),
  }),

  /* ── Call Sessions ──────────────────────────────────────────── */
  callSessions: defineTable({
    prospectId: v.id("prospects"),
    threadId: v.optional(v.string()),
    callPhase: v.union(
      v.literal("pending"),
      v.literal("dialing"),
      v.literal("opening"),
      v.literal("presenting"),
      v.literal("qa"),
      v.literal("booking"),
      v.literal("confirming"),
      v.literal("escalation"),
      v.literal("closing"),
      v.literal("ended"),
    ),
    offerState: v.object({
      presentedCenters: v.boolean(),
      selectedCenterId: v.optional(v.id("centers")),
      currentDiscounts: v.record(v.string(), v.number()),
      operatorOverride: v.optional(
        v.object({
          centerId: v.string(),
          oldAmount: v.number(),
          newAmount: v.number(),
        }),
      ),
    }),
    status: v.union(
      v.literal("active"),
      v.literal("on_hold"),
      v.literal("escalated"),
      v.literal("ended"),
    ),
    livekitRoomId: v.optional(v.string()),
    twilioCallSid: v.optional(v.string()),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    lastTurnAt: v.optional(v.number()),
    turnCount: v.number(),
  }).index("by_prospect", ["prospectId"])
    .index("by_status", ["status"]),

  /* ── Call Logs ──────────────────────────────────────────────── */
  callLogs: defineTable({
    sessionId: v.id("callSessions"),
    outcome: v.union(
      v.literal("in_progress"),
      v.literal("booked"),
      v.literal("declined"),
      v.literal("follow_up"),
      v.literal("escalated_resolved"),
      v.literal("escalated_pending"),
      v.literal("voicemail"),
      v.literal("no_answer"),
      v.literal("do_not_call"),
      v.literal("failed"),
    ),
    transcript: v.array(
      v.object({
        role: v.union(
          v.literal("agent"),
          v.literal("user"),
          v.literal("system"),
          v.literal("operator"),
        ),
        text: v.string(),
        timestamp: v.number(),
        turnNumber: v.optional(v.number()),
      }),
    ),
    summary: v.optional(v.string()),
    recordingUrl: v.optional(v.string()),
    escalationDetails: v.optional(
      v.object({
        reason: v.string(),
        repId: v.optional(v.id("humanReps")),
        resolved: v.boolean(),
      }),
    ),
  }).index("by_session", ["sessionId"]),

  /* ── Appointments ───────────────────────────────────────────── */
  appointments: defineTable({
    prospectId: v.id("prospects"),
    centerId: v.id("centers"),
    sessionId: v.id("callSessions"),
    date: v.string(),
    time: v.string(),
    status: v.union(
      v.literal("confirmed"),
      v.literal("completed"),
      v.literal("cancelled"),
      v.literal("no_show"),
    ),
    discountApplied: v.number(),
    finalPrice: v.number(),
    confirmationSmsSent: v.boolean(),
    reminderScheduled: v.boolean(),
  }).index("by_prospect", ["prospectId"])
    .index("by_center", ["centerId"]),

  /* ── Escalations ────────────────────────────────────────────── */
  escalations: defineTable({
    sessionId: v.id("callSessions"),
    reason: v.string(),
    transcriptSnapshot: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("assigned"),
      v.literal("resolved"),
    ),
    assignedRepId: v.optional(v.id("humanReps")),
    resolvedAt: v.optional(v.number()),
  }).index("by_session", ["sessionId"])
    .index("by_status", ["status"]),

  /* ── Human Reps ─────────────────────────────────────────────── */
  humanReps: defineTable({
    name: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    status: v.union(
      v.literal("available"),
      v.literal("busy"),
      v.literal("offline"),
    ),
    activeSessionId: v.optional(v.id("callSessions")),
  }).index("by_status", ["status"]),

  /* ── Operator Instructions ──────────────────────────────────── */
  operatorInstructions: defineTable({
    sessionId: v.id("callSessions"),
    type: v.union(
      v.literal("offer_adjustment"),
      v.literal("free_form"),
      v.literal("escalate_now"),
      v.literal("end_call"),
    ),
    payload: v.object({
      newOfferAmount: v.optional(v.number()),
      centerId: v.optional(v.string()),
      instructionText: v.optional(v.string()),
      reason: v.optional(v.string()),
    }),
    status: v.union(
      v.literal("queued"),
      v.literal("applied"),
      v.literal("rejected"),
    ),
    appliedAtTurn: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_session", ["sessionId"])
    .index("by_session_status", ["sessionId", "status"]),
});
