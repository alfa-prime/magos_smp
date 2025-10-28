import re
from datetime import datetime
from typing import Any

from app.core.logger_setup import logger
from app.service.extension.sanitaizer import (
    filter_operations_from_services, sanitize_additional_diagnosis_entry)
from app.service.gateway.gateway_service import GatewayService


async def fetch_person_data(person_id: str, gateway_service: GatewayService) -> dict:
    # Получает основные данные о пациенте по его ID.
    payload = {
        "params": {"c": "Common", "m": "loadPersonData"},
        "data": {"Person_id": person_id, "LoadShort": True, "mode": "PersonInfoPanel"},
    }

    response = await gateway_service.make_request(method="post", json=payload)
    return response[0] if isinstance(response, list) and response else {}


async def fetch_movement_data(
    event_id: str, gateway_service: GatewayService
) -> dict:  # Получает данные о движении пациента в рамках случая госпитализации.
    payload = {
        "params": {"c": "EvnSection", "m": "loadEvnSectionGrid"},
        "data": {"EvnSection_pid": event_id},
    }

    response = await gateway_service.make_request(method="post", json=payload)
    return response[0] if isinstance(response, list) and response else {}


async def fetch_referral_data(event_id: str, gateway_service: GatewayService) -> dict:
    # Получает данные о направлении на госпитализацию.
    payload = {
        "params": {"c": "EvnPS", "m": "loadEvnPSEditForm"},
        "data": {
            "EvnPS_id": event_id,
            "archiveRecord": "0",
            "delDocsView": "0",
            "attrObjects": [{"object": "EvnPSEditWindow", "identField": "EvnPS_id"}],
        },
    }
    response = await gateway_service.make_request(method="post", json=payload)
    return response[0] if isinstance(response, list) and response else {}


# ============== Начало - Получаем только операции (если они есть) из списка оказанных услуг ==============


async def _fetch_all_medical_services(
    event_id: str, gateway_service: GatewayService
) -> list[dict[str, str]]:
    """
    Получает список ВСЕХ оказанных услуг в рамках случая госпитализации.
    """
    payload = {
        "params": {"c": "EvnUsluga", "m": "loadEvnUslugaGrid"},
        "data": {"pid": event_id, "parent": "EvnPS"},
    }
    services = await gateway_service.make_request(method="post", json=payload)

    if not isinstance(services, list):
        logger.warning(
            f"event_id: {event_id}, API услуг вернул не список: {type(services)}"
        )
        return []

    return services


async def fetch_operations_data(
    event_id: str, gateway_service: GatewayService
) -> list[dict[str, str]]:
    """
    Находит и возвращает список операций среди всех услуг,
    оказанных пациенту в рамках госпитализации, если их нет возвращается пустой список.
    """
    services = await _fetch_all_medical_services(event_id, gateway_service)
    operations = filter_operations_from_services(services)

    if operations:
        logger.debug(f"event_id: {event_id}, найдено операций: {len(operations)}")
    else:
        logger.info(
            f"event_id: {event_id}, операции не найдены в списке из {len(services)} услуг."
        )

    return operations


# ============== Конец - Получаем только операции (если они есть) из списка оказанных услуг ==============

# ============== Старт - Получаем выписной эпикриз из ЕВМИАС ============================================


def _clean_html(raw_html):
    """Удаляет HTML-теги, лишние пробелы и переносы строк."""
    if not raw_html:
        return ""
    # Удаляем все HTML-теги
    text = re.sub(r"<.*?>", " ", raw_html)
    # Заменяем множественные пробелы и переносы строк на один пробел
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _combine_parts(*args):
    """Объединяет несколько текстовых частей в одну строку, игнорируя пустые."""
    # Фильтруем пустые или None значения и удаляем лишние пробелы
    valid_parts = [str(part).strip() for part in args if part]
    return " ".join(valid_parts) if valid_parts else None


