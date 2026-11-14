// Таймер відпочинку і секундомір. Іконку у верхній смузі видно лише на екрані активного
// тренування (стиль у styles.css); на інших екранах відлік іде далі, але його не видно.
// Час рахуємо від збережених міток (Date.now), а не додаємо по секунді:
// так він лишається правильним, навіть якщо телефон на якийсь час «заснув».

const STEP = 15;                // кнопки «−15 с» і «+15 с» під час відліку
const ITEM = 40;                // висота одного числа на барабані, px (як у styles.css)
const RING = 2 * Math.PI * 90;  // довжина кола з радіусом 90 (для кільця прогресу)

const button = document.getElementById('clock-btn');
const label = document.getElementById('clock-time');
const backdrop = document.getElementById('clock-backdrop'); // темний фон позаду панелі
const sheet = document.getElementById('clock-sheet');       // сама панель, що виїжджає знизу
const panel = document.getElementById('clock-panel');       // її вміст

let isOpen = false;     // чи відкрита панель
let mode = 'timer';     // що показує панель: 'timer' або 'stopwatch'
let timerSetting = 90;  // скільки секунд виставлено на таймері
let timerTotal = 0;     // повна тривалість поточного відліку, мс (для кільця)
let timerEndAt = null;  // мітка часу, коли таймер дійде до нуля, або null
let timerDone = false;  // таймер щойно закінчився: «0:00» кілька секунд блимає біля іконки
let swStartedAt = null; // мітка часу, від якої йде секундомір, або null, якщо він стоїть
let swElapsed = 0;      // скільки набігло до паузи, мс
let audio = null;       // для звукового сигналу
let frameId = null;     // запланований кадр секундоміра (щоб не запустити два цикли)

// Показує іконку, поки триває тренування. Коли тренування немає, ховає її і все скидає.
export function setClockVisible(visible) {
  button.hidden = !visible;
  if (visible) return;

  setOpen(false);
  timerEndAt = null;
  timerDone = false;
  swStartedAt = null;
  swElapsed = 0;
}

// Відкриває або закриває панель. Плавний рух роблять стилі класу is-open.
function setOpen(open) {
  isOpen = open;
  sheet.classList.toggle('is-open', open);
  backdrop.classList.toggle('is-open', open);
  document.body.classList.toggle('sheet-open', open); // сторінка позаду не прокручується
  if (open) draw();
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
    setTimeout(() => { timerDone = false; }, 5000); // «0:00» блимає 5 секунд і зникає
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

  if (!isOpen || mode !== 'timer' || !timerEndAt) return;

  // У панелі: цифри в центрі та частка кільця, що лишилась (від 1 до 0)
  panel.querySelector('#clock-big').textContent = formatClock(timerSeconds);
  panel.querySelector('#clock-ring').style.strokeDashoffset = RING * (1 - timerLeft() / timerTotal);
}

// Соті частки секунди міняються надто швидко для tick,
// тому секундомір у панелі перемальовуємо на кожному кадрі екрана
function frame() {
  if (!isOpen || mode !== 'stopwatch') return;
  panel.querySelector('#clock-big').textContent = formatStopwatch(stopwatchTime());
  if (swStartedAt) frameId = requestAnimationFrame(frame);
}

// Барабан із числами від 0 до 59. Прокручується пальцем і сам зупиняється рівно на числі.
function wheelHtml(unit, caption) {
  let items = '';
  for (let i = 0; i < 60; i++) items += `<div class="wheel-item">${i}</div>`;
  return `
    <div class="wheel-col">
      <div class="wheel" data-unit="${unit}">${items}</div>
      <span>${caption}</span>
    </div>
  `;
}

// Таймер до старту: барабани хвилин і секунд
const wheelsHtml = () => `
  <div class="wheels">
    ${wheelHtml('minutes', 'хв')}
    ${wheelHtml('seconds', 'с')}
  </div>
  <button class="btn btn-primary" data-action="timer-start">Старт</button>
`;

// Таймер іде: кільце, що зменшується
const ringHtml = () => `
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
  <button class="btn btn-danger mt" data-action="timer-stop">Стоп</button>
`;

