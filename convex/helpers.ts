import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/* ── Basic Queries ───────────────────────────────────────────── */

export const getSession = internalQuery({
  args: { sessionId: v.id("callSessions") },
  handler: async (ctx, args) => ctx.db.get(args.sessionId),
});

export const getProspect = internalQuery({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, args) => ctx.db.get(args.prospectId),
});

export const getCenter = internalQuery({
  args: { centerId: v.id("centers") },
  handler: async (ctx, args) => ctx.db.get(args.centerId),
});

export const getAllCenters = internalQuery({
  args: {},
  handler: async (ctx) => ctx.db.query("centers").collect(),
});

export const getQueuedInstructions = internalQuery({
  args: { sessionId: v.id("callSessions") },
  handler: async (ctx, args) =>
    ctx.db
      .query("operatorInstructions")
      .withIndex("by_session_status", (q) =>
        q.eq("sessionId", args.sessionId).eq("status", "queued")
      )
      .collect(),
});

export const getAppointment = internalQuery({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, args) => ctx.db.get(args.appointmentId),
});

/* ── Basic Mutations ─────────────────────────────────────────── */

export const patchSession = internalMutation({
  args: { sessionId: v.id("callSessions"), patch: v.any() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, args.patch);
  },
});

export const patchInstruction = internalMutation({
  args: { instructionId: v.id("operatorInstructions"), patch: v.any() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.instructionId, args.patch);
  },
});

export const patchAppointment = internalMutation({
  args: { appointmentId: v.id("appointments"), patch: v.any() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.appointmentId, args.patch);
  },
});

