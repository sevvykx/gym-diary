import { db, getActiveWorkout, deleteWorkout, getLastPerformance } from '../db.js';
import { MUSCLE_GROUPS } from '../seed.js';
import { setClockVisible, startRest, pickRest, formatClock } from '../clock.js';
import { escapeHtml, formatDate, formatDaysAgo, formatElapsed, formatSet, formatWeight } from '../utils.js';

// Підхід для вправи, якої ще не було в минулих тренуваннях
const DEFAULT_SET = { weight: 20, reps: 10 };

// Перша з щойно доданих вправ: після перемальовування прокрутимо до неї
let justAddedId = null;

// Кнопка «Завершити» у верхній смузі. Її та кнопку «згорнути» видно,
// лише поки body має клас workout-open, тобто на екрані активного тренування.
const finishBtn = document.getElementById('finish-btn');

// Раз на секунду оновлює тривалість тренування
let durationTimer = null;

// Чи згорнуте активне тренування. Тоді вкладка «Тренування» показує стартовий екран,
// а саме тренування висить смужкою над нижньою навігацією (нею керує js/app.js).
export const workoutState = { minimized: false };

export async function render(el, param) {
  const workout = await getActiveWorkout();
  // Тренування починається і скасовується на цьому екрані: одразу показуємо чи ховаємо таймер
  setClockVisible(Boolean(workout));
  document.body.classList.remove('workout-open');

  if (param === 'add') {
    if (!workout) {
      location.replace('#/workout');
      return;
    }
    await renderPicker(el, workout);
  } else if (workout && !workoutState.minimized) {
    await renderActive(el, workout);
  } else {
    await renderStart(el, workout);
  }
}

// ===== Стартовий екран: тренування немає або воно згорнуте =====

