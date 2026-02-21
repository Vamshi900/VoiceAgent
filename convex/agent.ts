import { Agent, createTool } from "@convex-dev/agent";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { components, internal } from "./_generated/api";
import { getSmsProvider } from "./sms/index";

/* ── Tool Definitions ─────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lookupCenters: any = createTool({
  description:
    "Look up the 3 imaging center options for the prospect based on their location.",
  args: z.object({
    prospectZip: z
      .string()
      .optional()
      .describe("The prospect's ZIP code (optional — returns all centers if omitted)"),
  }),
  handler: async (ctx, _args) => {
    return await ctx.runQuery(internal.helpers.lookupAllCenters, {});
  },
});

const checkAvailability: any = createTool({
  description:
    "Check available appointment time slots at a specific imaging center, optionally filtered by date.",
  args: z.object({
    centerId: z.string().describe("The Convex document ID of the center"),
    date: z
      .string()
      .optional()
      .describe("Filter to a specific date (YYYY-MM-DD). Omit for all available slots."),
  }),
  handler: async (ctx, args) => {
    return await ctx.runQuery(internal.helpers.checkCenterAvailability, {
      centerId: args.centerId as any,
      date: args.date,
    });
  },
});

const bookAppointment: any = createTool({
  description:
    "Book an X-ray appointment at a specific center, date, and time.",
  args: z.object({
    sessionId: z.string().describe("The current call session ID"),
    centerId: z.string().describe("The Convex ID of the chosen center"),
    date: z.string().describe("Appointment date (YYYY-MM-DD)"),
    time: z.string().describe("Appointment time (e.g. '10:30 AM')"),
  }),
  handler: async (ctx, args) => {
    return await ctx.runMutation(internal.helpers.bookAppointmentOp, {
      sessionId: args.sessionId as any,
      centerId: args.centerId as any,
      date: args.date,
      time: args.time,
    });
  },
});

const transferToHuman: any = createTool({
  description:
    "Escalate the call to a human sales rep. Finds an available rep, creates an escalation record, and returns the rep's info.",
  args: z.object({
    sessionId: z.string().describe("The current call session ID"),
    reason: z.string().describe("Why the call is being escalated"),
  }),
  handler: async (ctx, args) => {
    return await ctx.runMutation(internal.helpers.transferToHumanOp, {
      sessionId: args.sessionId as any,
      reason: args.reason,
    });
  },
});

const markDeclined: any = createTool({
  description:
    "Mark the prospect as declined. Use when the prospect clearly says no.",
  args: z.object({
    sessionId: z.string().describe("The current call session ID"),
    reason: z.string().optional().describe("Why the prospect declined"),
  }),
  handler: async (ctx, args) => {
    const result: any = await ctx.runMutation(
      internal.helpers.markProspectStatus,
      { sessionId: args.sessionId as any, status: "declined" }
    );
    return { ...result, reason: args.reason ?? "declined" };
  },
});

const markCompleted: any = createTool({
  description:
    "Mark the prospect as completed. Use when the prospect says they've already had their X-ray.",
  args: z.object({
    sessionId: z.string().describe("The current call session ID"),
    reason: z.string().optional().describe("Why the prospect is marked completed"),
  }),
  handler: async (ctx, args) => {
    const result: any = await ctx.runMutation(
      internal.helpers.markProspectStatus,
      { sessionId: args.sessionId as any, status: "completed" }
    );
    return { ...result, reason: args.reason ?? "already_completed" };
  },
});

const scheduleCallback: any = createTool({
  description:
    "Schedule a callback for this prospect. Use when no rep is available, prospect asks to be called later, or call drops.",
  args: z.object({
    sessionId: z.string().describe("The current call session ID"),
    delayMinutes: z.number().default(60).describe("Minutes until callback (default: 60)"),
    reason: z.string().describe("Why the callback is needed"),
  }),
  handler: async (ctx, args) => {
    return await ctx.runMutation(internal.helpers.scheduleCallbackOp, {
      sessionId: args.sessionId as any,
      delayMinutes: args.delayMinutes,
      reason: args.reason,
    });
  },
});

const sendConfirmationSms: any = createTool({
  description:
    "Send a confirmation SMS to the prospect with their appointment details.",
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
  handler: async (_ctx, args) => {
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
    return { sent: result.success, messageId: result.messageId, error: result.error };
  },
});

/* ── Sales Agent ──────────────────────────────────────────────── */

export const salesAgent: any = new Agent(components.agent, {
  name: "SalesAgent",
  languageModel: openai("gpt-4o"),
  instructions: `You are Sarah, a friendly and professional virtual care assistant calling on behalf of CVS Health on a recorded line.

YOUR MISSION: Help the patient book an X-ray appointment at one of three imaging centers. Their doctor recommended this procedure.

CALL FLOW:
1. OPENING — Verify you're speaking with the right person. Disclose you are an AI assistant. Be warm and concise.
2. PRESENTING — Present 3 imaging center options:
   - Option A: Closest center, no discount (convenience pitch)
   - Option B: Medium distance, moderate discount (balance pitch)
   - Option C: Farthest center, biggest discount (savings pitch)
3. Q&A — Answer questions about pricing, hours, insurance, location. Use the lookupCenters and checkAvailability tools.
4. BOOKING — When the patient picks an option, check availability and book it. Use bookAppointment.
5. CONFIRMING — Confirm the details, send confirmation SMS. Use sendConfirmationSms.
6. CLOSING — Thank them, remind them what to bring (insurance card, photo ID), say goodbye.

RULES:
- Be conversational, friendly, and concise. No long monologues.
- Never lie or make promises you cannot keep.
- If the patient asks something you cannot answer (MRI, billing disputes, legal, payment plans), use transferToHuman.
- If the patient explicitly asks to speak with a person, use transferToHuman immediately.
- If the patient becomes hostile or the conversation is going nowhere after 3 turns, use transferToHuman.
- If the patient says "do not call" or "remove me", acknowledge it and use markDeclined with reason "do_not_call".
- If the patient says they already had their X-ray, use markCompleted.
- If the patient declines all options, use markDeclined.
- Always confirm key details before ending the call.
- When presenting options, mention the name, discount, and distance for each.
- If an operator instruction is injected as a system message, follow it on this turn.`,
  tools: {
    lookupCenters,
    checkAvailability,
    bookAppointment,
    transferToHuman,
    markDeclined,
    markCompleted,
    scheduleCallback,
    sendConfirmationSms,
  },
  maxSteps: 5,
});

/* ── Transfer Agent ───────────────────────────────────────────── */

export const transferAgent: any = new Agent(components.agent, {
  name: "TransferAgent",
  languageModel: openai("gpt-4o-mini"),
  instructions: `You are a handoff assistant. Your only job is to summarize the conversation so far into a brief (2-3 sentence) handoff note for the human sales rep who is about to join the call.

Include:
- Patient name and what they're calling about
- What option(s) were discussed
- Why the call is being escalated
- Any special requests or concerns the patient mentioned

Be factual and concise. The rep needs to get up to speed in 10 seconds.`,
});
