import Dexie from '../vendor/dexie.mjs';
import { STARTER_EXERCISES } from './seed.js';

export const db = new Dexie('gym-diary');

// Тут лише ключ та індекси; інші поля зберігаються без опису
db.version(1).stores({
  exercises: '++id, &name, muscleGroup', // { name, muscleGroup, isCustom }
  workouts: '++id, startedAt',           // { startedAt, finishedAt|null, exerciseIds: [] }
  sets: '++id, workoutId, exerciseId',   // { workoutId, exerciseId, weight, reps, createdAt }
});

// Спрацьовує тільки один раз, коли база створюється вперше
db.on('populate', (tx) => {
  tx.table('exercises').bulkAdd(
    STARTER_EXERCISES.map((e) => ({ ...e, isCustom: false })),
  );
});

// Просимо браузер не видаляти дані автоматично, коли мало місця
export async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}

// Тренування, яке триває зараз (ще не завершене), або undefined
export function getActiveWorkout() {
  return db.workouts
    .orderBy('startedAt')
    .reverse()
    .filter((w) => w.finishedAt === null)
    .first();
}

// Видаляє тренування разом з усіма його підходами
export function deleteWorkout(workoutId) {
  return db.transaction('rw', db.workouts, db.sets, async () => {
    await db.sets.where('workoutId').equals(workoutId).delete();
    await db.workouts.delete(workoutId);
  });
}

// Підходи цієї вправи з останнього тренування, де вона була (поточне не рахуємо).
// Повертає { date, sets } або null, якщо вправу ще не робили.
export async function getLastPerformance(exerciseId, currentWorkoutId) {
  const sets = await db.sets
    .where('exerciseId')
    .equals(exerciseId)
    .filter((s) => s.workoutId !== currentWorkoutId)
    .toArray();
  if (sets.length === 0) return null;

  const latest = sets.reduce((a, b) => (b.createdAt > a.createdAt ? b : a));
  return {
    date: latest.createdAt,
    sets: sets.filter((s) => s.workoutId === latest.workoutId),
  };
}

// ===== Резервна копія =====

// Усі дані одним об'єктом, готовим для запису у файл
export async function exportAll() {
  return {
    app: 'gym-diary',
    version: 1,
    exportedAt: new Date().toISOString(),
    exercises: await db.exercises.toArray(),
    workouts: await db.workouts.toArray(),
    sets: await db.sets.toArray(),
  };
}

// Перевіряє, що об'єкт схожий на нашу копію. Повертає текст помилки або null, якщо все гаразд.
export function checkBackup(data) {
  const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

  if (data?.app !== 'gym-diary') return 'Це не файл копії щоденника тренувань.';
  if (data.version > 1) return 'Файл створено новішою версією програми.';

  const ok =
    Array.isArray(data.exercises) &&
    Array.isArray(data.workouts) &&
    Array.isArray(data.sets) &&
    data.exercises.every((e) =>
      isNumber(e?.id) && typeof e.name === 'string' && typeof e.muscleGroup === 'string') &&
    data.workouts.every((w) =>
      isNumber(w?.id) && isNumber(w.startedAt) && Array.isArray(w.exerciseIds) &&
      (w.finishedAt === null || isNumber(w.finishedAt))) &&
    data.sets.every((s) =>
      isNumber(s?.id) && isNumber(s.workoutId) && isNumber(s.exerciseId) &&
      isNumber(s.weight) && isNumber(s.reps));

  return ok ? null : 'Файл копії пошкоджений.';
}

// Замінює всі дані вмістом копії. Усе в одній транзакції:
// якщо щось піде не так, зміни скасуються і старі дані залишаться.
export function importAll(data) {
  return db.transaction('rw', db.exercises, db.workouts, db.sets, async () => {
    await db.exercises.clear();
    await db.workouts.clear();
    await db.sets.clear();
    await db.exercises.bulkAdd(data.exercises);
    await db.workouts.bulkAdd(data.workouts);
    await db.sets.bulkAdd(data.sets);
  });
}
