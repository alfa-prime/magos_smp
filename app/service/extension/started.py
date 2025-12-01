from datetime import datetime
from typing import Any

from app.core import get_settings
from app.model import ExtensionStartedData
from app.service.gateway.gateway_service import GatewayService
from app.service.extension.utils import safe_gather
from app.core.logger_setup import logger
from app.mapper import division_names, DEFAULT_DIVISION_NAME

settings = get_settings()


async def _fetch_data_for_building(
        cid: str,
        patient: ExtensionStartedData,
        search_date_range: str,
        gateway_service: GatewayService
) -> list[dict]:
    """
    Вспомогательная функция для запроса данных по конкретному LpuBuilding_cid.
    """
    payload_dict = {
        "params": {"c": "Search", "m": "searchData"},
        "data": {
            "SearchFormType": "EvnPS",
            "Person_Surname": patient.last_name,
            "PayType_id": settings.SEARCH_PAY_TYPE_ID,
            "LpuBuilding_cid": cid,
            "EvnSection_disDate_Range": search_date_range,
        },
    }

    response = await gateway_service.make_request(method="post", json=payload_dict)

    data = []
    if isinstance(response, dict):
        data = response.get("data", [])

    division_name = division_names.get(cid, DEFAULT_DIVISION_NAME)

    for item in data:
        item["_division_internal_cid"] = cid
        item["_division_name"] = division_name

    return data


async def fetch_started_data(
        patient: ExtensionStartedData, gateway_service: GatewayService
) -> list[Any]:
    """
    Ищет пациентов по всем указанным в настройках подразделениям (LpuBuilding_cid).
    """
    search_date_range = (
            patient.dis_date_range
            or f"{settings.SEARCH_PERIOD_START_DATE} - {datetime.now().strftime('%d.%m.%Y')}"
    )

    # Получаем список ID из настроек
    building_cids = settings.lpu_building_cids_list

    if not building_cids:
        logger.warning("Не заданы LpuBuilding_cid в настройках (.env). Поиск невозможен.")
        return []

    logger.info(f"Запуск поиска пациента '{patient.last_name}' по подразделениям: {building_cids}")

    # Создаем задачи для каждого подразделения
    tasks = [
        _fetch_data_for_building(cid, patient, search_date_range, gateway_service)
        for cid in building_cids
    ]

    # Запускаем параллельно
    results = await safe_gather(*tasks)

    # Объединяем результаты в один плоский список
    combined_data = []
    for batch in results:
        if batch:  # safe_gather возвращает None в случае ошибки, или список словарей при успехе
            combined_data.extend(batch)


    logger.info(f"Всего найдено записей: {len(combined_data)}")
    return combined_data
