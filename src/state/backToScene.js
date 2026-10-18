/**
 * backToScene.js — asal klik "Read more → Lesson" di kartu bantuan (Bagian C): alamat scene yang dibuka lagi oleh tombol
 * "← Back to the scene" di halaman pelajaran. Hanya alamat scene yang diingat; berlaku untuk pelajaran yang baru dibuka
 * dari kartu (learnHost menghapusnya saat halaman lain dibuka atau ditutup). Pola yang sama dengan asal klik ⓘ grafik.
 */
import { parseHash } from './route.js';

let origin = null;
/** @param {string} hash alamat saat tautan ditekan @param {string} lessonId */
export function setSceneOrigin(hash, lessonId) {
  const r = parseHash(hash);
  origin = r?.type === 'scene' ? { hash, lessonId } : null;
}
/** @returns {{hash:string, lessonId:string}|null} */
export const sceneOrigin = () => origin;
export const clearSceneOrigin = () => { origin = null; };
/** Alamat scene asal untuk pelajaran ini (null bila pelajaran tidak dibuka dari kartu). */
export const backToSceneHash = (lessonId) => (origin && origin.lessonId === lessonId ? origin.hash : null);
