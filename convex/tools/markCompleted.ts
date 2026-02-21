import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import type { ToolCtx } from "@convex-dev/agent";

export const markCompleted = createTool({
  description:
    "Mark the prospect as completed. Use when the prospect says they've already had their X-ray or no longer need one.",
  args: z.object({
    sessionId: z.string().describe("The current call session ID"),
    reason: z
      .string()
      .optional()
      .describe("Why the prospect is marked completed"),
  }),
  handler: async (ctx: ToolCtx, args) => {
    const session: any = await ctx.db.get(args.sessionId as any);
    if (!session) return { error: "Session not found" };

    await ctx.db.patch(session.prospectId, { status: "completed" });

    return {
      success: true,
      reason: args.reason ?? "already_completed",
    };
  },
});