async def fetch_patient_discharge_summary(
    event_id: str, gateway_service: GatewayService
) -> dict[str, Any] | None:
    # Выполняет многоступенчатый процесс получения и обработки данных из выписного эпикриза.
    logger.info(
        f"Начинаем получать данные из выписного эпикриза для event_id: {event_id}"
    )

    # ===== Шаг 1. Получаем id раздела события для запроса списка медицинских записей =====================
    payload = {
        "params": {"c": "EvnSection", "m": "loadEvnSectionGrid"},
        "data": {"EvnSection_pid": event_id},
    }

    section_data = await gateway_service.make_request(method="post", json=payload)

    if section_data and isinstance(section_data, list):
        event_section_id = section_data[0].get("EvnSection_id", "")
    else:
        event_section_id = None

    if not event_section_id:
        logger.warning(
            f"Не удалось получить EvnSection_id для event_id: {event_id}. Поиск эпикриза прерван."
        )
        return None
    logger.debug(f"Шаг 1/5: Получен EvnSection_id: {event_section_id}")

    # ===== Шаг 2. Получаем список медицинских записей пациента в рамках госпитализации =====================
    payload = {
        "params": {
            "c": "EvnXml6E",
            "m": "loadStacEvnXmlList",
            "_dc": datetime.now().timestamp(),
        },
        "data": {"Evn_id": event_section_id},
    }
    medical_records = await gateway_service.make_request(method="post", json=payload)

    if not isinstance(medical_records, list):
        logger.warning(
            f"API вернул не список медицинских записей: {type(medical_records)}. Поиск эпикриза прерван."
        )
        return None
    logger.debug(f"Шаг 2/5: Получено {len(medical_records)} медицинских записей")

    # ===== Шаг 3. Получаем из списка медицинских записей непосредственно сам выписной эпикриз =====================
    discharge_summary_entry = None
    for entry in medical_records:
        if (entry.get("XmlType_Name") == "Эпикриз") and (
            entry.get("XmlTypeKind_Name") == "Выписной"
        ):
            discharge_summary_entry = entry
            break

    if not discharge_summary_entry:
        logger.info(
            f"Не удалось найти выписной эпикриз для event_id: {event_id} среди {len(medical_records)} записей."
        )
        return None
    logger.debug("Шаг 3/5: Найден выписной эпикриз")

    # ===== Шаг 4. Получаем 'сырые' данные выписного эпикриза =====================
    payload = {
        "params": {
            "c": "XmlTemplate6E",
            "m": "getXmlTemplateForEvnXml",
            "_dc": datetime.now().timestamp(),
        },
        "data": {
            "Evn_id": discharge_summary_entry.get("EvnXml_pid", ""),
            "EvnXml_id": discharge_summary_entry.get("EMDRegistry_ObjectID", ""),
        },
    }

    if not all(payload["data"].values()):
        logger.warning(
            f"В записи эпикриза отсутствуют необходимые id: {payload['data']}. Поиск эпикриза прерван."
        )
        return None

    raw_discharge_summary_data = await gateway_service.make_request(
        method="post", json=payload
    )

    if (
        not isinstance(raw_discharge_summary_data, dict)
        or "xmlData" not in raw_discharge_summary_data
    ):
        logger.warning(
            f"Получены некорректные сырые данные для эпикриза: {raw_discharge_summary_data}."
        )
        return None
    logger.debug("Шаг 4/5: Получены сырые данные для выписного эпикриза.")

    # ===== Шаг 5. Извлекаем и структурируем необходимые данные по выписному эпикризу =====================
    xml_data = raw_discharge_summary_data.get("xmlData", {})
    template_raw = raw_discharge_summary_data.get("template", "")

    # -- Определяем все возможные заголовки и "стоп-слова" --
    # Возможные заголовки для каждого блока (через | для regex)
    LABELS_PRIMARY = r"Диагноз основной|Основное заболевание"  # noqa
    LABELS_COMPLICATION = r"Осложнения основного заболевания|Осложнения"  # noqa
    LABELS_CONCOMITANT = r"Сопутствующие заболевания"  # noqa

    # Все возможные заголовки, которые могут идти *после* наших блоков. Они служат "якорями" конца.
    STOP_LABELS = [  # noqa
        LABELS_COMPLICATION,
        LABELS_CONCOMITANT,
        r"Внешняя причина при травмах",
        r"Дополнительные сведения о заболевании",
        r"@#@ОсложненияОсновногоДиагнозаДвижРасш",
        r"ОсновногоДиагнозаДвижРасш",
        r"@#@СопутствующиеДиагнозы",
        r"@#@КодОсновногоДиагнозаДвижения",
        r"Состояние при поступлении:",
        r"основного: ",
        r"@#@НаименованиеОсновногоДиагнозаДвижения",
    ]
    # Объединяем все стоп-заголовки в один паттерн для поиска конца блока
    STOP_PATTERN = r"(?:" + "|".join(STOP_LABELS) + r")"  # noqa

    def extract_raw_section(template, start_labels_pattern):
        """Извлекает сырое содержимое блока между его заголовком и следующим известным заголовком."""
        # Паттерн: (группа 1: заголовок) \s*:? (группа 2: содержимое) (?= группа 3: следующий заголовок или конец строки)
        pattern = rf"({start_labels_pattern})\s*:?\s*(.*?)(?={STOP_PATTERN}|$)"
        match = re.search(pattern, template, re.DOTALL | re.IGNORECASE)
        return match.group(2).strip() if match else ""

    # -- Извлекаем сырое содержимое для каждого блока --

    raw_primary = extract_raw_section(template_raw, LABELS_PRIMARY)
    raw_complication = extract_raw_section(template_raw, LABELS_COMPLICATION)
    raw_concomitant = extract_raw_section(template_raw, LABELS_CONCOMITANT)

    # -- Извлекаем текст и значения маркеров из сырых блоков --

    marker_pattern = r"@#@([\w\d]+)@#@"

    # Обработка основного диагноза
    primary_text = _clean_html(re.sub(marker_pattern, "", raw_primary))
    primary_markers = [
        xml_data.get(marker_name)
        for marker_name in re.findall(marker_pattern, raw_primary)
    ]
    primary_diagnosis = _combine_parts(primary_text, *primary_markers)

    # Обработка осложнений
    complication_text = _clean_html(re.sub(marker_pattern, "", raw_complication))
    complication_markers = [
        xml_data.get(marker_name)
        for marker_name in re.findall(marker_pattern, raw_complication)
    ]
    primary_complication = _combine_parts(complication_text, *complication_markers)
    if primary_complication:
        primary_complication = primary_complication.replace(
            "Сахарный диабет", "<b>Сахарный диабет</b>"
        )

    # Обработка сопутствующих
    concomitant_text = _clean_html(re.sub(marker_pattern, "", raw_concomitant))
    concomitant_markers = [
        xml_data.get(marker_name)
        for marker_name in re.findall(marker_pattern, raw_concomitant)
    ]
    concomitant_diseases = _combine_parts(concomitant_text, *concomitant_markers)
    if concomitant_diseases:
        concomitant_diseases = concomitant_diseases.replace(
            "Сахарный диабет", "<b>Сахарный диабет</b>"
        )

    diagnos = xml_data.get("diagnos")
    if diagnos:
        diagnos = diagnos.replace("Сахарный диабет", "<b>Сахарный диабет</b>")

    item_659 = xml_data.get("specMarker_659")
    if item_659:
        item_659 = item_659.replace("Сахарный диабет", "<b>Сахарный диабет</b>")

    result = {
        "pure": {
            "diagnos": diagnos,
            "primary_diagnosis": primary_diagnosis,
            "primary_complication": primary_complication,
            "concomitant_diseases": concomitant_diseases,
            "item_90": xml_data.get("specMarker_90"),
            "item_94": xml_data.get("specMarker_94"),
            "item_272": xml_data.get("specMarker_272"),
            "item_284": xml_data.get("specMarker_284"),
            "item_659": item_659,
            "item_145": xml_data.get("specMarker_145"),
            "AdditionalInf": xml_data.get("AdditionalInf"),
        },
        "raw": raw_discharge_summary_data,
    }

    logger.info(f"Эпикриз успешно обработан для event_id: {event_id}.")
    return result


