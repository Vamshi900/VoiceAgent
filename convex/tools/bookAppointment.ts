import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import type { ToolCtx } from "@convex-dev/agent";

export const bookAppointment = createTool({
  description:
    "Book an X-ray appointment at a specific center, date, and time. Creates the appointment record, updates prospect status, and schedules a confirmation SMS.",
  args: z.object({
    sessionId: z.string().describe("The current call session ID"),
    centerId: z.string().describe("The Convex ID of the chosen center"),
    date: z.string().describe("Appointment date (YYYY-MM-DD)"),
    time: z.string().describe("Appointment time (e.g. '10:30 AM')"),
  }),
  handler: async (ctx: ToolCtx, args) => {
    const center: any = await ctx.db.get(args.centerId as any);
    if (!center) return { error: "Center not found" };

    const session: any = await ctx.db.get(args.sessionId as any);
    if (!session) return { error: "Session not found" };

    const prospect: any = await ctx.db.get(session.prospectId);
    if (!prospect) return { error: "Prospect not found" };

    // Check slot is still available
    const slot = center.availableSlots.find(
      (s: any) => s.date === args.date && s.time === args.time && s.available
    );
    if (!slot) {
      return { error: "Slot no longer available", suggestion: "Try another time" };
    }

    // Calculate pricing
    const discountAmount =
      session.offerState?.currentDiscounts?.[args.centerId] ??
      center.discountAmount;
    const finalPrice = center.basePrice - discountAmount;

    // Create appointment
    const appointmentId = await ctx.db.insert("appointments", {
      prospectId: session.prospectId,
      centerId: args.centerId as any,
      sessionId: args.sessionId as any,
      date: args.date,
      time: args.time,
      status: "confirmed",
      discountApplied: discountAmount,
      finalPrice,
      confirmationSmsSent: false,
      reminderScheduled: false,
    });

    // Update prospect status
    await ctx.db.patch(session.prospectId, { status: "booked" });

    // Mark slot as taken
    const updatedSlots = center.availableSlots.map((s: any) =>
      s.date === args.date && s.time === args.time
        ? { ...s, available: false }
        : s
    );
    await ctx.db.patch(args.centerId as any, { availableSlots: updatedSlots });

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
