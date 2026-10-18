/**
 * lessonPage.js — halaman pelajaran (#/learn/<id>, M11 Step 02). Urutan: remah roti + menit + tujuan, banner draf, isi,
 * kotak "Try it" (membuka rute di Explore dan mengingat pelajaran asal untuk pil "Back to lesson"), soal (benar/salah
 * langsung + alasan, tanpa skor), sumber, navigasi sebelumnya/berikutnya + "Mark as done". Kotak kata ada di samping
 * (layar lebar) atau di bawah isi (layar sempit). Teks isi dari content/learn.json; label lewat tr().
 * Tidak ada angka model: halaman hanya membaca learn.json, glossary.json, dan references.json.
 */
import { STR } from './strings.js';
import { tr } from '../state/lang.js';
import { findLesson, lessonWords } from '../state/learnView.js';

const L = STR.bi.lesson, LL = STR.bi.learn;

function h(tag, cls = '', text = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/**
 * @param {HTMLElement} root
 * @param {{learn:any|null, glossary:any, references:any, lang:'en'|'id', id:string,
 *   progress:ReturnType<import('../state/learnProgress.js').createLearnProgress>,
 *   onTry:(lessonId:string, route:string)=>void, onWord:(termId:string, from:'learn'|'glossary')=>void}} o
 */
export function createLesson(root, o) {
  const el = h('article', 'reading lesson-page');
  root.append(el);
  const t = (pair, ...args) => tr(pair, o.lang, ...args);
  const found = o.learn ? findLesson(o.learn, o.id) : null;
  if (!found) {
    const main = h('div', 'reading__main');
    main.append(h('h2', 'reading__title', t(LL.title)), h('p', 'reading__note', o.learn ? t(L.notFound, o.id) : t(LL.unavailable)));
    const a = h('a', 'btn btn--sm', t(o.learn ? L.backToList : LL.backToLanding));
    a.href = o.learn ? '#/learn' : '#/';
    main.append(a);
    el.append(main);
    return { el, dispose: () => el.remove() };
  }
  const { entry, prev, next } = found;
  const { lesson, level, levelIndex } = entry;
  const main = h('div', 'reading__main lesson__main');
  const side = h('aside', 'lesson__side');
  el.append(main, side);

  // banner draf (learn.reviewed === false) di paling atas, lalu 1) remah roti, menit, tujuan
  if (!o.learn.reviewed && o.learn.landing?.draftBanner) main.append(h('div', 'reg__banner learn-page__draft', tr(o.learn.landing.draftBanner, o.lang)));
  const crumbs = h('nav', 'lesson__crumbs');
  crumbs.setAttribute('aria-label', t(L.crumbs));
  const ol = h('ol', '');
  const c1 = h('li', ''), c1a = h('a', '', t(L.learn));
  c1a.href = '#/learn';
  c1.append(c1a);
  const c2 = h('li', '', `${t(LL.level, levelIndex)} · ${tr(level.title, o.lang)}`);
  const c3 = h('li', '', tr(lesson.title, o.lang));
  c3.setAttribute('aria-current', 'page');
  ol.append(c1, c2, c3);
  crumbs.append(ol);
  main.append(crumbs);
  main.append(h('h2', 'reading__title', tr(lesson.title, o.lang)));
  const meta = h('p', 'lesson__meta num');
  main.append(meta);
  const goal = h('p', 'lesson__goal');
  goal.append(h('b', '', `${t(L.goal)}: `), tr(lesson.goal, o.lang));
  main.append(goal);

  // 2) isi
  for (const p of lesson.body) main.append(h('p', 'lesson__p', tr(p, o.lang)));

  // 3) kotak kata (di samping pada layar lebar, di bawah isi pada layar sempit)
  const words = lessonWords(o.learn, o.glossary, lesson, o.lang);
  if (words.length) {
    const box = h('section', 'wordbox');
    box.setAttribute('aria-label', t(L.words));
    box.append(h('h3', '', t(L.words)));
    const dl = h('dl', 'wordbox__list');
    for (const w of words) {
      const wrap = h('div', 'wordbox__item');
      wrap.dataset.term = w.id;
      wrap.append(h('dt', '', w.term));
      if (w.definition) wrap.append(h('dd', '', w.definition));
      const a = h('a', 'wordbox__link', t(L.inGlossary));
      a.href = '#/glossary';
      a.addEventListener('click', (e) => { e.preventDefault(); o.onWord(w.id, w.from); });
      const dd = h('dd', '');
      dd.append(a);
      wrap.append(dd);
      dl.append(wrap);
    }
    box.append(dl);
    side.append(box);
  }

  // 4) Try it
  if (lesson.tryIt) {
    const box = h('section', 'tryit');
    box.append(h('h3', '', t(L.tryIt)), h('p', '', tr(lesson.tryIt.text, o.lang)));
    const go = h('a', 'btn tryit__go', `${t(L.tryOpen)} ▸`);
    go.href = lesson.tryIt.route;
    go.addEventListener('click', () => o.onTry(lesson.id, lesson.tryIt.route));
    box.append(go);
    main.append(box);
  }

  // 5) soal: langsung benar/salah + alasan; tidak ada skor yang disimpan
  const checks = lesson.checks ?? [];
  if (checks.length) {
    const sec = h('section', 'quiz');
    sec.append(h('h3', '', t(L.checks)), h('p', 'reading__note', t(L.noScore)));
    checks.forEach((c, qi) => {
      const q = h('fieldset', 'quiz__q');
      const lg = h('legend', '');
      lg.append(h('span', 'quiz__n num', t(L.question, qi + 1, checks.length)), ' ', h('b', '', tr(c.q, o.lang)));
      q.append(lg);
      const group = h('div', 'quiz__opts');
      group.setAttribute('role', 'radiogroup');
      const feedback = h('p', 'quiz__fb');
      feedback.setAttribute('role', 'status');
      const btns = c.options.map((op, oi) => {
        const b = h('button', 'quiz__opt', tr(op, o.lang));
        b.type = 'button';
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', 'false');
        b.addEventListener('click', () => {
          const right = oi === c.answer;
          btns.forEach((x, k) => { x.setAttribute('aria-checked', String(k === oi)); x.classList.toggle('is-right', k === oi && right); x.classList.toggle('is-wrong', k === oi && !right); });
          feedback.className = right ? 'quiz__fb is-right' : 'quiz__fb is-wrong';
          feedback.replaceChildren(h('b', '', `${right ? '✓' : '✗'} ${t(right ? L.right : L.wrong)}. `), h('span', '', `${t(L.why)}: ${tr(c.why, o.lang)}`));
        });
        group.append(b);
        return b;
      });
      q.append(group, feedback);
      sec.append(q);
    });
    main.append(sec);
  }

  // 6) sumber
  if ((lesson.refs ?? []).length) {
    const byId = new Map((o.references?.references ?? []).map((r) => [r.id, r]));
    const sec = h('section', 'srcs');
    sec.append(h('h3', '', t(L.sources)));
    const ul = h('ul', 'srcs__list');
    for (const id of lesson.refs) {
      const r = byId.get(id);
      const li = h('li', 'srcs__item');
      li.dataset.ref = id;
      li.append(h('span', 'srcs__cite', r?.cite ?? id));
      const row = h('span', 'srcs__row');
      if (r?.level === 'intro') row.append(h('span', 'bcard__chip bcard__chip--ok', t(L.startHere)));
      if (!r || r.locatorVerified !== true) row.append(h('span', 'bcard__chip bcard__chip--warn', t(L.toVerify)));
      if (r?.url) {
        const a = h('a', 'srcs__url', t(L.sourceOpen));
        a.href = r.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        row.append(a);
        if (r.accessed) row.append(h('span', 'srcs__acc', t(L.accessed, r.accessed)));
      }
      const refs = h('a', 'srcs__refs', t(L.sourceRefs));
      refs.href = `#/references/${encodeURIComponent(id)}`;
      row.append(refs);
      li.append(row);
      ul.append(li);
    }
    sec.append(ul);
    main.append(sec);
  }

  // 7) navigasi + Mark as done
  const nav = h('nav', 'lesson__nav');
  nav.setAttribute('aria-label', t(L.crumbs));
  const link = (e, label, cls) => {
    const a = h('a', `btn lesson__pn ${cls}`);
    a.href = `#/learn/${e.lesson.id}`;
    a.append(h('span', 'lesson__pn-label', label), h('span', 'lesson__pn-title', tr(e.lesson.title, o.lang)));
    return a;
  };
  nav.append(prev ? link(prev, `◀ ${t(L.prev)}`, 'lesson__pn--prev') : h('span', 'lesson__pn-gap'));
  const mark = h('button', 'btn lesson__done');
  mark.type = 'button';
  nav.append(mark);
  nav.append(next ? link(next, `${t(L.next)} ▶`, 'lesson__pn--next') : h('span', 'lesson__pn-gap'));
  main.append(nav);

  const paint = () => {
    const done = o.progress.has(lesson.id);
    mark.textContent = done ? `✓ ${t(L.markedDone)}` : t(L.markDone);
    mark.setAttribute('aria-pressed', String(done));
    mark.classList.toggle('is-on', done);
    meta.textContent = `${t(LL.minutes, lesson.minutes)} · ${t(done ? LL.done : LL.notDone)}`;
  };
  mark.addEventListener('click', () => o.progress.mark(lesson.id, !o.progress.has(lesson.id)));
  paint();
  const unsub = o.progress.subscribe(paint);
  return { el, dispose() { unsub(); el.remove(); } };
}
