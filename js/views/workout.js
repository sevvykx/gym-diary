import { db, getActiveWorkout, deleteWorkout, getLastPerformance } from '../db.js';
import { MUSCLE_GROUPS } from '../seed.js';
import { escapeHtml, formatDate, formatDaysAgo, formatSet, formatTime, formatWeight } from '../utils.js';

const WEIGHT_STEP = 2.5;
const DEFAULT_DRAFT = { weight: 20, reps: 10 };

// Що зараз стоїть у полях «вага» і «повтори» кожної вправи: exerciseId → { weight, reps }.
// Тримаємо окремо, щоб значення не скидалися, коли екран перемальовується.
const drafts = new Map();

// Вправа, яку щойно додали: після перемальовування прокрутимо до неї
let justAddedId = null;

export async function render(el, param) {
  const workout = await getActiveWorkout();

  if (param === 'add') {
    if (!workout) {
      location.replace('#/workout');
      return;
    }
    await renderPicker(el, workout);
  } else if (workout) {
    await renderActive(el, workout);
  } else {
    renderStart(el);
  }
}

// ===== Немає активного тренування =====

function renderStart(el) {
  el.innerHTML = `
    <div class="empty">
      <h2>Немає активного тренування</h2>
      <p>Почни нове, і тут з'являться вправи та підходи.</p>
      <button class="btn btn-primary btn-big" id="start-workout">Почати тренування</button>
    </div>
  `;

  el.querySelector('#start-workout').addEventListener('click', async () => {
    drafts.clear();
    await db.workouts.add({ startedAt: Date.now(), finishedAt: null, exerciseIds: [] });
    render(el);
  });
}

// ===== Тренування триває =====

