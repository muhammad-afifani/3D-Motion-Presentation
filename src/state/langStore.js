/**
 * langStore.js — state bahasa global ('en' | 'id', kunci etel:lang), satu salinan untuk seluruh aplikasi (M11 Step 02).
 * Sakelar EN/ID di header menulis di sini; main.js (teks dua bahasa + format angka, lalu scene dan halaman), Landing,
 * About, Learn, dan Glossary berlangganan. Kunjungan pertama: bahasa browser bila diawali "id", selain itu English
 * (Paket D1); pilihan tersimpan diutamakan. Tanpa DOM; storage dan bahasa browser diinjeksi (uji); akses storage
 * dibungkus try/catch (lang.js).
 */
import { langStorage, readLangChoice, resolveLang, writeLang, LANGS } from './lang.js';

/** @param {Storage|null} [storage] @param {string|undefined|null} [browserLang] navigator.language */
export function createLangStore(storage = langStorage(), browserLang = globalThis.navigator?.language) {
  let choice = readLangChoice(storage);
  let lang = resolveLang(choice, browserLang);
  const subs = new Set();
  /** @returns {boolean} bahasa berubah */
  const apply = (l) => { if (l === lang) return false; lang = l; for (const fn of [...subs]) fn(lang); return true; };
  return {
    get lang() { return lang; },
    /** true bila ada pilihan tersimpan (bahasa kunjungan pertama belum ditentukan). */
    get stored() { return choice.stored; },
    /** Pilihan pengguna: simpan (etel:lang) dan beri tahu pelanggan. @returns {boolean} tersimpan */
    set(l) {
      if (!LANGS.includes(l)) return false;
      const ok = writeLang(storage, l);
      choice = { lang: /** @type {'en'|'id'} */ (l), stored: true };
      apply(choice.lang);
      return ok;
    },
    /** @param {(lang:'en'|'id')=>void} fn @returns {() => void} */
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}

/** Salinan global yang dipakai aplikasi. */
export const langStore = createLangStore();
export const getLang = () => langStore.lang;
