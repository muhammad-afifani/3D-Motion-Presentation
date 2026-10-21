/**
 * i18n.js — kerangka terjemahan seluruh aplikasi (Paket D). Teks sumber kelompok yang sudah dimigrasi ditulis di
 * src/ui/strings.js sebagai pasangan { en, id } (nilai string atau fungsi). `createStrings` membentuk objek tampilan
 * `STR` (daun = string / fungsi biasa, seperti sebelum migrasi), dan `apply(lang)` mengisi ulang objek itu DI TEMPAT
 * lewat tr(): objek bertingkat tetap sama, jadi alias tingkat modul (`const T = STR.theme`) tetap sah dan komponen
 * tidak perlu diubah. Kelompok yang belum dimigrasi tetap English dan disalin apa adanya.
 *
 * Kapan teks berganti: hanya saat bahasa berubah (main.js memanggil apply, lalu memasang ulang scene dan menggambar
 * ulang halaman yang terbuka). Tidak ada string yang dibangun ulang setiap frame.
 *
 * Aturan (dijaga tests/i18n.test.js): setiap daun kelompok di MIGRATED_GROUPS adalah pasangan lengkap; sisi id tidak
 * sama dengan sisi en kecuali entri di daftar "Tetap Inggris" (docs/tetap_inggris.json, dibaca tes, bukan kode aplikasi;
 * ubah daftar itu lalu jalankan `node scripts/gen-tetap-inggris.mjs` untuk memperbarui docs/PADANAN_ISTILAH.md).
 * STR.bi dan STR.lang sudah dua bahasa sejak M11 dan dipilih langsung dengan tr() oleh komponennya: tidak ikut di sini.
 */
import { tr } from './lang.js';

/**
 * Teks dua bahasa.
 * @template {string | ((...args:any[]) => string)} [T=string]
 * @typedef {{en:T, id:T}} BiText
 */

/**
 * Kelompok STR yang sudah berupa pasangan { en, id } (bertambah per tahap D2–D6). Jalur bertitik ('basis.refs') =
 * hanya subkelompok itu; sisa kelompok induknya tetap English sampai tahapnya.
 */
export const MIGRATED_GROUPS = Object.freeze([
  'theme', 'formula', 'input',
  // D2 kerangka
  'common', 'app', 'nav', 'pages', 'content', 'debug', 'snapshot', 'presenter', 'regulation', 'landing', 'basis.refs',
  // D3 Scene 1–4, grafik bersama, tag Basis di sudut grafik / HUD
  'charts', 'scene1', 'scene2', 'scene3', 'scene4', 'basis.tag', 'basis.tagTip',
  // D4 Scene 5–8
  'scene5', 'scene6', 'scene7', 'scene8',
  // D5a Scene 9 (kelima tab)
  'scene9',
  // D5b Scene 10–11
  'scene10', 'scene11',
  // D6 panel asumsi (H), kartu Basis, nama kelompok Basis; src/model/basis.js TETAP English (lihat basis.enOnly)
  'assumptions', 'basis.groups', 'basis.card', 'basis.enOnly', 'basis.levelWord',
]);

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

/** Isi `target` dari `src` untuk satu bahasa tanpa mengganti objek / larik bertingkat yang sudah ada. */
function assignInto(target, src, lang) {
  for (const [k, v] of Object.entries(src)) {
    const t = target[k];
    if (v && typeof v === 'object' && !isPair(v) && t && typeof t === 'object' && Array.isArray(v) === Array.isArray(t) && (!Array.isArray(v) || v.length === t.length)) assignInto(t, v, lang);
    else target[k] = resolveText(v, lang);
  }
}

/**
 * @template {Record<string, any>} S
 * @param {S} src pohon teks sumber (kelompok MIGRATED_GROUPS berisi pasangan)
 * @param {readonly string[]} [groups] jalur kelompok, boleh bertitik ('basis.refs') atau menunjuk satu daun ('basis.tag')
 * @returns {{view:S, apply:(lang:'en'|'id')=>void}} view = STR (awal: English)
 */
export function createStrings(src, groups = MIGRATED_GROUPS) {
  const view = /** @type {any} */ ({ ...src });
  const at = (root, parts) => parts.reduce((o, k) => o[k], root);
  for (const g of groups) {
    const parts = g.split('.'), last = /** @type {string} */ (parts.pop());
    // salin tipis sepanjang jalur agar objek sumber (EN + id) tidak ikut berubah
    let s = src, t = view;
    for (const k of parts) { if (t[k] === s[k]) t[k] = { ...s[k] }; s = s[k]; t = t[k]; }
    t[last] = resolveText(s[last], 'en');
  }
  let current = 'en';
  return {
    view,
    apply(lang) {
      if (lang === current) return;
      current = lang;
      for (const g of groups) {
        const parts = g.split('.'), node = at(src, parts);
        if (isPair(node) || typeof node !== 'object') at(view, parts.slice(0, -1))[parts.at(-1)] = resolveText(node, lang); // daun tunggal ('basis.tag')
        else assignInto(at(view, parts), node, lang);
      }
    },
  };
}
