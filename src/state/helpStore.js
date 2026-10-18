/**
 * helpStore.js — satu salinan runtime content/help.json (Bagian C). Urutan seperti learnStore: fetch
 * ${BASE_URL}content/help.json (bisa diedit di dist/ tanpa build ulang) → bila tidak ada / rusak: fallback lewat dynamic
 * import (chunk terpisah) → bila gagal: data null (kartu menampilkan pesan "no help text"). Tidak pernah throw.
 */
import { contentUrl, HELP_FILE, validateHelp } from './content.js';

/** @typedef {{data:any|null, source:'file'|'fallback'|'none', errors:{field:string, code:string, detail?:string}[], error?:string}} HelpResult */

/** @param {{fetchFn?:typeof fetch, importFn?:() => Promise<any>, base?:string}} [o] @returns {Promise<HelpResult>} */
export async function loadHelp({ fetchFn = globalThis.fetch, importFn = () => import('../../content/help.json'), base } = {}) {
  let fileErrors = [];
  try {
    const res = await fetchFn(contentUrl(HELP_FILE, base), { cache: 'no-store' });
    const html = /html/i.test(res?.headers?.get?.('content-type') ?? '');
    if (res?.ok && !html) {
      const text = await res.text();
      if (!/^\s*</.test(text)) {
        try {
          const j = JSON.parse(text);
          fileErrors = validateHelp(j);
          if (!fileErrors.length) return { data: j, source: 'file', errors: [] };
        } catch (err) { fileErrors = [{ field: '(json)', code: 'parse', detail: String(err?.message ?? err) }]; }
      }
    }
  } catch { /* tanpa server / jaringan → fallback */ }
  try {
    const mod = await importFn();
    const j = mod?.default ?? mod;
    const errs = validateHelp(j);
    if (!errs.length) return { data: j, source: 'fallback', errors: fileErrors };
    return { data: null, source: 'none', errors: [...fileErrors, ...errs] };
  } catch (err) {
    return { data: null, source: 'none', errors: fileErrors, error: String(err?.message ?? err) };
  }
}

let current = null, started = null;
const subs = new Set();
/** Hasil saat ini (null sebelum selesai dimuat); panggilan pertama memulai pemuatan. */
export function helpOf() {
  if (!started) started = loadHelp().then((r) => { current = r; for (const fn of [...subs]) fn(r); return r; });
  return current;
}
/** Janji hasil pemuatan (memulai pemuatan bila belum). */
export function helpReady() { helpOf(); return started; }
/** Dengarkan hasil pemuatan (dipanggil segera bila sudah selesai). @returns {() => void} */
export function onHelp(fn) {
  subs.add(fn);
  if (current) fn(current); else helpOf();
  return () => subs.delete(fn);
}
/** Item bantuan menurut id (null bila belum dimuat atau tidak ada). */
export const helpItem = (id) => current?.data?.items?.[id] ?? null;
