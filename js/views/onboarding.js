import { saveProfile } from '../db.js';
import { escapeHtml } from '../utils.js';

// Кроки вступу. key: поле профілю. options: [значення для бази, підпис на кнопці].
// Кроки без options (ім'я та вага) мають поле для введення.
const STEPS = [
  { key: 'name', title: 'Як тебе звати?' },
  {
    key: 'goal',
    title: 'Яка твоя ціль?',
    options: [['strength', 'Сила'], ['muscle', "М'язова маса"], ['fitness', 'Загальна форма']],
  },
  {
    key: 'experience',
    title: 'Скільки вже тренуєшся?',
    options: [['beginner', 'Новачок'], ['intermediate', '0,5–2 роки'], ['advanced', '2+ роки']],
  },
  {
    key: 'workoutsPerWeek',
    title: 'Скільки тренувань на тиждень?',
    options: [[2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6']],
  },
  { key: 'bodyWeight', title: 'Яка твоя вага?' },
];

export function render(el) {
  // Відповіді живуть тут, поки користувач ходить між кроками.
  // Вагу тримаємо текстом, як її ввели; у число перетворюємо наприкінці.
  const answers = { name: '', goal: null, experience: null, workoutsPerWeek: null, bodyWeight: '' };
  draw(el, answers, 0);
}

function draw(el, answers, index) {
  const step = STEPS[index];

  let body;
  if (step.options) {
    // Вибрану раніше відповідь підсвічуємо, щоб її було видно після «Назад»
    body = `
      <div class="choices">
        ${step.options.map(([value, label], i) => `
          <button class="btn btn-big ${answers[step.key] === value ? 'btn-primary' : ''}"
                  type="button" data-option="${i}">${label}</button>
        `).join('')}
      </div>
    `;
  } else if (step.key === 'name') {
    body = `
      <form id="form">
        <input class="input" name="value" type="text" maxlength="30" autocomplete="given-name"
               placeholder="Ім'я" value="${escapeHtml(answers.name)}">
        <p class="error mt" id="error" hidden></p>
        <button class="btn btn-primary btn-big mt" type="submit">Далі</button>
      </form>
    `;
  } else {
    body = `
      <form id="form">
        <input class="input" name="value" type="text" inputmode="decimal" autocomplete="off"
               placeholder="Наприклад, 78,5" value="${escapeHtml(answers.bodyWeight)}">
        <p class="muted mt">У кілограмах. Для підрахунку вправ з власною вагою.</p>
        <p class="error" id="error" hidden></p>
        <button class="btn btn-primary btn-big" type="submit">Готово</button>
        <button class="btn mt" type="button" id="skip">Пропустити</button>
      </form>
    `;
  }

  el.innerHTML = `
    <div class="progress">
      <div class="progress-bar" style="width: ${((index + 1) / STEPS.length) * 100}%"></div>
    </div>
    <div class="page-head">
      <h2>${step.title}</h2>
      <p class="card-sub">Крок ${index + 1} з ${STEPS.length}</p>
    </div>
    ${body}
    ${index > 0 ? '<button class="btn btn-quiet mt" type="button" id="back">Назад</button>' : ''}
  `;

  const form = el.querySelector('#form');
  const error = el.querySelector('#error');
  form?.elements.value.focus();

  function showError(text) {
    error.textContent = text;
    error.hidden = false;
  }

  el.querySelector('#back')?.addEventListener('click', () => {
    if (form) answers[step.key] = form.elements.value.value; // щоб введене не зникло
    draw(el, answers, index - 1);
  });

  // Кнопка-варіант: запам'ятовуємо відповідь і одразу йдемо далі
  el.querySelectorAll('[data-option]').forEach((btn) => {
    btn.addEventListener('click', () => {
      answers[step.key] = step.options[btn.dataset.option][0];
      draw(el, answers, index + 1);
    });
  });

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = form.elements.value.value.trim().replace(/\s+/g, ' ');

    if (step.key === 'name') {
      if (!value) return showError("Введи своє ім'я");
      answers.name = value;
      draw(el, answers, index + 1);
    } else {
      const weight = Number(value.replace(',', '.'));
      if (!(weight >= 20 && weight <= 300)) {
        return showError('Введи вагу числом, наприклад 78,5, або натисни «Пропустити»');
      }
      finish(answers, weight);
    }
  });

  el.querySelector('#skip')?.addEventListener('click', () => finish(answers, null));
}

// Зберігає профіль і відкриває екран «Тренування»
async function finish(answers, bodyWeight) {
  await saveProfile({ ...answers, bodyWeight });
  // Міняємо адресу без події, а потім самі просимо app.js намалювати екран.
  // Просто location.hash не підходить: якщо адреса вже #/workout, подія не спрацює.
  history.replaceState(null, '', '#/workout');
  window.dispatchEvent(new Event('hashchange'));
}
