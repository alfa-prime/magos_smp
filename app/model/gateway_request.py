# Модель запроса к шлюзу API

from typing import Any, Dict

from pydantic import BaseModel, Field


class RequestParams(BaseModel):
    c: str = Field(..., description="Класс")
    m: str = Field(..., description="Метод")


class GatewayRequest(BaseModel):
    params: RequestParams
    data: Dict[str, Any]
