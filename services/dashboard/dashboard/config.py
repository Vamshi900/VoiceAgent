from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    api_base_url: str = Field(default="http://api:8000")
    api_auth_token: str = Field(alias="API_AUTH_TOKEN")
    dashboard_username: str = Field(alias="DASHBOARD_USERNAME", default="admin")
    dashboard_password: str = Field(alias="DASHBOARD_PASSWORD")


@lru_cache
def get_settings() -> Settings:
    return Settings()
