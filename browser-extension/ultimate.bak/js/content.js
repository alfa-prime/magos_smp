// browser-extension/js/content.js

const CONTAINER_ID = 'evmias-oms-result-container';
const STYLE_ID = 'evmias-oms-result-styles';

function removeInjectedElements() {
    const container = document.getElementById(CONTAINER_ID);
    if (container) {
        container.remove();
    }
    const styleSheet = document.getElementById(STYLE_ID);
    if (styleSheet) {
        styleSheet.remove();
    }
}

/**
 * Функция для создания и вставки блока с результатами.
 * @param {string} title - Заголовок блока.
 * @param {Array<object>} operations - Массив с данными об операциях.
 * @param {Array<object>} diagnoses - Массив с данными о диагнозах.
 */
function injectResultBlock(title, operations, diagnoses, discharge) {
    removeInjectedElements();
    const container = document.createElement('div');
    container.id = CONTAINER_ID;

    container.innerHTML = `
        <div class="content-wrapper">
            <h3>${title}</h3>
            <div id="evmias-diagnoses-container"></div>
            <div id="evmias-operations-container" style="margin-top: 5px;"></div>
            <div id="evmias-pure-data-container"></div>
        </div>
        <button id="evmias-oms-close-btn">Закрыть</button>
    `;

    // --- Логика для диагнозов ---
    const diagnosesContainer = container.querySelector('#evmias-diagnoses-container');
    if (diagnoses && diagnoses.length > 0) {
        const listEl = document.createElement('ul');
        diagnoses.forEach(diag => {
            const li = document.createElement('li');
            const codeSpan = document.createElement('span');
            codeSpan.className = 'diagnosis-code';
            codeSpan.textContent = diag.code;
            codeSpan.title = 'Нажмите, чтобы скопировать код';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'diagnosis-name';
            nameSpan.textContent = diag.name;
            codeSpan.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    await navigator.clipboard.writeText(diag.code);
                    const originalText = codeSpan.textContent;
                    codeSpan.textContent = 'Скопировано!';
                    codeSpan.style.color = '#9b1b30';
                    setTimeout(() => {
                        codeSpan.textContent = originalText;
                        codeSpan.style.color = 'inherit';
                    }, 1500);
                } catch (err) {
                    console.error('Не удалось скопировать текст: ', err);
                }
            });
            li.appendChild(codeSpan);
            li.appendChild(nameSpan);
            listEl.appendChild(li);
        });
        diagnosesContainer.appendChild(listEl);
    }

    const operationsContainer = container.querySelector('#evmias-operations-container');
    if (operations && operations.length > 0) {
        const operationsListEl = document.createElement('ul');
        operations.forEach(op => {
            const li = document.createElement('li');
            const codeSpan = document.createElement('span');
            codeSpan.className = 'operation-code';
            codeSpan.textContent = op.code;
            codeSpan.title = 'Нажмите, чтобы скопировать код';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'operation-name';
            nameSpan.textContent = `${op.name}`;
            codeSpan.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    await navigator.clipboard.writeText(op.code);
                    const originalText = codeSpan.textContent;
                    codeSpan.textContent = 'Скопировано!';
                    codeSpan.style.color = '#9b1b30';
                    setTimeout(() => {
                        codeSpan.textContent = originalText;
                        codeSpan.style.color = 'inherit';
                    }, 1500);
                } catch (err) {
                    console.error('Не удалось скопировать текст: ', err);
                }
            });
            li.appendChild(codeSpan);
            li.appendChild(nameSpan);
            operationsListEl.appendChild(li);
        });
        operationsContainer.appendChild(operationsListEl);
    }

    const pureContainer = container.querySelector('#evmias-pure-data-container');
    if (discharge && Object.values(discharge).some(v => v)) {
        let pureHtml = '';

        if (discharge.diagnos) {
            pureHtml += `
                <div class="pure-data-item">
                    <div class="diagnos-html-content">${discharge.diagnos}</div>
                </div>`;
        }
        if (discharge.item_90) {
            pureHtml += `
                <div class="pure-data-item">
                    <strong>Основное заболевание:</strong>
                    <span>${discharge.item_90} — ${discharge.item_94 || ''}</span>
                </div>`;
        }
        if (discharge.item_272) {
            pureHtml += `
                <div class="pure-data-item">
                    <span>${discharge.item_272}</span>
                </div>`;
        }
        if (discharge.item_284) {
             pureHtml += `
                <div class="pure-data-item">
                    <span>${discharge.item_284}</span>
                </div>`;
        }
        if (discharge.item_659) {
            pureHtml += `
                <div class="pure-data-item">
                    <strong>Сопутствующие заболевания:</strong>
                    <div class="pure-table-wrapper">${discharge.item_659}</div>
                </div>`;
        }
        if (discharge.primary_diagnosis) {
            pureHtml += `
                <div class="pure-data-item">
                    <div class="pure-table-wrapper">${discharge.primary_diagnosis}</div>
                </div>`;
        }
        if (discharge.concomitant_diseases) {
            pureHtml += `
                <div class="pure-data-item">
                    <strong>Сопутствующие заболевания:</strong>
                    <div class="pure-table-wrapper">${discharge.concomitant_diseases}</div>
                </div>`;
        }
        if (discharge.primary_complication) {
            pureHtml += `
                <div class="pure-data-item">
                    <strong>Осложнения основного заболевания:</strong>
                    <div class="pure-table-wrapper">${discharge.primary_complication}</div>
                </div>`;
        }
        if (discharge.item_145) {
            pureHtml += `
                <div class="pure-data-item">
                    <strong>Услуги:</strong>
                    <div class="pure-table-wrapper">${discharge.item_145}</div>
                </div>`;
        }
        if (discharge.AdditionalInf) {
            pureHtml += `
                <div class="pure-data-item">
                    <div class="pure-table-wrapper">${discharge.AdditionalInf}</div>
                </div>`;
        }

        pureContainer.innerHTML = pureHtml;
    }

     // ===== НАЧАЛО ИЗМЕНЕННОГО БЛОКА =====
    // Ищем основной контейнер формы в iframe, используя уточненный селектор.
    const injectionTarget = document.querySelector('div.x-window-body:has(input[name="ReferralHospitalizationNumberTicket"])');

    if (injectionTarget) {
        // Если нашли, вставляем нашу панель в самое начало этого контейнера.
        injectionTarget.prepend(container);
        console.log('[Content Script] Инфопанель встроена в основной контейнер формы.');
    } else {
        // Если по какой-то причине контейнер не найден, используем старый, надежный способ.
        console.warn('[Content Script] Основной контейнер формы не найден. Панель встроена в body.');
        document.body.prepend(container);
    }
    // ===== КОНЕЦ ИЗМЕНЕННОГО БЛОКА =====

    container.querySelector('#evmias-oms-close-btn').addEventListener('click', removeInjectedElements);
}

