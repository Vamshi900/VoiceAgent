import { mutation } from "../_generated/server";
import { v } from "convex/values";

/* ── Send Operator Instruction ────────────────────────────────── */

export const sendInstruction = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    // Validate session is active
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.status === "ended") {
      throw new Error("Session not found or already ended");
    }

    // Write instruction
    const instructionId = await ctx.db.insert("operatorInstructions", {
      sessionId: args.sessionId,
      type: args.type,
      payload: args.payload,
      status: "queued",
      createdAt: Date.now(),
    });

    // If offer adjustment, also patch the session's offer state
    if (
      args.type === "offer_adjustment" &&
      args.payload.centerId &&
      args.payload.newOfferAmount !== undefined
    ) {
      const currentDiscounts = { ...session.offerState.currentDiscounts };
      const oldAmount = currentDiscounts[args.payload.centerId] ?? 0;
      currentDiscounts[args.payload.centerId] = args.payload.newOfferAmount;

      await ctx.db.patch(args.sessionId, {
        offerState: {
          ...session.offerState,
          currentDiscounts,
          operatorOverride: {
            centerId: args.payload.centerId,
            oldAmount,
            newAmount: args.payload.newOfferAmount,
          },
        },
      });
    }

    return {
      instructionId,
      status: "queued" as const,
      willApplyOnTurn: "next",
    };
  },
});
