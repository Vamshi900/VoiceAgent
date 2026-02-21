import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import type { ToolCtx } from "@convex-dev/agent";

export const checkAvailability = createTool({
  description:
    "Check available appointment time slots at a specific imaging center, optionally filtered by date.",
  args: z.object({
    centerId: z.string().describe("The Convex document ID of the center"),
    date: z
      .string()
      .optional()
      .describe("Filter to a specific date (YYYY-MM-DD). Omit for all available slots."),
  }),
  handler: async (ctx: ToolCtx, args) => {
    const center: any = await ctx.db.get(args.centerId as any);
    if (!center) {
      return { error: "Center not found", slots: [] };
    }

    let slots = center.availableSlots.filter((s: any) => s.available);

    if (args.date) {
      slots = slots.filter((s: any) => s.date === args.date);
    }

    return {
      centerName: center.name,
      address: center.address,
      slots: slots.map((s: any) => ({
        date: s.date,
        time: s.time,
      })),
    };
  },
});
