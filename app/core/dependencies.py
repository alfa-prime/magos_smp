from typing import Annotated, Optional

import httpx
from fastapi import Depends, HTTPException, Request, Security, status
from fastapi.security import APIKeyHeader

from app.core import get_settings
from app.service.gateway.gateway_service import GatewayService

API_KEY_HEADER_SCHEME = APIKeyHeader(name="X-API-KEY", auto_error=False)
settings = get_settings()


async def get_base_http_client(request: Request) -> httpx.AsyncClient:
    return request.app.state.gateway_client


async def get_gateway_service(
    client: Annotated[httpx.AsyncClient, Depends(get_base_http_client)],
) -> GatewayService:
    return GatewayService(client=client)


async def check_api_key(api_key: Optional[str] = Security(API_KEY_HEADER_SCHEME)):
    if api_key and api_key == settings.GATEWAY_API_KEY:
        return api_key

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={
            "error": "Authentication Failed",
            "message": "The provided X-API-KEY is missing or invalid.",
            "remedy": "Please include a valid 'X-API-KEY' header in your request.",
        },
    )
