import { db, getProfile, getActiveWorkout, deleteWorkout, requestPersistentStorage } from './db.js';
import { render as renderWorkout, workoutState } from './views/workout.js';
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

// Активне тренування (для смужки згорнутого тренування) або null
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

  // Пішли з екрана тренування на інший: тренування вважаємо згорнутим.
  // Відкрили вибір вправ: навпаки, розгорнутим.
  if (name !== 'workout') workoutState.minimized = Boolean(active);
  else if (param === 'add') workoutState.minimized = false;

  // Згорнуте тренування показується смужкою над нижньою навігацією
  barWorkout = active ?? null;
  document.body.classList.toggle('has-workout-bar', Boolean(active) && workoutState.minimized);
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

// Робить нерухому копію поточного екрана (верхня смуга і вміст) на час анімації.
// kind: 'is-down' — копія з'їжджає вниз; 'is-under' — лежить під екраном, що виїжджає.
function addGhost(kind, ms) {
  const ghost = document.createElement('div');
  ghost.className = `slide-ghost ${kind}`;
  ghost.append(document.querySelector('.topbar').cloneNode(true), view.cloneNode(true));
  document.body.append(ghost);
  ghost.scrollTop = window.scrollY; // копія прокручена так само, як був екран
  setTimeout(() => ghost.remove(), ms);
}

// Стрілка вниз у верхній смузі. Лишаємось на вкладці «Тренування», але там одразу малюється
// стартовий екран зі смужкою внизу, а поверх нього з'їжджає вниз копія екрана тренування.
document.getElementById('minimize-btn').addEventListener('click', () => {
  addGhost('is-down', 250); // стільки триває анімація slide-down у styles.css
  workoutState.minimized = true;
  navigate();
});

// Стрілка вгору на смужці: тренування виїжджає знизу поверх копії екрана, що був до цього
document.getElementById('workout-expand').addEventListener('click', () => {
  addGhost('is-under', 300);
  workoutState.minimized = false;
  document.body.classList.add('slide-up');
  setTimeout(() => document.body.classList.remove('slide-up'), 300);
  // Якщо ми вже на вкладці «Тренування», адреса не зміниться, тому перемальовуємо самі
  if (parseHash().name === 'workout') navigate();
  else location.hash = '#/workout';
});

// Смітник на смужці
document.getElementById('workout-discard').addEventListener('click', async () => {
  if (!confirm('Скасувати тренування? Усі його підходи буде видалено.')) return;
  await deleteWorkout(barWorkout.id);
  workoutState.minimized = false;
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
