from typing import Annotated, Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status

from app.core import get_gateway_service, get_settings, logger, route_handler
from app.model import EnrichmentRequestData, ExtensionStartedData
from app.service import GatewayService, enrich_data, fetch_started_data

settings = get_settings()
router = APIRouter(prefix="/extension", tags=["Расширение"])


@router.post(
    path="/search",
    summary="Получить список пациентов по фильтру",
    description="Получить список пациентов по фильтру",
)
@route_handler(debug=True)
async def search_patients_hospitals(
        patient: ExtensionStartedData,
        gateway_service: Annotated[GatewayService, Depends(get_gateway_service)],
):
    logger.info("Запрос на поиск пациентов")
    result = await fetch_started_data(patient, gateway_service)

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Данные не найдены"
        )
    return result


@router.post(
    path="/enrich-data",
    summary="Обогатить данные для фронта",
    description="Обогатить данные для фронта",
    response_model=Dict[str, Any],
)
@route_handler(debug=True)
async def enrich_started_data_for_front(
        enrich_request: EnrichmentRequestData,
        gateway_service: Annotated[GatewayService, Depends(get_gateway_service)],
) -> Dict[str, Any]:
    logger.info("Обащение данных для фронта")
    result = await enrich_data(enrich_request, gateway_service)

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Не удалось обогатить данные"
        )
    return result
