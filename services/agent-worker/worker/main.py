import asyncio
import inspect
import json
import logging
import time

from pythonjsonlogger import jsonlogger

from worker.config import get_settings
from worker.prompts import build_opening_instruction, build_timeout_instruction, compose_system_prompt
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
    context_blob = attrs.get("context_json", "{}")
    try:
        context = json.loads(context_blob) if isinstance(context_blob, str) else context_blob
    except Exception:
        context = {}

    logger.info("Starting agent for room=%s participant=%s call_id=%s", ctx.room.name, participant.identity, call_id)

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
