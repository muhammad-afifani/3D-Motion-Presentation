/**
 * glossaryView.js — data halaman Glossary: istilah terurut (abjad), filter teks, dan sumber yang dicocokkan ke
 * references.json (known:false → UI menulis "source to verify", tidak pernah mengarang sitasi). Tanpa teks UI.
 */

/**
 * @param {any} glossary isi content/glossary.json @param {any} references isi content/references.json @param {string} [query]
 * @returns {{id:string, term:string, expansion:string|null, definition:string, refs:{id:string, known:boolean, cite:string}[], scenes:number[]}[]}
 */
export function glossaryTerms(glossary, references, query = '') {
  const byId = new Map((references?.references ?? []).map((r) => [r.id, r]));
  const q = String(query ?? '').trim().toLowerCase();
  return (glossary?.terms ?? [])
    .map((t) => ({
      id: t.id, term: t.term, expansion: t.expansion ?? null, definition: t.definition,
      refs: (t.refs ?? []).map((id) => ({ id, known: byId.has(id), cite: byId.get(id)?.cite ?? '' })),
      scenes: [...(t.scenes ?? [])],
    }))
    .filter((t) => !q || `${t.term} ${t.expansion ?? ''} ${t.definition}`.toLowerCase().includes(q))
    .sort((a, b) => a.term.localeCompare(b.term, 'en', { sensitivity: 'base' }));
}
