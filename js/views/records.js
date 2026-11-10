import { db } from '../db.js';
import { MUSCLE_GROUPS } from '../seed.js';
import { escapeHtml, formatDate, formatSet, formatWeight } from '../utils.js';

export async function render(el) {
  const exercises = await db.exercises.toArray();
  const sets = await db.sets.toArray();

  // Підходи, згруповані за вправою: Map { exerciseId → [підхід, ...] }
  const setsByExercise = new Map();
  for (const set of sets) {
    if (!setsByExercise.has(set.exerciseId)) setsByExercise.set(set.exerciseId, []);
    setsByExercise.get(set.exerciseId).push(set);
  }

  const html = MUSCLE_GROUPS.map((group) => {
    const cards = exercises
      .filter((e) => e.muscleGroup === group && setsByExercise.has(e.id))
      .map((e) => cardHtml(e, setsByExercise.get(e.id)))
      .join('');
    return cards ? `<h2 class="section-title">${group}</h2>${cards}` : '';
  }).join('');

  el.innerHTML = html || `
    <div class="empty">
      <h2>Рекордів ще немає</h2>
      <p>Вони порахуються автоматично після перших тренувань.</p>
    </div>
  `;
}

// Оцінка максимуму на 1 повтор за формулою Еплі: дає змогу порівняти 100 × 5 і 90 × 10
function oneRepMax({ weight, reps }) {
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

// Підхід з найбільшою оцінкою; якщо оцінки однакові, лишається той, що був раніше
function bestBy(sets, score) {
  return sets.reduce((best, set) => (score(set) > score(best) ? set : best));
}

function cardHtml(exercise, sets) {
  // Найважчий підхід; за однакової ваги виграє той, де більше повторів
  const heaviest = bestBy(sets, (s) => s.weight * 1000 + s.reps);

  let rows;
  if (heaviest.weight === 0) {
    // Вправа з власною вагою: рекордом є кількість повторів
    rows = rowHtml('Найбільше повторів', bestBy(sets, (s) => s.reps));
  } else {
    const strongest = bestBy(sets, oneRepMax);
    const estimate = `≈ ${formatWeight(Math.round(oneRepMax(strongest)))} кг на 1 повтор`;
    rows = rowHtml('Максимальна вага', heaviest) + rowHtml('Найкращий підхід', strongest, estimate);
  }

  return `
    <section class="card">
      <h2 class="card-title">${escapeHtml(exercise.name)}</h2>
      ${rows}
    </section>
  `;
}

// Рядок рекорду: зліва назва і дата, справа сам підхід
function rowHtml(label, set, note = '') {
  return `
    <div class="record">
      <div class="grow">
        <p>${label}</p>
        <p class="record-note">${formatDate(set.createdAt)}</p>
      </div>
      <div class="record-right">
        <p class="record-value">${formatSet(set)}</p>
        ${note ? `<p class="record-note">${note}</p>` : ''}
      </div>
    </div>
  `;
}
