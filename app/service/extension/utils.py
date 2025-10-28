import asyncio
from datetime import datetime, timedelta
from typing import Any, Awaitable, Tuple

from app.core import get_settings
from app.core.logger_setup import logger
from app.mapper import (bed_profile_correction_rules, bed_profiles,
                        department_codes, disease_outcome_ids,
                        medical_care_profile,
                        medical_care_profile_correction_rules, medical_orgs)
from app.service.extension.request import fetch_referred_org_by_id
from app.service.gateway.gateway_service import GatewayService

settings = get_settings()


async def safe_gather(*tasks: Awaitable[Any]) -> list[Any | None]:
    """
    Безопасно выполняет несколько асинхронных задач параллельно.

    Каждая задача (coroutine) выполняется через asyncio.gather. Если задача завершилась с исключением,
    оно логируется, а в итоговый список вместо результата добавляется None.

    Это позволяет продолжить выполнение даже если одна или несколько задач упали.

    :param tasks: Набор асинхронных функций (без await).
    :return: Список результатов — либо результат задачи, либо None, если она упала.
    """
    # Выполняем все задачи параллельно, исключения не прерывают выполнение
    results = await asyncio.gather(*tasks, return_exceptions=True)
    clean_results = []

    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.exception(
                f"Задача #{i + 1} завершилась с ошибкой: {type(result).__name__} — {result}"
            )
            clean_results.append(None)
        else:
            clean_results.append(result)

    return clean_results


async def get_referred_organization(
    data: dict, gateway_service: GatewayService
) -> str | None:
    """
    Определяет организацию направившую пациента на госпитализацию, если она указана
    """
    REFERRAL_BY_OTHER_MO = "2"  # noqa
    REFERRAL_BY_DEPARTMENT = "1"  # noqa

    referral_type = str(data.get("PrehospDirect_id"))

    if referral_type == REFERRAL_BY_OTHER_MO:
        org_id = str(data.get("Org_did"))
        if not org_id:
            logger.debug("Org_did отсутствует в данных.")
            return None

        org_info = await fetch_referred_org_by_id(org_id, gateway_service)
        org_name = org_info.get("Org_Name") if org_info else None
        logger.debug(f"Наименование организации направившей госпитализацию: {org_name}")

        if not org_name:
            return None

        org_data = medical_orgs.get(org_name)
        if not org_data:
            logger.warning(
                f"Организация '{org_name}' не найдена в справочнике организаций"
            )
            return None

        return org_data.get("registry_code")

    elif referral_type == REFERRAL_BY_DEPARTMENT:
        return settings.MO_REGISTRY_NUMBER

    return None


async def get_department_name(data: dict) -> str | None:
    """
    Возвращает нормализованное название отделения госпитализации
    """
    raw_name = data.get("LpuSection_Name", "")
    name = raw_name.strip()
    if not name:
        return None

    if name.startswith("ДС"):
        return "Дневной стационар"

    name = name.replace(" стационар ММЦ", "").replace(" ММЦ", "")

    replacements = {
        "Травматолого-ортопедическое отделение": "Травматология",
        "Отделение реабилитации и восстановительного лечения": "Отделение реабилитации",
        "Неврологическое отделение": "Неврология",
        "Гастроэнтерологическое отделение": "Гастроэнтерология",
        "Терапевтическое отделение": "Отделение терапии",
    }
    logger.debug(f"название отделения: {replacements.get(name, name)}")
    return replacements.get(name, name)


async def get_department_code(department_name: str) -> str | None:
    """
    Определяет код отделения госпитализации
    """
    if not department_name:
        logger.warning("Не передано название отделения")
        return None

    code = department_codes.get(department_name)

    if code is None:
        logger.warning(f"Не найден код для отделения: {department_name}")

    return code


async def get_bed_profile_code(
    movement_data: dict, department_name: str
) -> Tuple[str | None, str | None]:
    """
    Возвращает кортеж (код профиля койки, итоговое название профиля койки).
    """
    bed_profile_name = movement_data.get("LpuSectionBedProfile_Name", "")
    diag_code = movement_data.get("Diag_Code", "")

    if not bed_profile_name:
        logger.warning(
            f"Не найден профиль койки для person_id: {movement_data.get('Person_id')},"
        )
        return None, None

    # При необходимости корректируем название профиля койки в соответствии
    # с правилами основными на коде диагноза и имени отделения
    if department_name in [
        "Отделение реабилитации",
        "Хирургическое отделение №1",
        "Хирургическое отделение №2",
        "Дневной стационар",
        "Неврология",
    ]:
        for rule in bed_profile_correction_rules[department_name]:
            if diag_code and rule["pattern"].match(diag_code):
                original_name = bed_profile_name
                bed_profile_name = rule["replacement"]
                logger.info(
                    f"Скорректирован профиль койки для диагноза {diag_code}: с {original_name} на {bed_profile_name}"
                )

    bed_profile_id = bed_profiles.get(bed_profile_name)
    if not bed_profile_id:
        logger.warning(f"Не найден код профиля койки для: {bed_profile_name}")
        return None, bed_profile_name

    logger.debug(
        f"Определяем код профиля койки: {bed_profile_name}, код: {bed_profile_id}"
    )
    return str(bed_profile_id), bed_profile_name


