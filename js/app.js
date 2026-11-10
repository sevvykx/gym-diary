import { db, requestPersistentStorage } from './db.js';
import { render as renderWorkout } from './views/workout.js';
import { render as renderHistory } from './views/history.js';
import { render as renderExercises } from './views/exercises.js';
import { render as renderRecords } from './views/records.js';
import { render as renderSettings } from './views/settings.js';

// Назва маршруту → заголовок і функція, що малює екран
const routes = {
  workout:   { title: 'Тренування', render: renderWorkout },
  history:   { title: 'Історія',    render: renderHistory },
  exercises: { title: 'Вправи',     render: renderExercises },
  records:   { title: 'Рекорди',    render: renderRecords },
  settings:  { title: 'Дані',       render: renderSettings },
};

const view = document.getElementById('view');
const title = document.getElementById('title');

// '#/history/7' → name = 'history', param = '7'
function parseHash() {
  const [name, param] = location.hash.replace(/^#\/?/, '').split('/');
  return { name: routes[name] ? name : 'workout', param };
}

async function navigate() {
  const { name, param } = parseHash();
  const route = routes[name];

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
