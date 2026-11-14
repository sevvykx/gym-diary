// Таймер відпочинку і секундомір у верхній смузі. Іконку видно, лише поки триває тренування.
// Час рахуємо від збережених міток (Date.now), а не додаємо по секунді:
// так він лишається правильним, навіть якщо телефон на якийсь час «заснув».

const STEP = 15;                // кнопки «−15 с» і «+15 с»
const RING = 2 * Math.PI * 90;  // довжина кола з радіусом 90 (для кільця прогресу)

const button = document.getElementById('clock-btn');
const label = document.getElementById('clock-time');
const panel = document.getElementById('clock-panel');

let mode = 'timer';     // що показує панель: 'timer' або 'stopwatch'
let timerSetting = 90;  // скільки секунд виставлено на таймері
let timerTotal = 0;     // повна тривалість поточного відліку, мс (для кільця)
let timerEndAt = null;  // мітка часу, коли таймер дійде до нуля, або null
let timerDone = false;  // таймер щойно закінчився: «0:00» блимає біля іконки
let swStartedAt = null; // мітка часу, від якої йде секундомір, або null, якщо він стоїть
let swElapsed = 0;      // скільки набігло до паузи, мс
let audio = null;       // для звукового сигналу
let frameId = null;     // запланований кадр секундоміра (щоб не запустити два цикли)

// Показує іконку, поки триває тренування. Коли тренування немає, ховає її і все скидає.
export function setClockVisible(visible) {
  button.hidden = !visible;
  if (visible) return;

  panel.hidden = true;
  timerEndAt = null;
  timerDone = false;
  swStartedAt = null;
  swElapsed = 0;
}

// 95 → "1:35"
function formatClock(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

// Секундомір: хвилини, секунди й соті частки секунди. 83456 мс → "01:23:45"
function formatStopwatch(ms) {
  const pad = (n) => String(Math.floor(n)).padStart(2, '0');
  return `${pad(ms / 60000)}:${pad((ms / 1000) % 60)}:${pad((ms / 10) % 100)}`;
}

// Скільки лишилось на таймері, мс
function timerLeft() {
  return timerEndAt ? Math.max(0, timerEndAt - Date.now()) : 0;
}

// Скільки набігло на секундомірі, мс
function stopwatchTime() {
  return swElapsed + (swStartedAt ? Date.now() - swStartedAt : 0);
}

// Три короткі сигнали
function beep() {
  for (const delay of [0, 0.3, 0.6]) {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = 880;
    gain.gain.value = 0.3;
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(audio.currentTime + delay);
    oscillator.stop(audio.currentTime + delay + 0.2);
  }
}

// Кілька разів на секунду оновлює цифри біля іконки, а в панелі таймер і кільце
function tick() {
  if (timerEndAt && Date.now() >= timerEndAt) {
    timerEndAt = null;
    timerDone = true;
    beep();
    draw();
  }

  const timerSeconds = Math.ceil(timerLeft() / 1000);
  const swSeconds = Math.floor(stopwatchTime() / 1000);

  // Біля іконки: спершу таймер, якщо він іде; інакше секундомір
  let text = '';
  if (timerEndAt) text = formatClock(timerSeconds);
  else if (timerDone) text = '0:00';
  else if (swStartedAt || swElapsed) text = formatClock(swSeconds);
  label.textContent = text;
  label.classList.toggle('is-done', timerDone);

  if (panel.hidden || mode !== 'timer') return;

  // У панелі: цифри в центрі та частка кільця, що лишилась (від 1 до 0)
  const part = timerEndAt ? timerLeft() / timerTotal : 1;
  panel.querySelector('#clock-big').textContent = formatClock(timerEndAt ? timerSeconds : timerSetting);
  panel.querySelector('#clock-ring').style.strokeDashoffset = RING * (1 - part);
}

// Соті частки секунди міняються надто швидко для tick,
// тому секундомір у панелі перемальовуємо на кожному кадрі екрана
function frame() {
  if (panel.hidden || mode !== 'stopwatch') return;
  panel.querySelector('#clock-big').textContent = formatStopwatch(stopwatchTime());
  if (swStartedAt) frameId = requestAnimationFrame(frame);
}

function draw() {
  const controls = mode === 'timer'
    ? `
      <div class="clock-face">
        <svg viewBox="0 0 200 200">
          <circle class="clock-track" cx="100" cy="100" r="90"/>
          <circle class="clock-ring" id="clock-ring" cx="100" cy="100" r="90" stroke-dasharray="${RING}"/>
        </svg>
        <p class="clock-big" id="clock-big"></p>
      </div>
      <div class="row">
        <button class="btn" data-action="timer-add" data-seconds="${-STEP}">−${STEP} с</button>
        <button class="btn" data-action="timer-add" data-seconds="${STEP}">+${STEP} с</button>
      </div>
      ${timerEndAt
        ? '<button class="btn btn-danger mt" data-action="timer-stop">Стоп</button>'
        : '<button class="btn btn-primary mt" data-action="timer-start">Старт</button>'}
    `
    : `
      <p class="clock-stopwatch" id="clock-big"></p>
      <div class="row">
        <button class="btn btn-primary" data-action="sw-toggle">${swStartedAt ? 'Пауза' : 'Старт'}</button>
        <button class="btn" data-action="sw-reset">Скинути</button>
      </div>
    `;

  panel.innerHTML = `
    <div class="clock-inner">
      <div class="clock-head">
        <div class="chips">
          <label class="chip">
            <input type="radio" name="clock-mode" value="timer" ${mode === 'timer' ? 'checked' : ''}>
            <span>Таймер</span>
          </label>
          <label class="chip">
            <input type="radio" name="clock-mode" value="stopwatch" ${mode === 'stopwatch' ? 'checked' : ''}>
            <span>Секундомір</span>
          </label>
        </div>
        <button class="clock-close" data-action="close">Закрити</button>
      </div>
      ${controls}
    </div>
  `;
  tick();
  cancelAnimationFrame(frameId);
  frame();
}

// Іконка відкриває і закриває панель
button.addEventListener('click', () => {
  timerDone = false;
  panel.hidden = !panel.hidden;
  draw();
});

panel.addEventListener('change', (event) => {
  mode = event.target.value;
  draw();
});

panel.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]');
  if (!action) return;

  switch (action.dataset.action) {
    case 'close':
      panel.hidden = true; // відлік при цьому не зупиняється
      break;
    case 'timer-add': {
      const seconds = Number(action.dataset.seconds);
      if (timerEndAt) {
        // Таймер уже йде: зсуваємо кінець відліку
        timerEndAt += seconds * 1000;
        timerTotal += seconds * 1000;
      } else {
        timerSetting = Math.max(STEP, timerSetting + seconds);
      }
      break;
    }
    case 'timer-start':
      // Звук дозволено вмикати лише у відповідь на натискання, тому готуємо його тут
      audio ??= new AudioContext();
      audio.resume();
      timerTotal = timerSetting * 1000;
      timerEndAt = Date.now() + timerTotal;
      timerDone = false;
      break;
    case 'timer-stop':
      timerEndAt = null;
      break;
    case 'sw-toggle':
      if (swStartedAt) {
        swElapsed += Date.now() - swStartedAt;
        swStartedAt = null;
      } else {
        swStartedAt = Date.now();
      }
      break;
    case 'sw-reset':
      swStartedAt = null;
      swElapsed = 0;
      break;
  }
  draw();
});

// Перехід на інший екран закриває панель: час і далі видно біля іконки
window.addEventListener('hashchange', () => {
  panel.hidden = true;
});

setInterval(tick, 250);
