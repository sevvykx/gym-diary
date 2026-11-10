import { db, getProfile, countWorkoutsThisWeek } from '../db.js';
import { escapeHtml } from '../utils.js';
import { STEPS } from './onboarding.js';

export async function render(el) {
  const profile = await getProfile();
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
    </section>

    ${linkHtml('history', 'Історія', `Завершених тренувань: ${total}`)}
    ${linkHtml('records', 'Рекорди', 'Найкращі підходи в кожній вправі')}
    ${linkHtml('exercises', 'Вправи', `У списку: ${exercises}`)}
    ${linkHtml('settings', 'Налаштування', 'Профіль і резервна копія')}
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
