/**
 * main.js — boot: lencana model, store global, scene manager (lazy), navigasi Explore / mode Present, router hash,
 * keyboard, loop animasi.
 * Pintasan: ←/→ scene (Present; di Explore hanya saat fokus di navigasi) · Spasi play/pause · F beku · R reset · 1/2 pilih
 * mesin · L label · H panel asumsi · ? References · G Regulations · M Explore/Present · P presenter · S snapshot PNG ·
 * Q Quality · B Bloom · K laser pointer · Shift+K spotlight · Shift+D overlay debug.
 * Router (state/route.js): #/scene/N[/tab], #/regulations, #/formation, #/references[/id], #/glossary, #/assumptions;
 * M11: tanpa hash / #/ = landing (Explore; Present → Scene 1), #/about, #/learn[/id], #/learn/charts[/id] (ui/learnHost.js);
 * Learn/Chart guide/About di Present pindah ke Explore. Halaman penuh (References, Glossary, …) dibuka DI ATAS halaman Learn
 * atau landing; Close/Esc kembali ke halaman di bawahnya (alamat halaman langsung → landing). Pil "← Back to lesson"
 * (header kiri, di bawah tag scene) muncul setelah Try it dari pelajaran ke sebuah scene.
 * Halaman penuh menghentikan loop render (scene tetap ter-mount) dan melanjutkannya saat ditutup.
 * Animation speed (state.animSpeed, 0,1×–2×) mengalikan dt animasi untuk semua scene; dt mentah ikut sebagai argumen kedua.
 * Persistensi ringan (state/persist.js): batas, satuan, basis, opsi Scene 11, scene awal; kalibrasi tidak disimpan.
 */
import './styles.css';
import { mountModelBadge, relabelModelBadge } from './ui/modelBadge.js';
import { installTooltips } from './ui/tooltip.js';
import { createAssumptionsPanel } from './ui/assumptions.js';
import { createBasisCard } from './ui/basisCard.js';
import { createReferencesPage } from './ui/referencesPage.js';
import { createRegulationsPage } from './ui/regulationsPage.js';
import { createFormationPage } from './ui/formationPage.js';
import { createGlossaryPage } from './ui/glossaryPage.js';
import { isTypingTarget } from './ui/keys.js';
import { createCalibFlag, createQualityFlag } from './ui/statusFlags.js';
import { createQualityController, effectiveBloom, applyDisplay, displayState, QUALITY_TIERS } from './gfx/quality.js';
import { createPerfGuard } from './gfx/perfGuard.js';
import { createPersistence } from './state/persist.js';
import { SCENE_LIST, SCENE_NUMBERS } from './state/scenes.js';
import { parseHash, sceneHash, learnHash, TABBED_SCENE } from './state/route.js';
import { modeStorage, readMode, saveMode, otherMode, readNavCollapsed, saveNavCollapsed, arrowsChangeScene } from './state/mode.js';
import { createNav } from './ui/nav.js';
import { attachFormulaToggles } from './ui/formulaToggle.js';
import { button } from './ui/controls.js';
import { createThemeSwitch } from './ui/themeSwitch.js';
import { createLangSwitch } from './ui/langSwitch.js';
import { createLearnHost } from './ui/learnHost.js';
import { closeHelp, setHelpHandlers, openFor as helpOpenFor } from './ui/helpPopover.js';
import { createHelpButton } from './ui/helpButton.js';
import { createSettingsPanel } from './ui/settingsPanel.js';
import { notesStore } from './state/notes.js';
import { createBackLessonPill } from './ui/backLessonPill.js';
import { langStore } from './state/langStore.js';
import { unitsStore } from './state/unitsStore.js';
import { learnReady } from './state/learnStore.js';
import { guideIdForTitle } from './state/chartGuide.js';
import { backPillVisible, backTarget } from './state/learnView.js';
import { themeStorage, readTheme, writeTheme, applyTheme } from './state/theme.js';
import { refreshChartTheme } from './charts/chartBase.js';
import { viewportTone } from './gfx/viewportTone.js';
import { createPresenterMode } from './ui/presenterMode.js';
import { takeSnapshot } from './ui/snapshot.js';
import { createDebugOverlay } from './ui/debugOverlay.js';
import { fadeSwap } from './ui/transition.js';
import { createPointerTools } from './ui/pointer.js';
import { createFpsMeter } from './state/fpsMeter.js';
import { rendererStats, disposeLog } from './gfx/renderer.js';
import { STR, applyStringLang } from './ui/strings.js';
import { setNumberLang } from './ui/format.js';
import { regulationsInitialState } from './state/regulations.js';
import { fuelInitialState } from './state/deriveFuel.js';
import { leverInitialState } from './state/levers.js';
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

