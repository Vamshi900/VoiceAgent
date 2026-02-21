import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import type { ToolCtx } from "@convex-dev/agent";

export const lookupCenters = createTool({
  description:
    "Look up the 3 imaging center options for the prospect based on their location. Returns center name, address, discount, distance tier, base price, and available dates.",
  args: z.object({
    prospectZip: z
      .string()
      .optional()
      .describe("The prospect's ZIP code (optional — returns all centers if omitted)"),
  }),
  handler: async (ctx: ToolCtx, args) => {
    const centers = await ctx.db.query("centers").collect();

    return centers.map((c: any) => ({
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
            .filter((s: any) => s.available)
            .map((s: any) => s.date)
        ),
      ],
    }));
  },
});
