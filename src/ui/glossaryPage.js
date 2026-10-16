/**
 * glossaryPage.js — halaman Glossary (#/glossary, M9 Step 06): istilah dan singkatan dari content/glossary.json
 * (bisa diedit saat runtime, fallback bawaan). Definisi saja. Sumber = id references.json (tautan #/references/<id>);
 * id yang tidak ada di references.json tampil "source to verify". Tautan scene membuka #/scene/N.
 */
import { STR } from './strings.js';
import { createPageShell } from './pageShell.js';
import { createContentBanner } from './contentBanner.js';
import { contentOf, onContent } from '../state/contentStore.js';
import { glossaryTerms } from '../state/glossaryView.js';

const G = STR.pages.glossary;

function h(tag, cls = '', text = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/** @param {{homeHash?:()=>string, win?:Window}} [opts] */
export function createGlossaryPage({ homeHash, win } = {}) {
  let list = null, count = null, input = null, banner = null, query = '';
  function draw() {
    const terms = glossaryTerms(contentOf('glossary').data, contentOf('references').data, query);
    const total = glossaryTerms(contentOf('glossary').data, contentOf('references').data, '').length;
    count.textContent = G.count(terms.length, total);
    list.replaceChildren();
    if (!terms.length) { list.append(h('p', 'refs__intro', G.empty)); return; }
    for (const t of terms) {
      const it = h('div', 'gl__item');
      it.id = `term-${t.id}`;
      const dt = h('dt', 'gl__term');
      dt.append(h('b', '', t.term));
      if (t.expansion) dt.append(h('span', 'gl__exp', ` · ${t.expansion}`));
      const dd = h('dd', 'gl__def', t.definition);
      it.append(dt, dd);
      const links = h('dd', 'gl__links');
      if (t.refs.length) {
        links.append(`${G.sources}: `);
        t.refs.forEach((r, i) => {
          if (i) links.append(', ');
          if (r.known) { const a = h('a', 'fm-ref', r.id); a.href = `#/references/${encodeURIComponent(r.id)}`; a.title = r.cite; links.append(a); } else links.append(h('span', 'bcard__warn', STR.scene9.formationTab.sourceToVerify(r.id)));
        });
      }
      if (t.scenes.length) {
        if (t.refs.length) links.append(' · ');
        links.append(`${G.scenes}: `);
        t.scenes.forEach((n, i) => { if (i) links.append(', '); const a = h('a', 'fm-ref', G.sceneLink(n)); a.href = `#/scene/${n}`; links.append(a); });
      }
      if (links.childNodes.length) it.append(links);
      list.append(it);
    }
  }
  function render(body) {
    if (!list) {
      body.append(h('p', 'refs__intro', G.intro));
      banner = createContentBanner(body);
      const bar = h('div', 'gl__bar');
      const lab = h('label', 'ctl gl__filter');
      lab.append(h('span', 'ctl__label', G.filter));
      input = document.createElement('input');
      input.type = 'search';
      input.placeholder = G.filterPlaceholder;
      input.setAttribute('aria-label', G.filter);
      input.addEventListener('input', () => { query = input.value; draw(); });
      lab.append(input);
      count = h('span', 'refs__intro gl__count num');
      bar.append(lab, count);
      list = h('dl', 'gl__list');
      body.append(bar, list);
    }
    banner.show(contentOf('glossary'));
    draw();
  }
  const shell = createPageShell({ className: 'refs--glossary', title: G.title, hash: '#/glossary', render, homeHash, win });
  const unsub = [onContent('glossary', () => shell.refresh()), onContent('references', () => shell.refresh())];
  return { ...shell, get open() { return shell.open; }, dispose() { for (const u of unsub) u(); shell.dispose(); } };
}
