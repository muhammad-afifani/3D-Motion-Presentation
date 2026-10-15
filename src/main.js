/**
 * main.js — boot: lencana model, store global, scene manager (lazy), keyboard, loop animasi.
 * Pintasan: ←/→ scene · Spasi play/pause · F beku · R reset · 1/2 pilih mesin · L label · H panel asumsi · ? References · G Regulations · P presenter · S snapshot PNG · Q Quality · B Bloom · K laser pointer · Shift+K spotlight · Shift+D overlay debug.
 * Animation speed (state.animSpeed, 0,1×–2×) mengalikan dt animasi untuk semua scene; dt mentah ikut sebagai argumen kedua.
 * Persistensi ringan (state/persist.js): batas, satuan, basis, opsi Scene 11, scene awal; kalibrasi tidak disimpan.
 */
import './styles.css';
import { mountModelBadge } from './ui/modelBadge.js';
import { installTooltips } from './ui/tooltip.js';
import { createAssumptionsPanel } from './ui/assumptions.js';
import { createBasisCard } from './ui/basisCard.js';
import { createReferencesPage } from './ui/referencesPage.js';
import { createRegulationsPage } from './ui/regulationsPage.js';
import { isTypingTarget } from './ui/keys.js';
import { createCalibFlag, createQualityFlag } from './ui/statusFlags.js';
import { createQualityController, effectiveBloom, applyDisplay, displayState, QUALITY_TIERS } from './gfx/quality.js';
import { createPerfGuard } from './gfx/perfGuard.js';
import { createPersistence } from './state/persist.js';
import { SCENE_LIST } from './state/scenes.js';
import { createPresenterMode } from './ui/presenterMode.js';
import { button } from './ui/controls.js';
import { takeSnapshot } from './ui/snapshot.js';
import { createDebugOverlay } from './ui/debugOverlay.js';
import { fadeSwap } from './ui/transition.js';
import { createPointerTools } from './ui/pointer.js';
import { createFpsMeter } from './state/fpsMeter.js';
import { rendererStats, disposeLog } from './gfx/renderer.js';
import { STR } from './ui/strings.js';
import { regulationsInitialState } from './state/regulations.js';
import { fuelInitialState } from './state/deriveFuel.js';
import { createStore, defaultState, resetPatch, engineSwitchPatch, togglePlayPatch, toggleFreezePatch, cycleInitialState, flameInitialState, gtInitialState, noxInitialState, basisInitialState, calibInitialState, limitsInitialState, loadInitialState, compInitialState, emisInitialState, policyInitialState, ctrlInitialState, closingInitialState, animInitialState, displayInitialState, bloomCyclePatch, qualityCyclePatch } from './state/store.js';

/** Loader lazy per id scene (urutan & nomor di state/scenes.js, dipakai juga jendela presenter). */
const LOADERS = {
  piston: () => import('./scenes/piston.js'),
  cycles: () => import('./scenes/cycles.js'),
  combustion: () => import('./scenes/combustion.js'),
  nox: () => import('./scenes/nox.js'),
  turbine: () => import('./scenes/turbine.js'),
  partload: () => import('./scenes/partload.js'),
  compressor: () => import('./scenes/compressor.js'),
  emissions: () => import('./scenes/emissions.js'),
  policy: () => import('./scenes/policy.js'),
  controls: () => import('./scenes/controls.js'),
  closing: () => import('./scenes/closing.js'),
};
const SCENES = SCENE_LIST.map((x) => ({ ...x, load: LOADERS[x.id] }));

document.querySelector('.brand').textContent = STR.app.brand;
mountModelBadge(document.getElementById('model-badge'));
installTooltips();