// current: згорнуте тренування, якщо воно є
async function renderStart(el, current) {
  el.innerHTML = `
    <div class="empty">
      <h2>${current ? 'Тренування згорнуте' : 'Немає активного тренування'}</h2>
      <p>${current
        ? 'Воно триває далі. Розгорни його стрілкою на смужці внизу.'
        : "Почни нове, і тут з'являться вправи та підходи."}</p>
      <button class="btn btn-primary btn-big" id="start-workout">Почати тренування</button>
    </div>

    <dialog class="dialog" id="in-progress">
      <h2>Тренування вже триває</h2>
      <p class="muted">Продовжити його чи почати нове? Якщо почати нове, поточне буде видалено разом з підходами.</p>
      <button class="btn btn-primary" data-choice="continue">Продовжити тренування</button>
      <button class="btn btn-danger mt" data-choice="new">Почати нове</button>
      <button class="btn mt" data-choice="cancel">Скасувати</button>
    </dialog>
  `;

  const dialog = el.querySelector('#in-progress');
  // Стрілка «розгорнути» на смужці внизу: вона вміє показати тренування з анімацією
  const expand = () => document.getElementById('workout-expand').click();

  const startNew = () => db.workouts.add({ startedAt: Date.now(), finishedAt: null, exerciseIds: [] });

  el.querySelector('#start-workout').addEventListener('click', async () => {
    if (current) {
      dialog.showModal();
      return;
    }
    await startNew();
    render(el);
  });

  dialog.addEventListener('click', async (event) => {
    const choice = event.target.dataset.choice;
    if (!choice) return;
    dialog.close();

    if (choice === 'new') {
      await deleteWorkout(current.id);
      await startNew();
    }
    if (choice !== 'cancel') expand();
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
  // Нотатки до вправ цього тренування: { exerciseId: текст }
  const notes = workout.notes ?? {};

  el.innerHTML = `
    <div id="workout">
      <div class="workout-stats">
        <div><span>Тривалість</span><strong id="workout-duration">${formatElapsed(Date.now() - workout.startedAt)}</strong></div>
        <div><span>Об'єм</span><strong id="workout-volume"></strong></div>
        <div><span>Підходи</span><strong id="workout-sets"></strong></div>
      </div>
      ${isEmpty ? '<p class="muted">Додай першу вправу, щоб записувати підходи.</p>' : ''}
      ${workout.exerciseIds.map((id, i) => exerciseHtml(id, exercises[i], setsOf(id), lastTimes[i], notes[id])).join('')}
      <a class="btn ${isEmpty ? 'btn-primary' : ''}" href="#/workout/add">+ Додати вправу</a>
      <button class="btn btn-text mt-lg" data-action="cancel">Скасувати тренування</button>
    </div>
  `;

  const root = el.querySelector('#workout');

  // Об'єм і кількість підходів рахуємо лише з виконаних (відмічених галочкою)
  const updateStats = () => {
    const done = sets.filter((s) => s.done);
    const volume = done.reduce((sum, set) => sum + set.weight * set.reps, 0);
    root.querySelector('#workout-volume').textContent = `${formatWeight(volume)} кг`;
    root.querySelector('#workout-sets').textContent = done.length;
  };
  updateStats();

  // Тривалість іде щосекунди. Коли екран змінився і лічильника вже немає, зупиняємось.
  clearInterval(durationTimer);
  durationTimer = setInterval(() => {
    const node = document.getElementById('workout-duration');
    if (!node) {
      clearInterval(durationTimer);
      return;
    }
    node.textContent = formatElapsed(Date.now() - workout.startedAt);
  }, 1000);

  document.body.classList.add('workout-open');
  finishBtn.onclick = async () => {
    const undone = sets.filter((s) => !s.done);

    if (undone.length === sets.length) {
      if (!confirm('У тренуванні немає жодного виконаного підходу. Видалити його?')) return;
      await deleteWorkout(workout.id);
      render(el);
      return;
    }

    const question = undone.length > 0
      ? `Завершити тренування? Невідмічені підходи (${undone.length}) не збережуться.`
      : 'Завершити тренування?';
    if (!confirm(question)) return;

    // У завершеному тренуванні лишаються тільки виконані підходи
    await db.transaction('rw', db.workouts, db.sets, async () => {
      await db.sets.bulkDelete(undone.map((s) => s.id));
      await db.workouts.update(workout.id, { finishedAt: Date.now() });
    });
    location.hash = `#/history/${workout.id}`; // одразу показуємо підсумок
  };

  if (justAddedId) {
    root.querySelector(`[data-exercise="${justAddedId}"]`)?.scrollIntoView({ block: 'center' });
    justAddedId = null;
  }

  // Підхід, якому належить рядок таблиці з цим елементом
  const setOf = (node) => sets.find((s) => s.id === Number(node.closest('[data-set]').dataset.set));

  // Один обробник на всі кнопки: що робити, каже атрибут data-action
  root.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-action]');
    if (!btn) return;

    const card = btn.closest('[data-exercise]');
    const exerciseId = card ? Number(card.dataset.exercise) : null;

    switch (btn.dataset.action) {
      case 'toggle-set': {
        const set = setOf(btn);
        set.done = !set.done;
        if (set.done) set.createdAt = Date.now(); // час, коли підхід справді зроблено
        await db.sets.update(set.id, { done: set.done, createdAt: set.createdAt });
        btn.closest('.set-row').classList.toggle('is-done', set.done);
        btn.setAttribute('aria-pressed', set.done);
        updateStats();

        // Підхід виконано: запускаємо відпочинок, якщо він увімкнений для цієї вправи
        const rest = exercises[workout.exerciseIds.indexOf(exerciseId)]?.restSeconds;
        if (set.done && rest) startRest(rest);
        return; // змінився лише один рядок, перемальовувати екран не треба
      }

      case 'rest': {
        // Барабани з часом відпочинку; вибране запам'ятовується для цієї вправи назавжди
        const exercise = exercises[workout.exerciseIds.indexOf(exerciseId)];
        pickRest(exercise.restSeconds, async (seconds) => {
          await db.exercises.update(exerciseId, { restSeconds: seconds });
          render(el);
        });
        return;
      }

      case 'note': {
        // Показує або ховає поле нотатки; сам текст зберігається, коли поле втрачає фокус
        const field = card.querySelector('[data-note]');
        field.hidden = !field.hidden;
        if (!field.hidden) field.focus();
        return;
      }

      case 'add-set': {
        // Новий рядок копіює попередній; якщо рядків ще немає, бере минулий раз
        const exerciseSets = setsOf(exerciseId);
        const lastTime = lastTimes[workout.exerciseIds.indexOf(exerciseId)];
        const source = exerciseSets[exerciseSets.length - 1] ?? lastTime?.sets[0] ?? DEFAULT_SET;
        await db.sets.add(newSet(workout.id, exerciseId, source));
        break;
      }

      case 'delete-set': {
        const set = setOf(btn);
        if (!confirm(`Видалити підхід ${btn.textContent.trim()} («${formatSet(set)}»)?`)) return;
        await db.sets.delete(set.id);
        break;
      }

      case 'remove-exercise': {
        const count = setsOf(exerciseId).filter((s) => s.done).length;
        if (count > 0 && !confirm(`Прибрати вправу разом із виконаними підходами (${count})?`)) return;
        await db.transaction('rw', db.workouts, db.sets, async () => {
          await db.sets.bulkDelete(setsOf(exerciseId).map((s) => s.id));
          delete notes[exerciseId];
          await db.workouts.update(workout.id, {
            exerciseIds: workout.exerciseIds.filter((id) => id !== exerciseId),
            notes,
          });
        });
        break;
      }

      case 'cancel':
        if (!confirm('Скасувати тренування? Усі його підходи буде видалено.')) return;
        await deleteWorkout(workout.id);
        break;
    }

    render(el);
  });

  // У полі змінили вагу чи повтори: перевіряємо число, зберігаємо і показуємо в охайному вигляді.
  // Екран не перемальовуємо, щоб не збити курсор у сусідньому полі.
  root.addEventListener('change', async (event) => {
    const input = event.target;

    // Нотатка до вправи: порожню не зберігаємо
    if (input.matches('[data-note]')) {
      const exerciseId = Number(input.closest('[data-exercise]').dataset.exercise);
      const text = input.value.trim();
      if (text) notes[exerciseId] = text;
      else delete notes[exerciseId];
      await db.workouts.update(workout.id, { notes });
      return;
    }

    if (!input.matches('input[data-field]')) return;

    const set = setOf(input);
    const field = input.dataset.field;
    const value = parseFloat(input.value.replace(',', '.'));
    if (!Number.isNaN(value)) set[field] = normalize(field, value); // нечислове значення ігноруємо
    input.value = field === 'weight' ? formatWeight(set.weight) : set.reps;
    updateStats();
    await db.sets.update(set.id, { [field]: set[field] });
  });

  // Тап по полю виділяє число, тож нове значення одразу замінює старе
  root.addEventListener('focusin', (event) => {
    if (event.target.matches('input[data-field]')) event.target.select();
  });
}

