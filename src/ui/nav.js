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
import { createRelabeler } from './relabel.js';

const N = STR.nav;

function h(tag, cls = '', text = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/**
 * Tombol navigasi: penanda pendek (tampil di rail), label, dan tombol keyboard opsional. short / label / key / tip berupa
 * fungsi agar teksnya diambil ulang saat bahasa berubah (relabeler).
 */
function item({ short, label, key, tip, data }, rl) {
  const b = h('button', 'nav__item');
  b.type = 'button';
  for (const [k, v] of Object.entries(data)) b.dataset[k] = String(v);
  const num = h('span', 'nav__num num'), lab = h('span', 'nav__label');
  b.append(num, lab);
  rl.text(num, short); rl.text(lab, label);
  if (key) { const k = h('kbd'); b.append(k); rl.text(k, key); }
  rl.data(b, 'tip', tip);
  rl.attr(b, 'aria-label', tip);
  return b;
}

/**
 * @param {HTMLElement} parent
 * @param {{sceneNumbers:number[], onScene:(n:number)=>void, onPage:(p:string)=>void, onTool:(id:'snapshot'|'presenter'|'present')=>void,
 *   onCollapse:(collapsed:boolean)=>void}} cb
 */
export function createNav(parent, cb) {
  const rl = createRelabeler();
  const el = h('nav', 'nav');
  rl.attr(el, 'aria-label', () => N.label);
  const head = h('div', 'nav__head');
  const brand = h('div', 'brand nav__brand');
  rl.text(brand, () => STR.app.brand);
  const toggle = h('button', 'nav__toggle');
  toggle.type = 'button';
  toggle.addEventListener('click', () => cb.onCollapse(!el.classList.contains('is-collapsed')));
  head.append(brand, toggle);
  let collapsed = false;
  const paintToggle = () => { toggle.setAttribute('aria-label', collapsed ? N.expand : N.collapse); toggle.dataset.tip = collapsed ? N.expand : N.collapse; };
  rl.job(paintToggle);

  const body = h('div', 'nav__body');
  /** Judul kelompok; help = id kartu bantuan ⓘ (tampil saat rail terbuka). */
  const sec = (title, help) => {
    const s = h('div', 'nav__sec'), t = h('div', 'nav__title'), tt = h('span', 'nav__title-text');
    rl.text(tt, title);
    t.append(tt);
    if (help) t.append(createHelpButton(help, { describes: s }).el);
    s.append(t);
    body.append(s);
    return s;
  };
  const start = h('div', 'nav__sec nav__sec--start');
  body.append(start);
  const startBtn = item({ short: () => N.startShort, label: () => N.start, tip: () => N.startTip, data: { page: 'landing' } }, rl);
  startBtn.addEventListener('click', () => cb.onPage('landing'));
  start.append(startBtn);
  const learn = sec(() => N.learnTitle, 'nav.learn');
  for (const p of ['learn', 'charts', 'about']) {
    const b = item({ short: () => N.learnShort[p], label: () => N.learn[p], tip: () => N.learn[p], data: { page: p } }, rl);
    b.addEventListener('click', () => cb.onPage(p));
    learn.append(b);
  }
  const scenes = sec(() => N.scenesTitle, 'nav.scenes');
  for (const n of cb.sceneNumbers) {
    const b = item({ short: () => String(n), label: () => N.scenes[n], tip: () => N.sceneTip(n, N.scenes[n]), data: { scene: n } }, rl);
    b.addEventListener('click', () => cb.onScene(n));
    scenes.append(b);
  }
  const pages = sec(() => N.pagesTitle, 'nav.pages');
  for (const p of PAGES) {
    const b = item({ short: () => N.pagesShort[p], label: () => N.pages[p], key: () => N.pageKeys[p], tip: () => N.pages[p], data: { page: p } }, rl);
    b.addEventListener('click', () => cb.onPage(p));
    pages.append(b);
  }
  const tools = sec(() => N.toolsTitle, 'nav.tools');
  const toolDefs = [
    { id: 'snapshot', short: () => N.toolsShort.snapshot, label: () => STR.snapshot.button, key: () => STR.snapshot.key, tip: () => STR.snapshot.buttonTip },
    { id: 'presenter', short: () => N.toolsShort.presenter, label: () => STR.presenter.button, key: () => STR.presenter.key, tip: () => STR.presenter.buttonTip },
    { id: 'present', short: () => N.presentShort, label: () => N.present, key: () => N.modeKey, tip: () => N.presentTip },
  ];
  for (const t of toolDefs) {
    const b = item({ ...t, data: { tool: t.id } }, rl);
    b.addEventListener('click', () => cb.onTool(t.id));
    tools.append(b);
  }
  const hint = h('p', 'nav__hint');
  const hintText = document.createTextNode('');
  hint.append(hintText, ' ', createHelpButton('nav.keys', { describes: hint }).el);
  rl.node(hintText, () => N.keysHint);
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
      collapsed = c;
      el.classList.toggle('is-collapsed', c);
      toggle.textContent = c ? '»' : '«';
      toggle.setAttribute('aria-expanded', String(!c));
      paintToggle();
    },
    /** Teks ikut bahasa baru (dipanggil main.js setelah STR berganti). */
    relabel() { rl.run(); },
    /** Fokus ke tombol scene n (dipakai setelah ←/→ di navigasi agar panah berikutnya tetap di navigasi). */
    focusScene(n) { /** @type {HTMLElement|null} */ (el.querySelector(`[data-scene="${n}"]`))?.focus(); },
    hasFocus() { return el.contains(document.activeElement); },
    dispose() { el.removeEventListener('keydown', onKey); el.remove(); },
  };
}
