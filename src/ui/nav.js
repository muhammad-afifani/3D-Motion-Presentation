/**
 * nav.js — navigasi Explore (M9 Step 06): sidebar kiri yang bisa dilipat menjadi rail. Isi: Start (landing, M11),
 * kelompok Learn (Learn, Chart guide, About; M11), Scene 1–11, halaman penuh
 * (Regulations, Emission formation, References, Glossary, Assumptions), dan alat (Snapshot, Presenter, Present mode).
 * DOM murni: klik hanya memanggil callback; status aktif dari setScene / setPage. Di dalam navigasi ↑/↓ menggeser fokus;
 * ←/→ (ganti scene) ditangani main.js agar aturannya sama dengan mode Present.
 */
import { STR } from './strings.js';
import { PAGES } from '../state/route.js';
import { createHelpButton } from './helpButton.js';

const N = STR.nav;

function h(tag, cls = '', text = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/** Tombol navigasi: penanda pendek (tampil di rail), label, dan tombol keyboard opsional. */
function item({ short, label, key, tip, data }) {
  const b = h('button', 'nav__item');
  b.type = 'button';
  for (const [k, v] of Object.entries(data)) b.dataset[k] = String(v);
  b.append(h('span', 'nav__num num', short), h('span', 'nav__label', label));
  if (key) b.append(h('kbd', '', key));
  b.dataset.tip = tip;
  b.setAttribute('aria-label', tip);
  return b;
}

/**
 * @param {HTMLElement} parent
 * @param {{sceneNumbers:number[], onScene:(n:number)=>void, onPage:(p:string)=>void, onTool:(id:'snapshot'|'presenter'|'present')=>void,
 *   onCollapse:(collapsed:boolean)=>void}} cb
 */
export function createNav(parent, cb) {
  const el = h('nav', 'nav');
  el.setAttribute('aria-label', N.label);
  const head = h('div', 'nav__head');
  const brand = h('div', 'brand nav__brand', STR.app.brand);
  const toggle = h('button', 'nav__toggle');
  toggle.type = 'button';
  toggle.addEventListener('click', () => cb.onCollapse(!el.classList.contains('is-collapsed')));
  head.append(brand, toggle);

  const body = h('div', 'nav__body');
  /** Judul kelompok; help = id kartu bantuan ⓘ (tampil saat rail terbuka). */
  const sec = (title, help) => {
    const s = h('div', 'nav__sec'), t = h('div', 'nav__title');
    t.append(h('span', 'nav__title-text', title));
    if (help) t.append(createHelpButton(help, { describes: s }).el);
    s.append(t);
    body.append(s);
    return s;
  };
  const start = h('div', 'nav__sec nav__sec--start');
  body.append(start);
  const startBtn = item({ short: N.startShort, label: N.start, tip: N.startTip, data: { page: 'landing' } });
  startBtn.addEventListener('click', () => cb.onPage('landing'));
  start.append(startBtn);
  const learn = sec(N.learnTitle, 'nav.learn');
  for (const p of ['learn', 'charts', 'about']) {
    const b = item({ short: N.learnShort[p], label: N.learn[p], tip: N.learn[p], data: { page: p } });
    b.addEventListener('click', () => cb.onPage(p));
    learn.append(b);
  }
  const scenes = sec(N.scenesTitle, 'nav.scenes');
  for (const n of cb.sceneNumbers) {
    const b = item({ short: String(n), label: N.scenes[n], tip: N.sceneTip(n, N.scenes[n]), data: { scene: n } });
    b.addEventListener('click', () => cb.onScene(n));
    scenes.append(b);
  }
  const pages = sec(N.pagesTitle, 'nav.pages');
  for (const p of PAGES) {
    const b = item({ short: N.pagesShort[p], label: N.pages[p], key: N.pageKeys[p], tip: N.pages[p], data: { page: p } });
    b.addEventListener('click', () => cb.onPage(p));
    pages.append(b);
  }
  const tools = sec(N.toolsTitle, 'nav.tools');
  const toolDefs = [
    { id: 'snapshot', short: N.toolsShort.snapshot, label: STR.snapshot.button, key: STR.snapshot.key, tip: STR.snapshot.buttonTip },
    { id: 'presenter', short: N.toolsShort.presenter, label: STR.presenter.button, key: STR.presenter.key, tip: STR.presenter.buttonTip },
    { id: 'present', short: N.presentShort, label: N.present, key: N.modeKey, tip: N.presentTip },
  ];
  for (const t of toolDefs) {
    const b = item({ ...t, data: { tool: t.id } });
    b.addEventListener('click', () => cb.onTool(t.id));
    tools.append(b);
  }
  const hint = h('p', 'nav__hint', N.keysHint);
  hint.append(' ', createHelpButton('nav.keys', { describes: hint }).el);
  body.append(hint);
  el.append(head, body);
  parent.prepend(el);

  const items = () => [...el.querySelectorAll('.nav__item')];
  // ↑/↓ di dalam navigasi: pindah fokus antar tombol (←/→ diteruskan ke main.js)
  const onKey = (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    const list = items(), i = list.indexOf(/** @type {any} */ (document.activeElement));
    const next = list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length];
    next?.focus();
    e.preventDefault();
    e.stopPropagation();
  };
  el.addEventListener('keydown', onKey);

  return {
    el,
    /** Scene aktif (aria-current). */
    setScene(n) { for (const b of el.querySelectorAll('[data-scene]')) { const on = Number(/** @type {HTMLElement} */ (b).dataset.scene) === n; b.classList.toggle('is-on', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); } },
    /** Halaman penuh yang sedang terbuka (null = tidak ada). */
    setPage(p) { for (const b of el.querySelectorAll('[data-page]')) b.classList.toggle('is-on', /** @type {HTMLElement} */ (b).dataset.page === p); },
    setCollapsed(c) {
      el.classList.toggle('is-collapsed', c);
      toggle.textContent = c ? '»' : '«';
      toggle.setAttribute('aria-label', c ? N.expand : N.collapse);
      toggle.dataset.tip = c ? N.expand : N.collapse;
      toggle.setAttribute('aria-expanded', String(!c));
    },
    /** Fokus ke tombol scene n (dipakai setelah ←/→ di navigasi agar panah berikutnya tetap di navigasi). */
    focusScene(n) { /** @type {HTMLElement|null} */ (el.querySelector(`[data-scene="${n}"]`))?.focus(); },
    hasFocus() { return el.contains(document.activeElement); },
    dispose() { el.removeEventListener('keydown', onKey); el.remove(); },
  };
}
