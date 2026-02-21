import { query } from "../_generated/server";
import { v } from "convex/values";

/* ── Active Session ───────────────────────────────────────────── */

export const activeSession = query({
  args: { sessionId: v.id("callSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;

    const prospect = await ctx.db.get(session.prospectId);

    // Load centers with current discounts
    const centers = await ctx.db.query("centers").collect();
    const centerOptions = centers.map((c) => ({
      id: c._id,
      name: c.name,
      discount: session.offerState.currentDiscounts[c._id] ?? c.discountAmount,
      finalPrice:
        c.basePrice -
        (session.offerState.currentDiscounts[c._id] ?? c.discountAmount),
      distance: c.distanceTier,
      address: c.address,
    }));

    return {
      sessionId: session._id,
      prospectName: prospect?.name ?? "Unknown",
      prospectPhone: prospect?.phone ?? "",
      status: session.status,
      callPhase: session.callPhase,
      durationSoFar: session.startedAt
        ? Math.floor((Date.now() - session.startedAt) / 1000)
        : 0,
      offerState: session.offerState,
      centerOptions,
      turnCount: session.turnCount,
    };
  },
});

/* ── Session Transcript ───────────────────────────────────────── */

export const sessionTranscript = query({
  args: { sessionId: v.id("callSessions") },
  handler: async (ctx, args) => {
    const log = await ctx.db
      .query("callLogs")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();

    return {
      messages: log?.transcript ?? [],
    };
  },
});

/* ── Operator Instructions ────────────────────────────────────── */

export const operatorInstructions = query({
  args: { sessionId: v.id("callSessions") },
  handler: async (ctx, args) => {
    const instructions = await ctx.db
      .query("operatorInstructions")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    return {
      instructions: instructions.map((i) => ({
        id: i._id,
        type: i.type,
        payload: i.payload,
        status: i.status,
        createdAt: i.createdAt,
        appliedAtTurn: i.appliedAtTurn,
      })),
    };
  },
});

/* ── Pending Escalations ──────────────────────────────────────── */

export const pendingEscalations = query({
  args: {},
  handler: async (ctx) => {
    const escalations = await ctx.db
      .query("escalations")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const enriched = await Promise.all(
      escalations.map(async (esc) => {
        const session = await ctx.db.get(esc.sessionId);
        const prospect = session
          ? await ctx.db.get(session.prospectId)
          : null;

        return {
          id: esc._id,
          sessionId: esc.sessionId,
          prospectName: prospect?.name ?? "Unknown",
          reason: esc.reason,
          waitingSince: esc._creationTime,
          status: esc.status,
        };
      })
    );

    return { escalations: enriched };
  },
});

/* ── Today's Stats ────────────────────────────────────────────── */

export const todayStats = query({
  args: {},
  handler: async (ctx) => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    const logs = await ctx.db.query("callLogs").collect();
    const todayLogs = logs.filter((l) => l._creationTime >= todayMs);

    const stats = {
      callsMade: todayLogs.length,
      booked: todayLogs.filter((l) => l.outcome === "booked").length,
      declined: todayLogs.filter((l) => l.outcome === "declined").length,
      voicemail: todayLogs.filter((l) => l.outcome === "voicemail").length,
      escalated: todayLogs.filter(
        (l) =>
          l.outcome === "escalated_resolved" ||
          l.outcome === "escalated_pending"
      ).length,
      noAnswer: todayLogs.filter((l) => l.outcome === "no_answer").length,
      inProgress: 0,
      conversionRate: 0,
      avgCallDuration: 0,
    };

    // Active sessions
    const activeSessions = await ctx.db
      .query("callSessions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    stats.inProgress = activeSessions.length;

    // Conversion rate
    stats.conversionRate =
      stats.callsMade > 0 ? stats.booked / stats.callsMade : 0;

    return stats;
  },
});

/* ── Call Summary ─────────────────────────────────────────────── */

export const callSummary = query({
  args: { sessionId: v.id("callSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;

    const prospect = await ctx.db.get(session.prospectId);
    const log = await ctx.db
      .query("callLogs")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();

    // Check for appointment
    const appointment = await ctx.db
      .query("appointments")
      .withIndex("by_prospect", (q) => q.eq("prospectId", session.prospectId))
      .first();

    let selectedCenter = null;
    if (appointment) {
      selectedCenter = await ctx.db.get(appointment.centerId);
    }

    return {
      sessionId: session._id,
      outcome: log?.outcome ?? "in_progress",
      prospectName: prospect?.name ?? "Unknown",
      selectedCenter: selectedCenter?.name ?? null,
      appointmentDate: appointment?.date ?? null,
      appointmentTime: appointment?.time ?? null,
      discountApplied: appointment?.discountApplied ?? 0,
      finalPrice: appointment?.finalPrice ?? null,
      duration: session.endedAt && session.startedAt
        ? Math.floor((session.endedAt - session.startedAt) / 1000)
        : null,
      summary: log?.summary ?? null,
      transcript: log?.transcript ?? [],
      confirmationSmsSent: appointment?.confirmationSmsSent ?? false,
      reminderScheduled: appointment?.reminderScheduled ?? false,
    };
  },
});
