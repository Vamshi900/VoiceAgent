import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { salesAgent } from "./agent";
import { getGuardrailProvider } from "./guardrails/index";

const http = httpRouter();

/* ── Intelligence Turn Endpoint ───────────────────────────────── */

http.route({
  path: "/intelligence/turn",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const {
      sessionId,
      utterance,
      callPhase,
      isSilence,
      metadata,
    } = body;

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "sessionId is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Load session
    const session: any = await ctx
      .runQuery(internal.helpers.getSession, { sessionId })
      .catch(() => null);

    if (!session) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check for pending operator instructions
    const pendingInstructions: any[] = await ctx.runQuery(
      internal.helpers.getQueuedInstructions,
      { sessionId }
    );

    // Build context for the LLM
    let systemContext = "";
    let forceEscalate = false;
    let forceEnd = false;

    for (const instr of pendingInstructions) {
      if (instr.type === "escalate_now") {
        forceEscalate = true;
      } else if (instr.type === "end_call") {
        forceEnd = true;
      } else if (instr.type === "offer_adjustment") {
        systemContext += `\n[OPERATOR] Adjust the discount for center ${instr.payload.centerId} to $${instr.payload.newOfferAmount}. Mention the improved offer to the patient.`;
      } else if (instr.type === "free_form") {
        systemContext += `\n[OPERATOR] ${instr.payload.instructionText}`;
      }

      // Mark instruction as applied
      await ctx.runMutation(internal.helpers.patchInstruction, {
        instructionId: instr._id,
        patch: {
          status: "applied",
          appliedAtTurn: session.turnCount + 1,
        },
      });
    }

    // Load centers for context
    const centers: any[] = await ctx.runQuery(
      internal.helpers.getAllCenters,
      {}
    );

    const centerContext = centers
      .map(
        (c) =>
          `${c.name} (${c.distanceTier}): $${c.basePrice - (session.offerState.currentDiscounts[c._id] ?? c.discountAmount)} after $${session.offerState.currentDiscounts[c._id] ?? c.discountAmount} discount`
      )
      .join("; ");

    // Build the prompt
    let agentReply = "";
    let action = "none";
    let actionData: any = null;
    let updatedPhase = callPhase || session.callPhase;

    if (forceEscalate) {
      agentReply =
        "I understand — let me connect you with a specialist who can help with that. Please hold for just a moment.";
      action = "escalate";
    } else if (forceEnd) {
      agentReply =
        "Thank you so much for your time today. Have a wonderful day!";
      action = "end_call";
    } else {
      // Run agent LLM
      try {
        const threadId = session.threadId;
        if (!threadId) {
          return new Response(
            JSON.stringify({ error: "No thread found for session" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }

        const prompt = isSilence
          ? `[The patient has been silent for ${metadata?.silenceDuration ?? "several"} seconds. They may be thinking or may have stepped away. Gently check in.]`
          : utterance;

        const contextMessage =
          `Current call phase: ${session.callPhase}. ` +
          `Turn number: ${session.turnCount + 1}. ` +
          `Duration: ${metadata?.callDuration ?? 0}s. ` +
          `Centers: ${centerContext}. ` +
          `${systemContext}`;

        const fullPrompt = `[Context: ${contextMessage}]\n\n${prompt}`;

        const { thread } = await salesAgent.continueThread(ctx, { threadId });
        const result = await thread.generateText({
          prompt: fullPrompt,
        } as any);

        agentReply = result.text;

        // Check if any tools were called to determine action
        for (const step of result.steps ?? []) {
          for (const toolResult of (step as any).toolResults ?? []) {
            const toolName = toolResult.toolName;
            if (toolName === "transferToHuman") {
              action = "escalate";
              actionData = toolResult.result;
            } else if (toolName === "bookAppointment") {
              action = "none"; // booking is handled, agent confirms
              updatedPhase = "confirming";
            } else if (
              toolName === "markDeclined" ||
              toolName === "markCompleted"
            ) {
              updatedPhase = "closing";
            }
          }
        }
      } catch (error) {
        console.error("Agent LLM error:", error);
        agentReply =
          "I apologize, could you repeat that? I want to make sure I help you correctly.";
      }
    }

    // Run guardrails on the reply
    const guardrails = getGuardrailProvider();
    const guardrailResult = await guardrails.check(agentReply);
    if (!guardrailResult.safe) {
      console.warn("Guardrail flags:", guardrailResult.flags);
      agentReply = guardrailResult.sanitized;
    }

    // Store only the agent reply in transcript.
    // User entries are stored directly by the agent-worker via /transcript/append
    // to avoid duplicates (the worker callback fires for both user and agent speech).
    await ctx.runMutation(internal.helpers.appendTranscriptEntries, {
      sessionId,
      entries: [
        {
          role: "agent",
          text: agentReply,
          timestamp: Date.now(),
          turnNumber: session.turnCount + 1,
        },
      ],
    });

    // Update session state
    await ctx.runMutation(internal.helpers.patchSession, {
      sessionId,
      patch: {
        callPhase: updatedPhase,
        turnCount: session.turnCount + 1,
        lastTurnAt: Date.now(),
      },
    });

    const response = {
      agentReply,
      callPhase: updatedPhase,
      action,
      actionData,
      offerState: session.offerState,
      escalate: action === "escalate",
      escalateReason:
        action === "escalate" ? actionData?.reason ?? "operator_requested" : null,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

/* ── Session Start Endpoint ───────────────────────────────────── */

http.route({
  path: "/session/start",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();

    const result = await ctx.runMutation(
      api.functions.sessions.createSession,
      {
        prospectPhone: body.prospectPhone,
        callType: body.callType,
        campaignId: body.campaignId,
        livekitRoomId: body.livekitRoomId,
        twilioCallSid: body.twilioCallSid,
      }
    );

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

/* ── Session End Endpoint ─────────────────────────────────────── */

http.route({
  path: "/session/end",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();

    const result = await ctx.runAction(
      api.functions.sessions.endSession,
      {
        sessionId: body.sessionId,
        endReason: body.endReason ?? "unknown",
        finalDuration: body.finalDuration,
        recordingUrl: body.recordingUrl,
      }
    );

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

/* ── Transcript Append Endpoint ────────────────────────────────── */

http.route({
  path: "/transcript/append",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const { sessionId, entries } = body;

    if (!sessionId || !Array.isArray(entries) || entries.length === 0) {
      return new Response(
        JSON.stringify({ error: "sessionId and non-empty entries[] required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await ctx.runMutation(internal.helpers.appendTranscriptEntries, {
      sessionId,
      entries,
    });

    return new Response(
      JSON.stringify({ ok: true, count: entries.length }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }),
});

/* ── Session Update Endpoint ─────────────────────────────────── */

http.route({
  path: "/session/update",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const { sessionId, ...patch } = body;

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "sessionId is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await ctx.runMutation(internal.helpers.patchSession, {
      sessionId,
      patch,
    });

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }),
});

/* ── Health Check ─────────────────────────────────────────────── */

http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(
      JSON.stringify({ status: "ok", timestamp: Date.now() }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }),
});

export default http;
