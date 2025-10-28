def _sanitize_medical_service_entry(entry: dict) -> dict[str, str]:
    """
    Извлекает ключевые данные из записи об услуге и возвращает
    их в виде структурированного словаря.
    """
    return (
        {
            "code": entry.get("Usluga_Code", "").strip(),
            "name": entry.get("Usluga_Name", "").strip(),
        }
        if entry.get("Usluga_Code")
        else {}
    )


def filter_operations_from_services(
    services: list[dict[str, str]],
) -> list[dict[str, str]]:
    """
    Фильтрует список услуг, оставляя только операции.
    """
    if not isinstance(services, list):
        return []

    operations = []
    for entry in services:
        # EvnUslugaOper — системный идентификатор услуги, которая является операцией
        service_type = entry.get("EvnClass_SysNick", "")
        # todo: жду пример пациента
        # if isinstance(entry, dict) and ("EvnUslugaOper" in service_type or entry.get("Usluga_Code", "") == 'A06.09.005.002' ):
        if isinstance(entry, dict) and "EvnUslugaOper" in service_type:
            sanitized_entry = _sanitize_medical_service_entry(entry)
            if sanitized_entry:
                operations.append(sanitized_entry)

    return operations


def sanitize_additional_diagnosis_entry(entry: dict) -> dict[str, str]:
    """
    Извлекает и очищает ключевые данные из записи о дополнительном диагнозе.
    Возвращает словарь или None, если код диагноза отсутствует.
    """
    return (
        {
            "code": entry.get("Diag_Code", "").strip(),
            "name": entry.get("Diag_Name", "").strip(),
        }
        if entry.get("Diag_Code")
        else {}
    )
