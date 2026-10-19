/**
 * readingParts.js — bagian halaman baca yang dipakai bersama halaman pelajaran (Step 02) dan halaman Chart guide
 * (Step 03): kotak kata ("Words in this …") dan daftar sumber. Teks label datang dari pemanggil (sudah lewat tr()).
 */
import { STR } from './strings.js';
import { tr } from '../state/lang.js';
import { markNote } from '../state/notes.js';

const L = STR.bi.lesson;

function h(tag, cls = '', text = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/**
 * Kotak kata di samping (layar lebar) atau di bawah isi (layar sempit).
 * @param {{id:string, term:string, definition:string, from:'learn'|'glossary'}[]} words hasil lessonWords
 * @param {{lang:'en'|'id', title:string, onWord:(termId:string, from:'learn'|'glossary')=>void}} o
 * @returns {HTMLElement}
 */
export function createWordBox(words, o) {
  const box = h('section', 'wordbox');
  box.setAttribute('aria-label', o.title);
  box.append(h('h3', '', o.title));
  const dl = h('dl', 'wordbox__list');
  for (const w of words) {
    const wrap = h('div', 'wordbox__item');
    wrap.dataset.term = w.id;
    wrap.append(h('dt', '', w.term));
    if (w.definition) wrap.append(h('dd', '', w.definition));
    const a = h('a', 'wordbox__link', tr(L.inGlossary, o.lang));
    a.href = '#/glossary';
    a.addEventListener('click', (e) => { e.preventDefault(); o.onWord(w.id, w.from); });
    const dd = h('dd', '');
    dd.append(a);
    wrap.append(dd);
    dl.append(wrap);
  }
  box.append(dl);
  return box;
}

/**
 * Daftar sumber: kutipan, lencana "Start here" / "to verify", tautan sumber, tautan ke halaman References.
 * @param {string[]} ids id di references.json @param {any} references isi references.json
 * @param {{lang:'en'|'id'}} o @returns {HTMLElement}
 */
export function createSourceList(ids, references, o) {
  const t = (pair, ...args) => tr(pair, o.lang, ...args);
  const byId = new Map((references?.references ?? []).map((r) => [r.id, r]));
  const sec = h('section', 'srcs');
  sec.append(h('h3', '', t(L.sources)));
  const ul = h('ul', 'srcs__list');
  for (const id of ids) {
    const r = byId.get(id);
    const li = h('li', 'srcs__item');
    li.dataset.ref = id;
    li.append(h('span', 'srcs__cite', r?.cite ?? id));
    const row = h('span', 'srcs__row');
    if (r?.level === 'intro') row.append(h('span', 'bcard__chip bcard__chip--ok', t(L.startHere)));
    if (!r || r.locatorVerified !== true) row.append(markNote(h('span', 'bcard__chip bcard__chip--warn', t(L.toVerify))));
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
  return sec;
}