// Paket D1: bahasa UI → teks kelompok dua bahasa (state/i18n.js) dan format angka (ui/format.js). Pelanggan pertama
// langStore: berjalan sebelum komponen lain menggambar ulang dengan bahasa baru.
const applyUiLang = (l) => { setNumberLang(l); applyStringLang(l); };
applyUiLang(langStore.lang);
langStore.subscribe(applyUiLang);

document.querySelector('.topbar .brand').textContent = STR.app.brand;
mountModelBadge(document.getElementById('model-badge'));
installTooltips();

const store = createStore({ ...defaultState('diesel'), ...cycleInitialState(), ...flameInitialState(), ...noxInitialState(), ...gtInitialState(), ...basisInitialState(), ...calibInitialState(), ...limitsInitialState(), ...loadInitialState(), ...compInitialState(), ...emisInitialState(), ...policyInitialState(), ...ctrlInitialState(), ...closingInitialState(), ...animInitialState(), ...displayInitialState(), ...regulationsInitialState(), ...fuelInitialState(), ...leverInitialState() });
const persist = createPersistence(store, { sceneNumbers: SCENES.map((x) => x.number) });
/** Alamat scene saat ini (dipakai saat halaman penuh ditutup). */
const homeHash = () => (learnHost.open ? learnHash(learnHost.view, learnHost.viewId) : index >= 0 ? sceneHash(SCENES[index].number, SCENES[index].number === TABBED_SCENE ? store.get().pTab : null) : '#/');
// Basis card dan References dibuat SEBELUM panel asumsi: pendengar Esc-nya jalan lebih dulu, jadi Esc menutup lapisan paling atas
const references = createReferencesPage(document.body, { homeHash });
const regulations = createRegulationsPage(document.body, { homeHash });
const basisCard = createBasisCard(document.body, { onOpenRefs: () => references.setOpen(true) });
const formationPage = createFormationPage(store, { homeHash });
const glossary = createGlossaryPage({ homeHash });
const assumptions = createAssumptionsPanel(store, document.body, {
  available: persist.available,
  onReset: () => { persist.clear(); toast(STR.app.toast.savedReset); },
}, { homeHash });
const calibFlag = createCalibFlag(document.querySelector('.topbar__right'), store);
const qualityFlag = createQualityFlag(document.querySelector('.topbar__right'), store, () => assumptions.openSection('display'));

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
let formulaToggles = null;
let index = -1;
let loading = false;

const presenter = createPresenterMode({
  url: `${import.meta.env.BASE_URL}presenter.html`,
  getState: () => ({ scene: SCENES[index]?.number ?? SCENES[0].number, total: SCENES.length, playing: store.get().playing, frozen: store.get().frozen, start: learnHost?.view === 'landing' }),
  onNav: (dir) => goTo(index + dir),
  onGoto: (n) => goToScene(n),
  toast,
});
store.subscribe((s, prev, changed) => { if (changed.includes('playing') || changed.includes('frozen')) presenter.sync(); });
let snapping = false;
/** Tombol S: PNG 2× tampilan scene saat ini (tema gelap). */
async function snapshot() {
  if (snapping || index < 0 || learnHost.open) return;
  snapping = true;
  toast(STR.snapshot.busy);
  try {
    await takeSnapshot({ sceneNumber: SCENES[index].number, sceneTag: document.getElementById('scene-tag').textContent, toast });
  } finally {
    snapping = false;
  }
}