# ============== Конец - Получаем выписной эпикриз из ЕВМИАС ============================================


# ============== Начало - Получаем дополнительные диагнозы (если они есть) из движения в ЕВМИАС ==========
async def _fetch_raw_diagnosis_list(
    diagnosis_id: str, gateway_service: GatewayService
) -> list[dict[str, str]]:
    """
    Получает "сырой" список диагнозов от API.
    """
    payload = {
        "params": {"c": "EvnDiag", "m": "loadEvnDiagPSGrid"},
        "data": {"class": "EvnDiagPSSect", "EvnDiagPS_pid": diagnosis_id},
    }

    diagnosis_list = await gateway_service.make_request(method="post", json=payload)

    if not isinstance(diagnosis_list, list):
        logger.warning(
            f"EvnSection_id: {diagnosis_id}, API вернул не список: {type(diagnosis_list)}"
        )
        return []
    return diagnosis_list


def _process_diagnosis_list(
    diagnosis_list: list[dict[str, Any]],
) -> list[dict[str, str]]:
    """
    Обрабатывает "сырой" список диагнозов, очищая каждый элемент.
    Использует list comprehension для краткости и эффективности.
    """
    if not isinstance(diagnosis_list, list):
        return []

    # Это списковое включение делает то же, что и ваш цикл for, но в одну строку.
    # Оно проходит по каждому 'entry', вызывает 'sanitize...', и если результат не None,
    # добавляет его в новый список.
    return [
        sanitized
        for entry in diagnosis_list
        if (sanitized := sanitize_additional_diagnosis_entry(entry))
    ]


