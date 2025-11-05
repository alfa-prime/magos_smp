// browser-extension/js/pageInjector.js

export async function injectionTargetFunction(enrichedDataForForm) {
  const dataMapToInsert = enrichedDataForForm;
  let allElementsFound = true;

  // --- БЛОК НАСТРОЙКИ СКОРОСТИ (ТЮНИНГ) ---
  const TUNING = {
    // Общий максимальный таймаут для самых долгих операций
    REFERENCE_FIELD_TIMEOUT: 50000,
    // Как часто проверять состояние в функциях waitFor... (меньше = быстрее, но больше нагрузка)
    POLLING_INTERVAL: 150,
    // Пауза после переключения вкладки, чтобы дать ей прорисоваться
    TAB_SWITCH_DELAY: 250,
    // Пауза после отправки значения в фильтр, чтобы дать гриду среагировать
    FILTER_REACTION_DELAY: 250,
    // Пауза между повторными попытками при полной неудаче задачи
    TASK_RETRY_DELAY: 1000,
    // Пауза между повторными кликами при выборе строки
    ROW_SELECT_RETRY_DELAY: 300,
  };
  // --- КОНЕЦ БЛОКА НАСТРОЙКИ ---

  function showOverlay(doc, text = "Идет заполнение формы. <br> Пожалуйста, подождите.") {
    const oldOverlay = doc.getElementById('injection-overlay');
    if (oldOverlay) oldOverlay.remove();
    const overlay = doc.createElement('div');
    overlay.id = 'injection-overlay';
    Object.assign(overlay.style, {
      position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.6)', color: 'white', display: 'flex',
      justifyContent: 'center', alignItems: 'center', zIndex: '999999',
      fontSize: '24px', fontFamily: 'Arial, sans-serif'
    });
    overlay.innerHTML = `<div style="text-align: center; padding: 40px; background: #2c3e50; border-radius: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.3);"><p>${text}</p></div>`;
    doc.body.appendChild(overlay);
  }

  function hideOverlay(doc) {
    const overlay = doc.getElementById('injection-overlay');
    if (overlay) overlay.remove();
  }

  function dispatchMouseEvents(element, view) {
    const eventParams = {
      bubbles: true, cancelable: true, view: view, detail: 1, screenX: 0, screenY: 0,
      clientX: 0, clientY: 0, ctrlKey: false, altKey: false, shiftKey: false,
      metaKey: false, button: 0, relatedTarget: null
    };
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(type => {
      element.dispatchEvent(new MouseEvent(type, eventParams));
    });
  }

  function waitForRowSelected(rowElement, selectedClass = 'x-grid-row-selected', timeout = 5000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      (function check() {
        if (rowElement.classList.contains(selectedClass)) return resolve(true);
        if (Date.now() - start > timeout) return reject(new Error(`Таймаут ожидания выбора строки (класс ${selectedClass} не появился).`));
        setTimeout(check, TUNING.POLLING_INTERVAL);
      })();
    });
  }

  function waitForElement(doc, selector, timeout = 20000) {
    return new Promise((resolve) => {
      const start = Date.now();
      (function check() {
        const el = doc.querySelector(selector);
        if (el && el.offsetParent !== null) return resolve(el);
        if (Date.now() - start > timeout) {
          console.warn("Элемент не найден или не видим в DOM:", selector);
          allElementsFound = false;
          resolve(null);
        }
        setTimeout(check, TUNING.POLLING_INTERVAL);
      })();
    });
  }

  function waitForElementEnabled(doc, selector, timeout = 20000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      (function check() {
        const el = doc.querySelector(selector);
        if (el && !el.disabled) return resolve(el);
        if (Date.now() - start > timeout) {
          const reason = el ? "не стал активным" : "не был найден";
          return reject(new Error(`Таймаут ожидания: элемент ${selector} ${reason}.`));
        }
        setTimeout(check, TUNING.POLLING_INTERVAL);
      })();
    });
  }

  function waitForLoadMaskGone(doc, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      (function check() {
        const mask = doc.querySelector(".x-mask-msg");
        if (!mask || getComputedStyle(mask).display === "none") return resolve();
        if (Date.now() - start > timeout) return reject(new Error("Таймаут ожидания исчезновения маски загрузки."));
        setTimeout(check, TUNING.POLLING_INTERVAL);
      })();
    });
  }

  function waitForGridRowsSettled(doc, timeout = 30000, stableDelay = 1000) {
    return new Promise((resolve, reject) => {
      const gridView = doc.querySelector('.x-grid-view');
      if (!gridView) return reject(new Error("Не удалось найти контейнер грида (.x-grid-view)."));
      let inactivityTimer, hardTimeout;
      const cleanup = () => { clearTimeout(inactivityTimer); clearTimeout(hardTimeout); observer.disconnect(); };
      const onStable = () => { cleanup(); resolve(gridView.querySelectorAll('tr.x-grid-row').length); };
      const resetTimer = () => { clearTimeout(inactivityTimer); inactivityTimer = setTimeout(onStable, stableDelay); };
      const observer = new MutationObserver(resetTimer);
      hardTimeout = setTimeout(() => { cleanup(); reject(new Error(`Жесткий таймаут (${timeout}ms) ожидания стабилизации грида.`)); }, timeout);
      observer.observe(gridView, { childList: true, subtree: true });
      resetTimer();
    });
  }

  function waitForReferenceWindow(doc, isOpen, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      (function check() {
        const modal = [...doc.querySelectorAll(".x-window")].find(el => el.offsetParent !== null && el.innerText.includes("Выбор элемента"));
        if (!!modal === isOpen) return resolve(modal);
        if (Date.now() - start > timeout) return reject(new Error(`Таймаут ожидания ${isOpen ? "открытия" : "закрытия"} окна справочника.`));
        setTimeout(check, TUNING.POLLING_INTERVAL);
      })();
    });
  }

  function fillPlainInput(doc, selector, value) {
    const inp = doc.querySelector(selector);
    if (!inp) { console.warn(`[PLAIN INPUT] Не найден элемент ${selector}`); allElementsFound = false; return; }
    inp.focus(); inp.value = value;
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    inp.dispatchEvent(new Event("change", { bubbles: true }));
    inp.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
  }

  function fillDateInput({ doc, selector, value }) {
    const input = doc.querySelector(selector);
    if (!input) { allElementsFound = false; return; }
    input.focus(); input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
  }

  async function selectFromDropdown({ doc, iframeWindow, fieldSelector, value }) {
    const input = await waitForElement(doc, fieldSelector);
    if (!input) return;
    const trigger = input.closest(".x-form-item-body")?.querySelector(".x-form-trigger");
    if (!trigger) throw new Error(`Триггер для выпадающего списка ${fieldSelector} не найден.`);
    dispatchMouseEvents(trigger, iframeWindow);
    const dropdownList = await waitForElement(doc, ".x-boundlist:not(.x-boundlist-hidden)", 5000);
    await waitForElement(dropdownList, ".x-boundlist-item", 2000);
    const options = Array.from(dropdownList.querySelectorAll(".x-boundlist-item"));
    const targetOption = options.find(opt => opt.textContent.trim() === value);
    if (!targetOption) { doc.body.click(); throw new Error(`Опция "${value}" не найдена в выпадающем списке.`); }
    dispatchMouseEvents(targetOption, iframeWindow);
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  async function selectFromReferenceField({ doc, iframeWindow, fieldSelector, column, value }) {
    const input = await waitForElement(doc, fieldSelector);
    if (!input) return;

    input.focus();
    dispatchMouseEvents(input, iframeWindow);

    const referenceWindow = await waitForReferenceWindow(doc, true, TUNING.REFERENCE_FIELD_TIMEOUT);
    await waitForLoadMaskGone(doc, TUNING.REFERENCE_FIELD_TIMEOUT);
    await waitForGridRowsSettled(doc, TUNING.REFERENCE_FIELD_TIMEOUT);

    const headerEl = Array.from(referenceWindow.querySelectorAll(".x-column-header .x-column-header-text"))
      .find(el => el.textContent.trim() === column.trim());
    if (!headerEl) throw new Error(`Колонка с названием "${column}" не найдена.`);

    const filterInput = headerEl.closest(".x-column-header")?.querySelector("input[type='text']");
    if (!filterInput) throw new Error(`Поле для фильтрации в колонке "${column}" не найдено.`);

    let firstRow = null;
    const maxRetries = 5;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[pageInjector] Попытка ${attempt}/${maxRetries} найти "${value}" в колонке "${column}"`);
      filterInput.focus();
      filterInput.value = '';
      filterInput.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
      filterInput.value = value;
      filterInput.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
      filterInput.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
      filterInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true }));
      filterInput.blur();
      await new Promise(resolve => setTimeout(resolve, TUNING.FILTER_REACTION_DELAY));
      filterInput.blur();
      await waitForLoadMaskGone(doc, TUNING.REFERENCE_FIELD_TIMEOUT);
      await waitForGridRowsSettled(doc, TUNING.REFERENCE_FIELD_TIMEOUT);
      firstRow = referenceWindow.querySelector("tr.x-grid-row");
      if (firstRow && firstRow.innerText.includes(value)) {
        console.log(`[pageInjector] Запись найдена и верифицирована на попытке ${attempt}.`);
        break;
      } else {
        firstRow = null;
      }
      if (attempt < maxRetries) {
        console.warn(`[pageInjector] Запись не найдена или не прошла верификацию, ждем 1 секунду и пробуем снова...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!firstRow) throw new Error(`Запись со значением "${value}" в колонке "${column}" не найдена после ${maxRetries} попыток.`);

    const checker = firstRow.querySelector(".x-grid-cell-row-checker");
    if (!checker) throw new Error("Не удалось найти ячейку с чекбоксом (.x-grid-cell-row-checker) в найденной строке.");

    console.log("[pageInjector] Выполняем двойной клик (dblclick) для выбора и закрытия...");
    checker.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: iframeWindow }));
    await waitForReferenceWindow(doc, false, 5000);
    console.log("[pageInjector] Окно справочника успешно закрыто.");
  }

  console.log("[PAGE INJECTOR] Вставка данных:", dataMapToInsert);

  function findCorrectIframeAndDocument() {
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        const innerDoc = iframe.contentWindow.document;
        if (innerDoc && innerDoc.querySelector("input[name='ReferralHospitalizationNumberTicket']")) {
          return { iframe, doc: innerDoc };
        }
      } catch (e) { console.warn(`[PAGE INJECTOR] Iframe access error: ${e.message}`); }
    }
    return { iframe: null, doc: null };
  }

  const { iframe, doc } = findCorrectIframeAndDocument();
  if (!iframe || !doc) {
    chrome.runtime.sendMessage({ action: "injectionError", error: "Не удалось найти iframe с формой ГИС ОМС." });
    return;
  }

  showOverlay(doc);

  let executionError = null;
  try {
    const fillTasks = [
      { type: 'ref', name: 'ReferralHospitalizationMedIndications', column: 'Код' },
      { type: 'ref', name: 'HospitalizationInfoAddressDepartment', column: 'Адрес местонахождения'},
      { type: 'ref', name: 'VidMpV008', column: 'Код' },
      { type: 'ref', name: 'HospitalizationInfoV006', column: 'Код' },
      { type: 'ref', name: 'HospitalizationInfoV014', column: 'Код' },
      { type: 'ref', name: 'HospitalizationInfoSubdivision', column: 'Краткое наименование' },
      { type: 'ref', name: 'HospitalizationInfoSpecializedMedicalProfile', column: 'Код' },
      { type: 'ref', name: 'HospitalizationInfoV020', column: 'Код' },
      { type: 'ref', name: 'HospitalizationInfoC_ZABV027', column: 'Код' },
      { type: 'ref', name: 'HospitalizationInfoDiagnosisMainDisease', column: 'Код МКБ' },
      { type: 'ref', name: 'ResultV009', column: 'Код' },
      { type: 'ref', name: 'IshodV012', column: 'Код' },
      { type: 'ref', name: 'ReferralHospitalizationSendingDepartment', column: 'Реестровый номер' },
      { type: 'date', name: 'ReferralHospitalizationDateTicket' },
      { type: 'date', name: 'DateBirth' },
      { type: 'date', name: 'TreatmentDateStart' },
      { type: 'date', name: 'TreatmentDateEnd' },
      { type: 'dropdown', name: 'Gender' },
      { type: 'plain', name: 'ReferralHospitalizationNumberTicket' },
      { type: 'plain', name: 'Enp' },
      { type: 'plain', name: 'HospitalizationInfoNameDepartment' },
      { type: 'plain', name: 'HospitalizationInfoOfficeCode' },
      { type: 'plain', name: 'CardNumber' },
    ];

    for (const task of fillTasks) {
      const selector = `input[name='${task.name}']`;
      const value = dataMapToInsert[selector];
      if (!value) continue;

      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[pageInjector] Попытка ${attempt}/${maxRetries} для поля: ${task.name}`);

          switch (task.type) {
            case 'ref':
              await selectFromReferenceField({ doc, iframeWindow: iframe.contentWindow, fieldSelector: selector, column: task.column, value });
              break;
            case 'date':
              fillDateInput({ doc, selector, value });
              break;
            case 'dropdown':
              await selectFromDropdown({ doc, iframeWindow: iframe.contentWindow, fieldSelector: selector, value });
              break;
            case 'plain':
              fillPlainInput(doc, selector, value);
              break;
          }

          console.log(`[pageInjector] Поле ${task.name} успешно заполнено.`);
          break;

        } catch (error) {
          console.warn(`[pageInjector] Ошибка на попытке ${attempt} для поля ${task.name}:`, error.message);
          if (attempt === maxRetries) {
            throw new Error(`Не удалось заполнить поле ${task.name} после ${maxRetries} попыток. Последняя ошибка: ${error.message}`);
          }
          await new Promise(resolve => setTimeout(resolve, TUNING.TASK_RETRY_DELAY));
        }
      }

      if (task.name === 'HospitalizationInfoDiagnosisMainDisease') {
          console.log('[pageInjector] Диагноз МКБ заполнен. Переключаемся на вкладку "Сведения о случае..."');

          const tabs = Array.from(doc.querySelectorAll('span.x-tab-inner'));
          const targetTab = tabs.find(tab => tab.textContent.trim() === 'Сведения о случае оказанной медицинской помощи');

          if (targetTab) {
            dispatchMouseEvents(targetTab, iframe.contentWindow);
            await new Promise(resolve => setTimeout(resolve, TUNING.TAB_SWITCH_DELAY));

            console.log('[pageInjector] Ожидаем, пока поле "Результат" станет активным...');
            await waitForElementEnabled(doc, "input[name='ResultV009']", 15000);
            console.log('[pageInjector] Поле "Результат" активно. Продолжаем.');

          } else {
            console.warn('[pageInjector] Не удалось найти вкладку "Сведения о случае оказанной медицинской помощи" для переключения.');
          }
      }
    }
  } catch (error) {
    console.error("Критическая ошибка во время выполнения скрипта:", error);
    executionError = error;
  } finally {
    hideOverlay(doc);

    if (executionError) {
      chrome.runtime.sendMessage({ action: "injectionError", error: `Произошла ошибка: ${executionError.message || String(executionError)}` });
      chrome.runtime.sendMessage({ action: "formFillError", error: executionError.message || String(executionError) });
    } else {

      try {
        console.log('[pageInjector] Заполнение формы завершено. Возвращаемся на вкладку "Сведения о госпитализации".');
        const finalTabs = Array.from(doc.querySelectorAll('span.x-tab-inner'));
        const finalTargetTab = finalTabs.find(tab => tab.textContent.trim() === 'Сведения о госпитализации');

        if (finalTargetTab) {
          dispatchMouseEvents(finalTargetTab, iframe.contentWindow);
        } else {
          console.warn('[pageInjector] Не удалось найти вкладку "Сведения о госпитализации" для возврата.');
        }
      } catch (e) {
        console.error('[pageInjector] Произошла ошибка при возврате на исходную вкладку:', e);
      }

      const patientName = dataMapToInsert.patientFIO || dataMapToInsert["input[name='CardNumber']"] || "пациента";
      chrome.runtime.sendMessage({ action: "formFillComplete", patientName: patientName });

      const { medical_service_data: operations, additional_diagnosis_data: diagnoses, discharge_summary: discharge } = dataMapToInsert;
      if (operations?.length || diagnoses?.length || !allElementsFound || discharge) {
        let title = "Найдены дополнительные данные:";
        if (!allElementsFound) {
          title = "Данные вставлены, но некоторые поля не найдены.";
        }
        chrome.runtime.sendMessage({ action: "showFinalResultInPage", data: { title, operations, diagnoses, discharge } });
      }
    }
  }
}