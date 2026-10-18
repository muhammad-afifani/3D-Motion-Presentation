/**
 * lang.js — bahasa teks kelompok Learn (M11 Step 01): satu state global 'en' | 'id', disimpan di localStorage kunci
 * 'etel:lang' (try/catch). Kunjungan pertama (belum ada pilihan tersimpan) memakai learn.defaultLang; pilihan
 * berikutnya diingat. Untuk sementara hanya Landing, About, dan Learn yang berganti bahasa; bagian lain tetap English
 * sampai paket bahasa D (keputusan default global ditinjau lagi saat itu). Tidak masuk store, tidak menyentuh model.
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

/**
 * Bahasa efektif: pilihan tersimpan → learn.defaultLang (kunjungan pertama) → 'en'.
 * @param {{lang:string|null}} choice @param {string|undefined|null} learnDefault
 * @returns {'en'|'id'}
 */
export function resolveLang(choice, learnDefault) {
  if (LANGS.includes(choice?.lang)) return /** @type {'en'|'id'} */ (choice.lang);
  if (LANGS.includes(learnDefault)) return /** @type {'en'|'id'} */ (learnDefault);
  return FALLBACK_LANG;
}

/** @param {Storage|null} storage @param {string} lang @returns {boolean} tersimpan */
export function writeLang(storage, lang) {
  if (!LANGS.includes(lang)) return false;
  try { storage?.setItem(LANG_KEY, lang); return !!storage; } catch { return false; }
}

/**
 * Pemilih bahasa tunggal untuk teks dua bahasa: pasangan { en, id } (nilai string atau fungsi yang membentuk string).
 * Satu-satunya tempat pilihan bahasa ditentukan; dipakai Landing, About, Learn, Glossary (Step 01–02) dan nanti paket D
 * untuk seluruh aplikasi, sehingga tidak ada `if (lang === …)` tersebar. Pasangan tidak lengkap (sisi id kosong) → English.
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
