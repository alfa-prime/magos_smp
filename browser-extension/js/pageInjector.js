// browser-extension/js/pageInjector.js

export async function injectionTargetFunction(enrichedDataForForm) {
  const dataMapToInsert = enrichedDataForForm;
  let allElementsFound = true;

  const WAIT_PROFILES = {
    FAST: { timeout: 12000, stableDelay: 1000 },
    DEFAULT: { timeout: 20000, stableDelay: 1400 },
    SLOW: { timeout: 32000, stableDelay: 2500 },
  };

  const FIELD_COMPLEXITY_MAP = {
    "HospitalizationInfoAddressDepartment": WAIT_PROFILES.DEFAULT,
    "ReferralHospitalizationSendingDepartment": WAIT_PROFILES.SLOW,
    "HospitalizationInfoDiagnosisMainDisease": WAIT_PROFILES.DEFAULT,
    "HospitalizationInfoSubdivision": WAIT_PROFILES.DEFAULT,
    "ReferralHospitalizationMedIndications": WAIT_PROFILES.FAST,
    "VidMpV008": WAIT_PROFILES.FAST,
    "HospitalizationInfoV006": WAIT_PROFILES.FAST,
    "HospitalizationInfoV014": WAIT_PROFILES.FAST,
    "HospitalizationInfoSpecializedMedicalProfile": WAIT_PROFILES.FAST,
    "HospitalizationInfoV020": WAIT_PROFILES.FAST,
    "HospitalizationInfoC_ZABV027": WAIT_PROFILES.FAST,
    "ResultV009": WAIT_PROFILES.FAST,
    "IshodV012": WAIT_PROFILES.FAST,
  };

  function waitForRowSelected(rowElement, selectedClass = 'x-grid-row-selected', timeout = 3000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      (function check() {
        if (rowElement.classList.contains(selectedClass)) {
          return resolve(true);
        }
        if (Date.now() - start > timeout) {
          return reject(new Error(`Таймаут ожидания выбора строки (класс ${selectedClass} не появился).`));
        }
        setTimeout(check, 100);
      })();
    });
  }

  function waitForElement(doc, selector, timeout = 5000, interval = 100) {
    return new Promise((resolve) => {
      const start = Date.now();
      (function check() {
        const el = doc.querySelector(selector);
        if (el) return resolve(el);
        if (Date.now() - start > timeout) {
          console.warn("Элемент не найден в DOM:", selector);
          allElementsFound = false;
          resolve(null);
        }
        setTimeout(check, interval);
      })();
    });
  }

  function waitForLoadMaskGone(doc, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      (function check() {
        const mask = doc.querySelector(".x-mask-msg");
        if (!mask || getComputedStyle(mask).display === "none") return resolve();
        if (Date.now() - start > timeout) return reject(new Error("Таймаут ожидания исчезновения маски загрузки (load mask)"));
        setTimeout(check, 100);
      })();
    });
  }

  function waitForGridRowsSettled(doc, profile = WAIT_PROFILES.DEFAULT) {
    return new Promise((resolve, reject) => {
      const { timeout, stableDelay } = profile;
      const gridView = doc.querySelector('.x-grid-view');
      if (!gridView) return reject(new Error("Не удалось найти контейнер грида (.x-grid-view) для наблюдения."));
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

  function waitForReferenceWindow(doc, isOpen, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      (function check() {
        const modal = [...doc.querySelectorAll(".x-window")].find(el => el.offsetParent !== null && el.innerText.includes("Выбор элемента"));
        if (!!modal === isOpen) return resolve(modal);
        if (Date.now() - start > timeout) return reject(new Error(`Таймаут ожидания ${isOpen ? "открытия" : "закрытия"} окна справочника.`));
        setTimeout(check, 200);
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
    ["mousedown", "mouseup", "click"].forEach(evt => trigger.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: iframeWindow })));
    const dropdownList = await waitForElement(doc, ".x-boundlist:not(.x-boundlist-hidden)", 5000);
    await waitForElement(dropdownList, ".x-boundlist-item", 2000);
    const options = Array.from(dropdownList.querySelectorAll(".x-boundlist-item"));
    const targetOption = options.find(opt => opt.textContent.trim() === value);
    if (!targetOption) { doc.body.click(); throw new Error(`Опция "${value}" не найдена в выпадающем списке.`); }
    ["mousedown", "mouseup", "click"].forEach(evt => targetOption.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: iframeWindow })));
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  async function selectFromReferenceField({ doc, iframeWindow, fieldSelector, column, value, waitProfile }) {
    const input = await waitForElement(doc, fieldSelector);
    if (!input) return;
    input.focus();
    ["mousedown", "mouseup", "click"].forEach(evt => input.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: iframeWindow })));
    await waitForLoadMaskGone(doc);
    await waitForReferenceWindow(doc, true);
    await waitForGridRowsSettled(doc, waitProfile);
    const headerText = column.trim();
    const filterInput = Array.from(doc.querySelectorAll(".x-grid-header-ct input[type='text']")).find(inp => inp.closest(".x-column-header")?.querySelector(".x-column-header-text")?.textContent.trim() === headerText);
    if (!filterInput) throw new Error(`Фильтр-инпут для колонки "${headerText}" не найден`);
    filterInput.focus(); filterInput.value = value;
    filterInput.dispatchEvent(new Event("input", { bubbles: true }));
    filterInput.dispatchEvent(new Event("change", { bubbles: true }));
    ["keydown", "keypress", "keyup"].forEach(type => filterInput.dispatchEvent(new KeyboardEvent(type, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true })));
    filterInput.blur();
    await waitForLoadMaskGone(doc);
    await waitForGridRowsSettled(doc, waitProfile);

    const checker = doc.querySelector("tr.x-grid-row td.x-grid-cell-row-checker");
    if (!checker) throw new Error(`Чекбокс для выбора строки в справочнике не найден.`);
    const parentRow = checker.closest('tr.x-grid-row');
    if (!parentRow) throw new Error('Не удалось найти родительский элемент <tr> для чекбокса.');

    ["mousedown", "mouseup", "click"].forEach(evt => checker.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: iframeWindow })));

    await waitForRowSelected(parentRow, 'x-grid-row-selected');

    const btn = Array.from(doc.querySelectorAll("span.x-btn-inner")).find(s => s.textContent.trim() === "Выбрать")?.closest(".x-btn");
    if (!btn) throw new Error("Кнопка 'Выбрать' в справочнике не найдена");

    ["mousedown", "mouseup", "click"].forEach(evt => btn.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: iframeWindow })));

    await waitForReferenceWindow(doc, false);
  }

  console.log("[PAGE INJECTOR] Вставка данных:", dataMapToInsert);

  function findCorrectIframeAndDocument() {
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        const innerDoc = iframe.contentWindow.document;
        if (innerDoc && innerDoc.querySelector("input[name='ReferralHospitalizationNumberTicket']")) return { iframe, doc: innerDoc };
      } catch (e) { console.warn(`[PAGE INJECTOR] Iframe access error: ${e.message}`); }
    }
    return { iframe: null, doc: null };
  }

  const { iframe, doc } = findCorrectIframeAndDocument();
  if (!iframe || !doc) {
    chrome.runtime.sendMessage({ action: "injectionError", error: "Не удалось найти iframe с формой ГИС ОМС." });
    return;
  }

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
      { type: 'ref', name: 'ResultV009', column: 'Код' },
      { type: 'ref', name: 'IshodV012', column: 'Код' },
      { type: 'ref', name: 'HospitalizationInfoDiagnosisMainDisease', column: 'Код МКБ' },
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
      console.log(`[pageInjector] Заполняем поле: ${task.name}`);
      switch (task.type) {
        case 'ref': await selectFromReferenceField({ doc, iframeWindow: iframe.contentWindow, fieldSelector: selector, column: task.column, value, waitProfile: FIELD_COMPLEXITY_MAP[task.name] || WAIT_PROFILES.DEFAULT }); break;
        case 'date': fillDateInput({ doc, selector, value }); break;
        case 'dropdown': await selectFromDropdown({ doc, iframeWindow: iframe.contentWindow, fieldSelector: selector, value }); break;
        case 'plain': fillPlainInput(doc, selector, value); break;
      }
    }
  } catch (error) {
    executionError = error;
  } finally {
    if (executionError) {
      chrome.runtime.sendMessage({ action: "injectionError", error: `Произошла ошибка: ${executionError.message || String(executionError)}` });
      chrome.runtime.sendMessage({ action: "formFillError", error: executionError.message || String(executionError) });
    } else {
      const patientName = dataMapToInsert.patientFIO || dataMapToInsert["input[name='CardNumber']"] || "пациента";
      chrome.runtime.sendMessage({ action: "formFillComplete", patientName: patientName });
      const { medical_service_data: operations, additional_diagnosis_data: diagnoses, discharge_summary: discharge } = dataMapToInsert;
      if (operations?.length || diagnoses?.length || !allElementsFound || discharge) {
        let title = "Найдены дополнительные данные:";
        if (!allElementsFound) title = "Данные вставлены, но некоторые поля не найдены.";
        chrome.runtime.sendMessage({ action: "showFinalResultInPage", data: { title, operations, diagnoses, discharge } });
      }
    }
  }
}