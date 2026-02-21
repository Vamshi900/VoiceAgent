import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import type { ToolCtx } from "@convex-dev/agent";
import { getSmsProvider } from "../sms/index";

export const sendConfirmationSms = createTool({
  description:
    "Send a confirmation SMS to the prospect with their appointment details. Call this after successfully booking an appointment.",
  args: z.object({
    prospectPhone: z.string().describe("The prospect's phone number"),
    prospectName: z.string().describe("The prospect's first name"),
    centerName: z.string().describe("The imaging center name"),
    centerAddress: z.string().describe("The center's full address"),
    date: z.string().describe("Appointment date"),
    time: z.string().describe("Appointment time"),
    discountApplied: z.number().describe("Discount amount in dollars"),
    finalPrice: z.number().describe("Final price after discount"),
  }),
  handler: async (_ctx: ToolCtx, args) => {
    const sms = getSmsProvider();

    const body = [
      `Hi ${args.prospectName}! Your X-ray appointment is confirmed:`,
      "",
      `Location: ${args.centerName}`,
      `Date: ${args.date} at ${args.time}`,
      `Price: $${args.finalPrice}${args.discountApplied > 0 ? ` ($${args.discountApplied} discount applied)` : ""}`,
      "",
      `Address: ${args.centerAddress}`,
      `Bring: Insurance card, photo ID`,
      "",
      `To reschedule, call (800) 555-0199.`,
      `- CVS Health`,
    ].join("\n");

    const result = await sms.send(args.prospectPhone, body);

    return {
      sent: result.success,
      messageId: result.messageId,
      error: result.error,
    };
  },
});
