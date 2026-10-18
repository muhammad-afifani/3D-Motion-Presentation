/**
 * backLessonPill.js — pil kecil "← Back to lesson" (M11 Step 02) di header kiri, tepat di bawah tag scene (peta posisi
 * di docs/m11_pack/00_README: tidak bertumpuk dengan chip Formula di viewport atau tombol Explore (M) di header kanan).
 * Muncul setelah Try it dari pelajaran; hilang di Present, saat pindah scene/halaman Learn (diatur main.js). Tautan
 * biasa ke #/learn/<id>. Tidak ikut ekspor PNG.
 */
import { STR } from './strings.js';
import { tr } from '../state/lang.js';

const L = STR.bi.lesson;

/** @param {HTMLElement} parent @param {() => 'en'|'id'} getLang */
export function createBackLessonPill(parent, getLang) {
  const el = document.createElement('a');
  el.className = 'back-pill';
  el.hidden = true;
  el.dataset.snapSkip = '';
  parent.append(el);
  let lessonId = null;
  const paint = () => {
    if (!lessonId) return;
    el.href = `#/learn/${lessonId}`;
    el.textContent = tr(L.backToLesson, getLang());
    el.dataset.tip = tr(L.backToLessonTip, getLang());
  };
  return {
    el,
    get visible() { return !el.hidden; },
    show(id) { lessonId = id; el.hidden = false; paint(); },
    hide() { lessonId = null; el.hidden = true; },
    /** Bahasa berganti. */
    refresh: paint,
    dispose() { el.remove(); },
  };
}