if (window.self !== window.top) {
    console.log('✅ [Content Script] Запущен внутри iframe и готов получать сообщения.');

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'showFinalResultInPage') {
            console.log('[Content Script] Получены данные для отображения:', message.data);
            const { title, operations, diagnoses, discharge } = message.data;
            injectResultBlock(title, operations, diagnoses, discharge);
        }
    });

    let nativeCloseListenerAttached = false;
    const nativeButtonObserver = new MutationObserver(() => {
        if (nativeCloseListenerAttached) {
            return;
        }

        const allSpans = document.querySelectorAll('span.x-btn-inner');
        const closeSpan = Array.from(allSpans).find(span => span.textContent.trim() === 'Закрыть');

        if (closeSpan) {
            const closeButton = closeSpan.closest('button');
            if (closeButton) {
                console.log('[Content Script] Найдена нативная кнопка "Закрыть". Привязываем обработчик.');
                closeButton.addEventListener('click', removeInjectedElements);
                nativeCloseListenerAttached = true;
                nativeButtonObserver.disconnect();
            }
        }
    });

    nativeButtonObserver.observe(document.body, { childList: true, subtree: true });
}

const TARGET_ELEMENT_SELECTOR = "input[name='ReferralHospitalizationNumberTicket']";
let isElementFound = false;

function checkElementAndNotify() {
    const element = document.querySelector(TARGET_ELEMENT_SELECTOR);
    const currentlyFound = !!element;
    if (currentlyFound !== isElementFound) {
        isElementFound = currentlyFound;
        chrome.runtime.sendMessage({ action: "updateIcon", found: isElementFound });
    }
}

const mainObserver = new MutationObserver(checkElementAndNotify);
mainObserver.observe(document.body, { childList: true, subtree: true });
checkElementAndNotify();