// Картка однієї вправи: таблиця підходів, які можна відмітити виконаними
function exerciseHtml(exerciseId, exercise, exerciseSets, lastTime, note) {
  return `
    <section class="card" data-exercise="${exerciseId}">
      <div class="exercise-head">
        <h2>${escapeHtml(exercise?.name ?? 'Видалена вправа')}</h2>
        <button class="icon-btn" data-action="remove-exercise" aria-label="Прибрати вправу">×</button>
      </div>

      <p class="muted">${lastTime
        ? `Минулого разу: ${formatDate(lastTime.date)}, ${formatDaysAgo(lastTime.date)}`
        : 'Цієї вправи ще не було в минулих тренуваннях.'}</p>

      <div class="chip-row">
        ${exercise ? `
          <button class="chip-btn" data-action="rest">
            Відпочинок: ${exercise.restSeconds ? formatClock(exercise.restSeconds) : 'вимк.'}
          </button>
        ` : ''}
        <button class="chip-btn" data-action="note">Нотатка</button>
      </div>
      <textarea class="input note" data-note rows="2" maxlength="300"
        placeholder="Нотатка до цього тренування" ${note ? '' : 'hidden'}>${escapeHtml(note ?? '')}</textarea>

      <div class="set-row set-head">
        <span>№</span><span>Минуле</span><span>Кг</span><span>Повтори</span><span></span>
      </div>
      ${exerciseSets.map((set, i) => setRowHtml(set, i, lastTime?.sets[i])).join('')}

      <button class="btn mt" data-action="add-set">+ Додати підхід</button>
    </section>
  `;
}

