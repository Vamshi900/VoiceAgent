"""Bridge between LiveKit agent-worker and Convex intelligence layer.

Handles session lifecycle and intelligence turn routing:
  - create_session: Start a Convex call session
  - send_turn: Route each user utterance to Convex intelligence
  - end_session: Close the Convex session and get summary
"""

import logging
import time as _time

import httpx

from worker.config import get_settings

logger = logging.getLogger("agent-worker.convex")
settings = get_settings()


async def create_session(phone: str, call_type: str = "PROMOTION") -> dict:
    """Create a Convex call session. Returns sessionId, openingLine, centers."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(
            f"{settings.convex_site_url}/session/start",
            json={"prospectPhone": phone, "callType": call_type},
            headers={"Content-Type": "application/json"},
        )
        r.raise_for_status()
        return r.json()


async def send_turn(
    session_id: str,
    utterance: str,
    call_phase: str = "qa",
    is_silence: bool = False,
    metadata: dict | None = None,
) -> dict:
    """Send a user utterance to the Convex intelligence layer.

    Returns agentReply, callPhase, action, actionData, offerState, escalate.
    """
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.post(
            f"{settings.convex_site_url}/intelligence/turn",
            json={
                "sessionId": session_id,
                "utterance": utterance,
                "callPhase": call_phase,
                "isSilence": is_silence,
                "metadata": metadata or {},
            },
            headers={"Content-Type": "application/json"},
        )
        r.raise_for_status()
        return r.json()


async def store_transcript_entry(
    session_id: str,
    role: str,
    text: str,
    turn_number: int | None = None,
) -> None:
    """Append a single transcript entry to the Convex call log."""
    entry: dict = {
        "role": role,
        "text": text,
        "timestamp": int(_time.time() * 1000),
    }
    if turn_number is not None:
        entry["turnNumber"] = turn_number

    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(
            f"{settings.convex_site_url}/transcript/append",
            json={"sessionId": session_id, "entries": [entry]},
            headers={"Content-Type": "application/json"},
        )
        r.raise_for_status()


async def update_session(
    session_id: str,
    **patch: object,
) -> None:
    """Patch Convex session fields (livekitRoomId, callPhase, etc.)."""
    payload: dict = {"sessionId": session_id, **patch}
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(
            f"{settings.convex_site_url}/session/update",
            json=payload,
            headers={"Content-Type": "application/json"},
        )
        r.raise_for_status()


async def end_session(
    session_id: str,
    end_reason: str = "completed",
    final_duration: float | None = None,
) -> dict:
    """End the Convex session. Returns outcome and summary."""
    payload: dict = {"sessionId": session_id, "endReason": end_reason}
    if final_duration is not None:
        payload["finalDuration"] = final_duration

    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(
            f"{settings.convex_site_url}/session/end",
            json=payload,
            headers={"Content-Type": "application/json"},
        )
        r.raise_for_status()
        return r.json()