async def _fetch_additional_diagnosis(
    diagnosis_id: str, gateway_service: GatewayService
) -> list[dict[str, str]]:
    """
    Получает список дополнительных диагнозов из движения в ЕВМИАС, если они есть,
    и возвращает их в виде списка словарей.
    """
    if not diagnosis_id:
        logger.info(
            "Отсутствует ID для запроса дополнительных диагнозов (diagnosis_id)."
        )
        return []

    raw_diagnosis_list = await _fetch_raw_diagnosis_list(diagnosis_id, gateway_service)
    processed_diagnoses = _process_diagnosis_list(raw_diagnosis_list)

    if processed_diagnoses:
        logger.debug(
            f"EvnSection_id: {diagnosis_id}, найдено доп. диагнозов: {len(processed_diagnoses)}"
        )
    else:
        logger.info(f"EvnSection_id: {diagnosis_id}, доп. диагнозы не найдены")

    return processed_diagnoses


async def _get_valid_additional_diagnosis(data: list) -> list[dict[str, str | Any]]:
    """
    Фильтрует дополнительные диагнозы по МКБ:
    - E10/E11 (сахарный диабет)
    - Cxx.x (злокачественные новообразования)

    Всегда возвращает список (может быть пустым).
    """
    if not data:
        return []

    # ^(...|...)$ - ищет соответствие одному из шаблонов от начала до конца строки
    # E(10|11)\.\d - шаблон для диабета (например, E10.1, E11.9)
    # C\d{2}\.\d   - шаблон для онкологии (например, C50.1, C18.7)
    diagnosis_pattern = re.compile(r"^(E(10|11)\.\d|C\d{2}\.\d)$")
    valid_diagnosis = []

    for entry in data:
        diagnosis_code = entry.get("code")
        diagnosis_name = entry.get("name")

        if isinstance(diagnosis_code, str) and diagnosis_pattern.match(diagnosis_code):
            valid_diagnosis.append({"code": diagnosis_code, "name": diagnosis_name})

    return valid_diagnosis


async def fetch_and_process_additional_diagnosis(
    referred_data: dict[str, Any] | None, gateway_service: GatewayService
) -> list[dict[str, str]]:
    """
    Получает и фильтрует дополнительные диагнозы по МКБ E10/E11 (сахарный диабет)..
    """
    if not referred_data:
        logger.info(
            "Нет данных о направлении (referred_data), пропускаем запрос доп. диагнозов."
        )
        return []

    evn_section_id = referred_data.get("ChildEvnSection_id")
    if not evn_section_id:
        logger.warning(
            "В данных о направлении отсутствует ChildEvnSection_id, невозможно получить доп. диагнозы."
        )
        return []

    logger.debug(
        f"Запрашиваем дополнительные диагнозы для evn_section_id: {evn_section_id}"
    )
    additional_diagnosis_data = await _fetch_additional_diagnosis(
        evn_section_id, gateway_service
    )

    valid_additional_diagnosis = await _get_valid_additional_diagnosis(
        additional_diagnosis_data
    )
    logger.info(
        f"Найдено {len(valid_additional_diagnosis)} валидных доп. диагнозов по фильтру."
    )

    return valid_additional_diagnosis


# ============== Конец - Получаем дополнительные диагнозы (если они есть) из движения в ЕВМИАС ==========


async def fetch_referred_org_by_id(
    org_id: str, gateway_service: GatewayService
) -> dict:
    """
    Получает информацию о направившей организации по её ID.
    """
    payload = {"params": {"c": "Org", "m": "getOrgList"}, "data": {"Org_id": org_id}}

    response_json = await gateway_service.make_request(method="post", json=payload)
    return response_json[0] if isinstance(response_json, list) and response_json else {}


async def fetch_disease_data(data: dict, gateway_service: GatewayService) -> dict:
    """
    Загружает данные о заболевании из раздела случая госпитализации.
    """
    event_section_id = data.get("EvnSection_id", "")

    payload = {
        "params": {"c": "EvnSection", "m": "loadEvnSectionEditForm"},
        "data": {
            "EvnSection_id": event_section_id,
            "archiveRecord": "0",
            "attrObjects": [
                {"object": "EvnSectionEditWindow", "identField": "EvnSection_id"}
            ],
        },
    }

    response = await gateway_service.make_request(method="post", json=payload)

    if not isinstance(response, dict):
        return {}

    fields_data = response.get("fieldsData", [])
    return fields_data[0] if isinstance(fields_data, list) and fields_data else {}
