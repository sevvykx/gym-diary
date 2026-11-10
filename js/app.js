import { db, getProfile, requestPersistentStorage } from './db.js';
import { render as renderWorkout } from './views/workout.js';
import { render as renderHistory } from './views/history.js';
import { render as renderExercises } from './views/exercises.js';
import { render as renderRecords } from './views/records.js';
import { render as renderSettings } from './views/settings.js';
import { render as renderOnboarding } from './views/onboarding.js';

// Назва маршруту → заголовок і функція, що малює екран
const routes = {
  workout:   { title: 'Тренування', render: renderWorkout },
  history:   { title: 'Історія',    render: renderHistory },
  exercises: { title: 'Вправи',     render: renderExercises },
  records:   { title: 'Рекорди',    render: renderRecords },
  settings:  { title: 'Налаштування', render: renderSettings },
  onboarding: { title: 'Знайомство', render: renderOnboarding },
};

const view = document.getElementById('view');
const title = document.getElementById('title');

// '#/history/7' → name = 'history', param = '7'
function parseHash() {
  const [name, param] = location.hash.replace(/^#\/?/, '').split('/');
  return { name: routes[name] ? name : 'workout', param };
}

async function navigate() {
  let { name, param } = parseHash();

  // Без профілю показуємо лише онбординг, а з профілем на нього вже не пускаємо
  const hasProfile = Boolean(await getProfile());
  if (!hasProfile) name = 'onboarding';
  else if (name === 'onboarding') name = 'workout';

  const route = routes[name];

  // Під час онбордингу ховаємо нижню навігацію (стиль у styles.css)
  document.body.classList.toggle('is-onboarding', name === 'onboarding');
  title.textContent = route.title;
  document.querySelectorAll('.tabbar a').forEach((a) => {
    a.classList.toggle('active', a.dataset.route === name);
  });

  view.innerHTML = '';
  window.scrollTo(0, 0);
  await route.render(view, param);
}

// Для перевірки в консолі браузера: await db.exercises.toArray()
window.db = db;

async function start() {
  await db.open();
  requestPersistentStorage().then((ok) => console.log('Постійне сховище:', ok));
  window.addEventListener('hashchange', navigate);
  navigate();

  // Service Worker зберігає файли програми в кеші, щоб вона відкривалась без інтернету
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(console.error);
  }
}

start();
