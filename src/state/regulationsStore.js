/**
 * regulationsStore.js — isi content/regulations.json saat runtime (satu salinan untuk semua scene dan halaman).
 * Mulai dari salinan bawaan (sinkron), lalu diganti hasil fetch (file bisa diedit di dist/content/ tanpa build ulang).
 * File rusak / skema salah → tetap salinan bawaan + daftar galat (untuk banner); tidak pernah throw.
 */
import { loadContent, fallbackContent } from './content.js';

let current = { data: fallbackContent('regulations'), source: 'fallback', file: 'regulations.json', errors: [] };
let started = false;
const subs = new Set();

/** Isi saat ini; panggilan pertama memulai fetch. */
export function regulationsContent() {
  if (!started) {
    started = true;
    loadContent('regulations').then((r) => { current = r; for (const fn of subs) fn(current); });
  }
  return current;
}
/** Dengarkan pergantian isi (setelah fetch). @returns {() => void} berhenti mendengar */
export function onRegulations(fn) {
  subs.add(fn);
  regulationsContent();
  return () => subs.delete(fn);
}
