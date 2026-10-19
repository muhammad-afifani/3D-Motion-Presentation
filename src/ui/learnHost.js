/**
 * learnHost.js — wadah kelompok Learn (M11): landing (#/), About, Learn (daftar level + pelajaran), Chart guide.
 * Mengisi area di bawah header (header dengan sakelar bahasa dan tema tetap terlihat, navigasi kiri tetap ada); area scene
 * (#app) disembunyikan selama terbuka dan loop render scene berhenti (main.js). Halaman penuh lain (References,
 * Glossary, …) dibuka DI ATAS halaman ini tanpa menutupnya. Bahasa: state/langStore.js (etel:lang; kunjungan pertama =
 * bahasa browser bila diawali "id", selain itu English; Paket D1). Konten: state/learnStore.js (fetch → fallback dynamic import → minimal English). Progres: etel:learnDone.
 */
import { STR } from './strings.js';
import { learnHash } from '../state/route.js';
import { tr } from '../state/lang.js';
import { langStore } from '../state/langStore.js';
import { onLearn } from '../state/learnStore.js';
import { createLearnProgress } from '../state/learnProgress.js';
import { contentOf, onContent } from '../state/contentStore.js';
import { createLanding } from './landingPage.js';
import { createAbout } from './aboutPage.js';
import { createLearnList } from './learnPage.js';
import { createLesson } from './lessonPage.js';
import { createChartGuide } from './chartGuidePage.js';
import { chartOrigin, clearChartOrigin } from '../state/chartGuide.js';
import { sceneOrigin, clearSceneOrigin, backToSceneHash } from '../state/backToScene.js';

/**
 * @param {{shell:HTMLElement, app:HTMLElement, continueScene:() => number|null, onPresent:() => void, onChange?:() => void,
 *   onTry?:(lessonId:string, route:string)=>void, onWord?:(termId:string, from:'learn'|'glossary')=>void, win?:Window,
 *   progress?:ReturnType<typeof createLearnProgress>}} o
 */
export function createLearnHost(o) {
  const win = o.win ?? window;
  const host = document.createElement('main');
  host.className = 'learn-host';
  host.hidden = true;
  o.app.after(host);
  const progress = o.progress ?? createLearnProgress();
  let learn = null, loaded = false, view = null, viewId = null, child = null;
  const tagEl = () => document.getElementById('scene-tag'), msgEl = () => document.getElementById('key-message');
  let saved = null;

  onLearn((r) => {
    learn = r.data;
    loaded = true;
    render(); // bahasa kunjungan pertama sudah ditentukan langStore (bahasa browser / English)
  });
  langStore.subscribe(() => { setTag(); render(); });
  // References / Glossary berubah isi (fetch selesai): pelajaran memakai sumber dan kata dari keduanya
  onContent('references', () => { if ((view === 'learn' || view === 'charts') && viewId) render(); });
  onContent('glossary', () => { if ((view === 'learn' || view === 'charts') && viewId) render(); });

  function setTag() {
    if (!view || !tagEl()) return;
    tagEl().textContent = tr(STR.bi.tags[view], langStore.lang);
  }
  function render() {
    if (!view) return;
    child?.dispose();
    host.lang = langStore.lang;
    host.replaceChildren();
    if (!loaded) { child = null; host.classList.add('is-loading'); return; }
    host.classList.remove('is-loading');
    const lang = langStore.lang;
    if (view === 'landing') child = createLanding(host, { learn, lang, continueScene: o.continueScene, onPresent: o.onPresent });
    else if (view === 'about') child = createAbout(host, { learn, lang });
    else if (view === 'charts') child = createChartGuide(host, { learn, glossary: contentOf('glossary').data, references: contentOf('references').data, lang, id: viewId, onWord: (id, from) => o.onWord?.(id, from) });
    else if (viewId) child = createLesson(host, { learn, glossary: contentOf('glossary').data, references: contentOf('references').data, lang, id: viewId, backHash: backToSceneHash(viewId), progress, onTry: (id, route) => o.onTry?.(id, route), onWord: (id, from) => o.onWord?.(id, from) });
    else child = createLearnList(host, { learn, lang, progress });
    host.scrollTop = 0;
  }

  /** @param {'landing'|'learn'|'charts'|'about'} v @param {string|null} [id] */
  function show(v, id = null, { fromHash = false } = {}) {
    const same = view === v && viewId === id;
    // asal klik ⓘ hanya berlaku untuk panduan yang baru dibuka darinya
    if (chartOrigin() && !(v === 'charts' && id === chartOrigin().id)) clearChartOrigin();
    if (sceneOrigin() && !(v === 'learn' && id === sceneOrigin().lessonId)) clearSceneOrigin();
    if (!view) {
      saved = { tag: tagEl()?.textContent ?? '', msg: msgEl()?.textContent ?? '' };
      o.app.hidden = true;
      host.hidden = false;
    }
    view = v; viewId = id;
    setTag();
    if (msgEl()) msgEl().textContent = '';
    if (!fromHash) { const h = learnHash(v, id); if (win.location.hash !== h) win.history.replaceState(null, '', h); }
    if (!same) render();
    o.onChange?.();
  }
  function close() {
    if (!view) return;
    child?.dispose(); child = null;
    clearChartOrigin(); clearSceneOrigin();
    host.replaceChildren();
    host.hidden = true;
    o.app.hidden = false;
    view = null; viewId = null;
    if (saved) { if (tagEl()) tagEl().textContent = saved.tag; if (msgEl()) msgEl().textContent = saved.msg; saved = null; }
    o.onChange?.();
    win.dispatchEvent(new Event('resize')); // kanvas scene mengukur ulang setelah tampil lagi
  }
  const pageApi = (v) => ({ get open() { return view === v; }, setOpen: (on) => (on ? show(v) : view === v && close()) });

  return {
    el: host,
    progress,
    get view() { return view; },
    get viewId() { return viewId; },
    get open() { return view != null; },
    get lang() { return langStore.lang; },
    get learn() { return learn; },
    pages: { landing: pageApi('landing'), learn: pageApi('learn'), charts: pageApi('charts'), about: pageApi('about') },
    show, close,
    update(dt) { child?.update?.(dt); },
    /** Tone viewport berubah (ganti tema): hero dipasang ulang. */
    retheme() { if (view === 'landing') render(); },
    heroInfo() { return view === 'landing' ? child?.heroInfo?.() ?? null : null; },
  };
}
