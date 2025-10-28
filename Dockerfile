# Этап 1: Builder с созданием venv
FROM python:3.10 AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Создаем venv
RUN python -m venv /opt/venv
# Активируем его для последующих команд в этом слое
ENV PATH="/opt/venv/bin:$PATH"

# Копируем только requirements.txt для кэширования
WORKDIR /code
COPY requirements.txt .

# Устанавливаем зависимости в venv
RUN pip install --no-cache-dir -r requirements.txt

# Этап 2: Финальный образ
FROM python:3.10-slim

# -----------------------------------------------------------------------------
# ИЗМЕНЕНИЕ ИСТОЧНИКОВ ПАКЕТОВ (РЕПОЗИТОРИЕВ) APT
# -----------------------------------------------------------------------------
# Стандартные репозитории deb.debian.org могут быть недоступны из-за сетевых
# ограничений или проблем с DNS в Docker.
# Эта команда полностью заменяет стандартные адреса на зеркала от Яндекса,
# которые обеспечивают стабильный доступ.
#
# 1. Первая строка с `>` полностью перезаписывает файл /etc/apt/sources.list,
#    добавляя основной репозиторий пакетов.
# 2. Вторая строка с `>>` добавляет в конец файла репозиторий с обновлениями.
# 3. Третья строка с `>>` добавляет официальный репозиторий для обновлений безопасности.
# -----------------------------------------------------------------------------
RUN echo "deb http://mirror.yandex.ru/debian/ trixie main" > /etc/apt/sources.list && \
    echo "deb http://mirror.yandex.ru/debian/ trixie-updates main" >> /etc/apt/sources.list && \
    echo "deb http://security.debian.org/debian-security trixie-security main" >> /etc/apt/sources.list


# Установка локалей
RUN rm -rf /var/lib/apt/lists/* && \
 apt-get update && apt-get install -y --no-install-recommends locales \
 && sed -i '/ru_RU.UTF-8/s/^# //g' /etc/locale.gen \
 && locale-gen ru_RU.UTF-8 \
 && rm -rf /var/lib/apt/lists/*

ENV LANG=ru_RU.UTF-8 \
    LC_ALL=ru_RU.UTF-8 \
    PYTHONIOENCODING=utf-8 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Копируем venv из builder'а
COPY --from=builder /opt/venv /opt/venv

# Устанавливаем рабочую директорию
WORKDIR /code

# Копируем код приложения
COPY ./app /code/app

# Указываем PATH на venv, чтобы система знала, где искать uvicorn
ENV PATH="/opt/venv/bin:$PATH"

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]