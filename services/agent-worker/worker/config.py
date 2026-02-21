from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    api_auth_token: str = Field(alias="API_AUTH_TOKEN")
    api_base_url: str = Field(default="http://api:8000")

    livekit_url: str = Field(alias="LIVEKIT_WS_URL")
    livekit_api_key: str = Field(alias="LIVEKIT_API_KEY")
    livekit_api_secret: str = Field(alias="LIVEKIT_API_SECRET")

    openai_api_key: str = Field(alias="OPENAI_API_KEY")
    openai_model: str = Field(alias="OPENAI_MODEL", default="gpt-4o-mini")
    whisper_base_url: str = Field(alias="WHISPER_BASE_URL", default="http://host.docker.internal:8001/v1")
    whisper_api_key: str = Field(alias="WHISPER_API_KEY", default="local-whisper")
    whisper_model: str = Field(alias="WHISPER_MODEL", default="whisper-1")
    elevenlabs_api_key: str = Field(alias="ELEVENLABS_API_KEY")
    elevenlabs_voice_id: str = Field(alias="ELEVENLABS_VOICE_ID")

    max_call_duration_seconds: int = Field(alias="MAX_CALL_DURATION_SECONDS", default=900)
    agent_fallback_text: str = Field(alias="AGENT_FALLBACK_TEXT", default="Please try again later.")


@lru_cache
def get_settings() -> Settings:
    return Settings()
