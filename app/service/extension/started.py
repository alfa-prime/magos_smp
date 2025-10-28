from datetime import datetime

from app.core import get_settings
from app.model import ExtensionStartedData
from app.service.gateway.gateway_service import GatewayService

settings = get_settings()


async def fetch_started_data(
    patient: ExtensionStartedData, gateway_service: GatewayService
):
    search_date_range = (
        patient.dis_date_range
        or f"{settings.SEARCH_PERIOD_START_DATE} - {datetime.now().strftime('%d.%m.%Y')}"
    )

    payload_dict = {
        "params": {"c": "Search", "m": "searchData"},
        "data": {
            "SearchFormType": "EvnPS",
            "Person_Surname": patient.last_name,
            "PayType_id": settings.SEARCH_PAY_TYPE_ID,
            "LpuBuilding_cid": settings.SEARCH_LPU_BUILDING_CID,
            "EvnSection_disDate_Range": search_date_range,
        },
    }

    response = await gateway_service.make_request(method="post", json=payload_dict)
    return response.get("data", [])
