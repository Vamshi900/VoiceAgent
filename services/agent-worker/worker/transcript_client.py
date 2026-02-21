import httpx

from worker.config import get_settings


async def push_transcript_turn(call_id: str, speaker: str, text: str, start_ms: int, end_ms: int, confidence: float = 1.0) -> None:
    settings = get_settings()
    payload = {
        "call_id": call_id,
        "speaker": speaker,
        "text": text,
        "start_ms": start_ms,
        "end_ms": end_ms,
        "confidence": confidence,
    }
    headers = {"Authorization": f"Bearer {settings.api_auth_token}"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        await client.post(f"{settings.api_base_url}/v1/webhooks/internal/transcript", json=payload, headers=headers)
