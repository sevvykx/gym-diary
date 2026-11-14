import { db, getProfile, getActiveWorkout, deleteWorkout, requestPersistentStorage } from './db.js';
import { render as renderWorkout } from './views/workout.js';
import { render as renderHistory } from './views/history.js';
import { render as renderExercises } from './views/exercises.js';
import { render as renderRecords } from './views/records.js';
import { render as renderSettings } from './views/settings.js';
import { render as renderOnboarding } from './views/onboarding.js';
import { render as renderProfile } from './views/profile.js';
import { render as renderHome } from './views/home.js';
import { setClockVisible } from './clock.js';
import { formatElapsed } from './utils.js';

// Назва маршруту → заголовок і функція, що малює екран.
// parent: екран відкривається з профілю, тому має кнопку «назад» і підсвічує його вкладку.
const routes = {
  home:      { title: 'Головна',    render: renderHome },
  workout:   { title: 'Тренування', render: renderWorkout },
  profile:   { title: 'Профіль',    render: renderProfile },
  history:   { title: 'Історія',    render: renderHistory,   parent: 'profile' },
  exercises: { title: 'Вправи',     render: renderExercises, parent: 'profile' },
  records:   { title: 'Рекорди',    render: renderRecords,   parent: 'profile' },
  settings:  { title: 'Налаштування', render: renderSettings, parent: 'profile' },
  onboarding: { title: 'Знайомство', render: renderOnboarding },
};

const view = document.getElementById('view');
const title = document.getElementById('title');
const back = document.getElementById('back');
const barTime = document.getElementById('workout-bar-time');

// Активне тренування, поки воно згорнуте (тобто відкрито інший екран), або null
let barWorkout = null;

// '#/history/7' → name = 'history', param = '7'
function parseHash() {
  const [name, param] = location.hash.replace(/^#\/?/, '').split('/');
  return { name: routes[name] ? name : 'home', param };
}

async function navigate() {
  let { name, param } = parseHash();

  // Без профілю показуємо лише онбординг, а з профілем на нього вже не пускаємо
  const hasProfile = Boolean(await getProfile());
  if (!hasProfile) name = 'onboarding';
  else if (name === 'onboarding') name = 'workout';

  const route = routes[name];

  // Іконка таймера потрібна, лише поки триває тренування
  const active = await getActiveWorkout();
  setClockVisible(Boolean(active));

  // На всіх екранах, крім самого тренування, воно показується згорнутою смужкою внизу
  barWorkout = name === 'workout' ? null : active ?? null;
  document.body.classList.toggle('has-workout-bar', Boolean(barWorkout));
  updateBar();

  // Під час онбордингу ховаємо нижню навігацію (стиль у styles.css)
  document.body.classList.toggle('is-onboarding', name === 'onboarding');
  title.textContent = route.title;
  document.querySelectorAll('.tabbar a').forEach((a) => {
    a.classList.toggle('active', a.dataset.route === (route.parent ?? name));
  });

  // «Назад»: з деталей (#/history/7) до списку, зі списку до профілю
  back.hidden = !route.parent;
  if (route.parent) back.href = param ? `#/${name}` : `#/${route.parent}`;

  // Кнопки «згорнути» і «Завершити» показує лише екран активного тренування
  document.body.classList.remove('workout-open');
  view.innerHTML = '';
  window.scrollTo(0, 0);
  await route.render(view, param);
}

// ===== Згортання тренування =====

// Час на смужці згорнутого тренування
function updateBar() {
  if (barWorkout) barTime.textContent = `Тренування ${formatElapsed(Date.now() - barWorkout.startedAt)}`;
}
setInterval(updateBar, 1000);

// Стрілка вниз у верхній смузі: екран тренування з'їжджає вниз, і відкривається «Головна»
document.getElementById('minimize-btn').addEventListener('click', () => {
  view.classList.add('slide-down');
  setTimeout(() => {
    view.innerHTML = '';
    view.classList.remove('slide-down');
    location.hash = '#/home';
  }, 250); // стільки триває анімація slide-down у styles.css
});

// Стрілка вгору на смужці: тренування виїжджає знизу
document.getElementById('workout-expand').addEventListener('click', () => {
  view.classList.add('slide-up');
  setTimeout(() => view.classList.remove('slide-up'), 300);
  location.hash = '#/workout';
});

// Смітник на смужці
document.getElementById('workout-discard').addEventListener('click', async () => {
  if (!confirm('Скасувати тренування? Усі його підходи буде видалено.')) return;
  await deleteWorkout(barWorkout.id);
  navigate(); // перемальовуємо екран: смужка й таймер зникають
});

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
