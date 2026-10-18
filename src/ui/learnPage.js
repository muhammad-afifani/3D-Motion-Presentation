/**
 * learnPage.js — placeholder Learn (#/learn, #/learn/<id>) dan Chart guide (#/learn/charts[/<id>]) untuk M11 Step 01:
 * pengantar, banner draf (reviewed: false), dan daftar level / grafik yang dibaca dari content/learn.json (dua
 * bahasa). Halaman pelajaran dan panduan grafik penuh datang di Step 02 dan 03.
 */
import { STR } from './strings.js';
import { tr } from '../state/lang.js';

const P = STR.learnPage;

function h(tag, cls = '', text = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/** @param {HTMLElement} root @param {{learn:any|null, lang:'en'|'id', view:'learn'|'charts', id:string|null}} o */
export function createLearnPlaceholder(root, o) {
  const el = h('article', 'reading learn-page');
  const main = h('div', 'reading__main');
  const t = (p) => tr(p, o.lang);
  const j = o.learn;
  const charts = o.view === 'charts';
  main.append(h('h2', 'reading__title', charts ? P.chartsTitle : P.title));
  if (!j) {
    main.append(h('p', 'reading__note', P.unavailable));
  } else {
    if (!j.reviewed && j.landing?.draftBanner) main.append(h('div', 'reg__banner learn-page__draft', t(j.landing.draftBanner)));
    main.append(h('p', 'reading__lead', t(charts ? j.landing.chartsIntro : j.landing.learnIntro)));
    main.append(h('p', 'reading__note', charts ? P.chartsSoon : (o.id ? P.lessonSoon(o.id) : P.soon)));
    if (charts) {
      const ul = h('ul', 'learn-page__list');
      for (const c of j.charts ?? []) {
        const li = h('li', '');
        li.id = `chart-${c.id}`;
        if (c.id === o.id) li.classList.add('is-target');
        li.append(h('b', '', c.titles?.[0] ?? c.id), ' · ', t(c.shows));
        ul.append(li);
      }
      main.append(ul);
    } else {
      const ol = h('ol', 'learn-page__levels');
      for (const lv of j.levels) {
        const li = h('li', 'learn-page__level');
        const minutes = lv.lessons.reduce((a, l) => a + l.minutes, 0);
        li.append(h('h3', '', t(lv.title)));
        if (lv.summary) li.append(h('p', '', t(lv.summary)));
        li.append(h('p', 'reading__note num', P.lessonCount(lv.lessons.length, minutes)));
        const ul = h('ul', '');
        for (const ls of lv.lessons) {
          const x = h('li', '', t(ls.title));
          if (ls.id === o.id) x.classList.add('is-target');
          ul.append(x);
        }
        li.append(ul);
        ol.append(li);
      }
      main.append(ol);
    }
  }
  el.append(main);
  root.append(el);
  el.querySelector('.is-target')?.scrollIntoView?.({ block: 'center' });
  return { el, dispose: () => el.remove() };
}
