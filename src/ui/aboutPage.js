/**
 * aboutPage.js — halaman About (#/about, M11 Step 01): judul dan enam bagian dari content/learn.json (dua bahasa),
 * satu kolom ±70 karakter, daftar isi kecil di samping pada layar lebar, tautan Learn / References / Assumptions.
 */
import { STR } from './strings.js';
import { tr } from '../state/lang.js';

const A = STR.bi.about, L = STR.bi.learn;

function h(tag, cls = '', text = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/** @param {HTMLElement} root @param {{learn:any|null, lang:'en'|'id'}} o */
export function createAbout(root, o) {
  const el = h('article', 'reading reading--about');
  const t = (p) => tr(p, o.lang);
  const ab = o.learn?.about;
  if (!ab) {
    el.append(h('h2', 'reading__title', tr(A.learn, o.lang)), h('p', 'reading__note', tr(L.unavailable, o.lang)));
    root.append(el);
    return { el, dispose: () => el.remove() };
  }
  const toc = h('nav', 'reading__toc');
  toc.setAttribute('aria-label', tr(A.toc, o.lang));
  toc.append(h('div', 'reading__toc-title', tr(A.toc, o.lang)));
  const tocList = h('ol', '');
  const main = h('div', 'reading__main');
  main.append(h('h2', 'reading__title', t(ab.title)));
  for (const s of ab.sections) {
    const sec = h('section', 'reading__sec');
    sec.id = `about-${s.id}`;
    sec.append(h('h3', '', t(s.title)));
    for (const p of s.body) sec.append(h('p', '', t(p)));
    main.append(sec);
    const li = h('li', '');
    const a = h('a', '', t(s.title));
    a.href = `#/about`;
    a.addEventListener('click', (e) => { e.preventDefault(); sec.scrollIntoView({ block: 'start' }); /** @type {HTMLElement} */ (sec.querySelector('h3'))?.focus?.(); });
    li.append(a);
    tocList.append(li);
  }
  toc.append(tocList);
  const next = h('nav', 'reading__next');
  next.setAttribute('aria-label', tr(A.next, o.lang));
  for (const [k, href] of [['learn', '#/learn'], ['references', '#/references'], ['assumptions', '#/assumptions']]) {
    const a = h('a', 'btn btn--sm', tr(A[k], o.lang));
    a.href = href;
    next.append(a);
  }
  main.append(next);
  el.append(toc, main);
  root.append(el);
  return { el, dispose: () => el.remove() };
}
