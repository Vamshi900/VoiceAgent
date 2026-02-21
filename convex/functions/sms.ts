import { action } from "../_generated/server";
import { v } from "convex/values";
import { getSmsProvider } from "../sms/index";

/* ── Send SMS Action ──────────────────────────────────────────── */

export const sendSms = action({
  args: {
    to: v.string(),
    body: v.string(),
  },
  handler: async (_ctx, args) => {
    const sms = getSmsProvider();
    const result = await sms.send(args.to, args.body);
    return result;
  },
});

/* ── Send Reminder SMS ────────────────────────────────────────── */

export const sendReminderSms = action({
  args: {
    appointmentId: v.id("appointments"),
  },
  handler: async (ctx, args) => {
    // Load appointment and related data
    const appointment: any = await ctx.runQuery(async (ctx) =>
      ctx.db.get(args.appointmentId)
    );
    if (!appointment) return { error: "Appointment not found" };

    const prospect: any = await ctx.runQuery(async (ctx) =>
      ctx.db.get(appointment.prospectId)
    );
    const center: any = await ctx.runQuery(async (ctx) =>
      ctx.db.get(appointment.centerId)
    );

    if (!prospect || !center) return { error: "Missing data" };

    const body = [
      `Hi ${prospect.name}! Reminder: your X-ray is tomorrow at ${appointment.time}`,
      `at ${center.name} (${center.address}).`,
      `See you there! - CVS Health`,
    ].join(" ");

    const sms = getSmsProvider();
    const result = await sms.send(prospect.phone, body);

    if (result.success) {
      await ctx.runMutation(async (ctx) => {
        await ctx.db.patch(args.appointmentId, { reminderScheduled: true });
      });
    }

    return result;
  },
});
