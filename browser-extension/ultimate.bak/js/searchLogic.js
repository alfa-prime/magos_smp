// browser-extension/js/searchLogic.js

import * as ui from "./ui.js";
import * as api from "./apiService.js";

const resultsList = document.getElementById("results");

export async function searchPatient() {
  const lastName = document.getElementById("lastname").value.trim();
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;

  ui.clearUserMessages();
  ui.clearResultsList();
  ui.showLoading();
  ui.setSearchButtonState(false, "Поиск...");

  if (startDate > endDate) {
    ui.showUserError("Дата начала не может быть позже даты окончания");
    return;
  }
  if (!lastName) {
    ui.showUserError("Фамилия обязательна");
    return;
  }

  const searchPayload = {
    last_name: lastName,
    start_date: startDate,
    end_date: endDate,
  };

  try {
    const results = await api.fetchSearchResults(searchPayload);
    if (!Array.isArray(results)) {
      console.error("[SearchLogic] API поиска вернул не массив:", results);
      throw new Error("Получен некорректный формат данных от сервера поиска.");
    }

    if (results.length === 0) {
      ui.showUserMessage("Записи не найдены", "info");
      return;
    }

    ui.hideLoading();
    ui.setSearchButtonState(true, "Искать");

    results.forEach((item) => {
      const person =
        `${item.Person_Surname || ""} ${item.Person_Firname || ""} ${item.Person_Secname || ""} (${item.Person_Birthday || "N/A"})`.trim();
      const card = item.EvnPS_NumCard || "N/A";
      const hospDate = item.EvnPS_setDate || "N/A";

      const li = document.createElement("li");
      li.innerHTML = `
                <div><strong>${person}</strong></div>
                <div><br></div>
                <div>Номер карты: ${card}</div>
                <div>Дата госпитализации: ${hospDate}</div>
                <div><br></div>
                <button class="select-btn">Выбрать</button>
            `;
      resultsList.appendChild(li);

      const selectButton = li.querySelector("button");
      selectButton.addEventListener("click", async () => {
        ui.showLoading();
        ui.setSelectButtonState(selectButton, false, "Обработка...");
        ui.clearUserMessages();

        try {
          const enrichmentPayload = { started_data: item };
          const enrichedDataForForm = await api.fetchEnrichedDataForPatient(enrichmentPayload);

          // 1. Отправляем сообщение с данными фоновому скрипту для выполнения в фоне.
          chrome.runtime.sendMessage({
              action: 'startFormFill',
              data: enrichedDataForForm
          });

          // 2. Немедленно закрываем popup. Фоновый скрипт сделает остальную работу.
          window.close();

        } catch (err) {
          console.error("[SearchLogic] Ошибка при обогащении:", err);
          ui.showUserError(err.message);
          ui.setSelectButtonState(selectButton, true, "Выбрать");
          ui.hideLoading();
        }
      });
    });
  } catch (err) {
    console.error("[SearchLogic] Ошибка API поиска:", err);
    ui.showUserError(err.message);
  } finally {
      const finalLoadingEl = document.getElementById("loading");
      if (finalLoadingEl && finalLoadingEl.style.display !== "none") ui.hideLoading();
      const finalSearchBtn = document.getElementById("searchBtn");
      if (finalSearchBtn && finalSearchBtn.disabled) ui.setSearchButtonState(true, "Искать");
  }
}