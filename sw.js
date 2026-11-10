// Service Worker: зберігає файли програми в кеші, щоб вона працювала без інтернету.
// Дані тренувань тут ні до чого: вони лежать в IndexedDB.

// Змінюй номер, якщо треба примусово скинути кеш у всіх, хто встановив програму
const CACHE = 'gym-diary-v2';

// Усі файли програми. Додав новий файл у проєкт: допиши його сюди.
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/app.js',
  'js/db.js',
  'js/seed.js',
  'js/utils.js',
  'js/views/workout.js',
  'js/views/history.js',
  'js/views/exercises.js',
  'js/views/records.js',
  'js/views/settings.js',
  'js/views/onboarding.js',
  'vendor/dexie.mjs',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

// Під час розробки на localhost завжди беремо свіжі файли з сервера
const IS_DEV = self.location.hostname === 'localhost';

// Встановлення: завантажуємо всі файли в кеш
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
  self.skipWaiting(); // нова версія починає працювати одразу
});

// Активація: видаляємо кеші старих версій
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

// Кожен запит файлу проходить через цей обробник
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const isOwnFile = new URL(request.url).origin === self.location.origin;
  if (request.method !== 'GET' || !isOwnFile) return;

  const fresh = fetchAndCache(request);                          // свіжа версія з мережі
  const cached = caches.match(request, { ignoreSearch: true });  // збережена версія

  // Не даємо браузеру приспати Service Worker, поки кеш оновлюється
  event.waitUntil(fresh.catch(() => {}));

  event.respondWith(
    IS_DEV
      ? fresh.catch(() => cached)                     // розробка: мережа, а без неї кеш
      : cached.then((response) => response ?? fresh), // телефон: одразу кеш, оновлення у фоні
  );
});

// Завантажує файл з мережі і кладе копію в кеш
async function fetchAndCache(request) {
  const response = await fetch(request, { cache: 'no-cache' });
  if (response.ok) {
    const cache = await caches.open(CACHE);
    // Зберігаємо за адресою без ?параметрів, щоб не плодити копії одного файлу
    await cache.put(request.url.split('?')[0], response.clone());
  }
  return response;
}
