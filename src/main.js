/**
 * main.js — boot: lencana model, store global, scene manager (lazy), keyboard, loop animasi.
 * Pintasan: ←/→ scene · Spasi play/pause · F beku · R reset · 1/2 pilih mesin · L label · H panel asumsi.
 */
import './styles.css';
import { mountModelBadge } from './ui/modelBadge.js';
import { installTooltips } from './ui/tooltip.js';
import { createAssumptionsPanel } from './ui/assumptions.js';
import { STR } from './ui/strings.js';
import { createStore, defaultState, resetPatch, engineSwitchPatch, togglePlayPatch, toggleFreezePatch, cycleInitialState, flameInitialState, gtInitialState, noxInitialState, basisInitialState, calibInitialState, limitsInitialState, loadInitialState, compInitialState, emisInitialState } from './state/store.js';

const SCENES = [
  { id: 'piston', number: 1, load: () => import('./scenes/piston.js') },
  { id: 'cycles', number: 2, load: () => import('./scenes/cycles.js') },
  { id: 'combustion', number: 3, load: () => import('./scenes/combustion.js') },
  { id: 'nox', number: 4, load: () => import('./scenes/nox.js') },
  { id: 'turbine', number: 5, load: () => import('./scenes/turbine.js') },
  { id: 'partload', number: 6, load: () => import('./scenes/partload.js') },
  { id: 'compressor', number: 7, load: () => import('./scenes/compressor.js') },
  { id: 'emissions', number: 8, load: () => import('./scenes/emissions.js') },
];

document.querySelector('.brand').textContent = STR.app.brand;
mountModelBadge(document.getElementById('model-badge'));
installTooltips();

const store = createStore({ ...defaultState('diesel'), ...cycleInitialState(), ...flameInitialState(), ...noxInitialState(), ...gtInitialState(), ...basisInitialState(), ...calibInitialState(), ...limitsInitialState(), ...loadInitialState(), ...compInitialState(), ...emisInitialState() });
const assumptions = createAssumptionsPanel(store);
const app = document.getElementById('app');
const toastEl = document.getElementById('toast');
let toastTimer = 0;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 2200);
}

let current = null;
let index = -1;
let loading = false;

async function goTo(i) {
  if (i < 0 || i >= SCENES.length) { toast(STR.app.toast.noScene); return; }
  if (i === index || loading) return;
  loading = true;
  try {
    const mod = await SCENES[i].load();
    current?.dispose();
    app.replaceChildren();
    const msgEl = document.getElementById('key-message');
    document.getElementById('scene-tag').textContent = STR.app.sceneTag(mod.meta.number, mod.meta.title);
    msgEl.textContent = mod.meta.message;
    document.title = STR.app.docTitle(mod.meta.title);
    current = mod.createScene({ root: app, store, toast, setMessage: (t) => { msgEl.textContent = t; } });
    current.mount();
    index = i;
  } finally {
    loading = false;
  }
}

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const t = /** @type {HTMLInputElement} */ (e.target);
  if (t instanceof HTMLInputElement && t.type !== 'range') return;
  if (current?.onKey?.(e)) { e.preventDefault(); return; }
  const s = store.get();
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  switch (key) {
    case ' ':
      e.preventDefault();
      /** @type {HTMLElement} */ (document.activeElement)?.blur?.();
      if (s.frozen) toast(STR.app.toast.frozenHint);
      store.set(togglePlayPatch(s));
      break;
    case 'f': store.set(toggleFreezePatch(s)); break;
    case 'r': store.set(resetPatch(s)); toast(STR.app.toast.reset); break;
    case '1': case '2': {
      const engine = e.key === '1' ? 'diesel' : 'gas';
      if (engine !== s.engine) store.set(engineSwitchPatch(s, engine));
      break;
    }
    case '3': case '4': toast(STR.app.toast.turbine); break;
    case 'h': assumptions.toggle(); break;
    case 'p': toast(STR.app.toast.presenter); break;
    case 'ArrowRight': goTo(index + 1); break;
    case 'ArrowLeft': goTo(index - 1); break;
    default: return;
  }
});

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  current?.update(dt);
  requestAnimationFrame(loop);
}

goTo(0).then(() => requestAnimationFrame(loop));
