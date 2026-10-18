/**
 * learnStore.js — satu salinan runtime content/learn.json (M11). Urutan: fetch ${BASE_URL}content/learn.json (bisa
 * diedit di dist/ tanpa build ulang) → bila tidak ada / rusak: fallback lewat dynamic import (chunk terpisah, tidak
 * masuk bundle utama) → bila import juga gagal: data null (landing minimal English, tanpa layar kosong). Tidak pernah
 * throw; galat skema dicatat untuk banner.
 */
import { contentUrl, LEARN_FILE, validateLearn, fallbackContent } from './content.js';
import { parseHash } from './route.js';
import { SCENE_NUMBERS } from './scenes.js';

/** @typedef {{data:any|null, source:'file'|'fallback'|'none', errors:{field:string, code:string, detail?:string}[], error?:string}} LearnResult */

const validate = (j) => validateLearn(j, {
  refIds: (fallbackContent('references')?.references ?? []).map((r) => r.id),
  glossaryIds: (fallbackContent('glossary')?.terms ?? []).map((t) => t.id),
  parseRoute: parseHash,
  sceneNumbers: [...SCENE_NUMBERS],
});

/**
 * @param {{fetchFn?:typeof fetch, importFn?:() => Promise<any>, base?:string}} [o]
 * @returns {Promise<LearnResult>}
 */
export async function loadLearn({ fetchFn = globalThis.fetch, importFn = () => import('../../content/learn.json'), base } = {}) {
  let fileErrors = [];
  try {
    const res = await fetchFn(contentUrl(LEARN_FILE, base), { cache: 'no-store' });
    const html = /html/i.test(res?.headers?.get?.('content-type') ?? '');
    if (res?.ok && !html) {
      const text = await res.text();
      if (!/^\s*</.test(text)) {
        try {
          const j = JSON.parse(text);
          fileErrors = validate(j);
          if (!fileErrors.length) return { data: j, source: 'file', errors: [] };
        } catch (err) { fileErrors = [{ field: '(json)', code: 'parse', detail: String(err?.message ?? err) }]; }
      }
    }
  } catch { /* tanpa server / jaringan → fallback */ }
  try {
    const mod = await importFn();
    const j = mod?.default ?? mod;
    const errs = validate(j);
    if (!errs.length) return { data: j, source: 'fallback', errors: fileErrors };
    return { data: null, source: 'none', errors: [...fileErrors, ...errs] };
  } catch (err) {
    return { data: null, source: 'none', errors: fileErrors, error: String(err?.message ?? err) };
  }
}

let current = null, started = null;
const subs = new Set();
/** Hasil saat ini (null sebelum selesai dimuat); panggilan pertama memulai pemuatan. */
export function learnOf() {
  if (!started) started = loadLearn().then((r) => { current = r; for (const fn of subs) fn(r); return r; });
  return current;
}
/** Dengarkan hasil pemuatan (dipanggil segera bila sudah selesai). @returns {() => void} */
export function onLearn(fn) {
  subs.add(fn);
  if (current) fn(current); else learnOf();
  return () => subs.delete(fn);
}
