import httpx
from fastapi import FastAPI

from app.core.logger_setup import logger

from .config import get_settings


async def init_gateway_client(app: FastAPI):
    """
    Создает экземпляр HTTPX клиента и сохраняет его в app.state.
    """
    settings = get_settings()
    gateway_client = httpx.AsyncClient(
        base_url=settings.GATEWAY_URL,
        headers={"X-API-KEY": settings.GATEWAY_API_KEY},
        timeout=settings.REQUEST_TIMEOUT,
    )
    app.state.gateway_client = gateway_client
    logger.info(f"Gateway client initialized for base_url: {settings.GATEWAY_URL}")


async def shutdown_gateway_client(app: FastAPI):
    """
    Закрывает HTTPX клиент.
    """
    if hasattr(app.state, "gateway_client"):
        await app.state.gateway_client.aclose()
        logger.info("Gateway client closed.")
