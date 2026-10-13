import './styles.css';
import { mountModelBadge } from './ui/modelBadge.js';
import { createStore, defaultState } from './state/store.js';
import { derive, runSim, simKey } from './state/derive.js';
import { fmt, toBar, toLiter } from './ui/format.js';

mountModelBadge(document.getElementById('model-badge'));

const store = createStore(defaultState('diesel'));
let sim = runSim(store.get());
let key = simKey(store.get());

store.subscribe((s) => {
  if (simKey(s) !== key) { sim = runSim(s); key = simKey(s); }
});

const out = document.getElementById('frame-dump');
function render() {
  const f = derive(store.get(), sim);
  out.textContent = [
    `θ        ${fmt(f.theta, 1)}°  (${f.phase})`,
    `V        ${fmt(toLiter(f.V), 3)} L`,
    `P        ${fmt(toBar(f.P), 2)} bar`,
    `T        ${fmt(f.T, 0)} K`,
    `Pmax     ${fmt(toBar(f.summary.Pmax), 1)} bar`,
    `η rem    ${fmt(f.eta.brake, 3)}`,
  ].join('\n');
}
store.subscribe(render);
render();

let t0 = performance.now();
function tick(now) {
  const s = store.get();
  const dθ = 6 * s.rpmVisual * ((now - t0) / 1000);
  t0 = now;
  store.set({ theta: ((((s.theta + dθ + 360) % 720) + 720) % 720) - 360 });
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