// ── halaman penuh (satu yang terbuka; loop render berhenti selama terbuka) ──
/** Halaman Assumptions = panel H dalam tata letak halaman (satu komponen); overlay H tidak dihitung sebagai halaman. */
const assumptionsPage = { get open() { return assumptions.isPage; }, setOpen: (on) => (on ? assumptions.setPage(true) : assumptions.isPage && assumptions.setOpen(false)) };
// M11: landing / Learn / Chart guide / About mengisi area di bawah header (scene disembunyikan, header tetap)
// Pil "← Back to lesson": Try it dari pelajaran → scene tujuan; tampil selama scene itu terbuka di Explore (state/learnView.js)
let backLesson = null, pendingBack = null;
const backPill = createBackLessonPill(document.querySelector('.topbar__left'), () => langStore.lang);
function syncBack() {
  const ok = backPillVisible(backLesson, { mode, learnOpen: learnHost.open, sceneNumber: SCENES[index]?.number ?? null });
  if (ok) backPill.show(backLesson.lessonId); else { backLesson = null; backPill.hide(); }
}
const learnHost = createLearnHost({
  shell: document.querySelector('.shell'), app,
  continueScene: () => (index >= 0 ? SCENES[index].number : persist.savedScene),
  onPresent: () => { setMode('present'); goToScene(1); },
  onChange: () => { presenter.sync(); syncBack(); },
  onTry: (lessonId, route) => { pendingBack = backTarget(lessonId, parseHash(route)); },
  onWord: (termId, from) => { closeOverlays('glossary'); glossary.focusTerm(termId, from); },
});
setHelpHandlers({ onGlossary: (termId) => { closeOverlays('glossary'); glossary.focusTerm(termId, 'glossary'); } }); // kartu bantuan → Read more → Glossary (overlay di atas scene)
const PAGE_API = { regulations, formation: formationPage, references, glossary, assumptions: assumptionsPage, ...learnHost.pages };
/** Halaman penuh yang melapisi halaman Learn / landing / scene (Close kembali ke bawahnya). */
const OVERLAYS = ['regulations', 'formation', 'references', 'glossary', 'assumptions'];
const openPage = () => Object.keys(PAGE_API).find((p) => PAGE_API[p].open) ?? null;
function closeOverlays(except = null) { for (const p of OVERLAYS) if (p !== except && PAGE_API[p].open) PAGE_API[p].setOpen(false); }
function showPage(p) {
  closeOverlays(p);
  PAGE_API[p]?.setOpen(true);
}
function togglePage(p) { if (PAGE_API[p].open) PAGE_API[p].setOpen(false); else showPage(p); }

// ── mode Explore / Present + navigasi ──
const storage = modeStorage();
let mode = readMode(storage);
const nav = createNav(document.body, {
  sceneNumbers: [...SCENE_NUMBERS],
  onScene: (n) => { for (const api of Object.values(PAGE_API)) if (api.open) api.setOpen(false); goToScene(n); },
  onPage: (p) => showPage(p),
  onTool: (id) => { if (id === 'snapshot') snapshot(); else if (id === 'presenter') presenter.toggle(); else setMode('present'); },
  onCollapse: (c) => { setCollapsed(c); saveNavCollapsed(storage, c); },
});
function setCollapsed(c) { nav.setCollapsed(c); document.body.classList.toggle('nav-collapsed', c); }
setCollapsed(readNavCollapsed(storage, window.innerWidth));
const hintEl = document.getElementById('mode-hint');
let hintTimer = 0;
// Present: tombol "Explore (M)" selalu terlihat di header kanan atas (tidak ikut ekspor PNG)
const exitPresent = button({ label: STR.nav.exitPresent, key: STR.nav.modeKey, tip: STR.nav.exitPresentTip, onClick: () => setMode('explore') });
exitPresent.el.classList.add('present-exit');
exitPresent.el.dataset.snapSkip = '';
document.querySelector('.topbar__right').prepend(exitPresent.el);
// header kanan: [Explore (M)] … [slot EN/ID] [Dark/Light] [Model OK]; slot bahasa diisi paket M11 / D
const themeStore = themeStorage();
let theme = applyTheme(readTheme(themeStore));
const themeSwitch = createThemeSwitch({ value: theme, onChange: (t) => setTheme(t) });
const langSlot = document.createElement('span');
langSlot.className = 'lang-slot';
langSlot.id = 'lang-slot';
const langSwitch = createLangSwitch({ value: langStore.lang, onChange: (l) => langStore.set(l) });
langSlot.append(langSwitch.el);
langStore.subscribe((l) => { langSwitch.set(l); themeSwitch.relabel(); backPill.refresh(); relabelChrome(); relangView(); });
// Satuan tampilan (M13, bendera UNITS_UI): ganti satuan memasang ulang scene seperti ganti bahasa (state di store tetap, tanpa string
// dibangun tiap frame); satuan isian batas (ppm / mg) mengikuti satuan konsentrasi pilihan. Model dan jalur regulasi tidak ikut berubah.
const syncLimUnit = () => { const u = unitsStore.unit('concentration'); if (u !== 'auto') store.set({ limUnit: u === 'mgNm3' ? 'mg' : 'ppm' }); };
syncLimUnit();
unitsStore.subscribe(() => { syncLimUnit(); relangView(); });
const settings = createSettingsPanel({ getMode: () => mode, getState: () => store.get() }); // ⚙ Settings (popover; Hide working notes)
document.getElementById('model-badge').before(langSlot, themeSwitch.el, createHelpButton('hdr.switches', { describes: themeSwitch.el }).el, settings.el); // ⓘ kelompok sakelar, lalu ⚙
document.getElementById('model-badge').after(createHelpButton('hdr.status', { describes: document.getElementById('model-badge') }).el); // ⓘ lencana Model OK dan chip Quality
/**
 * Bahasa berubah (D1): teks statis scene, grafik canvas, dan chip "ƒ Formula" diambil saat scene dipasang → pasang ulang
 * scene yang sama (state di store tetap, seperti ganti tone viewport); halaman penuh / panel H yang terbuka dirender ulang.
 */
