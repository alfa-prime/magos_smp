from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field, model_validator


class ExtensionStartedData(BaseModel):
    """Модель для стартовых данных"""

    last_name: str = Field(..., description="Фамилия пациента", examples=["АЛЕЙНИКОВ"])
    start_date: Optional[str] = Field(
        None, description="Дата начала периода в формате YYYY-MM-DD", examples=[""]
    )
    end_date: Optional[str] = Field(
        None, description="Дата окончания периода в формате YYYY-MM-DD", examples=[""]
    )
    dis_date_range: Optional[str] = Field(
        None, description="Диапазон дат госпитализации", examples=[""]
    )

    @model_validator(mode="before")  # noqa
    @classmethod
    def validate_and_format_date_range(cls, data: dict) -> dict:
        start_date = data.get("start_date")
        end_date = data.get("end_date")

        if start_date and end_date:
            try:
                start = datetime.strptime(start_date, "%Y-%m-%d")
                end = datetime.strptime(end_date, "%Y-%m-%d")

                if start > end:
                    raise ValueError("Дата начала не может быть позже даты окончания")

                data["dis_date_range"] = (
                    f"{start.strftime('%d.%m.%Y')} - {end.strftime('%d.%m.%Y')}"
                )
            except ValueError as e:
                raise ValueError(f"Ошибка в диапазоне дат: {e}")

        return data


class EnrichmentRequestData(BaseModel):
    """Модель данных для получения данных от фронтенда"""

    started_data: Dict[str, Any] = Field(
        ..., description="Оригинальные данные о событии/пациенте из ЕВМИАС"
    )