async function renderActive(el, workout) {
  const exercises = await db.exercises.bulkGet(workout.exerciseIds);
  const sets = await db.sets.where('workoutId').equals(workout.id).toArray();
  const setsOf = (exerciseId) => sets.filter((s) => s.exerciseId === exerciseId);
  // Для кожної вправи: що було на попередньому тренуванні
  const lastTimes = await Promise.all(
    workout.exerciseIds.map((id) => getLastPerformance(id, workout.id)),
  );
  const isEmpty = workout.exerciseIds.length === 0;

  el.innerHTML = `
    <div id="workout">
      <p class="muted">Почато о ${formatTime(workout.startedAt)}</p>
      ${isEmpty ? '<p class="muted">Додай першу вправу, щоб записувати підходи.</p>' : ''}
      ${workout.exerciseIds.map((id, i) => exerciseHtml(id, exercises[i], setsOf(id), lastTimes[i])).join('')}
      <a class="btn ${isEmpty ? 'btn-primary' : ''}" href="#/workout/add">+ Додати вправу</a>
      <button class="btn btn-success btn-big mt-lg" data-action="finish">Завершити тренування</button>
      <button class="btn btn-text mt" data-action="cancel">Скасувати тренування</button>
    </div>
  `;

  const root = el.querySelector('#workout');

  if (justAddedId) {
    root.querySelector(`[data-exercise="${justAddedId}"]`)?.scrollIntoView({ block: 'center' });
    justAddedId = null;
  }

  // Один обробник на всі кнопки: що робити, каже атрибут data-action
  root.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-action]');
    if (!btn) return;

    const card = btn.closest('[data-exercise]');
    const exerciseId = card ? Number(card.dataset.exercise) : null;
    const draft = drafts.get(exerciseId);

    switch (btn.dataset.action) {
      case 'step': {
        const field = btn.dataset.field;
        readInputs(card, draft);
        draft[field] = normalize(field, draft[field] + Number(btn.dataset.delta));
        writeInputs(card, draft);
        return; // змінилося лише число в полі, перемальовувати екран не треба
      }

      case 'use-set': // тап по підходу з минулого разу підставляє його в поля
        draft.weight = Number(btn.dataset.weight);
        draft.reps = Number(btn.dataset.reps);
        writeInputs(card, draft);
        return;

      case 'add-set':
        readInputs(card, draft);
        await addSet(workout.id, exerciseId, draft);
        break;

      case 'repeat-set': {
        const exerciseSets = setsOf(exerciseId);
        const last = exerciseSets[exerciseSets.length - 1];
        drafts.set(exerciseId, { weight: last.weight, reps: last.reps });
        await addSet(workout.id, exerciseId, last);
        break;
      }

      case 'delete-set': {
        const set = sets.find((s) => s.id === Number(btn.dataset.set));
        if (!confirm(`Видалити підхід «${formatSet(set)}»?`)) return;
        await db.sets.delete(set.id);
        break;
      }

      case 'remove-exercise': {
        const count = setsOf(exerciseId).length;
        if (count > 0 && !confirm(`Прибрати вправу разом із записаними підходами (${count})?`)) return;
        await db.transaction('rw', db.workouts, db.sets, async () => {
          await db.sets.bulkDelete(setsOf(exerciseId).map((s) => s.id));
          await db.workouts.update(workout.id, {
            exerciseIds: workout.exerciseIds.filter((id) => id !== exerciseId),
          });
        });
        drafts.delete(exerciseId);
        break;
      }

      case 'finish':
        if (sets.length === 0) {
          if (!confirm('У тренуванні немає жодного підходу. Видалити його?')) return;
          await deleteWorkout(workout.id);
        } else {
          if (!confirm('Завершити тренування?')) return;
          await db.workouts.update(workout.id, { finishedAt: Date.now() });
        }
        drafts.clear();
        break;

      case 'cancel':
        if (!confirm('Скасувати тренування? Усі його підходи буде видалено.')) return;
        await deleteWorkout(workout.id);
        drafts.clear();
        break;
    }

    render(el);
  });

  // Число ввели з клавіатури: перевіряємо його і показуємо в охайному вигляді
  root.addEventListener('change', (event) => {
    const card = event.target.closest('[data-exercise]');
    if (!card || !event.target.matches('input[data-field]')) return;
    const draft = drafts.get(Number(card.dataset.exercise));
    readInputs(card, draft);
    writeInputs(card, draft);
  });

  // Тап по полю виділяє число, тож нове значення одразу замінює старе
  root.addEventListener('focusin', (event) => {
    if (event.target.matches('input[data-field]')) event.target.select();
  });
}

// Картка однієї вправи: записані підходи і поля для нового
function exerciseHtml(exerciseId, exercise, exerciseSets, lastTime) {
  const last = exerciseSets[exerciseSets.length - 1];

  // Початкові значення полів: останній підхід сьогодні, інакше перший підхід минулого разу
  if (!drafts.has(exerciseId)) {
    const source = last ?? lastTime?.sets[0] ?? DEFAULT_DRAFT;
    drafts.set(exerciseId, { weight: source.weight, reps: source.reps });
  }
  const draft = drafts.get(exerciseId);

  return `
    <section class="card" data-exercise="${exerciseId}">
      <div class="exercise-head">
        <h2>${escapeHtml(exercise?.name ?? 'Видалена вправа')}</h2>
        <button class="icon-btn" data-action="remove-exercise" aria-label="Прибрати вправу">×</button>
      </div>

      ${lastTimeHtml(lastTime)}

      <ol class="sets">
        ${exerciseSets.map((set, i) => `
          <li>
            <span class="set-num">${i + 1}</span>
            <span class="set-value">${formatSet(set)}</span>
            <button class="icon-btn" data-action="delete-set" data-set="${set.id}" aria-label="Видалити підхід">×</button>
          </li>
        `).join('')}
      </ol>

      <div class="steppers">
        ${stepperHtml('Вага, кг', 'weight', WEIGHT_STEP, formatWeight(draft.weight), 'decimal')}
        ${stepperHtml('Повтори', 'reps', 1, draft.reps, 'numeric')}
      </div>

      <button class="btn btn-primary" data-action="add-set">Додати підхід</button>
      ${last ? `<button class="btn mt" data-action="repeat-set">↻ Повторити: ${formatSet(last)}</button>` : ''}
    </section>
  `;
}

