/**
 * contentStore.js — satu salinan runtime per file content/*.json untuk semua scene dan halaman.
 * Mulai dari salinan bawaan (sinkron), lalu diganti hasil fetch (file bisa diedit di dist/content/ tanpa build ulang).
 * File rusak / skema salah → tetap salinan bawaan + daftar galat (untuk banner); tidak pernah throw.
 */
import { loadContent, fallbackContent, CONTENT_FILES } from './content.js';

const stores = new Map();

function storeOf(kind) {
  if (!stores.has(kind)) stores.set(kind, { current: { data: fallbackContent(kind), source: 'fallback', file: CONTENT_FILES[kind], errors: [] }, started: false, subs: new Set() });
  return stores.get(kind);
}

/** Isi saat ini; panggilan pertama memulai fetch. @param {keyof typeof CONTENT_FILES} kind */
export function contentOf(kind) {
  const st = storeOf(kind);
  if (!st.started) {
    st.started = true;
    loadContent(kind).then((r) => { st.current = r; for (const fn of st.subs) fn(r); });
  }
  return st.current;
}
/** Dengarkan pergantian isi (setelah fetch). @returns {() => void} berhenti mendengar */
export function onContent(kind, fn) {
  const st = storeOf(kind);
  st.subs.add(fn);
  contentOf(kind);
  return () => st.subs.delete(fn);
}
