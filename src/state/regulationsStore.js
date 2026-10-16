/**
 * regulationsStore.js — isi content/regulations.json saat runtime (lihat contentStore.js).
 */
import { contentOf, onContent } from './contentStore.js';

/** Isi saat ini; panggilan pertama memulai fetch. */
export const regulationsContent = () => contentOf('regulations');
/** Dengarkan pergantian isi (setelah fetch). @returns {() => void} berhenti mendengar */
export const onRegulations = (fn) => onContent('regulations', fn);
