/**
 * learnPage.js — daftar level Learn (#/learn, M11 Step 02; menggantikan placeholder Step 01): pengantar, banner draf,
 * tombol Continue ke pelajaran pertama yang belum selesai, enam kartu level (ringkasan, jumlah pelajaran dan menit
 * dihitung dari data, bilah progres, daftar pelajaran dengan tanda selesai), Reset progress dengan konfirmasi di dalam
 * halaman, dan tautan ke Chart guide. Teks isi dari content/learn.json; label lewat tr() (state/lang.js).
 */
import { STR } from './strings.js';
import { tr } from '../state/lang.js';
import { levelStats, learnStats, firstUndone } from '../state/learnView.js';

const L = STR.bi.learn;

function h(tag, cls = '', text = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/**
 * @param {HTMLElement} root
 * @param {{learn:any|null, lang:'en'|'id', progress:ReturnType<import('../state/learnProgress.js').createLearnProgress>}} o
 */
export function createLearnList(root, o) {
  const el = h('article', 'reading learn-page learn-page--list');
  const main = h('div', 'reading__main');
  el.append(main);
  root.append(el);
  const t = (pair, ...args) => tr(pair, o.lang, ...args);
  const j = o.learn;
  let confirming = false, status = '';

  function draw() {
    main.replaceChildren();
    main.append(h('h2', 'reading__title', t(L.title)));
    if (!j) {
      main.append(h('p', 'reading__note', t(L.unavailable)));
      const a = h('a', 'btn btn--sm', t(L.backToLanding));
      a.href = '#/';
      main.append(a);
      return;
    }
    if (!j.reviewed && j.landing?.draftBanner) main.append(h('div', 'reg__banner learn-page__draft', tr(j.landing.draftBanner, o.lang)));
    main.append(h('p', 'reading__lead', tr(j.landing.learnIntro, o.lang)));

    const isDone = (id) => o.progress.has(id);
    const all = learnStats(j, isDone);
    const next = firstUndone(j, isDone);
    const bar = h('div', 'learn-page__bar');
    if (next) {
      const c = h('a', 'btn learn-page__continue');
      c.href = `#/learn/${next.lesson.id}`;
      c.append(h('b', '', t(L.continue)), ` → ${tr(next.lesson.title, o.lang)}`);
      bar.append(c);
    } else bar.append(h('p', 'reading__note', t(L.allDone)));
    bar.append(h('span', 'learn-page__stats num', `${t(L.progress, all.done, all.lessons)} · ${t(L.total, all.minutes)}`));
    // Reset progress: konfirmasi di dalam halaman (bukan dialog browser)
    const reset = h('div', 'learn-page__reset');
    if (confirming) {
      reset.setAttribute('role', 'group');
      reset.setAttribute('aria-label', t(L.resetAsk));
      const yes = h('button', 'btn btn--sm learn-page__reset-yes', t(L.resetYes));
      const no = h('button', 'btn btn--sm', t(L.resetNo));
      yes.type = no.type = 'button';
      yes.addEventListener('click', () => { confirming = false; status = t(L.resetDone); o.progress.reset(); });
      no.addEventListener('click', () => { confirming = false; draw(); main.querySelector('.learn-page__reset button')?.focus(); });
      reset.append(h('span', 'reading__note', t(L.resetAsk)), yes, no);
    } else {
      const b = h('button', 'btn btn--sm', t(L.reset));
      b.type = 'button';
      b.disabled = all.done === 0;
      b.addEventListener('click', () => { confirming = true; status = ''; draw(); main.querySelector('.learn-page__reset-yes')?.focus(); });
      reset.append(b);
    }
    bar.append(reset);
    main.append(bar);
    const live = h('p', 'reading__note learn-page__status', status);
    live.setAttribute('role', 'status');
    main.append(live);

    const grid = h('div', 'learn-page__levels');
    j.levels.forEach((lv, i) => {
      const st = levelStats(lv, isDone);
      const card = h('section', 'lvl');
      card.dataset.level = lv.id;
      card.append(h('h3', 'lvl__title', `${t(L.level, i)} · ${tr(lv.title, o.lang)}`));
      if (lv.summary) card.append(h('p', 'lvl__summary', tr(lv.summary, o.lang)));
      card.append(h('p', 'lvl__meta num', `${t(L.lessonCount, st.lessons, st.minutes)} · ${t(L.progress, st.done, st.lessons)}`));
      const track = h('div', 'lvl__track');
      track.setAttribute('role', 'progressbar');
      track.setAttribute('aria-valuemin', '0');
      track.setAttribute('aria-valuemax', String(st.lessons));
      track.setAttribute('aria-valuenow', String(st.done));
      track.setAttribute('aria-label', `${t(L.level, i)}: ${t(L.progress, st.done, st.lessons)}`);
      const fill = h('div', 'lvl__fill');
      fill.style.width = `${st.lessons ? (100 * st.done) / st.lessons : 0}%`;
      track.append(fill);
      card.append(track);
      const ol = h('ol', 'lvl__lessons');
      for (const ls of lv.lessons) {
        const done = isDone(ls.id);
        const li = h('li', done ? 'lvl__lesson is-done' : 'lvl__lesson');
        const a = h('a', 'lvl__link');
        a.href = `#/learn/${ls.id}`;
        const mark = h('span', 'lvl__mark', done ? '✓' : '○');
        mark.setAttribute('role', 'img');
        mark.setAttribute('aria-label', t(done ? L.done : L.notDone));
        a.append(mark, h('span', 'lvl__name', tr(ls.title, o.lang)), h('span', 'lvl__min num', t(L.minutes, ls.minutes)));
        li.append(a);
        ol.append(li);
      }
      card.append(ol);
      grid.append(card);
    });
    main.append(grid);

    const charts = h('section', 'learn-page__charts');
    charts.append(h('h3', '', t(L.chartGuide)), h('p', 'reading__note', tr(j.landing.chartsIntro, o.lang)));
    const go = h('a', 'btn btn--sm', t(L.openCharts));
    go.href = '#/learn/charts';
    charts.append(go);
    main.append(charts);
  }
  draw();
  const unsub = o.progress.subscribe(() => { const f = document.activeElement; draw(); if (f === document.body) main.querySelector('.learn-page__reset button')?.focus(); });
  return { el, dispose() { unsub(); el.remove(); } };
}
