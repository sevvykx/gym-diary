import { db, deleteWorkout } from '../db.js';
import { escapeHtml, formatDuration, formatLongDate, formatSet, formatTime } from '../utils.js';

// #/history показує список, #/history/7 показує деталі тренування з id 7
export async function render(el, param) {
  if (param) {
    await renderDetails(el, Number(param));
  } else {
    await renderList(el);
  }
}

// ===== Список тренувань =====

async function renderList(el) {
  const workouts = await db.workouts
    .orderBy('startedAt')
    .reverse() // найновіші зверху
    .filter((w) => w.finishedAt !== null)
    .toArray();

  if (workouts.length === 0) {
    el.innerHTML = `
      <div class="empty">
        <h2>Історія порожня</h2>
        <p>Завершені тренування з'являться тут.</p>
      </div>
    `;
    return;
  }

  const sets = await db.sets.toArray();
  const names = await exerciseNames();

  el.innerHTML = workouts.map((workout) => {
    const workoutSets = sets.filter((s) => s.workoutId === workout.id);
    // Назви тільки тих вправ, де є хоча б один підхід
    const exerciseList = workout.exerciseIds
      .filter((id) => workoutSets.some((s) => s.exerciseId === id))
      .map((id) => names.get(id) ?? 'Видалена вправа')
      .join(', ');

    return `
      <a class="card" href="#/history/${workout.id}">
        <div class="grow">
          <p class="card-title">${formatLongDate(workout.startedAt)}</p>
          <p class="card-sub">${timeLine(workout)} · підходів: ${workoutSets.length}</p>
          <p class="card-sub truncate">${escapeHtml(exerciseList)}</p>
        </div>
        <span class="chevron">›</span>
      </a>
    `;
  }).join('');
}

// ===== Деталі одного тренування =====

async function renderDetails(el, workoutId) {
  const workout = await db.workouts.get(workoutId);

  if (!workout || workout.finishedAt === null) {
    el.innerHTML = `
      <a class="btn" href="#/history">‹ Назад до історії</a>
      <div class="empty"><h2>Тренування не знайдено</h2></div>
    `;
    return;
  }

  const sets = await db.sets.where('workoutId').equals(workoutId).toArray();
  const names = await exerciseNames();

  const cards = workout.exerciseIds.map((exerciseId) => {
    const exerciseSets = sets.filter((s) => s.exerciseId === exerciseId);
    if (exerciseSets.length === 0) return '';

    return `
      <section class="card">
        <h2 class="card-title">${escapeHtml(names.get(exerciseId) ?? 'Видалена вправа')}</h2>
        <ol class="sets sets-flush">
          ${exerciseSets.map((set, i) => `
            <li>
              <span class="set-num">${i + 1}</span>
              <span class="set-value">${formatSet(set)}</span>
            </li>
          `).join('')}
        </ol>
      </section>
    `;
  }).join('');

  el.innerHTML = `
    <a class="btn" href="#/history">‹ Назад до історії</a>
    <div class="page-head">
      <h2>${formatLongDate(workout.startedAt)}</h2>
      <p class="card-sub">${timeLine(workout)} · підходів: ${sets.length}</p>
    </div>
    ${cards}
    <button class="btn btn-danger mt-lg" id="delete-workout">Видалити тренування</button>
  `;

  el.querySelector('#delete-workout').addEventListener('click', async () => {
    if (!confirm('Видалити це тренування? Його підходи зникнуть з історії та рекордів.')) return;
    await deleteWorkout(workoutId);
    location.replace('#/history');
  });
}

// ===== Спільне =====

// "18:30 · 52 хв"
function timeLine(workout) {
  return `${formatTime(workout.startedAt)} · ${formatDuration(workout.finishedAt - workout.startedAt)}`;
}

// Назви вправ за id: Map { 1 → 'Жим лежачи', ... }
async function exerciseNames() {
  const exercises = await db.exercises.toArray();
  return new Map(exercises.map((e) => [e.id, e.name]));
}