let relangPending = false;
function relangView() {
  if (index >= 0) { if (loading) relangPending = true; else goTo(index, true); }
  // halaman penuh: judul dan isi dirender ulang; halaman Learn / About / Chart guide memakai langganan learnHost sendiri
  for (const p of OVERLAYS) { const api = PAGE_API[p]; if (api.refresh) api.refresh(); }
  assumptions.relabel(); // D6: isi panel H dibangun ulang dalam bahasa baru
  basisCard.relabel();
}
/** Komponen header dan navigasi yang dibuat sekali: ambil teks ulang dari STR (sudah berbahasa baru). */
function relabelChrome() {
  document.querySelector('.topbar .brand').textContent = STR.app.brand;
  nav.relabel();
  exitPresent.setLabel(STR.nav.exitPresent); exitPresent.setTip(STR.nav.exitPresentTip);
  hintEl.textContent = hintEl.classList.contains('is-on') ? STR.nav.hintPresent : hintEl.textContent;
  relabelModelBadge(document.getElementById('model-badge'));
  calibFlag.relabel(); qualityFlag.relabel();
  presenter.relabel();
}
/** Ganti tema: atribut data-theme, simpan (etel:theme), grafik canvas membaca ulang token warna. */
function setTheme(t) {
  if (t === theme) return;
  const toneBefore = viewportTone();
  theme = applyTheme(t);
  writeTheme(themeStore, theme);
  themeSwitch.set(theme);
  refreshChartTheme();
  // nyala, bloom, dan partikel 3D dipilih saat rig dibuat: tone viewport berubah → pasang ulang scene (state di store tetap)
  if (viewportTone() !== toneBefore) { if (index >= 0) goTo(index, true); learnHost.retheme(); }
}
/** Catatan kerja tersembunyi? Pilihan tersimpan (Settings) atau, tanpa pilihan, hanya di Present (state/notes.js). */
const syncNotes = () => document.body.classList.toggle('hide-notes', notesStore.hide(mode));
notesStore.subscribe(syncNotes);
function applyMode() {
  syncNotes();
  document.body.classList.toggle('mode-explore', mode === 'explore');
  document.body.classList.toggle('mode-present', mode === 'present');
  nav.el.hidden = mode === 'present';
  exitPresent.el.hidden = mode !== 'present';
  syncBack();
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize'))); // kanvas & grafik mengukur ulang lebar
}
/** Ganti mode (M); masuk Present → petunjuk kecil "M: Explore" sesaat. */
function setMode(m) {
  if (m === mode) return;
  mode = m;
  saveMode(storage, mode);
  closeHelp(false); // ⓘ tersembunyi di Present; kartu yang terbuka ikut tertutup
  settings.close(); // ⚙ juga tersembunyi di Present
  applyMode();
  // landing tidak tampil di Present: tutup, dan pastikan ada scene (Scene 1 bila belum ada)
  if (mode === 'present' && learnHost.open) { learnHost.close(); if (index < 0) goTo(0); else syncHash(); }
  if (mode === 'present') {
    if (nav.hasFocus()) /** @type {HTMLElement} */ (document.activeElement)?.blur?.();
    hintEl.textContent = STR.nav.hintPresent;
    hintEl.classList.add('is-on');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hintEl.classList.remove('is-on'), 2500);
  } else {
    hintEl.classList.remove('is-on');
    toast(STR.nav.toastExplore);
  }
}
applyMode();

