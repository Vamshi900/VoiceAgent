import { internalMutation, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { components, internal } from "../_generated/api";
import { transferAgent } from "../agent";
import { createThread } from "@convex-dev/agent";

/* ── Create Session ───────────────────────────────────────────── */

export const createSession = internalMutation({
  args: {
    prospectPhone: v.string(),
    callType: v.optional(v.string()),
    campaignId: v.optional(v.string()),
    livekitRoomId: v.optional(v.string()),
    twilioCallSid: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Look up or create prospect
    let prospect = await ctx.db
      .query("prospects")
      .withIndex("by_phone", (q) => q.eq("phone", args.prospectPhone))
      .first();

    if (!prospect) {
      const prospectId = await ctx.db.insert("prospects", {
        name: "Unknown",
        phone: args.prospectPhone,
        status: "in_progress",
        callAttempts: 1,
        maxAttempts: 3,
      });
      prospect = await ctx.db.get(prospectId);
    } else {
      await ctx.db.patch(prospect._id, {
        status: "in_progress",
        callAttempts: prospect.callAttempts + 1,
        lastCalledAt: Date.now(),
      });
    }

    // Load center discounts for offer state
    const centers = await ctx.db.query("centers").collect();
    const currentDiscounts: Record<string, number> = {};
    for (const c of centers) {
      currentDiscounts[c._id] = c.discountAmount;
    }

    // Create agent thread
    const threadId = await createThread(ctx, components.agent, {});

    // Create session
    const sessionId = await ctx.db.insert("callSessions", {
      prospectId: prospect!._id,
      threadId,
      callPhase: "opening",
      offerState: {
        presentedCenters: false,
        currentDiscounts,
      },
      status: "active",
      livekitRoomId: args.livekitRoomId,
      twilioCallSid: args.twilioCallSid,
      startedAt: Date.now(),
      turnCount: 0,
    });

    // Build center summaries for the opening
    const centerSummaries = centers.map((c) => ({
      id: c._id,
      name: c.name,
      discount: c.discountAmount,
      distance: c.distanceTier,
    }));

    return {
      sessionId,
      prospectName: prospect!.name,
      openingLine: `Hi, is this ${prospect!.name}?`,
      callPhase: "opening" as const,
      centers: centerSummaries,
    };
  },
});

/* ── End Session ──────────────────────────────────────────────── */

export const endSession = internalAction({
  args: {
    sessionId: v.id("callSessions"),
    endReason: v.string(),
    finalDuration: v.optional(v.number()),
    recordingUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session: any = await ctx
      .runQuery(internal.helpers.getSession, {
        sessionId: args.sessionId,
      })
      .catch(() => null);

    // Mark session as ended
    await ctx.runMutation(internal.helpers.patchSession, {
      sessionId: args.sessionId,
      patch: {
        status: "ended",
        callPhase: "ended",
        endedAt: Date.now(),
      },
    });

    // Generate summary using transfer agent
    let summary = "Call ended.";
    try {
      if (session?.threadId) {
        const { thread } = await transferAgent.continueThread(ctx, {
          threadId: session.threadId,
        });
        const result = await thread.generateText({
          prompt: `The call has ended (reason: ${args.endReason}). Generate a brief 2-3 sentence summary of this call including: what was discussed, the outcome, and any follow-up needed.`,
        } as any);
        summary = result.text;
      }
    } catch (e) {
      console.error("Failed to generate summary:", e);
    }

    // Determine outcome
    let outcome: string = "failed";
    if (session) {
      const prospect: any = await ctx
        .runQuery(internal.helpers.getProspect, {
          prospectId: session.prospectId,
        })
        .catch(() => null);

      if (prospect?.status === "booked") outcome = "booked";
      else if (prospect?.status === "declined") outcome = "declined";
      else if (prospect?.status === "do_not_call") outcome = "do_not_call";
      else if (prospect?.status === "completed") outcome = "follow_up";
      else if (args.endReason === "voicemail") outcome = "voicemail";
      else if (args.endReason === "no_answer") outcome = "no_answer";
      else outcome = "failed";
    }

    // Create call log
    await ctx.runMutation(internal.helpers.insertCallLog, {
      sessionId: args.sessionId,
      outcome,
      transcript: [],
      summary,
      recordingUrl: args.recordingUrl,
    });

    return {
      acknowledged: true,
      outcome,
      summary,
    };
  },
});
