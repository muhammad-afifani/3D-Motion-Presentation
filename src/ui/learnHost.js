/**
 * learnHost.js — wadah kelompok Learn (M11): landing (#/), About, Learn, Chart guide. Mengisi area di bawah header
 * (header dengan sakelar bahasa dan tema tetap terlihat, navigasi kiri tetap ada); area scene (#app) disembunyikan
 * selama terbuka dan loop render scene berhenti (main.js). Bahasa: state/lang.js (etel:lang; kunjungan pertama =
 * learn.defaultLang). Konten: state/learnStore.js (fetch → fallback dynamic import → minimal English).
 */
import { STR } from './strings.js';
import { learnHash } from '../state/route.js';
import { langStorage, readLangChoice, resolveLang, writeLang } from '../state/lang.js';
import { onLearn } from '../state/learnStore.js';
import { createLanding } from './landingPage.js';
import { createAbout } from './aboutPage.js';
import { createLearnPlaceholder } from './learnPage.js';

/**
 * @param {{shell:HTMLElement, app:HTMLElement, continueScene:() => number|null, onPresent:() => void, onChange?:() => void,
 *   win?:Window}} o
 */
export function createLearnHost(o) {
  const win = o.win ?? window;
  const host = document.createElement('main');
  host.className = 'learn-host';
  host.hidden = true;
  o.app.after(host);
  const storage = langStorage();
  let learn = null, loaded = false, view = null, viewId = null, child = null;
  let choice = readLangChoice(storage);
  let lang = resolveLang(choice, null);
  const langSubs = new Set();
  const tagEl = () => document.getElementById('scene-tag'), msgEl = () => document.getElementById('key-message');
  let saved = null;

  const setLangInternal = (l) => {
    if (l === lang) return;
    lang = l;
    for (const fn of langSubs) fn(lang);
    render();
  };
  onLearn((r) => {
    learn = r.data;
    loaded = true;
    if (!choice.stored) setLangInternal(resolveLang(choice, learn?.defaultLang)); // kunjungan pertama: bahasa default learn.json
    render();
  });

  function render() {
    if (!view) return;
    child?.dispose();
    host.lang = lang;
    host.replaceChildren();
    if (!loaded) { child = null; host.classList.add('is-loading'); return; }
    host.classList.remove('is-loading');
    if (view === 'landing') child = createLanding(host, { learn, lang, continueScene: o.continueScene, onPresent: o.onPresent });
    else if (view === 'about') child = createAbout(host, { learn, lang });
    else child = createLearnPlaceholder(host, { learn, lang, view, id: viewId });
    host.scrollTop = 0;
  }

  /** @param {'landing'|'learn'|'charts'|'about'} v @param {string|null} [id] */
  function show(v, id = null, { fromHash = false } = {}) {
    const same = view === v && viewId === id;
    if (!view) {
      saved = { tag: tagEl()?.textContent ?? '', msg: msgEl()?.textContent ?? '' };
      o.app.hidden = true;
      host.hidden = false;
    }
    view = v; viewId = id;
    if (tagEl()) tagEl().textContent = v === 'landing' ? STR.landing.tag : (STR.nav.learn[v] ?? STR.landing.tag);
    if (msgEl()) msgEl().textContent = '';
    if (!fromHash) { const h = learnHash(v, id); if (win.location.hash !== h) win.history.replaceState(null, '', h); }
    if (!same) render();
    o.onChange?.();
  }
  function close() {
    if (!view) return;
    child?.dispose(); child = null;
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
    get view() { return view; },
    get open() { return view != null; },
    get lang() { return lang; },
    get learn() { return learn; },
    pages: { landing: pageApi('landing'), learn: pageApi('learn'), charts: pageApi('charts'), about: pageApi('about') },
    show, close,
    /** Sakelar EN/ID: simpan pilihan (etel:lang) dan render ulang. */
    setLang(l) { writeLang(storage, l); choice = { lang: l, stored: true }; setLangInternal(l); },
    onLangChange(fn) { langSubs.add(fn); return () => langSubs.delete(fn); },
    update(dt) { child?.update?.(dt); },
    /** Tone viewport berubah (ganti tema): hero dipasang ulang. */
    retheme() { if (view === 'landing') render(); },
    heroInfo() { return view === 'landing' ? child?.heroInfo?.() ?? null : null; },
  };
}
