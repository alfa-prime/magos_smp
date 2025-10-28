import httpx

from app.core.logger_setup import logger

from .config import get_settings

settings = get_settings()

IS_CONFIGURED = settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID

if IS_CONFIGURED:
    TELEGRAM_URL = (
        f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
    )
    logger.info("Уведомления в Telegram включены.")
else:
    logger.warning("Токен или ID чата для Telegram не заданы. Уведомления отключены.")


async def send_telegram_alert(message: str):
    if not IS_CONFIGURED:
        return

    max_length = 4096
    if len(message) > max_length:
        message = message[: max_length - 10] + "\n...(Обрезано)"

    payload = {
        "chat_id": settings.TELEGRAM_CHAT_ID,
        "text": message,
        "parse_mode": "HTML",
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(TELEGRAM_URL, json=payload, timeout=10)
            response.raise_for_status()
        logger.debug("Уведомление в Telegram успешно отправлено.")
    except httpx.RequestError as e:
        logger.error(f"Не удалось отправить уведомление в Telegram (ошибка сети): {e}")
    except httpx.HTTPStatusError as e:
        logger.error(
            f"Telegram API вернул ошибку: {e.response.status_code} - {e.response.text}"
        )
    except Exception as e:
        logger.error(f"Непредвиденная ошибка при отправке уведомления в Telegram: {e}")
