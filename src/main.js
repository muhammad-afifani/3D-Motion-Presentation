/**
 * main.js — boot: lencana model, store global, scene manager (lazy), keyboard, loop animasi.
 * Pintasan: ←/→ scene · Spasi play/pause · F beku · R reset · 1/2 pilih mesin · L label.
 */
import './styles.css';
import { mountModelBadge } from './ui/modelBadge.js';
import { installTooltips } from './ui/tooltip.js';
import { createStore, defaultState, resetPatch, engineSwitchPatch } from './state/store.js';

const SCENES = [
  { id: 'piston', number: 1, load: () => import('./scenes/piston.js') },
];

mountModelBadge(document.getElementById('model-badge'));
installTooltips();

const store = createStore(defaultState('diesel'));
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
  if (i < 0 || i >= SCENES.length) { toast('Scene lain dibangun di milestone berikutnya'); return; }
  if (i === index || loading) return;
  loading = true;
  try {
    const mod = await SCENES[i].load();
    current?.dispose();
    app.replaceChildren();
    current = mod.createScene({ root: app, store, toast });
    current.mount();
    index = i;
    document.getElementById('scene-tag').textContent = `Scene ${mod.meta.number} · ${mod.meta.title}`;
    document.getElementById('key-message').textContent = mod.meta.message;
    document.title = `${mod.meta.title} · Engine & Turbine Emission Lab`;
  } finally {
    loading = false;
  }
}

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const tag = /** @type {HTMLElement} */ (e.target).tagName;
  if (tag === 'INPUT' && /** @type {HTMLInputElement} */ (e.target).type !== 'range') return;
  if (current?.onKey?.(e)) { e.preventDefault(); return; }
  const s = store.get();
  switch (e.key) {
    case ' ':
      e.preventDefault();
      /** @type {HTMLElement} */ (document.activeElement)?.blur?.();
      store.set({ playing: !s.playing });
      break;
    case 'f': case 'F': store.set({ frozen: !s.frozen }); break;
    case 'r': case 'R': store.set(resetPatch(s)); toast('Parameter dikembalikan ke preset'); break;
    case '1': case '2': {
      const engine = e.key === '1' ? 'diesel' : 'gas';
      if (engine !== s.engine) store.set(engineSwitchPatch(s, engine));
      break;
    }
    case '3': case '4': toast('Turbin: Scene 5 (milestone M5)'); break;
    case 'h': case 'H': toast('Panel asumsi: milestone M4'); break;
    case 'p': case 'P': toast('Mode presenter: milestone M8'); break;
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