const store = createStore({ ...defaultState('diesel'), ...cycleInitialState(), ...flameInitialState(), ...noxInitialState(), ...gtInitialState(), ...basisInitialState(), ...calibInitialState(), ...limitsInitialState(), ...loadInitialState(), ...compInitialState(), ...emisInitialState(), ...policyInitialState(), ...ctrlInitialState(), ...closingInitialState(), ...animInitialState(), ...displayInitialState(), ...regulationsInitialState(), ...fuelInitialState() });
const persist = createPersistence(store, { sceneNumbers: SCENES.map((x) => x.number) });
// Basis card dan References dibuat SEBELUM panel asumsi: pendengar Esc-nya jalan lebih dulu, jadi Esc menutup lapisan paling atas
const references = createReferencesPage();
const regulations = createRegulationsPage();
const basisCard = createBasisCard(document.body, { onOpenRefs: () => references.setOpen(true) });
const assumptions = createAssumptionsPanel(store, document.body, {
  available: persist.available,
  onReset: () => { persist.clear(); toast(STR.app.toast.savedReset); },
});
createCalibFlag(document.querySelector('.topbar__right'), store);
createQualityFlag(document.querySelector('.topbar__right'), store, () => assumptions.openSection('display'));

// kualitas adaptif + bloom global (hanya visual; derive* tidak membaca quality / bloomMode / qTier)
const qc = createQualityController();
const bloomGuard = createPerfGuard();
let lastDisplay = '';
function updateDisplay(rawDt) {
  const s = store.get();
  const { tier } = qc.sample(rawDt, s.quality);
  const g = bloomGuard.sample(rawDt, s.quality === 'auto' ? 'off' : s.bloomMode); // perfGuard = fallback saat Quality bukan Auto
  if (g.justTripped && s.bloomMode === 'auto' && QUALITY_TIERS[tier].bloom) toast(STR.scene3.toastBloomOff(g.fps));
  const bloom = effectiveBloom(s.bloomMode, tier, s.quality, g.tripped);
  const key = `${tier}|${bloom}`;
  if (key !== lastDisplay) { lastDisplay = key; applyDisplay({ tier, bloom }); }
  if (s.qTier !== tier) store.set({ qTier: tier });
}
store.subscribe((s, prev, changed) => { if (changed.includes('bloomMode') && s.bloomMode === 'auto') bloomGuard.reset(); });
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

const presenter = createPresenterMode({
  url: `${import.meta.env.BASE_URL}presenter.html`,
  getState: () => ({ scene: SCENES[index]?.number ?? SCENES[0].number, total: SCENES.length, playing: store.get().playing, frozen: store.get().frozen }),
  onNav: (dir) => goTo(index + dir),
  onGoto: (n) => goToScene(n),
  toast,
});
store.subscribe((s, prev, changed) => { if (changed.includes('playing') || changed.includes('frozen')) presenter.sync(); });
const tools = document.createElement('div');
tools.className = 'topbar__tools';
let snapping = false;
/** Tombol S: PNG 2× tampilan scene saat ini (tema gelap). */
async function snapshot() {
  if (snapping || index < 0) return;
  snapping = true;
  toast(STR.snapshot.busy);
  try {
    await takeSnapshot({ sceneNumber: SCENES[index].number, sceneTag: document.getElementById('scene-tag').textContent, toast });
  } finally {
    snapping = false;
  }
}
tools.append(
  button({ label: STR.snapshot.button, key: STR.snapshot.key, tip: STR.snapshot.buttonTip, onClick: () => snapshot() }).el,
  button({ label: STR.presenter.button, key: STR.presenter.key, tip: STR.presenter.buttonTip, onClick: () => presenter.toggle() }).el,
  button({ label: STR.basis.refs.button, key: STR.basis.refs.key, tip: STR.basis.refs.buttonTip, onClick: () => references.toggle() }).el,
  button({ label: STR.regulation.page.button, key: STR.regulation.page.key, tip: STR.regulation.page.buttonTip, onClick: () => regulations.toggle() }).el,
);
document.querySelector('.topbar__right').prepend(tools);

