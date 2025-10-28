from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    GATEWAY_API_KEY: str
    GATEWAY_URL: str
    GATEWAY_REQUEST_ENDPOINT: str
    REQUEST_TIMEOUT: float = 30.0

    LOGS_LEVEL: str = "DEBUG"

    CORS_ALLOW_REGEX: str = r"^chrome-extension://[a-z]{32}$"

    # === Параметры бизнес-логики приложения === (см. .env)
    MO_REGISTRY_NUMBER: str
    LPU_ID: str
    KSG_YEAR: str
    SEARCH_PERIOD_START_DATE: str
    SEARCH_PAY_TYPE_ID: str
    SEARCH_LPU_BUILDING_CID: str

    MEDICAL_CARE_TYPE_CODE: str

    DEBUG_MODE: bool
    DEBUG_HTTP: bool
    LOGS_LEVEL: str

    TELEGRAM_BOT_TOKEN: Optional[str] = None
    TELEGRAM_CHAT_ID: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()  # noqa
