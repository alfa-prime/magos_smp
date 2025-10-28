from typing import Annotated

from fastapi import APIRouter, Depends

from app.core import check_api_key, get_gateway_service
from app.model import GatewayRequest
from app.service import GatewayService

router = APIRouter(
    prefix="/health", tags=["Проверка здоровья"], dependencies=[Depends(check_api_key)]
)


@router.get(
    path="/ping",
    summary="Стандартная проверка работоспособности",
    description="Возвращает 'pong', если сервис запущен и отвечает на запросы.",
)
async def check():
    return {"ping": "pong"}


@router.post(
    path="/gateway",
    summary="Проверка связи со шлюзом API",
    description="Отправляет тестовый запрос на API-шлюз для проверки связи и аутентификации.",
)
async def check_gateway_connection(
    gateway_service: Annotated[GatewayService, Depends(get_gateway_service)],
):
    payload_dict = {
        "params": {"c": "Common", "m": "getCurrentDateTime"},
        "data": {"is_activerulles": "true"},
    }

    validated_payload = GatewayRequest.model_validate(payload_dict)

    response = await gateway_service.make_request(
        method="post", json=validated_payload.model_dump()
    )

    return response
