import hashlib
import hmac
import base64
from typing import Optional

from fastapi import Header, HTTPException, status
from twilio.request_validator import RequestValidator

from app.core.config import get_settings


def require_api_token(authorization: Optional[str] = Header(default=None)) -> None:
    settings = get_settings()
    expected = f"Bearer {settings.api_auth_token}"
    if authorization != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")


def verify_twilio_signature(url: str, form: dict[str, str], signature: Optional[str]) -> None:
    settings = get_settings()
    if not signature:
        raise HTTPException(status_code=401, detail="Missing Twilio signature")

    validator = RequestValidator(settings.twilio_auth_token)

    if not validator.validate(url, form, signature):
        raise HTTPException(status_code=401, detail="Invalid Twilio signature")


def verify_livekit_signature(body: bytes, signature: Optional[str]) -> None:
    settings = get_settings()
    if not signature:
        raise HTTPException(status_code=401, detail="Missing LiveKit signature")

    digest = hmac.new(
        settings.livekit_webhook_secret.encode("utf-8"),
        body,
        hashlib.sha256,
    ).digest()
    expected = base64.b64encode(digest).decode("utf-8")
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=401, detail="Invalid LiveKit signature")
