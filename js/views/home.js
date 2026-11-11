import { db } from '../db.js';
import { escapeHtml, formatDuration, formatLongDate, formatTime, formatWeight } from '../utils.js';

// Мотиваційні фрази: щоразу, коли відкривається екран, показуємо випадкову
const QUOTES = [
  'Найважче тренування те, на яке ти не прийшов.',
  'Не чекай мотивації. Почни, і вона наздожене.',
  'Сьогоднішня втома стане завтрашньою силою.',
  'Маленький крок щодня дає більше, ніж великий раз на місяць.',
  'Ти змагаєшся лише з собою вчорашнім.',
  'Дисципліна працює і тоді, коли настрою немає.',
  'Ще один підхід. Саме він і рахується.',
  'Результат не приходить швидко, зате лишається надовго.',
  'Штанга однаково важка для всіх. Різниця в тому, хто повертається.',
  'Погане тренування краще за пропущене.',
  'Сила росте там, де закінчується зручність.',
  'Через рік ти подякуєш собі за сьогодні.',
];

export async function render(el) {
  // Останнє завершене тренування
  const workout = await db.workouts
    .orderBy('startedAt')
    .reverse()
    .filter((w) => w.finishedAt !== null)
    .first();

  const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];

  el.innerHTML = `
    <h2 class="section-title">Останнє тренування</h2>
    ${workout ? await workoutHtml(workout) : `
      <section class="card">
        <p class="card-sub">Завершених тренувань ще немає.</p>
        <a class="btn btn-primary mt" href="#/workout">До тренування</a>
      </section>
    `}

    <h2 class="section-title">Мотивація</h2>
    <section class="card">
      <p class="card-title">${quote}</p>
    </section>
  `;
}

// Картка тренування: дата, час, об'єм і вправи. Натискання відкриває деталі в історії.
async function workoutHtml(workout) {
  const sets = await db.sets.where('workoutId').equals(workout.id).toArray();
  const exercises = await db.exercises.bulkGet(workout.exerciseIds);

  // Об'єм: сума «вага × повтори» за всі підходи
  const volume = sets.reduce((sum, set) => sum + set.weight * set.reps, 0);
  const duration = formatDuration(workout.finishedAt - workout.startedAt);

  // Рядок на кожну вправу, де є хоча б один підхід
  const lines = workout.exerciseIds.map((exerciseId, i) => {
    const count = sets.filter((s) => s.exerciseId === exerciseId).length;
    if (count === 0) return '';
    const name = exercises[i]?.name ?? 'Видалена вправа';
    return `<p class="card-sub truncate">${escapeHtml(name)} · підходів: ${count}</p>`;
  }).join('');

  return `
    <a class="card" href="#/history/${workout.id}">
      <div class="grow">
        <p class="card-title">${formatLongDate(workout.startedAt)}</p>
        <p class="card-sub">${formatTime(workout.startedAt)} · ${duration} · об'єм ${formatWeight(volume)} кг</p>
        ${lines}
      </div>
      <span class="chevron">›</span>
    </a>
  `;
}
