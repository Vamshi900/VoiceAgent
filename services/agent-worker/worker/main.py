"""LiveKit agent-worker with Convex intelligence layer.

Voice pipeline: Whisper STT → Convex Intelligence → ElevenLabs TTS
The Convex intelligence layer handles CVS booking agent logic, tools,
state management, and operator instructions.
"""

import asyncio
import json
import logging
import time

from pythonjsonlogger import jsonlogger

from worker.config import get_settings
from worker import convex_bridge
from worker.prompts import compose_system_prompt, build_opening_instruction, build_timeout_instruction
from worker.transcript_client import push_transcript_turn

logger = logging.getLogger("agent-worker")
handler = logging.StreamHandler()
handler.setFormatter(jsonlogger.JsonFormatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
logger.handlers = [handler]
logger.setLevel(logging.INFO)
settings = get_settings()

try:
    from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, cli
    from livekit.plugins import elevenlabs, openai, silero
except Exception as exc:
    logger.exception("Failed importing livekit agent packages: %s", exc)
    raise


def build_stt() -> object:
    """Build STT using OpenAI Whisper API (cloud).

    Uses the main OpenAI API key for Whisper transcription.
    LiveKit agents SDK 1.2.x requires VAD for non-streaming STT,
    so we use OpenAI's cloud Whisper which supports streaming.
    """
    logger.info("Configuring STT with OpenAI Whisper (cloud) model=%s", settings.whisper_model)
    return openai.STT(model=settings.whisper_model, api_key=settings.openai_api_key)


async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect()
    participant = await ctx.wait_for_participant()
    attrs = participant.attributes or {}

    # Read from agent dispatch metadata first, then fall back to participant attributes
    dispatch_meta: dict = {}
    try:
        raw_meta = getattr(ctx.job, "metadata", "") or ""
        if raw_meta:
            dispatch_meta = json.loads(raw_meta) if isinstance(raw_meta, str) else raw_meta
    except Exception:
        pass

    call_id = dispatch_meta.get("call_id", "") or attrs.get("call_id", "")
    phone_number = dispatch_meta.get("phone_number", "") or attrs.get("phone_number", "")
    convex_session_id = dispatch_meta.get("convex_session_id", "") or attrs.get("convex_session_id", "")
    context_blob = attrs.get("context_json", "{}")
    try:
        context = json.loads(context_blob) if isinstance(context_blob, str) else context_blob
    except Exception:
        context = {}

    logger.info(
        "Starting agent for room=%s participant=%s call_id=%s convex_session=%s dispatch_meta=%s",
        ctx.room.name, participant.identity, call_id, convex_session_id, dispatch_meta,
    )

    # --- Convex Intelligence Mode ---
    # If we have a Convex session (pre-created by operator dashboard), use
    # the Convex intelligence layer for agent responses.
    # Otherwise fall back to direct OpenAI mode.
    use_convex = bool(convex_session_id and settings.convex_site_url)

    if use_convex:
        await _run_convex_mode(ctx, convex_session_id, call_id, phone_number, context)
    else:
        await _run_direct_mode(ctx, call_id, context)


async def _run_convex_mode(
    ctx: JobContext,
    convex_session_id: str,
    call_id: str,
    phone_number: str,
    context: dict,
) -> None:
    """Use Convex intelligence layer for agent responses.

    Pipeline: Whisper STT → Convex /intelligence/turn → ElevenLabs TTS
    Convex handles the CVS booking agent, tools, state, and operator instructions.
    The local LLM handles natural conversation; Convex provides state, tools, and
    operator instructions. Only action overrides (escalate, end_call) trigger
    explicit generate_reply calls.
    """
    logger.info("Running in Convex intelligence mode, session=%s", convex_session_id)

    # Update Convex session with LiveKit room ID
    try:
        await convex_bridge.update_session(convex_session_id, livekitRoomId=ctx.room.name)
    except Exception:
        logger.exception("Failed to update session with room ID")

    # Build system prompt — uses CVS booking prompt + context from Convex
    system_prompt = compose_system_prompt(context)
    agent = Agent(instructions=system_prompt)

    # Use gpt-4o for the voice pipeline LLM (reliable + fast for real-time)
    llm_model = "gpt-4o"
    logger.info("Creating AgentSession: LLM=%s, TTS=elevenlabs voice=%s", llm_model, settings.elevenlabs_voice_id)

    session = AgentSession(
        vad=silero.VAD.load(),
        stt=build_stt(),
        llm=openai.LLM(model=llm_model, api_key=settings.openai_api_key),
        tts=elevenlabs.TTS(api_key=settings.elevenlabs_api_key, voice_id=settings.elevenlabs_voice_id),
        allow_interruptions=True,
    )

    start_time = time.monotonic()
    turn_count = 0
    current_phase = "opening"
    disconnected = False
    transcript_sink = getattr(settings, "transcript_sink", "both")

    async def _store_convex_entry(role: str, text: str, turn: int | None = None) -> None:
        """Store a transcript entry in Convex (non-fatal on error)."""
        try:
            await convex_bridge.store_transcript_entry(
                session_id=convex_session_id,
                role=role,
                text=text,
                turn_number=turn,
            )
        except Exception:
            logger.exception("Failed to store %s transcript in Convex", role)

    async def _handle_transcript(event) -> None:  # type: ignore[no-untyped-def]
        nonlocal turn_count, current_phase

        speaker = getattr(event, "speaker", "unknown")
        text = getattr(event, "text", "")
        if not text:
            return

        # Push transcript to Python API (for PostgreSQL storage)
        if call_id and transcript_sink in ("log", "both"):
            try:
                await push_transcript_turn(
                    call_id=call_id,
                    speaker=speaker,
                    text=text,
                    start_ms=int(getattr(event, "start_time_ms", 0)),
                    end_ms=int(getattr(event, "end_time_ms", 0)),
                    confidence=float(getattr(event, "confidence", 1.0)),
                )
            except Exception:
                logger.exception("Failed to push transcript to API call_id=%s", call_id)

        # Store agent speech directly in Convex (not routed through /intelligence/turn)
        if speaker == "agent" and transcript_sink in ("http", "both"):
            await _store_convex_entry("agent", text, turn_count or None)

        # Route user speech through Convex intelligence for state/tools/operator
        if speaker == "user":
            turn_count += 1

            # Store user entry in Convex immediately
            if transcript_sink in ("http", "both"):
                await _store_convex_entry("user", text, turn_count)

            try:
                result = await convex_bridge.send_turn(
                    session_id=convex_session_id,
                    utterance=text,
                    call_phase=current_phase,
                    metadata={
                        "callDuration": int(time.monotonic() - start_time),
                        "turnId": f"turn-{turn_count}",
                    },
                )

                # Update phase from Convex
                if result.get("callPhase"):
                    current_phase = result["callPhase"]

                # Only action overrides trigger explicit generate_reply.
                # The local pipeline LLM handles normal conversation flow;
                # Convex /intelligence/turn is for state, tools, and operator instructions.
                action = result.get("action", "none")
                if action == "escalate":
                    logger.info("Convex escalation requested, session=%s", convex_session_id)
                    await session.generate_reply(
                        instructions="The system has flagged this call for escalation. "
                        "Tell the caller you are connecting them with a specialist."
                    )
                elif action == "end_call":
                    logger.info("Convex end_call requested, session=%s", convex_session_id)
                    await session.generate_reply(
                        instructions="End the call politely. Thank the caller for their time."
                    )

            except Exception:
                logger.exception("Convex intelligence turn failed, session=%s", convex_session_id)

    # LiveKit agents 1.2.x requires sync callbacks — wrap async in create_task
    @session.on("transcript")
    def on_transcript(event) -> None:  # type: ignore[no-untyped-def]
        asyncio.create_task(_handle_transcript(event))

    # Handle participant disconnect → end Convex session
    async def _on_participant_disconnected(participant) -> None:  # type: ignore[no-untyped-def]
        nonlocal disconnected
        identity = getattr(participant, "identity", "unknown")
        logger.info("Participant disconnected: %s, session=%s", identity, convex_session_id)
        disconnected = True
        try:
            duration = time.monotonic() - start_time
            await convex_bridge.end_session(convex_session_id, "customer_hangup", duration)
            logger.info("Convex session ended (customer_hangup), session=%s", convex_session_id)
        except Exception:
            logger.exception("Failed to end Convex session on disconnect=%s", convex_session_id)

    ctx.room.on("participant_disconnected", lambda p: asyncio.create_task(_on_participant_disconnected(p)))

    logger.info("Starting AgentSession in room=%s", ctx.room.name)
    await session.start(room=ctx.room, agent=agent)
    logger.info("AgentSession started, speaking opening line...")

    # Speak the opening line
    opening = build_opening_instruction(context)
    logger.info("Opening instruction: %s", opening[:100])
    try:
        await session.generate_reply(instructions=opening)
        logger.info("Opening line spoken successfully")
        # Store opening greeting in Convex so it appears in the transcript
        # (the agent transcript callback may also fire, but dedup is harmless)
        await _store_convex_entry("agent", opening, 0)
    except Exception:
        logger.exception("Failed to speak opening line")

    # Main loop — wait for max duration or participant disconnect
    while not disconnected and time.monotonic() - start_time < settings.max_call_duration_seconds:
        await asyncio.sleep(1)

    if disconnected:
        # Session already ended in disconnect handler
        await ctx.shutdown(reason="participant_disconnected")
        return

    # Timeout — close the call
    await session.generate_reply(instructions=build_timeout_instruction())

    # End Convex session
    try:
        duration = time.monotonic() - start_time
        await convex_bridge.end_session(convex_session_id, "max_duration", duration)
        logger.info("Convex session ended, session=%s", convex_session_id)
    except Exception:
        logger.exception("Failed to end Convex session=%s", convex_session_id)

    await ctx.shutdown(reason="max_duration_reached")


async def _run_direct_mode(ctx: JobContext, call_id: str, context: dict) -> None:
    """Fallback: direct OpenAI mode without Convex (original behavior)."""
    logger.info("Running in direct OpenAI mode (no Convex session)")

    agent = Agent(instructions=compose_system_prompt(context))

    session = AgentSession(
        vad=silero.VAD.load(),
        stt=build_stt(),
        llm=openai.LLM(model="gpt-4o", api_key=settings.openai_api_key),
        tts=elevenlabs.TTS(api_key=settings.elevenlabs_api_key, voice_id=settings.elevenlabs_voice_id),
        allow_interruptions=True,
    )

    start_time = time.monotonic()

    async def _handle_transcript_direct(event) -> None:  # type: ignore[no-untyped-def]
        if not call_id:
            return
        try:
            await push_transcript_turn(
                call_id=call_id,
                speaker=event.speaker,
                text=event.text,
                start_ms=int(event.start_time_ms),
                end_ms=int(event.end_time_ms),
                confidence=float(getattr(event, "confidence", 1.0)),
            )
        except Exception:
            logger.exception("Failed to push transcript turn call_id=%s", call_id)

    @session.on("transcript")
    def on_transcript(event) -> None:  # type: ignore[no-untyped-def]
        asyncio.create_task(_handle_transcript_direct(event))

    await session.start(room=ctx.room, agent=agent)
    await session.generate_reply(instructions=build_opening_instruction(context))

    while time.monotonic() - start_time < settings.max_call_duration_seconds:
        await asyncio.sleep(1)

    await session.generate_reply(instructions=build_timeout_instruction())
    await session.generate_reply(instructions=settings.agent_fallback_text)
    await ctx.shutdown(reason="max_duration_reached")


def run_agent_worker() -> None:
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            ws_url=settings.livekit_url,
            api_key=settings.livekit_api_key,
            api_secret=settings.livekit_api_secret,
            agent_name="phone-ai-agent",
        )
    )


if __name__ == "__main__":
    run_agent_worker()
