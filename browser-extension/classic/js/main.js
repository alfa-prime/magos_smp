// browser-extension/js/main.js
import { initForm } from "./form.js";
import { debounce } from "./utils.js";
import { searchPatient } from "./searchLogic.js";
import { showUserError } from "./ui.js";


export function setupSearchHandler() {
  const debouncedSearch = debounce(searchPatient, 500);
  const searchButtonEl = document.getElementById("searchBtn");
  if (searchButtonEl) {
    searchButtonEl.addEventListener("click", debouncedSearch);
  }
  document.querySelectorAll("input").forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        debouncedSearch();
      }
    });
  });
}

window.addEventListener("DOMContentLoaded", () => {
  initForm();
  setupSearchHandler();

  // Оставляем проверку, чтобы убедиться, что расширение запущено на правильном сайте
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs.length) {
      showUserError("Не удалось получить доступ к активной вкладке.");
      return;
    }

    // Эта проверка очень важна. Мы ее оставляем!
    if (!tabs[0].url || !tabs[0].url.startsWith("https://gisoms.ffoms.gov.ru")) {
      console.warn("Popup открыт не на странице ГИС ОМС.");
      showUserError("Расширение предназначено для gisoms.ffoms.gov.ru");
      // Также можно заблокировать кнопку поиска, чтобы предотвратить бесполезные запросы
      const searchButton = document.getElementById('searchBtn');
      if (searchButton) {
          searchButton.disabled = true;
      }
      return;
    }

    // Вся логика sendMessage, связанная с FETCH_LIST_MO, удалена.
    // Теперь здесь просто ничего не происходит, и это нормально.
    // Код просто убедился, что мы на верном сайте, и продолжает работу.
    console.log("✅ Расширение запущено на правильной странице ГИС ОМС.");
  });
});