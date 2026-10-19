/**
 * learnView.js — data tampilan Learn (M11 Step 02), fungsi murni tanpa teks UI: daftar pelajaran datar, statistik
 * level, pelajaran sebelumnya/berikutnya lintas level, pelajaran pertama yang belum selesai, kata per pelajaran
 * (learn.terms dan glossary.json, dua bahasa), dan cocokan target pil "Back to lesson".
 */
import { tr } from './lang.js';

/** @typedef {{lesson:any, level:any, levelIndex:number, index:number}} LessonEntry */

/** @param {any} learn @returns {LessonEntry[]} urutan baca (Level 0 … Level 5) */
export function lessonEntries(learn) {
  const out = [];
  (learn?.levels ?? []).forEach((level, levelIndex) => (level.lessons ?? []).forEach((lesson) => out.push({ lesson, level, levelIndex, index: out.length })));
  return out;
}

/** @returns {{entry:LessonEntry, prev:LessonEntry|null, next:LessonEntry|null}|null} */
export function findLesson(learn, id) {
  const all = lessonEntries(learn);
  const i = all.findIndex((e) => e.lesson.id === id);
  return i < 0 ? null : { entry: all[i], prev: all[i - 1] ?? null, next: all[i + 1] ?? null };
}

/** @param {any} level @param {(id:string)=>boolean} isDone */
export function levelStats(level, isDone) {
  const lessons = level?.lessons ?? [];
  return { lessons: lessons.length, minutes: lessons.reduce((a, l) => a + (Number.isFinite(l.minutes) ? l.minutes : 0), 0), done: lessons.filter((l) => isDone(l.id)).length };
}

/** Total seluruh level. */
export function learnStats(learn, isDone) {
  const all = lessonEntries(learn);
  return { lessons: all.length, minutes: all.reduce((a, e) => a + e.lesson.minutes, 0), done: all.filter((e) => isDone(e.lesson.id)).length };
}

/** Pelajaran pertama yang belum selesai (null bila semua selesai atau tidak ada pelajaran). */
export function firstUndone(learn, isDone) {
  return lessonEntries(learn).find((e) => !isDone(e.lesson.id)) ?? null;
}

/**
 * Kata di satu pelajaran. Id di learn.terms dan di glossary.json: pasangan dua bahasa (D2: glossary.json berisi pasangan;
 * learn.glossaryId tidak dibaca lagi). `known:false` bila id tak ditemukan di mana pun.
 * @returns {{id:string, term:string, definition:string, from:'learn'|'glossary', known:boolean}[]}
 */
export function lessonWords(learn, glossary, lesson, lang) {
  const own = new Map((learn?.terms ?? []).map((t) => [t.id, t]));
  const gl = new Map((glossary?.terms ?? []).map((t) => [t.id, t]));
  return (lesson?.terms ?? []).map((id) => {
    if (own.has(id)) { const t = own.get(id); return { id, term: tr(t.term, lang), definition: tr(t.definition, lang), from: 'learn', known: true }; }
    if (gl.has(id)) { const g = gl.get(id); return { id, ...glossaryText(learn, g, lang), from: 'glossary', known: true }; }
    return { id, term: id, definition: '', from: 'glossary', known: false };
  });
}

/** Nama dan definisi satu istilah glossary.json menurut bahasa (pasangan { en, id }; `learn` tidak dipakai lagi). */
export function glossaryText(learn, g, lang) {
  return { term: tr(g.term, lang), definition: tr(g.definition, lang) };
}

/** Kata dasar (learn.terms) untuk halaman Glossary, terurut abjad menurut bahasa; `query` menyaring nama + definisi. */
export function basicWords(learn, references, lang, query = '') {
  const refs = new Map((references?.references ?? []).map((r) => [r.id, r]));
  const q = String(query ?? '').trim().toLowerCase();
  return (learn?.terms ?? [])
    .map((t) => ({ id: t.id, term: tr(t.term, lang), definition: tr(t.definition, lang), refs: (t.refs ?? []).map((id) => ({ id, known: refs.has(id), cite: refs.get(id)?.cite ?? '' })) }))
    .filter((t) => !q || `${t.term} ${t.definition}`.toLowerCase().includes(q))
    .sort((a, b) => a.term.localeCompare(b.term, lang, { sensitivity: 'base' }));
}

/**
 * Pil "Back to lesson": target = scene tujuan Try it. Pil tampil selama scene itu terbuka di mode Explore dan halaman
 * Learn tertutup; pindah tab dalam scene yang sama tidak menghilangkannya.
 * @param {{lessonId:string, n:number}|null} state
 * @param {{mode:'explore'|'present', learnOpen:boolean, sceneNumber:number|null}} ctx
 */
export const backPillVisible = (state, ctx) => !!state && ctx.mode === 'explore' && !ctx.learnOpen && ctx.sceneNumber === state.n;

/** Target pil dari rute Try it hasil parseHash: hanya rute scene yang memakai pil (halaman penuh kembali lewat Close). */
export const backTarget = (lessonId, route) => (route?.type === 'scene' ? { lessonId, n: route.n } : null);