// Блок «Минулого разу»: дата і підходи попереднього тренування з цією вправою
function lastTimeHtml(lastTime) {
  if (!lastTime) return '<p class="muted">Цієї вправи ще не було в минулих тренуваннях.</p>';

  return `
    <div class="last-time">
      <span class="caption">Минулого разу · ${formatDate(lastTime.date)}, ${formatDaysAgo(lastTime.date)}</span>
      <div class="last-sets">
        ${lastTime.sets.map((set) => `
          <button class="last-set" data-action="use-set" data-weight="${set.weight}" data-reps="${set.reps}">
            ${formatSet(set)}
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

// Поле з числом і кнопками − та + з боків
function stepperHtml(label, field, step, value, inputmode) {
  return `
    <div>
      <span class="caption">${label}</span>
      <div class="stepper">
        <button data-action="step" data-field="${field}" data-delta="${-step}" aria-label="Менше">−</button>
        <input data-field="${field}" type="text" inputmode="${inputmode}" value="${value}" aria-label="${label}">
        <button data-action="step" data-field="${field}" data-delta="${step}" aria-label="Більше">+</button>
      </div>
    </div>
  `;
}

function addSet(workoutId, exerciseId, { weight, reps }) {
  return db.sets.add({ workoutId, exerciseId, weight, reps, createdAt: Date.now() });
}

// Забирає числа з полів картки в draft (нечислове значення ігнорує)
function readInputs(card, draft) {
  card.querySelectorAll('input[data-field]').forEach((input) => {
    const value = parseFloat(input.value.replace(',', '.'));
    if (!Number.isNaN(value)) draft[input.dataset.field] = normalize(input.dataset.field, value);
  });
}

function writeInputs(card, draft) {
  card.querySelector('input[data-field="weight"]').value = formatWeight(draft.weight);
  card.querySelector('input[data-field="reps"]').value = draft.reps;
}

// Вага: від 0 до 999 кг; повтори: ціле число від 1 до 999
function normalize(field, value) {
  if (field === 'weight') return Math.min(999, Math.max(0, Math.round(value * 100) / 100));
  return Math.min(999, Math.max(1, Math.round(value)));
}

// ===== Вибір вправи (#/workout/add) =====

async function renderPicker(el, workout) {
  document.getElementById('title').textContent = 'Додати вправу';
  const exercises = await db.exercises.toArray();

  el.innerHTML = `
    <a class="btn" href="#/workout">‹ Назад до тренування</a>
    ${MUSCLE_GROUPS.map((group) => pickerGroupHtml(group, exercises, workout.exerciseIds)).join('')}
    <p class="muted mt-lg">Немає потрібної? Додай її у вкладці «Вправи».</p>
  `;

  el.querySelectorAll('[data-pick]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const exerciseId = Number(btn.dataset.pick);
      await db.workouts.update(workout.id, { exerciseIds: [...workout.exerciseIds, exerciseId] });
      justAddedId = exerciseId;
      location.replace('#/workout'); // replace, щоб «назад» не повертало на цей список
    });
  });
}

function pickerGroupHtml(group, exercises, addedIds) {
  const items = exercises.filter((e) => e.muscleGroup === group);
  if (items.length === 0) return '';

  return `
    <h2 class="section-title">${group}</h2>
    <ul class="list">
      ${items.map((e) => {
        const added = addedIds.includes(e.id);
        return `
          <li>
            <button class="list-item list-btn" data-pick="${e.id}" ${added ? 'disabled' : ''}>
              <span class="grow">${escapeHtml(e.name)}</span>
              ${added ? '<span class="badge">додано</span>' : ''}
            </button>
          </li>
        `;
      }).join('')}
    </ul>
  `;
}