// Ставить барабани на виставлений час і стежить за прокручуванням
function setupWheels() {
  const [minutes, seconds] = panel.querySelectorAll('.wheel');
  if (!minutes) return; // зараз показано не барабани

  minutes.scrollTop = Math.floor(timerSetting / 60) * ITEM;
  seconds.scrollTop = (timerSetting % 60) * ITEM;

  const read = (wheel) => Math.round(wheel.scrollTop / ITEM);
  for (const wheel of [minutes, seconds]) {
    wheel.addEventListener('scroll', () => {
      timerSetting = read(minutes) * 60 + read(seconds);
    });
    // Тап по числу теж вибирає його
    wheel.addEventListener('click', (event) => {
      const item = event.target.closest('.wheel-item');
      if (item) wheel.scrollTo({ top: Number(item.textContent) * ITEM, behavior: 'smooth' });
    });
  }
}

function draw() {
  let controls;
  if (mode === 'stopwatch') {
    controls = `
      <p class="clock-stopwatch" id="clock-big"></p>
      <div class="row">
        <button class="btn btn-primary" data-action="sw-toggle">${swStartedAt ? 'Пауза' : 'Старт'}</button>
        <button class="btn" data-action="sw-reset">Скинути</button>
      </div>
    `;
  } else {
    controls = timerEndAt ? ringHtml() : wheelsHtml();
  }

  panel.innerHTML = `
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
    ${controls}
  `;
  setupWheels();
  tick();
  cancelAnimationFrame(frameId);
  frame();
}

// Іконка відкриває панель, натискання на темний фон закриває
button.addEventListener('click', () => {
  timerDone = false;
  setOpen(true);
});

backdrop.addEventListener('click', () => setOpen(false));

panel.addEventListener('change', (event) => {
  mode = event.target.value;
  draw();
});

panel.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]');
  if (!action) return;

  switch (action.dataset.action) {
    case 'timer-add': {
      // Зсуваємо кінець відліку, що вже йде
      const seconds = Number(action.dataset.seconds);
      timerEndAt += seconds * 1000;
      timerTotal += seconds * 1000;
      break;
    }
    case 'timer-start':
      if (timerSetting === 0) return; // на барабанах 0 хв 0 с: запускати нічого
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

// ===== Перетягування панелі вниз =====

let dragStartY = null; // де палець торкнувся панелі, або null, якщо її не тягнуть
let dragStartAt = 0;   // і коли це було
let dragged = false;   // палець справді тягнув панель, а не просто натиснув кнопку

sheet.addEventListener('pointerdown', (event) => {
  if (event.target.closest('.wheel')) return; // барабан прокручується сам, панель при цьому не тягнемо
  dragStartY = event.clientY;
  dragStartAt = event.timeStamp;
  dragged = false;
});

sheet.addEventListener('pointermove', (event) => {
  if (dragStartY === null) return;
  const shift = Math.max(0, event.clientY - dragStartY);

  if (!dragged) {
    if (shift < 8) return; // дрібний рух пальця вважаємо звичайним натисканням
    dragged = true;
    sheet.setPointerCapture(event.pointerId); // рух надходить сюди, навіть якщо палець вийшов за панель
    sheet.classList.add('is-dragging');
    backdrop.classList.add('is-dragging');
  }

  // Панель їде за пальцем, а фон світлішає
  sheet.style.transform = `translateY(${shift}px)`;
  backdrop.style.opacity = 1 - shift / sheet.offsetHeight;
});

function endDrag(event) {
  if (dragStartY === null) return;
  const shift = Math.max(0, event.clientY - dragStartY);
  const speed = shift / (event.timeStamp - dragStartAt); // пікселів за мілісекунду
  dragStartY = null;
  if (!dragged) return;

  // Прибираємо зсув: далі панель сама плавно доїде вниз або повернеться на місце
  sheet.classList.remove('is-dragging');
  backdrop.classList.remove('is-dragging');
  sheet.style.transform = '';
  backdrop.style.opacity = '';

  // Закриваємо, якщо стягнули більш ніж на третину висоти або швидко змахнули
  if (shift > sheet.offsetHeight / 3 || speed > 0.5) setOpen(false);
}

sheet.addEventListener('pointerup', endDrag);
sheet.addEventListener('pointercancel', endDrag);

// Після перетягування браузер ще надсилає click туди, де відпустили палець: гасимо його,
// щоб випадково не натиснулась кнопка
sheet.addEventListener('click', (event) => {
  if (!dragged) return;
  dragged = false;
  event.stopPropagation();
  event.preventDefault();
}, true);

// Перехід на інший екран закриває панель: час і далі видно біля іконки
window.addEventListener('hashchange', () => setOpen(false));

setInterval(tick, 250);
