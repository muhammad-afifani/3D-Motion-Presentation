/**
 * glossaryView.js — data halaman Glossary: istilah terurut (abjad), filter teks, dan sumber yang dicocokkan ke
 * references.json (known:false → UI menulis "source to verify", tidak pernah mengarang sitasi). Tanpa teks UI.
 * M11 Step 02: bahasa ID memakai learn.glossaryId (nama bila ada, definisi); tanpa itu → English asli.
 */
import { glossaryText } from './learnView.js';
import { tr } from './lang.js';

/**
 * @param {any} glossary isi content/glossary.json @param {any} references isi content/references.json @param {string} [query]
 * @param {{learn?:any, lang?:'en'|'id'}} [opts] learn = isi learn.json (definisi ID), lang = bahasa tampil
 * @returns {{id:string, term:string, expansion:string|null, definition:string, refs:{id:string, known:boolean, cite:string}[], scenes:number[]}[]}
 */
export function glossaryTerms(glossary, references, query = '', { learn = null, lang = 'en' } = {}) {
  const byId = new Map((references?.references ?? []).map((r) => [r.id, r]));
  const q = String(query ?? '').trim().toLowerCase();
  return (glossary?.terms ?? [])
    .map((t) => ({
      id: t.id, ...glossaryText(learn, t, lang), expansion: t.expansion ? tr(t.expansion, lang) : null,
      refs: (t.refs ?? []).map((id) => ({ id, known: byId.has(id), cite: byId.get(id)?.cite ?? '' })),
      scenes: [...(t.scenes ?? [])],
    }))
    .filter((t) => !q || `${t.term} ${t.expansion ?? ''} ${t.definition}`.toLowerCase().includes(q))
    .sort((a, b) => a.term.localeCompare(b.term, lang, { sensitivity: 'base' }));
}
