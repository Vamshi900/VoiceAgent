from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "development"
    api_auth_token: str = Field(alias="API_AUTH_TOKEN")

    database_url: str = Field(alias="DATABASE_URL")
    redis_url: str = Field(alias="REDIS_URL")

    livekit_url: str = Field(alias="LIVEKIT_URL")
    livekit_api_key: str = Field(alias="LIVEKIT_API_KEY")
    livekit_api_secret: str = Field(alias="LIVEKIT_API_SECRET")
    livekit_sip_trunk_id: str = Field(alias="LIVEKIT_SIP_TRUNK_ID")
    livekit_webhook_secret: str = Field(alias="LIVEKIT_WEBHOOK_SECRET")
    livekit_default_room_prefix: str = Field(alias="LIVEKIT_DEFAULT_ROOM_PREFIX", default="call")

    twilio_auth_token: str = Field(alias="TWILIO_AUTH_TOKEN")
    twilio_phone_number: str = Field(alias="TWILIO_PHONE_NUMBER")

    openai_api_key: str = Field(alias="OPENAI_API_KEY")
    openai_model: str = Field(alias="OPENAI_MODEL", default="gpt-4o-mini")
    whisper_base_url: str = Field(alias="WHISPER_BASE_URL", default="")
    whisper_model: str = Field(alias="WHISPER_MODEL", default="whisper-1")
    elevenlabs_api_key: str = Field(alias="ELEVENLABS_API_KEY")
    elevenlabs_voice_id: str = Field(alias="ELEVENLABS_VOICE_ID")

    transcript_retention_days: int = Field(alias="TRANSCRIPT_RETENTION_DAYS", default=30)
    max_call_duration_seconds: int = Field(alias="MAX_CALL_DURATION_SECONDS", default=900)
    agent_fallback_text: str = Field(alias="AGENT_FALLBACK_TEXT", default="Please try again shortly.")


@lru_cache
def get_settings() -> Settings:
    return Settings()
