import { db, getProfile, saveProfile, countWorkoutsThisWeek } from '../db.js';
import { escapeHtml, formatWeight, parseBodyWeight } from '../utils.js';
import { STEPS } from './onboarding.js';

export async function render(el, param) {
  const profile = await getProfile();

  if (param === 'edit') {
    renderEdit(el, profile);
  } else {
    await renderView(el, profile);
  }
}

// ===== Профіль =====

async function renderView(el, profile) {
  const total = await db.workouts.filter((w) => w.finishedAt !== null).count();
  const thisWeek = await countWorkoutsThisWeek();
  const exercises = await db.exercises.count();

  // Підпис цілі беремо зі STEPS: 'strength' → 'Сила'
  const goals = STEPS.find((step) => step.key === 'goal').options;
  const goalLabel = goals.find(([value]) => value === profile.goal)[1];

  el.innerHTML = `
    <section class="card">
      <h2 class="card-title">${escapeHtml(profile.name)}</h2>
      <p class="card-sub">Ціль: ${goalLabel}</p>
      <p class="card-sub">Тренувань: ${total} · цього тижня ${thisWeek} з ${profile.workoutsPerWeek}</p>
      <a class="btn mt" href="#/profile/edit">Редагувати профіль</a>
    </section>

    ${linkHtml('history', 'Історія', `Завершених тренувань: ${total}`)}
    ${linkHtml('records', 'Рекорди', 'Найкращі підходи в кожній вправі')}
    ${linkHtml('exercises', 'Вправи', `У списку: ${exercises}`)}
    ${linkHtml('settings', 'Налаштування', 'Резервна копія і відновлення')}
  `;
}

// Кнопка-картка, що веде на інший екран
function linkHtml(route, title, sub) {
  return `
    <a class="card" href="#/${route}">
      <div class="grow">
        <p class="card-title">${title}</p>
        <p class="card-sub">${sub}</p>
      </div>
      <span class="chevron">›</span>
    </a>
  `;
}

// ===== Редагування профілю =====

// Ті самі поля й варіанти, що у вступі
function renderEdit(el, profile) {
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

  el.innerHTML = `
    <form class="card" id="profile-form">
      <h2 class="card-title">Редагування профілю</h2>
      ${STEPS.map(fieldHtml).join('')}
      <p class="error" id="profile-error" hidden></p>
      <button class="btn btn-primary" type="submit">Зберегти</button>
      <a class="btn mt" href="#/profile">Скасувати</a>
    </form>
  `;

  const form = el.querySelector('#profile-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fields = form.elements;
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
    location.replace('#/profile'); // replace, щоб «назад» не повертало на форму
  });
}
