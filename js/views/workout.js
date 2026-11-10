export function render(el) {
  el.innerHTML = `
    <div class="empty">
      <h2>Немає активного тренування</h2>
      <p>Почни нове, і тут з'являться вправи та підходи.</p>
      <button class="btn btn-primary btn-big" id="start-workout">Почати тренування</button>
    </div>
  `;
}
