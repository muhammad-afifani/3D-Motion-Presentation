/**
 * theme.js — tema tampilan Dark / Light (bagian B). Murni tampilan: tidak masuk store dan tidak menyentuh model.
 * Disimpan di localStorage kunci 'etel:theme' lewat try/catch. Tanpa pilihan tersimpan (atau storage tidak terbaca)
 * → Dark; prefers-color-scheme sengaja tidak diikuti (presentasi di proyektor tidak boleh berubah karena setelan OS).
 * Tema dipasang sebagai atribut data-theme di <html>; index.html dan presenter.html memasangnya lebih dulu lewat
 * skrip kecil di <head> agar tidak ada kilatan tema gelap.
 */
export const THEME_KEY = 'etel:theme';
export const THEMES = Object.freeze(['dark', 'light']);
export const DEFAULT_THEME = 'dark';

/** @returns {Storage|null} */
export function themeStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/**
 * @param {Storage|null} storage
 * @returns {{theme:'dark'|'light', stored:boolean}} stored = pilihan tersimpan terbaca
 */
export function readThemeChoice(storage) {
  try {
    const v = storage?.getItem(THEME_KEY);
    if (THEMES.includes(v)) return { theme: /** @type {'dark'|'light'} */ (v), stored: true };
  } catch { /* storage diblokir */ }
  return { theme: DEFAULT_THEME, stored: false };
}

/** @param {Storage|null} storage @returns {'dark'|'light'} */
export const readTheme = (storage) => readThemeChoice(storage).theme;

/** @param {Storage|null} storage @param {string} theme @returns {boolean} tersimpan */
export function writeTheme(storage, theme) {
  if (!THEMES.includes(theme)) return false;
  try { storage?.setItem(THEME_KEY, theme); return !!storage; } catch { return false; }
}

/** @param {string} theme @param {Document} [doc] */
export function applyTheme(theme, doc = globalThis.document) {
  const t = THEMES.includes(theme) ? theme : DEFAULT_THEME;
  if (doc?.documentElement) doc.documentElement.dataset.theme = t;
  return t;
}

/** Tema yang sedang terpasang di dokumen. */
export const currentTheme = (doc = globalThis.document) => (doc?.documentElement?.dataset.theme === 'light' ? 'light' : 'dark');
