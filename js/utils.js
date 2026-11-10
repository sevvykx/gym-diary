// Текст, який ввів користувач, вставляємо в HTML тільки через цю функцію,
// інакше символи на кшталт < або " зламають розмітку
export function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(text).replace(/[&<>"']/g, (char) => map[char]);
}

// 82.5 → "82,5", 80 → "80"
export function formatWeight(weight) {
  return String(Math.round(weight * 100) / 100).replace('.', ',');
}

// Підхід як текст: "80 кг × 8" або "власна вага × 12"
export function formatSet({ weight, reps }) {
  return weight > 0 ? `${formatWeight(weight)} кг × ${reps}` : `власна вага × ${reps}`;
}

// Час у форматі "18:30"
export function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}
