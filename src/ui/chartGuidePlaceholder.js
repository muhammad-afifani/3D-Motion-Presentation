/**
 * chartGuidePlaceholder.js — Chart guide (#/learn/charts[/<id>]) sampai Step 03: pengantar, banner draf, dan daftar
 * grafik dari content/learn.json. Diganti halaman panduan grafik penuh di Step 03.
 */
import { STR } from './strings.js';
import { tr } from '../state/lang.js';

const L = STR.bi.learn;

function h(tag, cls = '', text = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/** @param {HTMLElement} root @param {{learn:any|null, lang:'en'|'id', id:string|null}} o */
export function createChartGuidePlaceholder(root, o) {
  const el = h('article', 'reading learn-page');
  const main = h('div', 'reading__main');
  const j = o.learn;
  main.append(h('h2', 'reading__title', tr(L.chartGuide, o.lang)));
  if (!j) main.append(h('p', 'reading__note', tr(L.unavailable, o.lang)));
  else {
    if (!j.reviewed && j.landing?.draftBanner) main.append(h('div', 'reg__banner learn-page__draft', tr(j.landing.draftBanner, o.lang)));
    main.append(h('p', 'reading__lead', tr(j.landing.chartsIntro, o.lang)), h('p', 'reading__note', tr(L.chartsSoon, o.lang)));
    const ul = h('ul', 'learn-page__list');
    for (const c of j.charts ?? []) {
      const li = h('li', c.id === o.id ? 'is-target' : '');
      li.id = `chart-${c.id}`;
      li.append(h('b', '', c.titles?.[0] ?? c.id), ' · ', tr(c.shows, o.lang));
      ul.append(li);
    }
    main.append(ul);
  }
  const back = h('a', 'btn btn--sm', tr(L.title, o.lang));
  back.href = '#/learn';
  main.append(back);
  el.append(main);
  root.append(el);
  el.querySelector('.is-target')?.scrollIntoView?.({ block: 'center' });
  return { el, dispose: () => el.remove() };
}
