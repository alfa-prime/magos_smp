import { injectionTargetFunction } from './pageInjector.js';

const isOffscreenApiSupported = typeof chrome.offscreen !== 'undefined';

const TITLE_ENABLED = 'ЕВМИАС -> ОМС: Заполнить форму';
const TITLE_DISABLED = 'ЕВМИАС -> ОМС (неактивно)';
const REASON_DISABLED = 'Перейдите на страницу ввода данных в ГИС ОМС для активации.';

async function setActionState(tabId, enabled) {
    try {
        if (enabled) {
            await chrome.action.enable(tabId);
            await chrome.action.setTitle({ tabId: tabId, title: TITLE_ENABLED });
        } else {
            await chrome.action.disable(tabId);
            await chrome.action.setTitle({ tabId: tabId, title: `${TITLE_DISABLED}\n${REASON_DISABLED}` });
        }
    } catch (e) {
        // Игнорируем ошибки при закрытии вкладки
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateIcon' && sender.tab) {
        setActionState(sender.tab.id, message.found);
        return;
    }

    if (message.action === 'startFormFill') {
        (async () => {
            try {
                // 1. Находим вкладку
                let targetTabId = message.tabId;
                if (!targetTabId) {
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    targetTabId = tab?.id;
                }

                if (!targetTabId) {
                    console.error('[Background] Не удалось найти вкладку для инъекции.');
                    sendResponse({ success: false, error: 'Вкладка не найдена' });
                    return;
                }

                console.log(`[Background] Данные получены. Запускаем инъекцию в таб ${targetTabId}...`);

                // 2. ЗАПУСКАЕМ СКРИПТ БЕЗ AWAIT
                // Мы не ждем, пока он выполнится (это долго). Мы просто кидаем его в исполнение.
                chrome.scripting.executeScript({
                    target: { tabId: targetTabId },
                    func: injectionTargetFunction,
                    args: [message.data]
                }).catch(err => {
                    // Эта ошибка возникнет, если скрипт вообще не удалось запустить (например, нет прав)
                    // Но popup к этому моменту уже закроется.
                    console.error(`[Background] Ошибка запуска скрипта (в фоне):`, err);
                });
                
                // 3. Сразу отвечаем Popup'у, чтобы он закрылся
                console.log(`[Background] Команда отправлена, закрываем Popup.`);
                sendResponse({ success: true });

            } catch (error) {
                console.error(`[Background] Ошибка подготовки инъекции:`, error);
                sendResponse({ success: false, error: error.message });
            }
        })();

        return true; // Держим канал для асинхронного sendResponse
    }

    if (message.action === 'showFinalResultInPage') {
        if (sender.tab && sender.tab.id) {
            chrome.tabs.sendMessage(sender.tab.id, message).catch(err => console.error(err));
        }
        return;
    }

    if (message.action === 'injectionError' || message.action === 'formFillError') {
        console.error(`[Background] Ошибка от pageInjector: ${message.error}`);
        return;
    }

    if (message.action === 'formFillComplete') {
        if (isOffscreenApiSupported) {
             chrome.offscreen.hasDocument().then(has => {
                 if(has) chrome.offscreen.closeDocument();
             });
        }
        const patientInfo = message.patientName ? `для пациента ${message.patientName}` : '';
        console.log(`[Background] Заполнение формы завершено ${patientInfo}.`);
        return;
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        if (!tab.url.startsWith("https://gisoms.ffoms.gov.ru/")) {
            setActionState(tabId, false);
        }
    }
});