// browser-extension/js/ui.js

/**
 * Модуль для управления элементами пользовательского интерфейса.
 */

// Получаем ссылки на UI элементы один раз при загрузке модуля
const messageEl = document.getElementById("message");
const loadingEl = document.getElementById("loading");
const searchBtn = document.getElementById("searchBtn"); // Основная кнопка поиска
const resultsListEl = document.getElementById("results");

// Элементы нового блока
//const searchBlockEl = document.getElementById("search-block");
//const finalViewEl = document.getElementById("final-view");
//const finalViewTitleEl = document.getElementById("final-view-title");
//const operationsListEl = document.getElementById("operations-list");
//const closePopupBtn = document.getElementById("close-popup-btn");


/**
 * Форматирует сообщение для отображения.
 * Справляется со строками, объектами Error и другими объектами.
 * @param {*} input - Входные данные для форматирования.
 * @returns {string} - Отформатированное строковое сообщение.
 */
function formatDisplayMessage(input) {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof Error) {
    return input.message || "Произошла ошибка."; // У Error всегда есть message
  }
  if (Array.isArray(input)) {
    return input.map(item => formatDisplayMessage(item)).join(', ');
  }
  if (typeof input === 'object' && input !== null) {
    return input.detail || input.message || JSON.stringify(input); // Порядок важен
  }
  return String(input); // В крайнем случае
}

/**
 * Показывает сообщение пользователю.
 * @param {*} msg - Сообщение (строка, Error, объект, массив).
 * @param {string} type - Тип сообщения ('info' или 'error').
 */
export function showUserMessage(msg, type = "info") {
  if (!messageEl) return;

  const displayMsg = formatDisplayMessage(msg);
  console.log(`[UI] Сообщение (тип: ${type}): ${displayMsg}. Исходное:`, msg);

  messageEl.textContent = displayMsg;
  messageEl.className = `message ${type}`;
  messageEl.style.display = "block";

  // Показ сообщения обычно означает, что операция (например, загрузка) завершена
  hideLoading();
  // Если это ошибка, также сбрасываем кнопку поиска (общая логика)
  if (type === "error") {
    setSearchButtonState(true, "Искать");
  }
}

/**
 * Показывает сообщение об ошибке.
 * @param {*} msg - Сообщение об ошибке.
 */
export function showUserError(msg) {
  showUserMessage(msg, "error");
}

/**
 * Показывает индикатор загрузки.
 */
export function showLoading() {
  if (loadingEl) loadingEl.style.display = "block";
}

/**
 * Скрывает индикатор загрузки.
 */
export function hideLoading() {
  if (loadingEl) loadingEl.style.display = "none";
}

/**
 * Очищает (скрывает) текущее сообщение.
 */
export function clearUserMessages() {
  if (messageEl) {
    messageEl.style.display = "none";
    messageEl.textContent = "";
  }
}

/**
 * Очищает список результатов.
 */
export function clearResultsList() {
  if (resultsListEl) resultsListEl.innerHTML = "";
}

/**
 * Устанавливает состояние основной кнопки поиска.
 * @param {boolean} enabled - true, если кнопка должна быть активна.
 * @param {string} text - Текст кнопки.
 */
export function setSearchButtonState(enabled, text = "Искать") {
  if (searchBtn) {
    searchBtn.disabled = !enabled;
    searchBtn.textContent = text;
  }
}

/**
 * Устанавливает состояние для кнопки "Выбрать" в элементе списка.
 * @param {HTMLButtonElement} buttonElement - Элемент кнопки.
 * @param {boolean} enabled - true, если кнопка должна быть активна.
 * @param {string} text - Текст кнопки.
 */
export function setSelectButtonState(buttonElement, enabled, text = "Выбрать") {
    console.log("[UI] setSelectButtonState вызван для:", buttonElement, "enabled:", enabled, "text:", text);
    if (buttonElement instanceof HTMLButtonElement) {
        buttonElement.disabled = !enabled;
        buttonElement.textContent = text;
    } else {
        console.warn("[UI] setSelectButtonState вызван с неверным элементом:", buttonElement);
    }
}

/**
 * Переключает интерфейс на финальный вид, показывая результат и/или операции.
 * @param {Array<object>} operations - Массив объектов операций. Может быть пустым.
 * @param {string} title - Заголовок для финального экрана.
 */
//export function switchToFinalView(operations, title) {
//    if (!finalViewEl || !searchBlockEl) return;
//
//    // 1. Устанавливаем заголовок
//    finalViewTitleEl.textContent = title;
//
//    // 2. Заполняем список операций, если они есть
//    operationsListEl.innerHTML = '';
//    if (operations && operations.length > 0) {
//        operations.forEach(op => {
//            const li = document.createElement('li');
//            li.textContent = `${op.code} - ${op.name}`;
//            operationsListEl.appendChild(li);
//        });
//        operationsListEl.style.display = 'block';
//    } else {
//        operationsListEl.style.display = 'none';
//    }
//
//    // 3. Скрываем основной блок поиска и показываем финальный
//    searchBlockEl.style.display = 'none';
//    finalViewEl.style.display = 'block';
//
//    // 4. Назначаем обработчик на кнопку "Закрыть"
//    const oldBtn = closePopupBtn;
//    const newBtn = oldBtn.cloneNode(true);
//    oldBtn.parentNode.replaceChild(newBtn, oldBtn);
//
//    newBtn.addEventListener('click', () => {
//        window.close();
//    }, { once: true });
//}