async function goTo(i) {
  if (i < 0 || i >= SCENES.length) { toast(STR.app.toast.noScene); return; }
  if (i === index || loading) return;
  loading = true;
  try {
    const mod = await SCENES[i].load();
    // fade-through ±350 ms (instan bila prefers-reduced-motion); data frame & HUD tidak disentuh
    await fadeSwap(app, () => {
      current?.dispose();
      app.replaceChildren();
      const msgEl = document.getElementById('key-message');
      document.getElementById('scene-tag').textContent = STR.app.sceneTag(mod.meta.number, mod.meta.title);
      msgEl.textContent = mod.meta.message;
      document.title = STR.app.docTitle(mod.meta.title);
      current = mod.createScene({ root: app, store, toast, setMessage: (t) => { msgEl.textContent = t; }, goToScene });
      current.mount();
      index = i;
    }, { skipOut: !current });
    persist.setScene(mod.meta.number);
    presenter.sync();
  } finally {
    loading = false;
  }
}

/** Pindah ke scene bernomor n (dipakai tautan kartu Scene 10). */
function goToScene(n) {
  const i = SCENES.findIndex((x) => x.number === n);
  if (i < 0) { toast(STR.app.toast.noScene); return; }
  goTo(i);
}

// laser pointer / spotlight (K / Shift+K; Esc mematikan)
const pointer = createPointerTools(document.body);
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && pointer.mode !== 'off') { pointer.set('off'); toast(STR.app.toast.pointer.off); } });

// overlay debug (Shift+D) + kait uji (scripts/e2e): hanya membaca statistik
const fpsMeter = createFpsMeter(1);
const heapMB = () => (performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null);
const debugOverlay = createDebugOverlay(document.body, () => ({ fps: fpsMeter.fps, ms: fpsMeter.ms, stats: rendererStats(), heapMB: heapMB(), quality: { mode: store.get().quality, ...displayState() } }));
window.__etelDebug = {
  stats: rendererStats, disposeLog, fps: () => fpsMeter.fps, heapMB,
  storeSubs: () => store.subscriberCount(), scene: () => SCENES[index]?.number ?? null, loading: () => loading,
  quality: () => ({ mode: store.get().quality, ...displayState() }),
  setQuality: (q) => store.set({ quality: q }),
  goToScene: (n) => goToScene(n),
  basisCardOpen: () => basisCard.open, referencesOpen: () => references.open, regulationsOpen: () => regulations.open,
};

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (isTypingTarget(e.target)) return; // tombol cepat mati saat fokus di kolom isian (input, select, textarea)
  if (e.key.toLowerCase() === 'r') persist.resetStartScene(); // R: scene awal berikutnya kembali ke Scene 1
  if (current?.onKey?.(e)) { e.preventDefault(); return; }
  const s = store.get();
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (e.shiftKey && key === 'd') { debugOverlay.toggle(); return; }
  if (key === 'k') { toast(STR.app.toast.pointer[pointer.toggle({ shift: e.shiftKey })]); return; }
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
    case '?': references.toggle(); break;
    case 'g': regulations.toggle(); break;
    case 'p': presenter.toggle(); break;
    case 's': snapshot(); break;
    case 'q': { const p = qualityCyclePatch(s); store.set(p); toast(STR.app.toast.quality(STR.assumptions.display.qualityOpts[p.quality])); break; }
    case 'b': { const p = bloomCyclePatch(s); store.set(p); toast(STR.app.toast.bloom(STR.assumptions.display.bloomOpts[p.bloomMode])); break; }
    case 'ArrowRight': goTo(index + 1); break;
    case 'ArrowLeft': goTo(index - 1); break;
    default: return;
  }
});

let last = performance.now();
function loop(now) {
  const rawDt = Math.max(0, (now - last) / 1000);   // dt mentah (fps & kualitas)
  const dt = Math.min(0.1, rawDt);                  // dt animasi dibatasi (tab kembali aktif, frame lambat)
  last = now;
  current?.update(dt * (store.get().animSpeed ?? 1), dt);
  fpsMeter.sample(rawDt);
  updateDisplay(rawDt);
  debugOverlay.update(rawDt);
  requestAnimationFrame(loop);
}

const startIdx = Math.max(0, SCENES.findIndex((x) => x.number === persist.startScene));
goTo(startIdx).then(() => requestAnimationFrame(loop));
