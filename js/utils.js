// Текст, який ввів користувач, вставляємо в HTML тільки через цю функцію,
// інакше символи на кшталт < або " зламають розмітку
export function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(text).replace(/[&<>"']/g, (char) => map[char]);
}
