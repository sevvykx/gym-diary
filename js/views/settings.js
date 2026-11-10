import { db, exportAll, checkBackup, importAll, getProfile, saveProfile } from '../db.js';
import { escapeHtml, formatDate, formatDaysAgo, formatWeight, parseBodyWeight } from '../utils.js';
import { STEPS } from './onboarding.js';

// Коли востаннє зберігали копію (пам'ятаємо в localStorage, щоб нагадувати)
const LAST_EXPORT_KEY = 'lastExportAt';

export function render(el) {
  return draw(el);
}

// message: { text, isError } показується зверху після експорту чи відновлення
async function draw(el, message = null) {
  const workouts = await db.workouts.count();
  const sets = await db.sets.count();
  const exercises = await db.exercises.count();
  const persisted = (await navigator.storage?.persisted?.()) ?? false;
  const lastExportAt = Number(localStorage.getItem(LAST_EXPORT_KEY));
  // Профілю може не бути одразу після відновлення з копії, де його немає
  const profile = await getProfile();

  el.innerHTML = `
    ${message ? `<p class="notice ${message.isError ? 'is-error' : ''}">${message.text}</p>` : ''}

    ${profile ? profileHtml(profile) : ''}

    <section class="card">
      <h2 class="card-title">Резервна копія</h2>
      <p class="card-sub">
        Дані зберігаються тільки на цьому пристрої. Якщо видалити програму з початкового екрана,
        вони зникнуть. Час від часу зберігай копію у файл.
      </p>
      <p class="card-sub">
        Остання копія: ${lastExportAt ? `${formatDate(lastExportAt)}, ${formatDaysAgo(lastExportAt)}` : 'ще не було'}
      </p>
      <button class="btn btn-primary mt" id="export">Зберегти копію у файл</button>
    </section>

    <section class="card">
      <h2 class="card-title">Відновлення</h2>
      <p class="card-sub">Завантажує дані з файлу копії. Усі поточні дані буде замінено.</p>
      <button class="btn mt" id="import">Відновити з файлу</button>
      <input type="file" id="import-file" accept=".json,application/json" hidden>
    </section>

    <section class="card">
      <h2 class="card-title">Зараз у програмі</h2>
      <p class="card-sub">Тренувань: ${workouts} · Підходів: ${sets} · Вправ: ${exercises}</p>
      <p class="card-sub">Захист від автоматичного очищення: ${persisted ? 'увімкнено' : 'не надано браузером'}</p>
    </section>
  `;

  // Повідомлення стоїть угорі екрана: прокручуємо до нього, щоб його було видно
  if (message) window.scrollTo(0, 0);

  // ----- Профіль -----
  const profileForm = el.querySelector('#profile-form');
  profileForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fields = profileForm.elements;
    const fail = (text) => {
      const error = el.querySelector('#profile-error');
      error.textContent = text;
      error.hidden = false;
    };

    const name = fields.name.value.trim().replace(/\s+/g, ' ');
    if (!name) return fail("Введи своє ім'я");

    // Порожнє поле ваги означає «не вказано»
    const weightText = fields.bodyWeight.value.trim();
    const bodyWeight = weightText ? parseBodyWeight(weightText) : null;
    if (weightText && bodyWeight === null) {
      return fail('Введи вагу числом, наприклад 78,5, або залиш поле порожнім');
    }

    const updated = { name, bodyWeight };
    // У radio записано номер варіанта: за ним беремо значення для бази
    for (const step of STEPS.filter((s) => s.options)) {
      updated[step.key] = step.options[fields[step.key].value][0];
    }

    await saveProfile(updated);
    draw(el, { text: 'Профіль збережено.' });
  });

  // ----- Експорт -----
  el.querySelector('#export').addEventListener('click', async () => {
    const data = await exportAll();
    const file = new File([JSON.stringify(data, null, 2)], `gym-diary-${todayStamp()}.json`, {
      type: 'application/json',
    });

    if (await saveFile(file)) {
      localStorage.setItem(LAST_EXPORT_KEY, Date.now());
      draw(el, { text: `Копію збережено у файл ${file.name}.` });
    }
  });

  // ----- Імпорт -----
  const fileInput = el.querySelector('#import-file');
  el.querySelector('#import').addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    const fail = (text) => draw(el, { text, isError: true });

    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      return fail('Не вдалося прочитати файл: це не JSON.');
    }

    const problem = checkBackup(data);
    if (problem) return fail(problem);

    const question =
      `Замінити всі дані копією з файлу?\n\n` +
      `У файлі тренувань: ${data.workouts.length}, підходів: ${data.sets.length}.\n` +
      `Поточні дані буде видалено.`;
    if (!confirm(question)) {
      fileInput.value = ''; // щоб той самий файл можна було вибрати ще раз
      return;
    }

    try {
      await importAll(data);
    } catch (error) {
      console.error(error);
      return fail('Не вдалося записати дані з файлу. Поточні дані не змінено.');
    }
    draw(el, { text: 'Дані відновлено з файлу.' });
  });
}

// Картка «Профіль»: ті самі поля й варіанти, що у вступі
function profileHtml(profile) {
  const fieldHtml = (step) => {
    if (step.options) {
      return `
        <div class="field">
          <span>${step.label}</span>
          <div class="chips">
            ${step.options.map(([value, label], i) => `
              <label class="chip">
                <input type="radio" name="${step.key}" value="${i}" ${profile[step.key] === value ? 'checked' : ''}>
                <span>${label}</span>
              </label>
            `).join('')}
          </div>
        </div>
      `;
    }

    const input = step.key === 'name'
      ? `type="text" maxlength="30" value="${escapeHtml(profile.name)}"`
      : `type="text" inputmode="decimal" placeholder="Необов'язково"
         value="${profile.bodyWeight === null ? '' : formatWeight(profile.bodyWeight)}"`;
    return `
      <label class="field">
        <span>${step.label}</span>
        <input class="input" name="${step.key}" autocomplete="off" ${input}>
      </label>
    `;
  };

  return `
    <form class="card" id="profile-form">
      <h2 class="card-title">Профіль</h2>
      ${STEPS.map(fieldHtml).join('')}
      <p class="error" id="profile-error" hidden></p>
      <button class="btn btn-primary" type="submit">Зберегти профіль</button>
    </form>
  `;
}

// Віддає файл користувачу. Повертає false, якщо він сам скасував збереження.
async function saveFile(file) {
  // На телефоні відкриваємо меню «Поділитися» (звідти «Зберегти у Файли»):
  // у встановленій на iPhone програмі звичайне завантаження працює ненадійно
  const isTouch = matchMedia('(pointer: coarse)').matches;
  if (isTouch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (error) {
      if (error.name === 'AbortError') return false;
      // інша помилка: пробуємо звичайне завантаження нижче
    }
  }

  // Звичайне завантаження: тимчасове посилання на файл, по якому «клікаємо» з коду
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

// Сьогоднішня дата для назви файлу: "2026-11-10"
function todayStamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
