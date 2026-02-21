import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import type { ToolCtx } from "@convex-dev/agent";

export const scheduleCallback = createTool({
  description:
    "Schedule a callback for this prospect. Use when: no human rep is available for escalation, prospect asks to be called back later, or call drops.",
  args: z.object({
    sessionId: z.string().describe("The current call session ID"),
    delayMinutes: z
      .number()
      .default(60)
      .describe("How many minutes until the callback (default: 60)"),
    reason: z.string().describe("Why the callback is needed"),
  }),
  handler: async (ctx: ToolCtx, args) => {
    const session: any = await ctx.db.get(args.sessionId as any);
    if (!session) return { error: "Session not found" };

    const prospect: any = await ctx.db.get(session.prospectId);
    if (!prospect) return { error: "Prospect not found" };

    // Check we haven't exceeded max attempts
    if (prospect.callAttempts >= prospect.maxAttempts) {
      return {
        success: false,
        error: "Max call attempts reached",
        attempts: prospect.callAttempts,
        maxAttempts: prospect.maxAttempts,
      };
    }

    // Update prospect for callback
    await ctx.db.patch(session.prospectId, { status: "callback" });

    // Note: In production, we'd use ctx.scheduler.runAfter() to schedule
    // the actual callback. For now we just record the intent.
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
