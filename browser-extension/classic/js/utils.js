
/**
 * Утилиты, не связанные напрямую с UI.
 */

// Debounce-функция: предотвращает частые вызовы (например, при быстрой печати и нажатии Enter)
export function debounce(fn, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  };
}