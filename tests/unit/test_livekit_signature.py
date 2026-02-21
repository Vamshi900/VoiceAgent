import base64
import hashlib
import hmac

import pytest


def test_livekit_signature_validation(monkeypatch: pytest.MonkeyPatch) -> None:
    pytest.importorskip("pydantic")

    monkeypatch.setenv("LIVEKIT_WEBHOOK_SECRET", "secret")
    monkeypatch.setenv("API_AUTH_TOKEN", "x")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///tmp.db")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("LIVEKIT_URL", "http://localhost:7880")
    monkeypatch.setenv("LIVEKIT_API_KEY", "key")
    monkeypatch.setenv("LIVEKIT_API_SECRET", "secret")
    monkeypatch.setenv("LIVEKIT_SIP_TRUNK_ID", "trunk")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "token")
    monkeypatch.setenv("TWILIO_PHONE_NUMBER", "+15555550123")
    monkeypatch.setenv("OPENAI_API_KEY", "k")
    monkeypatch.setenv("ELEVENLABS_API_KEY", "k")
    monkeypatch.setenv("ELEVENLABS_VOICE_ID", "v")

    from app.core.config import get_settings
    from app.core.security import verify_livekit_signature
    from fastapi import HTTPException

    get_settings.cache_clear()
    body = b'{"event":"participant_joined"}'
    signature = base64.b64encode(hmac.new(b"secret", body, hashlib.sha256).digest()).decode("utf-8")
    verify_livekit_signature(body, signature)

    with pytest.raises(HTTPException):
        verify_livekit_signature(body, "bad")
