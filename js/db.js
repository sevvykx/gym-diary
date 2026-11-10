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