/** @param {number} i @param {boolean} [force] pasang ulang scene yang sama (mis. tone viewport berubah karena ganti tema) */
async function goTo(i, force = false) {
  if (i < 0 || i >= SCENES.length) { toast(STR.app.toast.noScene); return; }
  if (i === index && !force) { syncHash(); return; } // mis. Scene N dipilih dari navigasi saat halaman Learn menutupi scene N
  if (loading) return;
  loading = true;
  try {
    const mod = await SCENES[i].load();
    // fade-through ±350 ms (instan bila prefers-reduced-motion); data frame & HUD tidak disentuh
    await fadeSwap(app, () => {
      closeHelp(false); // kartu bantuan milik scene lama
      formulaToggles?.dispose(); formulaToggles = null;
      current?.dispose();
      app.replaceChildren();
      const msgEl = document.getElementById('key-message');
      document.getElementById('scene-tag').textContent = STR.app.sceneTag(mod.meta.number, mod.meta.title);
      msgEl.textContent = mod.meta.message;
      document.title = STR.app.docTitle(mod.meta.title);
      current = mod.createScene({ root: app, store, toast, setMessage: (t) => { msgEl.textContent = t; }, goToScene });
      current.mount();
      formulaToggles = attachFormulaToggles(app, store); // chip "ƒ Formula" di atas visual 3D (pilihan global)
      index = i;
    }, { skipOut: !current });
    persist.setScene(mod.meta.number);
    nav.setScene(mod.meta.number);
    syncHash();
    presenter.sync();
    syncBack();
  } finally {
    loading = false;
  }
  if (relangPending) { relangPending = false; goTo(index, true); } // bahasa berganti saat scene sedang dimuat
}

/** Alamat mengikuti scene (dan tab Scene 9) selama tidak ada halaman penuh terbuka; replaceState tidak memicu hashchange. */
function syncHash() {
  if (index < 0 || openPage()) return;
  const h = homeHash();
  if (location.hash !== h) history.replaceState(null, '', h);
}
store.subscribe((s, prev, changed) => { if (changed.includes('pTab') && SCENES[index]?.number === TABBED_SCENE) syncHash(); });

/** Terapkan alamat: scene (+ tab Scene 9) atau halaman. Halaman References/Regulations juga membaca alamat sendiri. */
function applyRoute(r) {
  if (!r) return;
  closeHelp(false);
  if (r.type === 'learn') {
    if (r.view === 'landing' && mode === 'present') { if (index < 0) goTo(0); else syncHash(); return; } // Present: tanpa landing
    if (mode === 'present') setMode('explore'); // Learn, Chart guide, About = materi Explore
    closeOverlays();
    learnHost.show(r.view, r.id, { fromHash: true });
    return;
  }
  if (r.type === 'page') { closeOverlays(r.page); return; } // dibuka di atas halaman Learn / landing / scene, tidak menutupnya
  if (learnHost.open) learnHost.close();
  if (pendingBack) { backLesson = pendingBack.n === r.n ? pendingBack : null; pendingBack = null; } // Try it → pil Back to lesson
  if (r.tab) store.set({ pTab: r.tab });
  const i = SCENES.findIndex((x) => x.number === r.n);
  if (i !== index) goTo(i); else { syncHash(); syncBack(); }
}
window.addEventListener('hashchange', () => applyRoute(parseHash(location.hash)));

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
  mode: () => mode, page: () => openPage(), paused: () => paused,
  hero: () => learnHost.heroInfo(), lang: () => learnHost.lang, uiLang: () => langStore.lang, setLang: (l) => langStore.set(l), limits: () => ({ nox: store.get().limNOx, co: store.get().limCO, refO2: store.get().emRefO2 }), learnView: () => learnHost.view, learnViewId: () => learnHost.viewId,
  backPill: () => (backPill.visible ? backPill.el.getAttribute('href') : null), glossaryOpen: () => glossary.open, helpOpen: () => helpOpenFor(), settingsOpen: () => settings.open, notes: () => ({ choice: notesStore.choice, hide: notesStore.hide(mode) }),
  guideFor: async (title) => guideIdForTitle(title, (await learnReady())?.data?.charts ?? []),
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
    case '?': togglePage('references'); break;
    case 'g': togglePage('regulations'); break;
    case 'm': setMode(otherMode(mode)); break;
    case 'p': presenter.toggle(); break;
    case 's': snapshot(); break;
    case 'q': { const p = qualityCyclePatch(s); store.set(p); toast(STR.app.toast.quality(STR.assumptions.display.qualityOpts[p.quality])); break; }
    case 'b': { const p = bloomCyclePatch(s); store.set(p); toast(STR.app.toast.bloom(STR.assumptions.display.bloomOpts[p.bloomMode])); break; }
    case 'ArrowRight': case 'ArrowLeft': {
      // Present: panah selalu ganti scene; Explore: hanya bila fokus di navigasi (fokus lalu ikut ke scene baru)
      const inNav = nav.hasFocus();
      if (!arrowsChangeScene(mode, inNav, openPage() != null)) return; // Explore: tidak saat halaman Learn / halaman penuh terbuka
      const i = index + (key === 'ArrowRight' ? 1 : -1);
      goTo(i).then(() => { if (inNav && SCENES[i]) nav.focusScene(SCENES[i].number); });
      break;
    }
    default: return;
  }
});