// Рядок таблиці: номер (тап видаляє підхід), той самий підхід минулого разу, вага, повтори, галочка
function setRowHtml(set, index, previous) {
  return `
    <div class="set-row ${set.done ? 'is-done' : ''}" data-set="${set.id}">
      <button class="row-num" data-action="delete-set" aria-label="Видалити підхід ${index + 1}">${index + 1}</button>
      <span class="set-prev">${previous ? formatSet(previous) : '—'}</span>
      <input data-field="weight" type="text" inputmode="decimal" value="${formatWeight(set.weight)}" aria-label="Вага, кг">
      <input data-field="reps" type="text" inputmode="numeric" value="${set.reps}" aria-label="Повтори">
      <button class="set-check" data-action="toggle-set" aria-label="Підхід виконано" aria-pressed="${set.done}">
        <svg viewBox="0 0 24 24"><path d="M5 12.5l5 5 9-11"/></svg>
      </button>
    </div>
  `;
}

// Новий, ще не виконаний підхід із тими самими вагою і повторами, що в source
function newSet(workoutId, exerciseId, { weight, reps }) {
  return { workoutId, exerciseId, weight, reps, done: false, createdAt: Date.now() };
}

// Вага: від 0 до 999 кг; повтори: ціле число від 1 до 999
function normalize(field, value) {
  if (field === 'weight') return Math.min(999, Math.max(0, Math.round(value * 100) / 100));
  return Math.min(999, Math.max(1, Math.round(value)));
}

// ===== Вибір вправи (#/workout/add) =====

async function renderPicker(el, workout) {
  document.getElementById('title').textContent = 'Додати вправи';
  const exercises = await db.exercises.toArray();
  // id вибраних вправ у тому порядку, в якому їх натискали: так вони й стануть у тренуванні
  const picked = [];

  el.innerHTML = `
    <a class="btn" href="#/workout">‹ Назад до тренування</a>
    ${MUSCLE_GROUPS.map((group) => pickerGroupHtml(group, exercises, workout.exerciseIds)).join('')}
    <p class="muted mt-lg picker-space">Немає потрібної? Додай її в «Профіль» → «Вправи».</p>
    <div class="picker-bar">
      <button class="btn btn-primary" id="add-picked" disabled>Вибери вправи</button>
    </div>
  `;

  const addBtn = el.querySelector('#add-picked');

  el.querySelectorAll('[data-pick]').forEach((btn) => {
    btn.addEventListener('click', () => {
      // Повторне натискання знімає вибір
      const exerciseId = Number(btn.dataset.pick);
      const index = picked.indexOf(exerciseId);
      if (index === -1) picked.push(exerciseId);
      else picked.splice(index, 1);

      // Біля кожної вибраної вправи показуємо її номер по порядку
      el.querySelectorAll('[data-pick]').forEach((item) => {
        const order = picked.indexOf(Number(item.dataset.pick)) + 1;
        const badge = item.querySelector('.badge');
        item.classList.toggle('is-picked', order > 0);
        badge.textContent = order;
        badge.hidden = order === 0;
      });
      addBtn.disabled = picked.length === 0;
      addBtn.textContent = picked.length ? `Додати вправи: ${picked.length}` : 'Вибери вправи';
    });
  });

  addBtn.addEventListener('click', async () => {
    // Кожна нова вправа одразу отримує рядки підходів: ті самі, що минулого разу, або один типовий
    for (const exerciseId of picked) {
      const lastTime = await getLastPerformance(exerciseId, workout.id);
      const source = lastTime ? lastTime.sets : [DEFAULT_SET];
      await db.sets.bulkAdd(source.map((set) => newSet(workout.id, exerciseId, set)));
    }
    await db.workouts.update(workout.id, { exerciseIds: [...workout.exerciseIds, ...picked] });
    justAddedId = picked[0];
    location.replace('#/workout'); // replace, щоб «назад» не повертало на цей список
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
            <button class="list-item list-btn" ${added ? 'disabled' : `data-pick="${e.id}"`}>
              <span class="grow">${escapeHtml(e.name)}</span>
              ${added ? '<span class="badge">додано</span>' : '<span class="badge" hidden></span>'}
            </button>
          </li>
        `;
      }).join('')}
    </ul>
  `;
}
