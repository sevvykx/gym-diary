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