async def get_medical_care_profile(
    data: dict, corrected_bed_profile_name: str | None = None
) -> str | None:
    """
    Определяет код профиля оказания медицинской помощи.
    Сначала проверяет, есть ли правило коррекции на основе профиля койки.
    """
    if corrected_bed_profile_name:
        target_profile_key = medical_care_profile_correction_rules.get(
            corrected_bed_profile_name
        )
        if target_profile_key:
            logger.info(
                f"Применяется правило коррекции: профиль койки '{corrected_bed_profile_name}' "
                f"требует профиль медпомощи '{target_profile_key}'."
            )
            profile_data = medical_care_profile.get(target_profile_key)
            if profile_data and profile_data.get("Code"):
                return profile_data.get("Code")
            else:
                logger.warning(
                    f"Правило коррекции найдено, но ключ '{target_profile_key}' "
                    f"отсутствует или некорректен в справочнике medical_care_profile."
                )

    raw_name = data.get("LpuSectionProfile_Name")
    if not raw_name:
        logger.warning("Профиль медицинской помощи не указан.")
        return None

    profile_key = str(raw_name).lower().strip()
    profile = medical_care_profile.get(profile_key)
    if not profile:
        logger.warning(f"Профиль '{raw_name}' не найден в справочнике.")
        return None

    code = profile.get("Code")
    if not code:
        logger.warning(f"У профиля '{raw_name}' нет кода в справочнике.")
        return None

    logger.debug(f"Определен код профиля: '{raw_name}' -> '{code}'")
    return code


async def get_direction_date(admission_date: str) -> str | None:
    """
    Вычисляет дату направления на госпитализацию, в зависимости от даты госпитализации.
    Это должны быть пн, ср или пт. до даты госпитализации.
    """
    try:
        admission_date = datetime.strptime(admission_date, "%d.%m.%Y")
    except ValueError:
        logger.warning(f"Неверный формат даты: {admission_date}")
        return None
    # Разрешённые дни недели: понедельник (0), среда (2), пятница (4)
    allowed_days = [0, 2, 4]
    # Начинаем с дня до поступления
    for i in range(1, 8):  # максимум неделя в прошлое
        candidate = admission_date - timedelta(days=i)
        if candidate.weekday() in allowed_days:
            return candidate.strftime("%d.%m.%Y")
    return None


async def get_medical_care_condition(lpu_section_name: str) -> str:
    """
    Определяет код условия оказания медицинской помощи, в зависимости от отделения
    """
    inpatient_care = "1"
    day_hospital_care = "2"
    logger.debug(
        f"Определяем условия оказания медицинской помощи. Отделение: {lpu_section_name}"
    )
    return (
        day_hospital_care if lpu_section_name == "Дневной стационар" else inpatient_care
    )


async def get_medical_care_form(data: dict) -> str | None:
    """
    Определяет код формы оказания медицинской помощи, в зависимости от типа госпитализации
    """
    scheduled_hospitalization_code = "3"
    emergency_hospitalization_code = "1"

    raw_medical_care_form_id = data.get("PrehospType_id")
    if raw_medical_care_form_id is None:
        logger.warning("Не найден PrehospDirect_id в данных")
        return None

    medical_care_form_id = str(raw_medical_care_form_id)
    logger.debug(
        f"Определяем код формы медицинской помощи. evmias_id: {medical_care_form_id}"
    )

    match medical_care_form_id:
        case "2":
            return scheduled_hospitalization_code
        case "1" | "3":
            return emergency_hospitalization_code
        case _:
            return None


async def get_outcome_code(disease_data: dict) -> str | None:
    """
    Определяет код исхода лечения
    """
    outcome_code_evmias = disease_data.get("ResultDesease_id")
    outcome_entry = disease_outcome_ids.get(outcome_code_evmias)

    if not outcome_entry:
        logger.warning(
            f"Не найден исход заболевания для evmias_id: {outcome_code_evmias}"
        )
        return None

    outcome_code = outcome_entry.get("code")
    logger.debug(
        f"Определяем код исхода лечения: evmias_id {outcome_code_evmias}, код: {outcome_code}"
    )
    return outcome_code


async def get_disease_type_code(disease_data: dict) -> str | None:
    """
    Определят код характера основного заболевания
    """
    acute = "1"  # острое заболевание
    new_chronic = "2"  # впервые в жизни выявленное хроническое заболевание
    known_chronic = "3"  # ранее установленное хроническое заболевание

    disease_type_code = disease_data.get("DeseaseType_id")
    logger.debug(
        f"Определяем код характера основного заболевания. evmias_id: {disease_type_code}"
    )

    if disease_type_code:
        match disease_type_code:
            case "1":
                return new_chronic
            case "2":
                return known_chronic
            case "3":
                return acute
            case _:
                return None
