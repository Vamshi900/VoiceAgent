import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import type { ToolCtx } from "@convex-dev/agent";

export const markDeclined = createTool({
  description:
    "Mark the prospect as declined. Use when the prospect clearly says no and doesn't want to book.",
  args: z.object({
    sessionId: z.string().describe("The current call session ID"),
    reason: z
      .string()
      .optional()
      .describe("Why the prospect declined (e.g. 'not interested', 'too expensive')"),
  }),
  handler: async (ctx: ToolCtx, args) => {
    const session: any = await ctx.db.get(args.sessionId as any);
    if (!session) return { error: "Session not found" };

    await ctx.db.patch(session.prospectId, { status: "declined" });

    return {
      success: true,
      reason: args.reason ?? "declined",
    };
  },
});
