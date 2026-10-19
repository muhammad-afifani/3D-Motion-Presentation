/**
 * glossaryPage.js — halaman Glossary (#/glossary, M9 Step 06; dua bahasa sejak M11 Step 02): istilah dan singkatan dari
 * content/glossary.json (bisa diedit saat runtime, fallback bawaan). Definisi saja. Sumber = id references.json (tautan
 * #/references/<id>); id yang tidak ada di references.json tampil "source to verify". Tautan scene membuka #/scene/N.
 * Bahasa mengikuti state global (state/langStore.js): ID memakai learn.glossaryId (nama istilah bila ada, definisi).
 * Bagian "Basic words" (learn.terms, penanda "from Learn") ada di atas daftar istilah. focusTerm(id) membuka halaman,
 * menggulir ke istilah dan menyorotnya (dipakai tautan kata di halaman pelajaran).
 */
import { STR } from './strings.js';
import { tr } from '../state/lang.js';
import { langStore } from '../state/langStore.js';
import { createPageShell } from './pageShell.js';
import { createLangSwitch } from './langSwitch.js';
import { createContentBanner } from './contentBanner.js';
import { contentOf, onContent } from '../state/contentStore.js';
import { onLearn } from '../state/learnStore.js';
import { glossaryTerms } from '../state/glossaryView.js';
import { basicWords } from '../state/learnView.js';
import { markNote } from '../state/notes.js';

const G = STR.bi.glossary;

function h(tag, cls = '', text = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/** @param {{homeHash?:()=>string, win?:Window}} [opts] */
export function createGlossaryPage({ homeHash, win } = {}) {
  let list = null, count = null, input = null, banner = null, query = '', learn = null, target = null;
  const lang = () => langStore.lang;
  const t = (pair, ...args) => tr(pair, lang(), ...args);

  function sourceLinks(refs) {
    const links = h('dd', 'gl__links');
    links.append(`${t(G.sources)}: `);
    refs.forEach((r, i) => {
      if (i) links.append(', ');
      if (r.known) { const a = h('a', 'fm-ref', r.id); a.href = `#/references/${encodeURIComponent(r.id)}`; a.title = r.cite; links.append(a); } else links.append(h('span', 'bcard__warn', STR.scene9.formationTab.sourceToVerify(r.id)));
    });
    return links;
  }
  function draw() {
    const refsData = contentOf('references').data;
    const opts = { learn, lang: lang() };
    const terms = glossaryTerms(contentOf('glossary').data, refsData, query, opts);
    const total = glossaryTerms(contentOf('glossary').data, refsData, '', opts).length;
    const basic = basicWords(learn, refsData, lang(), query);
    count.textContent = t(G.count, terms.length + basic.length, total + (learn?.terms?.length ?? 0));
    list.replaceChildren();
    if (!terms.length && !basic.length) { list.append(h('p', 'refs__intro', t(G.empty))); return; }
    if (basic.length) {
      list.append(h('h3', 'gl__group', t(G.basicTitle)), h('p', 'refs__intro', t(G.basicIntro)));
      for (const w of basic) {
        const it = h('div', 'gl__item gl__item--basic');
        it.id = `basic-${w.id}`;
        const dt = h('dt', 'gl__term');
        dt.append(h('b', '', w.term), ' ', markNote(h('span', 'bcard__chip', t(G.fromLearn))));
        it.append(dt, h('dd', 'gl__def', w.definition));
        if (w.refs.length) it.append(sourceLinks(w.refs));
        list.append(it);
      }
      list.append(h('h3', 'gl__group', t(G.termsTitle)));
    }
    for (const tm of terms) {
      const it = h('div', 'gl__item');
      it.id = `term-${tm.id}`;
      const dt = h('dt', 'gl__term');
      dt.append(h('b', '', tm.term));
      if (tm.expansion) dt.append(h('span', 'gl__exp', ` · ${tm.expansion}`));
      const dd = h('dd', 'gl__def', tm.definition);
      it.append(dt, dd);
      const links = tm.refs.length ? sourceLinks(tm.refs) : h('dd', 'gl__links');
      if (tm.scenes.length) {
        if (tm.refs.length) links.append(' · ');
        links.append(`${t(G.scenes)}: `);
        tm.scenes.forEach((n, i) => { if (i) links.append(', '); const a = h('a', 'fm-ref', t(G.sceneLink, n)); a.href = `#/scene/${n}`; links.append(a); });
      }
      if (links.childNodes.length) it.append(links);
      list.append(it);
    }
    if (target) list.querySelector(`#${CSS.escape(target)}`)?.classList.add('is-target');
  }
  function render(body) {
    // dibangun ulang setiap kali dibuka atau saat bahasa/isi berganti (label dua bahasa)
    banner?.dispose?.();
    body.replaceChildren();
    body.append(h('p', 'refs__intro', t(G.intro)));
    banner = createContentBanner(body);
    const bar = h('div', 'gl__bar');
    const lab = h('label', 'ctl gl__filter');
    lab.append(h('span', 'ctl__label', t(G.filter)));
    input = document.createElement('input');
    input.type = 'search';
    input.value = query;
    input.placeholder = t(G.filterPlaceholder);
    input.setAttribute('aria-label', t(G.filter));
    input.addEventListener('input', () => { query = input.value; draw(); });
    lab.append(input);
    count = h('span', 'refs__intro gl__count num');
    bar.append(lab, count);
    list = h('dl', 'gl__list');
    list.lang = lang();
    body.append(bar, list);
    banner.show(contentOf('glossary'));
    draw();
  }
  // halaman penuh menutupi header, jadi sakelar EN/ID (state global yang sama) juga ada di kepala halaman Glossary
  const langSwitch = createLangSwitch({ value: lang(), onChange: (l) => langStore.set(l) });
  const shell = createPageShell({ className: 'refs--glossary', title: () => STR.pages.glossary.title, hash: '#/glossary', render, homeHash, win, headExtra: langSwitch.el });
  const unsub = [
    onContent('glossary', () => shell.refresh()), onContent('references', () => shell.refresh()),
    onLearn((r) => { learn = r.data; shell.refresh(); }),
    langStore.subscribe((l) => { langSwitch.set(l); shell.refresh(); }),
  ];
  return {
    ...shell,
    get open() { return shell.open; },
    /** Buka halaman, kosongkan saringan, gulir ke istilah (id glossary.json atau kata dasar learn.terms) dan sorot. */
    focusTerm(id, from = 'glossary') {
      query = '';
      target = from === 'learn' ? `basic-${id}` : `term-${id}`;
      const wanted = target;
      if (shell.open) shell.refresh(); else shell.setOpen(true); // setOpen mengembalikan gulir ke atas: gulir setelahnya
      target = null;
      list?.querySelector(`#${CSS.escape(wanted)}`)?.scrollIntoView({ block: 'center' });
    },
    dispose() { for (const u of unsub) u(); shell.dispose(); },
  };
}
