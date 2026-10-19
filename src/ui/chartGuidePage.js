/**
 * chartGuidePage.js — Chart guide (#/learn/charts[/<id>], M11 Step 03). Indeks: pengantar, banner draf, 15 panduan per
 * scene (judul grafik persis seperti di layar, scene, tag tingkat model). Panduan: judul + Scene N, What it shows, Axes,
 * How to read it, What to look for, Common mistakes, kotak kata, pelajaran terkait, sumber, "Open the chart" dan (bila
 * datang dari tombol ⓘ) "← Back to the chart". Teks isi dari content/learn.json; label lewat tr(). Tanpa angka model.
 */
import { STR } from './strings.js';
import { tr } from '../state/lang.js';
import { markNote } from '../state/notes.js';
import { groupChartsByScene, GUIDE_LEVELS, backToChartHash } from '../state/chartGuide.js';
import { lessonWords, findLesson } from '../state/learnView.js';
import { createWordBox, createSourceList } from './readingParts.js';

const L = STR.bi.learn, G = STR.bi.chartGuide, LL = STR.bi.lesson;

function h(tag, cls = '', text = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/** Tag tingkat model seperti di grafik ("Basis · Ideal / Real …"); kosong bila panduan tidak punya tag. */
const levelText = (id) => {
  const keys = GUIDE_LEVELS[id] ?? [];
  return keys.length ? `${STR.basis.tag} · ${keys.map((k) => STR.common.level[k]).join(' / ')}` : '';
};

/**
 * @param {HTMLElement} root
 * @param {{learn:any|null, glossary:any, references:any, lang:'en'|'id', id:string|null,
 *   onWord:(termId:string, from:'learn'|'glossary')=>void}} o
 */
export function createChartGuide(root, o) {
  const el = h('article', 'reading learn-page chart-guide');
  root.append(el);
  const t = (pair, ...args) => tr(pair, o.lang, ...args);
  const j = o.learn;
  const main = h('div', 'reading__main');
  el.append(main);
  const dispose = () => el.remove();

  const crumb = (current) => {
    const nav = h('nav', 'lesson__crumbs');
    nav.setAttribute('aria-label', t(LL.crumbs));
    const ol = h('ol', '');
    const a1 = h('li', ''), l1 = h('a', '', t(L.title));
    l1.href = '#/learn';
    a1.append(l1);
    const a2 = h('li', ''), l2 = h('a', '', t(L.chartGuide));
    l2.href = '#/learn/charts';
    if (current) a2.append(l2); else { a2.textContent = t(L.chartGuide); a2.setAttribute('aria-current', 'page'); }
    ol.append(a1, a2);
    if (current) { const a3 = h('li', '', current); a3.setAttribute('aria-current', 'page'); ol.append(a3); }
    nav.append(ol);
    return nav;
  };

  if (!j) {
    main.append(h('h2', 'reading__title', t(L.chartGuide)), h('p', 'reading__note', t(L.unavailable)));
    const back = h('a', 'btn btn--sm', t(L.backToLanding));
    back.href = '#/';
    main.append(back);
    return { el, dispose };
  }
  const draft = () => { if (!j.reviewed && j.landing?.draftBanner) main.append(markNote(h('div', 'reg__banner learn-page__draft', tr(j.landing.draftBanner, o.lang)))); };
  const charts = j.charts ?? [];
  const guide = o.id ? charts.find((c) => c.id === o.id) : null;

  // ── indeks ──
  if (!guide) {
    main.append(crumb(null), h('h2', 'reading__title', t(L.chartGuide)));
    draft();
    if (o.id) main.append(h('p', 'reading__note chart-guide__missing', t(G.notFound, o.id)));
    main.append(h('p', 'reading__lead', tr(j.landing.chartsIntro, o.lang)));
    for (const grp of groupChartsByScene(charts)) {
      const sec = h('section', 'chart-guide__group');
      const hd = h('h3', '');
      hd.append(h('span', '', t(G.scene, grp.scene)), ' ', h('span', 'chart-guide__count num', `· ${t(G.guideCount, grp.charts.length)}`));
      sec.append(hd);
      const ul = h('ul', 'chart-guide__list');
      for (const c of grp.charts) {
        const li = h('li', 'chart-guide__row');
        li.dataset.chart = c.id;
        const a = h('a', 'chart-guide__link', c.titles[0]);
        a.href = `#/learn/charts/${c.id}`;
        li.append(a);
        const lv = levelText(c.id);
        if (lv) li.append(h('span', 'chart-guide__level', lv));
        if (c.titles.length > 1) li.append(h('span', 'chart-guide__more', c.titles.slice(1).join(' · ')));
        ul.append(li);
      }
      sec.append(ul);
      main.append(sec);
    }
    const back = h('a', 'btn btn--sm', t(L.title));
    back.href = '#/learn';
    main.append(back);
    return { el, dispose };
  }

  // ── panduan satu grafik ──
  el.classList.add('lesson-page');
  main.classList.add('lesson__main');
  const side = h('aside', 'lesson__side');
  el.append(side);
  main.append(crumb(guide.titles[0]));
  draft();
  main.append(h('h2', 'reading__title', guide.titles[0]));
  const sub = h('p', 'chart-guide__sub');
  const sceneLink = h('a', 'chart-guide__scene', t(G.scene, guide.scene));
  sceneLink.href = guide.route;
  sceneLink.dataset.tip = t(G.sceneLink, guide.scene);
  sub.append(sceneLink);
  const lv = levelText(guide.id);
  if (lv) sub.append(' ', h('span', 'chart-guide__level', lv));
  if (guide.titles.length > 1) sub.append(h('span', 'chart-guide__more', guide.titles.slice(1).join(' · ')));
  main.append(sub);

  const section = (label, body) => {
    const sec = h('section', 'reading__sec chart-guide__sec');
    sec.append(h('h3', '', label), ...body);
    main.append(sec);
  };
  section(t(G.shows), [h('p', '', tr(guide.shows, o.lang))]);
  section(t(G.axes), [h('p', '', tr(guide.axes, o.lang))]);
  const list = (tag, items) => { const e = h(tag, 'chart-guide__items'); for (const x of items) e.append(h('li', '', tr(x, o.lang))); return e; };
  section(t(G.read), [list('ol', guide.read ?? [])]);
  if ((guide.lookFor ?? []).length) section(t(G.lookFor), [list('ul', guide.lookFor)]);
  if ((guide.mistakes ?? []).length) section(t(G.mistakes), [list('ul', guide.mistakes)]);

  const bar = h('div', 'chart-guide__bar');
  const open = h('a', 'btn chart-guide__open', `${t(G.openChart)} ▸`);
  open.href = guide.route;
  bar.append(open);
  const fromChart = backToChartHash(guide.id);
  if (fromChart) {
    const back = h('a', 'btn chart-guide__back', t(G.backToChart));
    back.href = fromChart;
    back.dataset.tip = t(G.backToChartTip);
    bar.prepend(back);
  }
  main.append(bar);

  const words = lessonWords(j, o.glossary, guide, o.lang);
  if (words.length) side.append(createWordBox(words, { lang: o.lang, title: t(G.words), onWord: o.onWord }));
  const related = (guide.lessons ?? []).map((id) => findLesson(j, id)).filter(Boolean);
  if (related.length) {
    const box = h('section', 'wordbox chart-guide__lessons');
    box.append(h('h3', '', t(G.lessons)));
    const ul = h('ul', 'chart-guide__lesson-list');
    for (const f of related) {
      const li = h('li', ''), a = h('a', '', tr(f.entry.lesson.title, o.lang));
      a.href = `#/learn/${f.entry.lesson.id}`;
      li.append(a);
      ul.append(li);
    }
    box.append(ul);
    side.append(box);
  }
  if ((guide.refs ?? []).length) main.append(createSourceList(guide.refs, o.references, { lang: o.lang }));
  return { el, dispose };
}
