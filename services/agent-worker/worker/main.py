"""LiveKit agent-worker with Convex intelligence layer.

Voice pipeline: Whisper STT → Convex Intelligence → ElevenLabs TTS
The Convex intelligence layer handles CVS booking agent logic, tools,
state management, and operator instructions.
"""

import asyncio
import inspect
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
    from livekit.plugins import elevenlabs, openai
except Exception as exc:
    logger.exception("Failed importing livekit agent packages: %s", exc)
    raise


def build_local_whisper_stt() -> object:
    params = inspect.signature(openai.STT).parameters
    kwargs: dict[str, object] = {}

    if "model" in params:
        kwargs["model"] = settings.whisper_model
    if "api_key" in params:
        kwargs["api_key"] = settings.whisper_api_key
    if settings.whisper_base_url and "base_url" in params:
        kwargs["base_url"] = settings.whisper_base_url
    elif settings.whisper_base_url and "client_options" in params:
        kwargs["client_options"] = {"base_url": settings.whisper_base_url}
    else:
        logger.warning("openai.STT does not expose base_url/client_options; local whisper endpoint may be ignored")

    logger.info("Configuring STT for local Whisper endpoint=%s model=%s", settings.whisper_base_url, settings.whisper_model)
    return openai.STT(**kwargs)


async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect()
    participant = await ctx.wait_for_participant()
    attrs = participant.attributes or {}
    call_id = attrs.get("call_id", "")
    phone_number = attrs.get("phone_number", "")
    convex_session_id = attrs.get("convex_session_id", "")
    context_blob = attrs.get("context_json", "{}")
    try:
        context = json.loads(context_blob) if isinstance(context_blob, str) else context_blob
    except Exception:
        context = {}

    logger.info(
        "Starting agent for room=%s participant=%s call_id=%s convex_session=%s",
        ctx.room.name, participant.identity, call_id, convex_session_id,
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
    """
    logger.info("Running in Convex intelligence mode, session=%s", convex_session_id)

    # Build system prompt — uses CVS booking prompt + context from Convex
    system_prompt = compose_system_prompt(context)
    agent = Agent(instructions=system_prompt)

    session = AgentSession(
        stt=build_local_whisper_stt(),
        llm=openai.LLM(model=settings.openai_model, api_key=settings.openai_api_key),
        tts=elevenlabs.TTS(api_key=settings.elevenlabs_api_key, voice_id=settings.elevenlabs_voice_id),
        allow_interruptions=True,
    )

    start_time = time.monotonic()
    turn_count = 0
    current_phase = "opening"

    @session.on("transcript")
    async def on_transcript(event) -> None:  # type: ignore[no-untyped-def]
        nonlocal turn_count, current_phase

        # Push transcript to Python API (for PostgreSQL storage)
        if call_id:
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
                logger.exception("Failed to push transcript to API call_id=%s", call_id)

        # Route user speech through Convex intelligence
        if event.speaker == "user":
            turn_count += 1
            try:
                result = await convex_bridge.send_turn(
                    session_id=convex_session_id,
                    utterance=event.text,
                    call_phase=current_phase,
                    metadata={
                        "callDuration": int(time.monotonic() - start_time),
                        "turnId": f"turn-{turn_count}",
                    },
                )

                # Update phase from Convex
                if result.get("callPhase"):
                    current_phase = result["callPhase"]

                # Check for actions from Convex intelligence
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

                # If Convex returns a specific agent reply, inject it
                agent_reply = result.get("agentReply", "")
                if agent_reply:
                    await session.generate_reply(instructions=f"Say exactly: {agent_reply}")

            except Exception:
                logger.exception("Convex intelligence turn failed, session=%s", convex_session_id)

    await session.start(room=ctx.room, agent=agent)

    # Speak the opening line
    await session.generate_reply(instructions=build_opening_instruction(context))

    # Main loop — wait for max duration
    while time.monotonic() - start_time < settings.max_call_duration_seconds:
        await asyncio.sleep(1)

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
        stt=build_local_whisper_stt(),
        llm=openai.LLM(model=settings.openai_model, api_key=settings.openai_api_key),
        tts=elevenlabs.TTS(api_key=settings.elevenlabs_api_key, voice_id=settings.elevenlabs_voice_id),
        allow_interruptions=True,
    )

    start_time = time.monotonic()

    @session.on("transcript")
    async def on_transcript(event) -> None:  # type: ignore[no-untyped-def]
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
