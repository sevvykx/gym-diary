import { db } from '../db.js';
import { MUSCLE_GROUPS } from '../seed.js';
import { escapeHtml } from '../utils.js';

export async function render(el) {
  const exercises = await db.exercises.toArray();

  el.innerHTML = `
    <button class="btn btn-primary" id="add-open">+ Своя вправа</button>

    <form class="card mt" id="add-form" hidden>
      <label class="field">
        <span>Назва</span>
        <input class="input" name="name" type="text" maxlength="60"
               autocomplete="off" placeholder="Наприклад, Тяга Т-грифа">
      </label>
      <div class="field">
        <span>Група м'язів</span>
        <div class="chips">
          ${MUSCLE_GROUPS.map((group, i) => `
            <label class="chip">
              <input type="radio" name="group" value="${group}" ${i === 0 ? 'checked' : ''}>
              <span>${group}</span>
            </label>
          `).join('')}
        </div>
      </div>
      <p class="error" id="add-error" hidden></p>
      <div class="row">
        <button class="btn" type="button" id="add-cancel">Скасувати</button>
        <button class="btn btn-primary" type="submit">Зберегти</button>
      </div>
    </form>

    ${MUSCLE_GROUPS.map((group) => groupHtml(group, exercises)).join('')}
  `;

  const openBtn = el.querySelector('#add-open');
  const form = el.querySelector('#add-form');
  const error = el.querySelector('#add-error');

  function toggleForm(show) {
    form.hidden = !show;
    openBtn.hidden = show;
    error.hidden = true;
    if (show) form.elements.name.focus();
  }

  openBtn.addEventListener('click', () => toggleForm(true));
  el.querySelector('#add-cancel').addEventListener('click', () => toggleForm(false));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = form.elements.name.value.trim().replace(/\s+/g, ' ');
    const muscleGroup = form.elements.group.value;

    let message = '';
    if (!name) {
      message = 'Введи назву вправи';
    } else if (exercises.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
      message = 'Вправа з такою назвою вже є';
    }
    if (message) {
      error.textContent = message;
      error.hidden = false;
      return;
    }

    await db.exercises.add({ name, muscleGroup, isCustom: true });
    render(el);
  });

  el.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.delete);
      const exercise = exercises.find((e) => e.id === id);

      if (await isUsed(id)) {
        alert('Цю вправу вже використано в тренуваннях, тому видалити її не можна.');
        return;
      }
      if (!confirm(`Видалити вправу «${exercise.name}»?`)) return;

      await db.exercises.delete(id);
      render(el);
    });
  });
}

// Один блок: заголовок групи і список її вправ
function groupHtml(group, exercises) {
  const items = exercises.filter((e) => e.muscleGroup === group);
  if (items.length === 0) return '';

  return `
    <h2 class="section-title">${group}</h2>
    <ul class="list">
      ${items.map((e) => `
        <li class="list-item">
          <span class="grow">${escapeHtml(e.name)}</span>
          ${e.isCustom ? `
            <span class="badge">своя</span>
            <button class="icon-btn" data-delete="${e.id}" aria-label="Видалити">×</button>
          ` : ''}
        </li>
      `).join('')}
    </ul>
  `;
}

// Чи є вправа в якомусь тренуванні або підході
async function isUsed(exerciseId) {
  const setsCount = await db.sets.where('exerciseId').equals(exerciseId).count();
  if (setsCount > 0) return true;
  const workoutsCount = await db.workouts
    .filter((w) => w.exerciseIds.includes(exerciseId))
    .count();
  return workoutsCount > 0;
}
