import re

from app.core import get_settings
from app.core.logger_setup import logger
from app.model import EnrichmentRequestData
from app.service.gateway.gateway_service import GatewayService
from app.service.extension.request import (
    fetch_and_process_additional_diagnosis, fetch_disease_data,
    fetch_movement_data, fetch_operations_data,
    fetch_patient_discharge_summary, fetch_person_data, fetch_referral_data)
from app.service.extension.utils import (get_bed_profile_code,
                                         get_department_code,
                                         get_department_name,
                                         get_direction_date,
                                         get_disease_type_code,
                                         get_medical_care_condition,
                                         get_medical_care_form,
                                         get_medical_care_profile,
                                         get_outcome_code,
                                         get_referred_organization,
                                         safe_gather)

settings = get_settings()


async def enrich_data(
    enrich_request: EnrichmentRequestData, gateway_service: GatewayService
):
    logger.info("Запрос на обогащение получен.")
    started_data = enrich_request.started_data
    person_id = started_data.get("Person_id")
    event_id = started_data.get("EvnPS_id")
    logger.debug(f"Извлечены данные: person_id={person_id}, event_id={event_id}")

    # person_data = await fetch_person_data(person_id, gateway_service)
    # logger.warning(f"person_data: {person_data}, {type(person_data)})")
    # movement_data = await fetch_movement_data(event_id, gateway_service)
    # logger.warning(f"movement_data: {movement_data}, {type(movement_data)})")
    # referred_data = await fetch_referral_data(event_id, gateway_service)
    # logger.warning(f"referred_data: {referred_data}, {type(referred_data)})")
    # medical_service_data = await fetch_operations_data(event_id, gateway_service)
    # logger.warning(f"medical_service_data: {medical_service_data}, {type(medical_service_data)})")
    # discharge_summary = await fetch_patient_discharge_summary(event_id, gateway_service)
    # logger.warning(f"discharge_summary: {discharge_summary}, {type(discharge_summary)})")


    results = await safe_gather(
        fetch_person_data(person_id, gateway_service),
        fetch_movement_data(event_id, gateway_service),
        fetch_referral_data(event_id, gateway_service),
        fetch_operations_data(event_id, gateway_service),
        fetch_patient_discharge_summary(event_id, gateway_service),
    )
    (
        person_data,
        movement_data,
        referred_data,
        medical_service_data,
        discharge_summary,
    ) = results

    person_data = person_data or {}
    movement_data = movement_data or {}
    referred_data = referred_data or {}
    medical_service_data = medical_service_data or []
    pure_discharge_summary = discharge_summary.get("pure") if discharge_summary else {}

    # если есть данные об операции, то убираем данные о них из эпикриза, что бы не было дублирования,
    # это для случаев когда в эпикризе есть данные об операции, а в медстатистике нет
    if medical_service_data:
        pure_discharge_summary["item_145"] = None

    valid_additional_diagnosis = await fetch_and_process_additional_diagnosis(
        referred_data, gateway_service
    )
    referred_organization = await get_referred_organization(
        referred_data, gateway_service
    )
    disease_data = await fetch_disease_data(movement_data, gateway_service)

    department_name = await get_department_name(started_data)
    department_code = await get_department_code(department_name)

    bed_profile_code, corrected_bed_profile_name = await get_bed_profile_code(
        movement_data, department_name
    )
    medical_care_profile = await get_medical_care_profile(
        movement_data, corrected_bed_profile_name
    )

    polis_number = person_data.get("Person_EdNum", "")
    person_birthday = started_data.get("Person_Birthday", "")
    gender = person_data.get("Sex_Name", "")

    admission_date = started_data.get("EvnPS_setDate")
    direction_date = await get_direction_date(admission_date)
    discharge_date = started_data.get("EvnPS_disDate")

    medical_care_conditions = await get_medical_care_condition(department_name)
    medical_care_form = await get_medical_care_form(referred_data)

    outcome_code = await get_outcome_code(disease_data)

    # todo: подумать, может быть отдельная функция для этого? посмотрим.
    # Обрабатываем случай, когда в ЕВМИАС не указан исход заболевания.
    # если условия оказания медицинской помощи 1 (круглосуточный стационар),
    # то код исхода заболевания должен начинаться с 1xx (см. справочники https://nsi.ffoms.ru/ [V006, V019])
    if medical_care_conditions == "1" and outcome_code == 202:
        outcome_code = "102"

    diag_code = movement_data.get("Diag_Code", "")

    # todo: это костыль, в дальнейшем может быть отдельная функция?
    # меняем профиль медицинской помощи на 'Оториноларингология' код: 20
    # при диагнозах J34.x
    if re.compile(r"^J34\.\d$").match(diag_code):
        medical_care_profile = '20'

    # меняем профиль медицинской помощи на 'Колопроктология' код: 14
    # при диагнозах K60.x - K64.x && D12.x
    if re.compile(r"^K6[0-4]\.\d$").match(diag_code) or re.compile(r"^D12\.\d$").match(diag_code):
        medical_care_profile = '14'


    card_number = started_data.get("EvnPS_NumCard", "").split(" ")[0]
    treatment_outcome_code = movement_data.get("LeaveType_Code")


    disease_type_code = await get_disease_type_code(disease_data)

    enriched_data = {
        "input[name='ReferralHospitalizationNumberTicket']": "б/н",
        "input[name='ReferralHospitalizationDateTicket']": direction_date,
        "input[name='ReferralHospitalizationMedIndications']": "001",
        "input[name='Enp']": polis_number,
        "input[name='DateBirth']": person_birthday,
        "input[name='Gender']": gender,
        "input[name='TreatmentDateStart']": admission_date,
        "input[name='TreatmentDateEnd']": discharge_date,
        "input[name='VidMpV008']": settings.MEDICAL_CARE_TYPE_CODE,
        "input[name='HospitalizationInfoV006']": medical_care_conditions,
        "input[name='HospitalizationInfoV014']": medical_care_form,
        "input[name='HospitalizationInfoSpecializedMedicalProfile']": medical_care_profile,
        "input[name='HospitalizationInfoSubdivision']": "Стационар",
        "input[name='HospitalizationInfoNameDepartment']": department_name,
        "input[name='HospitalizationInfoOfficeCode']": department_code,
        "input[name='HospitalizationInfoV020']": bed_profile_code,
        "input[name='HospitalizationInfoDiagnosisMainDisease']": diag_code,
        "input[name='CardNumber']": card_number,
        "input[name='ResultV009']": treatment_outcome_code,
        "input[name='IshodV012']": outcome_code,
        "input[name='HospitalizationInfoC_ZABV027']": disease_type_code,
        "input[name='ReferralHospitalizationSendingDepartment']": referred_organization,
        "additional_diagnosis_data": valid_additional_diagnosis,
        "medical_service_data": medical_service_data,
        "discharge_summary": pure_discharge_summary,
        "input[name='HospitalizationInfoAddressDepartment']": "Павлика Морозова, д. 6",
    }

    return enriched_data
