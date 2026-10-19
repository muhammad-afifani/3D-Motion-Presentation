/**
 * lang.js — bahasa UI: satu state global 'en' | 'id', disimpan di localStorage kunci 'etel:lang' (try/catch).
 * Paket D1: English default; kunjungan pertama (belum ada pilihan tersimpan) memakai bahasa browser bila diawali "id"
 * (navigator.language, mis. id-ID); pilihan tersimpan selalu diutamakan. learn.defaultLang tidak dipakai lagi.
 * Kelompok teks yang sudah dua bahasa ikut sakelar EN/ID (state/i18n.js); angka ikut bahasa (ui/format.js).
 * Tidak masuk store, tidak menyentuh model.
 */
export const LANG_KEY = 'etel:lang';
export const LANGS = Object.freeze(['en', 'id']);
export const FALLBACK_LANG = 'en';

/** @returns {Storage|null} */
export function langStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/** @param {Storage|null} storage @returns {{lang:'en'|'id'|null, stored:boolean}} */
export function readLangChoice(storage) {
  try {
    const v = storage?.getItem(LANG_KEY);
    if (LANGS.includes(v)) return { lang: /** @type {'en'|'id'} */ (v), stored: true };
  } catch { /* storage diblokir */ }
  return { lang: null, stored: false };
}

/** Bahasa browser Indonesia? "id", "id-ID", juga kode lama "in". @param {string|undefined|null} tag */
export const isIndonesianLocale = (tag) => /^(id|in)(-|_|$)/i.test(String(tag ?? ''));

/**
 * Bahasa efektif: pilihan tersimpan → bahasa browser bila diawali "id" (kunjungan pertama) → 'en'.
 * @param {{lang:string|null}} choice @param {string|undefined|null} browserLang navigator.language
 * @returns {'en'|'id'}
 */
export function resolveLang(choice, browserLang) {
  if (LANGS.includes(choice?.lang)) return /** @type {'en'|'id'} */ (choice.lang);
  return isIndonesianLocale(browserLang) ? 'id' : FALLBACK_LANG;
}

/** @param {Storage|null} storage @param {string} lang @returns {boolean} tersimpan */
export function writeLang(storage, lang) {
  if (!LANGS.includes(lang)) return false;
  try { storage?.setItem(LANG_KEY, lang); return !!storage; } catch { return false; }
}

/**
 * Pemilih bahasa tunggal untuk teks dua bahasa: pasangan { en, id } (nilai string atau fungsi yang membentuk string).
 * Satu-satunya tempat pilihan bahasa ditentukan; dipakai Landing, About, Learn, Glossary (Step 01–02) dan paket D
 * (state/i18n.js) untuk seluruh aplikasi, sehingga tidak ada `if (lang === …)` tersebar. Pasangan tidak lengkap (sisi id kosong) → English.
 * @param {{en:any, id?:any}|string|null|undefined} pair
 * @param {'en'|'id'} lang
 * @param {...any} args argumen untuk pasangan berupa fungsi
 * @returns {string}
 */
export function tr(pair, lang, ...args) {
  const v = pair && typeof pair === 'object' ? (pair[lang] || pair.en) : pair;
  const out = typeof v === 'function' ? v(...args) : v;
  return out == null ? '' : String(out);
}
