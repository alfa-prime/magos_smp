/**
 * form.js
 * Инициализация формы:
 *  - установка стартовой и конечной даты (с начала прошлого месяца по сегодня)
 *  - фокус на поле «Фамилия»
 */


export function initForm() {
  console.log("[Form.js] initForm вызвана"); // Добавим лог для проверки вызова
  const now = new Date();
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // Установка значений дат по умолчанию (начало прошлого месяца, сегодня)
  document.getElementById("startDate").value =
    prevMonthStart.toLocaleDateString("sv-SE");
  document.getElementById("endDate").value = now.toLocaleDateString("sv-SE");


  // Фокус на поле "Фамилия" при открытии
  const lastnameInput = document.getElementById("lastname");
  if (lastnameInput) {
    lastnameInput.focus();
    lastnameInput.select();
  }
}
