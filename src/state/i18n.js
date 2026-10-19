/**
 * i18n.js — kerangka terjemahan seluruh aplikasi (Paket D1). Teks sumber kelompok yang sudah dimigrasi ditulis di
 * src/ui/strings.js sebagai pasangan { en, id } (nilai string atau fungsi). `createStrings` membentuk objek tampilan
 * `STR` (daun = string / fungsi biasa, seperti sebelum migrasi), dan `apply(lang)` mengisi ulang objek itu DI TEMPAT
 * lewat tr(): objek bertingkat tetap sama, jadi alias tingkat modul (`const T = STR.theme`) tetap sah dan komponen
 * tidak perlu diubah. Kelompok yang belum dimigrasi tetap English dan disalin apa adanya.
 *
 * Kapan teks berganti: hanya saat bahasa berubah (main.js memanggil apply, lalu memasang ulang scene dan menggambar
 * ulang halaman yang terbuka). Tidak ada string yang dibangun ulang setiap frame.
 *
 * Aturan (dijaga tests/i18n.test.js): setiap daun kelompok di MIGRATED_GROUPS adalah pasangan lengkap; sisi id tidak
 * sama dengan sisi en kecuali istilah di daftar "Tetap Inggris" docs/PADANAN_ISTILAH.md (SAME_OK di bawah).
 * STR.bi dan STR.lang sudah dua bahasa sejak M11 dan dipilih langsung dengan tr() oleh komponennya: tidak ikut di sini.
 */
import { tr } from './lang.js';

/**
 * Teks dua bahasa.
 * @template {string | ((...args:any[]) => string)} [T=string]
 * @typedef {{en:T, id:T}} BiText
 */

/** Kelompok STR yang sudah berupa pasangan { en, id } (bertambah per tahap D2–D6). */
export const MIGRATED_GROUPS = Object.freeze(['theme', 'formula', 'input']);

/**
 * Istilah yang sengaja sama di kedua bahasa (singkatan, simbol, nama halaman/produk, jargon lapangan). Harus juga
 * tercantum di bagian "Tetap Inggris" docs/PADANAN_ISTILAH.md (dijaga tests/i18n.test.js).
 */
export const SAME_OK = Object.freeze(['ƒ']);

/** Pasangan dua bahasa: tepat kunci { en, id }. @param {any} v @returns {v is BiText<any>} */
export const isPair = (v) => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 2 && 'en' in v && 'id' in v;

/**
 * Pasangan → nilai untuk satu bahasa (string, atau fungsi yang memanggil tr() dengan argumennya); objek dan larik ditelusuri.
 * @param {any} v @param {'en'|'id'} lang
 */
export function resolveText(v, lang) {
  if (isPair(v)) return typeof v.en === 'function' ? (...args) => tr(v, lang, ...args) : tr(v, lang);
  if (Array.isArray(v)) return v.map((x) => resolveText(x, lang));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolveText(x, lang)]));
  return v;
}

/** Isi `target` dari `src` untuk satu bahasa tanpa mengganti objek bertingkat yang sudah ada. */
function assignInto(target, src, lang) {
  for (const [k, v] of Object.entries(src)) {
    const t = target[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && !isPair(v) && t && typeof t === 'object' && !Array.isArray(t)) assignInto(t, v, lang);
    else target[k] = resolveText(v, lang);
  }
}

/**
 * @template {Record<string, any>} S
 * @param {S} src pohon teks sumber (kelompok MIGRATED_GROUPS berisi pasangan)
 * @param {readonly string[]} [groups]
 * @returns {{view:S, apply:(lang:'en'|'id')=>void}} view = STR (awal: English)
 */
export function createStrings(src, groups = MIGRATED_GROUPS) {
  const view = /** @type {any} */ ({});
  for (const [k, v] of Object.entries(src)) view[k] = groups.includes(k) ? resolveText(v, 'en') : v;
  let current = 'en';
  return {
    view,
    apply(lang) {
      if (lang === current) return;
      current = lang;
      for (const g of groups) assignInto(view[g], src[g], lang);
    },
  };
}
