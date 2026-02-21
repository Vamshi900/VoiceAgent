import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import type { ToolCtx } from "@convex-dev/agent";

export const transferToHuman = createTool({
  description:
    "Escalate the call to a human sales rep. Finds an available rep, creates an escalation record, and returns the rep's info so LiveKit can dial them in.",
  args: z.object({
    sessionId: z.string().describe("The current call session ID"),
    reason: z.string().describe("Why the call is being escalated"),
  }),
  handler: async (ctx: ToolCtx, args) => {
    // Find an available rep
    const rep: any = await ctx.db
      .query("humanReps")
      .withIndex("by_status", (q: any) => q.eq("status", "available"))
      .first();

    if (!rep) {
      return {
        success: false,
        error: "No reps available",
        action: "schedule_callback",
      };
    }

    // Create escalation record
    const escalationId = await ctx.db.insert("escalations", {
      sessionId: args.sessionId as any,
      reason: args.reason,
      status: "pending",
      assignedRepId: rep._id,
    });

    // Mark rep as busy
    await ctx.db.patch(rep._id, {
      status: "busy",
      activeSessionId: args.sessionId as any,
    });

    // Update session
    await ctx.db.patch(args.sessionId as any, {
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