export const insertCallLog = internalMutation({
  args: {
    sessionId: v.id("callSessions"),
    outcome: v.string(),
    transcript: v.array(v.any()),
    summary: v.optional(v.string()),
    recordingUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => ctx.db.insert("callLogs", args as any),
});

/* ── Transcript + Call Log Updates ───────────────────────────── */

export const appendTranscriptEntries = internalMutation({
  args: {
    sessionId: v.id("callSessions"),
    entries: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const log = await ctx.db
      .query("callLogs")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (log) {
      await ctx.db.patch(log._id, {
        transcript: [...log.transcript, ...args.entries],
      });
    } else {
      // Safety net: create callLog if it was not pre-created during session start
      await ctx.db.insert("callLogs", {
        sessionId: args.sessionId,
        outcome: "in_progress" as any,
        transcript: args.entries,
      });
    }
  },
});

export const updateCallLog = internalMutation({
  args: {
    sessionId: v.id("callSessions"),
    outcome: v.string(),
    summary: v.optional(v.string()),
    recordingUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const log = await ctx.db
      .query("callLogs")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (log) {
      await ctx.db.patch(log._id, {
        outcome: args.outcome as any,
        summary: args.summary,
        recordingUrl: args.recordingUrl,
      });
    } else {
      await ctx.db.insert("callLogs", {
        sessionId: args.sessionId,
        outcome: args.outcome as any,
        transcript: [],
        summary: args.summary,
        recordingUrl: args.recordingUrl,
      });
    }
  },
});

/* ── Compound Tool Queries ───────────────────────────────────── */

export const lookupAllCenters = internalQuery({
  args: {},
  handler: async (ctx) => {
    const centers = await ctx.db.query("centers").collect();
    return centers.map((c) => ({
      id: c._id,
      name: c.name,
      address: c.address,
      phone: c.phone,
      hours: c.hours,
      discountAmount: c.discountAmount,
      distanceTier: c.distanceTier,
      basePrice: c.basePrice,
      finalPrice: c.basePrice - c.discountAmount,
      availableDates: [
        ...new Set(
          c.availableSlots
            .filter((s) => s.available)
            .map((s) => s.date)
        ),
      ],
    }));
  },
});

export const checkCenterAvailability = internalQuery({
  args: { centerId: v.id("centers"), date: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const center = await ctx.db.get(args.centerId);
    if (!center) return { error: "Center not found", slots: [] };

    let slots = center.availableSlots.filter((s) => s.available);
    if (args.date) {
      slots = slots.filter((s) => s.date === args.date);
    }

    return {
      centerName: center.name,
      address: center.address,
      slots: slots.map((s) => ({ date: s.date, time: s.time })),
    };
  },
});

/* ── Compound Tool Mutations ─────────────────────────────────── */

export const bookAppointmentOp = internalMutation({
  args: {
    sessionId: v.id("callSessions"),
    centerId: v.id("centers"),
    date: v.string(),
    time: v.string(),
  },
  handler: async (ctx, args) => {
    const center = await ctx.db.get(args.centerId);
    if (!center) return { error: "Center not found" };

    const session = await ctx.db.get(args.sessionId);
    if (!session) return { error: "Session not found" };

    const prospect = await ctx.db.get(session.prospectId);
    if (!prospect) return { error: "Prospect not found" };

    const slot = center.availableSlots.find(
      (s) => s.date === args.date && s.time === args.time && s.available
    );
    if (!slot) {
      return { error: "Slot no longer available", suggestion: "Try another time" };
    }

    const discountAmount =
      session.offerState?.currentDiscounts?.[args.centerId] ??
      center.discountAmount;
    const finalPrice = center.basePrice - discountAmount;

    const appointmentId = await ctx.db.insert("appointments", {
      prospectId: session.prospectId,
      centerId: args.centerId,
      sessionId: args.sessionId,
      date: args.date,
      time: args.time,
      status: "confirmed",
      discountApplied: discountAmount,
      finalPrice,
      confirmationSmsSent: false,
      reminderScheduled: false,
    });

    await ctx.db.patch(session.prospectId, { status: "booked" });

    const updatedSlots = center.availableSlots.map((s) =>
      s.date === args.date && s.time === args.time
        ? { ...s, available: false }
        : s
    );
    await ctx.db.patch(args.centerId, { availableSlots: updatedSlots });

    return {
      appointmentId,
      centerName: center.name,
      address: center.address,
      date: args.date,
      time: args.time,
      discountApplied: discountAmount,
      finalPrice,
      prospectName: prospect.name,
      prospectPhone: prospect.phone,
    };
  },
});

export const transferToHumanOp = internalMutation({
  args: {
    sessionId: v.id("callSessions"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const rep = await ctx.db
      .query("humanReps")
      .withIndex("by_status", (q) => q.eq("status", "available"))
      .first();

    if (!rep) {
      return {
        success: false,
        error: "No reps available",
        action: "schedule_callback",
      };
    }

    const escalationId = await ctx.db.insert("escalations", {
      sessionId: args.sessionId,
      reason: args.reason,
      status: "pending",
      assignedRepId: rep._id,
    });

    await ctx.db.patch(rep._id, {
      status: "busy",
      activeSessionId: args.sessionId,
    });

    await ctx.db.patch(args.sessionId, {
      status: "escalated",
      callPhase: "escalation",
    });

    return {
      success: true,
      escalationId,
      repName: rep.name,
      repPhone: rep.phone,
      reason: args.reason,
    };
  },
});

export const markProspectStatus = internalMutation({
  args: {
    sessionId: v.id("callSessions"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return { error: "Session not found" };
    await ctx.db.patch(session.prospectId, { status: args.status as any });
    return { success: true };
  },
});

export const scheduleCallbackOp = internalMutation({
  args: {
    sessionId: v.id("callSessions"),
    delayMinutes: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return { error: "Session not found" };

    const prospect = await ctx.db.get(session.prospectId);
    if (!prospect) return { error: "Prospect not found" };

    if (prospect.callAttempts >= prospect.maxAttempts) {
      return {
        success: false,
        error: "Max call attempts reached",
        attempts: prospect.callAttempts,
        maxAttempts: prospect.maxAttempts,
      };
    }

    await ctx.db.patch(session.prospectId, { status: "callback" as any });

    const callbackAt = Date.now() + args.delayMinutes * 60 * 1000;

    return {
      success: true,
      callbackAt,
      delayMinutes: args.delayMinutes,
      reason: args.reason,
      prospectPhone: prospect.phone,
    };
  },
});
