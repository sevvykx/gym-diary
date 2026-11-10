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

// Дата у форматі "8 листопада" (рік додаємо, якщо він не поточний)
export function formatDate(timestamp) {
  const date = new Date(timestamp);
  const options = { day: 'numeric', month: 'long' };
  if (date.getFullYear() !== new Date().getFullYear()) options.year = 'numeric';
  return date.toLocaleDateString('uk-UA', options);
}

// "сьогодні", "вчора" або "5 дн. тому" (рахуємо календарні дні, а не години)
export function formatDaysAgo(timestamp) {
  const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(new Date(timestamp))) / 86400000);
  if (days <= 0) return 'сьогодні';
  if (days === 1) return 'вчора';
  return `${days} дн. тому`;
}

// Дата з днем тижня: "Понеділок, 10 листопада" (рік додаємо, якщо він не поточний)
export function formatLongDate(timestamp) {
  const date = new Date(timestamp);
  const options = { weekday: 'long', day: 'numeric', month: 'long' };
  if (date.getFullYear() !== new Date().getFullYear()) options.year = 'numeric';
  const text = date.toLocaleDateString('uk-UA', options);
  return text[0].toUpperCase() + text.slice(1);
}

// Тривалість: "52 хв" або "1 год 12 хв"
export function formatDuration(ms) {
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} хв`;
  return `${Math.floor(minutes / 60)} год ${minutes % 60} хв`;
}

// Власна вага з поля вводу: "78,5" → 78.5. Повертає null, якщо це не число від 20 до 300
export function parseBodyWeight(text) {
  const weight = Number(text.trim().replace(',', '.'));
  return weight >= 20 && weight <= 300 ? weight : null;
}