let last = performance.now();
let paused = false, shownPage = undefined;
function loop(now) {
  const rawDt = Math.max(0, (now - last) / 1000);   // dt mentah (fps & kualitas)
  const dt = Math.min(0.1, rawDt);                  // dt animasi dibatasi (tab kembali aktif, frame lambat)
  last = now;
  const page = openPage();
  if (page !== shownPage) { shownPage = page; closeHelp(false); nav.setPage(page); if (!page) syncHash(); }
  // tanpa scene dan tanpa halaman (mis. halaman ditutup dari landing): Explore → landing, Present → Scene 1
  if (!page && index < 0 && !loading) { if (mode === 'present') goTo(0); else learnHost.show('landing'); }
  // halaman penuh terbuka → render 3D, grafik, dan pengukur kualitas berhenti (scene tetap ter-mount); lanjut saat ditutup
  paused = page != null;
  if (!paused) {
    current?.update(dt * (store.get().animSpeed ?? 1), dt);
    fpsMeter.sample(rawDt);
    updateDisplay(rawDt);
  } else if (page === 'landing') {
    // hero landing: kualitas adaptif global tetap bekerja (bloom, pixel ratio, jumlah partikel)
    learnHost.update(dt);
    fpsMeter.sample(rawDt);
    updateDisplay(rawDt);
  }
  debugOverlay.update(rawDt);
  requestAnimationFrame(loop);
}

// alamat langsung (#/scene/N[/tab]) diutamakan atas scene awal yang tersimpan; alamat halaman membuka halaman di atas scene awal.
// M11: alamat tanpa hash → landing (Explore; scene belum dipasang sampai landing ditinggalkan); Present tanpa hash → Scene 1.
const route0 = parseHash(location.hash);
if (route0?.type === 'scene' && route0.tab) store.set({ pTab: route0.tab });
const presentLanding = route0?.type === 'learn' && route0.view === 'landing' && mode === 'present';
const startN = presentLanding ? 1 : route0?.type === 'scene' ? route0.n : persist.startScene;
const startIdx = Math.max(0, SCENES.findIndex((x) => x.number === startN));
if (route0?.type === 'learn' && !presentLanding) {
  if (mode === 'present') setMode('explore'); // Learn, Chart guide, About = materi Explore
  learnHost.show(route0.view, route0.id, { fromHash: true });
  requestAnimationFrame(loop);
} else if (route0?.type === 'page' && mode === 'explore') {
  // halaman dibuka langsung lewat alamat: landing di bawahnya, jadi Close / Esc kembali ke landing (tidak buntu)
  learnHost.show('landing', null, { fromHash: true });
  requestAnimationFrame(loop);
} else goTo(startIdx).then(() => requestAnimationFrame(loop));
