// browser-extension/js/apiService.js

const API_SEARCH_URL = "http://192.168.0.145:8082/extension/search";
const API_ENRICH_URL = "http://192.168.0.145:8082/extension/enrich-data";

//const API_SEARCH_URL = "http://0.0.0.0:8000/extension/search";
//const API_ENRICH_URL = "http://0.0.0.0:8000/extension/enrich-data";

/**
 * Вспомогательная функция для обработки ответа API.
 * @param {Response} response - Объект Response от fetch.
 * @param {string} operationName - Название операции для логов и сообщений об ошибках.
 * @returns {Promise<any>} - Promise, который разрешается с данными JSON или отклоняется с ошибкой.
 */
async function handleApiResponse(response, operationName = "API") {
    if (!response.ok) {
        let errorDetail = `Ошибка ${operationName}: ${response.status}`;
        try {
            // Пытаемся получить более детальную ошибку из JSON тела, если оно есть
            const errorData = await response.json();
            if (errorData && errorData.detail) {
                // Если detail - массив (как мы обсуждали ранее, что может вызвать [object Object])
                if (Array.isArray(errorData.detail)) {
                     errorDetail = errorData.detail.map(d =>
                        (typeof d === 'object' && d !== null && d.message) ? d.message : JSON.stringify(d)
                    ).join('; ');
                } else if (typeof errorData.detail === 'string') {
                    errorDetail = errorData.detail;
                }
            }
        } catch (e) {
            // Игнорируем, если тело ответа не JSON или пустое
            console.warn(`Не удалось распарсить JSON из ответа об ошибке для ${operationName}:`, e);
        }
        console.error(`[API] ${operationName} не удался со статусом ${response.status}: ${errorDetail}`);
        throw new Error(errorDetail);
    }
    // Если ответ успешный, парсим JSON
    try {
        return await response.json();
    } catch (e) {
        console.error(`[API] Не удалось распарсить JSON из успешного ответа для ${operationName}:`, e, "Тело ответа:", await response.text().catch(() => "не удалось прочитать тело"));
        throw new Error(`Ошибка парсинга данных от ${operationName}.`);
    }
}

/**
 * Запрашивает список пациентов с сервера.
 * @param {object} searchPayload - Объект с параметрами поиска.
 * @returns {Promise<Array<any>>} - Promise с массивом результатов поиска.
 */
export async function fetchSearchResults(searchPayload) {
    console.log("[API] Запрос на поиск пациентов:", searchPayload);
    const response = await fetch(API_SEARCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(searchPayload),
    });
    return handleApiResponse(response, "поиска пациентов");
}

/**
 * Запрашивает обогащенные данные для пациента.
 * @param {object} enrichmentPayload - Объект с данными для обогащения.
 * @returns {Promise<object>} - Promise с объектом обогащенных данных.
 */
export async function fetchEnrichedDataForPatient(enrichmentPayload) {
    console.log("[API] Запрос на обогащение данных:", enrichmentPayload);
    const response = await fetch(API_ENRICH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(enrichmentPayload),
    });
    return handleApiResponse(response, "обогащения данных");
}