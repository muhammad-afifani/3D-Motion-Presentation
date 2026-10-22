/**
 * format.js — satu-satunya modul format angka tampilan (Paket D1). Locale mengikuti bahasa UI: 'en' → en-US
 * (1,500.5), 'id' → id-ID (1.500,5). Semua jalur tampilan (HUD, tabel Limits/Regulations, tick sumbu canvas, legenda
 * suhu, ekspor PNG, jendela presenter) memformat lewat fungsi di sini, jadi angka ikut bahasa tanpa logika per komponen.
 * Konversi satuan hanya terjadi di lapisan ini, dan hanya lewat fungsi thermo.js (toUnit dkk.): fq / fqDelta / fqRate
 * menulis angka dalam satuan pilihan pengguna (state/unitsStore.js, Settings → Units); toQty / fromQty mengonversi nilai
 * (data grafik, batas slider), parseQty / checkQty membaca isian dalam satuan tampilan. Nilai di store, model, dan frame
 * selalu satuan dasar. Opsi `qty` pada formatNumber tidak dipakai (cadangan lama); gunakan fq.
 * Isian angka pengguna: parseNumber / checkNumber (koma maupun titik desimal; satu kasus ambigu mengikuti bahasa, lihat parseNumber).
 */
import { LANGS } from '../state/lang.js';
import { UNIT_DEFS, toUnit, fromUnit, toUnitDelta, toUnitRate, concentrationToUnit, mgNm3ToPpmReg, MW, CONCENTRATION_SPECIES } from '../model/thermo.js';
import { unitsStore, QUANTITIES } from '../state/unitsStore.js';

/** @typedef {'en'|'id'} NumLang */
/**
 * Jenis besaran (nilai dalam satuan tampilan saat ini). Disiapkan untuk pengaturan satuan; belum dipakai untuk konversi.
 * @typedef {'pressure'|'temperature'|'volume'|'length'|'power'|'energy'|'mass'|'concentration'|'fraction'|'angle'|'speed'|'flow'|null} Quantity
 */
/** @typedef {{digits?:number, qty?:Quantity, grouping?:boolean}} NumberFormatOpts */

const LOCALE = Object.freeze({ en: 'en-US', id: 'id-ID' });
/** @type {NumLang} */
let numLang = 'en';
const cache = new Map();

/** Bahasa format angka (dipanggil main.js / presenter.js saat bahasa UI berubah). @param {string} lang */
export function setNumberLang(lang) { if (LANGS.includes(lang)) numLang = /** @type {NumLang} */ (lang); }
/** @returns {NumLang} */
export const numberLang = () => numLang;

function formatter(lang, digits, grouping, maxDigits = digits) {
  const k = `${lang}|${digits}|${maxDigits}|${grouping}`;
  let f = cache.get(k);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE[lang], { minimumFractionDigits: digits, maximumFractionDigits: maxDigits, useGrouping: grouping });
    cache.set(k, f);
  }
  return f;
}

/**
 * Format angka tampilan. `qty` belum mengubah nilai (cadangan pengaturan satuan).
 * @param {number|null|undefined} x @param {NumberFormatOpts & {lang?:NumLang}} [o]
 * @returns {string} '–' bila bukan angka
 */
export function formatNumber(x, { digits = 1, qty = null, grouping = true, lang = numLang } = {}) {
  void qty;
  if (x == null || !Number.isFinite(x)) return '–';
  return formatter(lang, digits, grouping).format(x);
}

/** @param {number|null|undefined} x @param {number} [digits=1] */
export const fmt = (x, digits = 1) => formatNumber(x, { digits });

/** Percent from a fraction (0.441 → "44.1" / "44,1"). */
export const pct = (x, digits = 1) => fmt(x * 100, digits);

export const toBar = (Pa) => Pa / 1e5;
export const toLiter = (m3) => m3 * 1e3;
export const toMm = (m) => m * 1e3;

// ───────────── Satuan tampilan (Settings → Units) ─────────────
/** @typedef {keyof typeof UNIT_DEFS} ConvQty */
const SI_UNIT = Object.freeze(Object.fromEntries(QUANTITIES.map((q) => [q.id, q.si])));

/**
 * Satuan efektif besaran. 'auto' (daya) → satuan bawaan scene yang diberikan pemanggil sebagai `native` (mis. 'MW');
 * tanpa `native`, auto jatuh ke kW. Bendera UNITS_UI mati → selalu SI bawaan.
 * kAsC: tempat yang ditulis dalam °C (ambient, acuan ISO, derating per °C): pilihan K tetap ditulis °C.
 * @param {ConvQty} qty @param {string|null} [native] @param {boolean} [kAsC] @returns {string} id satuan UNIT_DEFS
 */
export function qtyUnit(qty, native = null, kAsC = false) {
  let u = unitsStore.unit(qty);
  if (u === 'auto') u = native ?? (qty === 'power' ? 'kW' : SI_UNIT[qty]);
  // tempat yang ditulis dalam °C (suhu ambient, acuan ISO, laju derating per °C): K (satuan SI bawaan) tetap tampil °C
  if (kAsC && qty === 'temperature' && u === 'K') u = 'C';
  return u;
}
/** Satuan acuan penulisan digit di pemanggil: native bila ada, selain itu satuan SI bawaan. */
const refUnit = (qty, native) => native ?? (SI_UNIT[qty] === 'auto' ? null : SI_UNIT[qty]);

/**
 * Digit desimal di satuan tampilan supaya angka bermakna kira-kira sama dengan penulisan di satuan acuan:
 * digits − round(log10(factor_tampil / factor_acuan)), dibatasi 0…6 (112,4 bar → 1.630 psia; 200 mm → 7,9 in).
 */
export function digitsFor(qty, unit, digits, native = null) {
  const ref = refUnit(qty, native);
  if (!ref || ref === unit) return digits;
  const fu = UNIT_DEFS[qty].units[unit].factor, fr = UNIT_DEFS[qty].units[ref].factor;
  return Math.min(6, Math.max(0, digits - Math.round(Math.log10(fu / fr))));
}

/**
 * Nilai dasar → angka bertulis dalam satuan pilihan.
 * @param {number|null|undefined} x nilai dasar (Pa, K, W, J/kg, …)
 * @param {ConvQty} qty
 * @param {NumberFormatOpts & {native?:string|null, kAsC?:boolean, scale?:number, lang?:NumLang}} [o] digits = digit di satuan acuan (native atau SI bawaan); scale = pengali setelah konversi (100 untuk persen)
 */
export function fq(x, qty, { digits = 1, native = null, kAsC = false, scale = 1, grouping = true, lang = numLang } = {}) {
  if (x == null || !Number.isFinite(x)) return '–';
  const unit = qtyUnit(qty, native, kAsC);
  return formatNumber(toUnit(qty, unit, x) * scale, { digits: digitsFor(qty, unit, digits, native), grouping, lang });
}
/** Seperti fq untuk SELISIH (tanpa offset suhu): ΔT, kenaikan T. */
export function fqDelta(x, qty, { digits = 1, native = null, kAsC = false, scale = 1, grouping = true, lang = numLang } = {}) {
  if (x == null || !Number.isFinite(x)) return '–';
  const unit = qtyUnit(qty, native, kAsC);
  return formatNumber(toUnitDelta(qty, unit, x) * scale, { digits: digitsFor(qty, unit, digits, native), grouping, lang });
}
/** Seperti fq untuk LAJU per satuan dasar (derating %/K → %/°F). */
export function fqRate(x, qty, { digits = 2, native = null, kAsC = false, scale = 1, grouping = true, lang = numLang } = {}) {
  if (x == null || !Number.isFinite(x)) return '–';
  const unit = qtyUnit(qty, native, kAsC);
  return formatNumber(toUnitRate(qty, unit, x) * scale, { digits: digitsFor(qty, unit, digits, native), grouping, lang });
}
/**
 * Seperti fq untuk nilai yang disimpan dalam satuan `from` (bukan satuan dasar), mis. suhu ambient dalam °C: fqFrom(15, 'temperature', 'C').
 * Digit ditulis relatif terhadap `from`.
 */
export function fqFrom(x, qty, from, o = {}) {
  if (x == null || !Number.isFinite(x)) return '–';
  const { digits = 1, kAsC = false, scale = 1, grouping = true, lang = numLang } = o;
  const unit = qtyUnit(qty, from, kAsC);
  // satuan pilihan = satuan simpanan: tulis apa adanya (tanpa bolak-balik lewat satuan dasar, supaya angka SI tidak bergeser)
  if (unit === from) return formatNumber(x * scale, { digits, grouping, lang });
  return fq(fromUnit(qty, from, x), qty, { ...o, native: from });
}
/**
 * Satuan konsentrasi gas yang berlaku di satu tempat: 'ppmvd' | 'mgNm3'. Pilihan "As in each scene" → `native` (satuan yang ditulis
 * tempat itu sebelum fitur satuan; bawaan 'ppmvd').
 * @param {'ppmvd'|'mgNm3'} [native]
 */
export function concUnit(native = 'ppmvd') {
  const u = unitsStore.unit('concentration');
  return u === 'auto' ? native : u;
}
/**
 * Konsentrasi gas pada basis tampilan (nilai sudah ppmvd @ refO2) → angka tertulis dalam satuan konsentrasi pilihan. Basis O₂ dan volume
 * dibawa pemanggil (refO2, TrefC) dan harus tetap tampil di samping angka. Hanya tampilan: perbandingan ke batas tidak lewat sini.
 * @param {number|null|undefined} ppm ppmvd pada O₂ acuan basis tampilan
 * @param {{species?:'nox'|'co'|'so2'|'ch4', refO2:number, TrefC:number, digits?:number, native?:'ppmvd'|'mgNm3', lang?:NumLang}} o
 */
export function fqConc(ppm, { species = 'nox', refO2, TrefC, digits = 1, native = 'ppmvd', lang = numLang } = /** @type {any} */ ({})) {
  if (ppm == null || !Number.isFinite(ppm)) return '–';
  const unit = concUnit(native);
  const v = unit === 'mgNm3' ? concentrationToUnit({ ppm, species, unit: 'mgNm3', refFrom: refO2, refO2, TrefC }) : ppm;
  return formatNumber(v, { digits, lang });
}
/**
 * Konsentrasi pada BASIS REGULASI (nilai dalam mg/Nm³ pada TrefC grup, mis. NOx mesin di tab Levers Scene 9) → angka tertulis dalam satuan
 * konsentrasi pilihan. Pilihan ppmvd memakai mgNm3ToPpmReg (jalur regulasi: volume molar pada basis grup); O₂ acuan basis grup tetap sama
 * (tidak ada koreksi O₂), sehingga basis tetap yang ditulis di samping angka. Perbandingan ke batas (chip, margin) tidak lewat sini.
 * @param {number|null|undefined} mg @param {{species?:'nox'|'co'|'so2'|'ch4', TrefC:number, PatmAbs?:number, digits?:number, lang?:NumLang}} o
 */
export function fqConcReg(mg, { species = 'nox', TrefC, PatmAbs = 1, digits = 1, lang = numLang } = /** @type {any} */ ({})) {
  if (mg == null || !Number.isFinite(mg)) return '–';
  const v = concUnit('mgNm3') === 'ppmvd' ? mgNm3ToPpmReg(mg, MW[CONCENTRATION_SPECIES[species]], TrefC, PatmAbs) : mg;
  return formatNumber(v, { digits, lang });
}
/** Nilai dasar → nilai angka di satuan pilihan (tanpa pemformatan), mis. data sumbu grafik. */
export const toQty = (x, qty, native = null, kAsC = false) => toUnit(qty, qtyUnit(qty, native, kAsC), x);
/** Nilai angka di satuan pilihan → nilai dasar (batas slider, nilai isian). */
export const fromQty = (x, qty, native = null, kAsC = false) => fromUnit(qty, qtyUnit(qty, native, kAsC), x);

/** Langkah "bulat" terdekat (1, 2, 5 × 10^k, jarak log terkecil): langkah slider di satuan tampilan (10 K → 18 °F → 20 °F). */
export function niceStep(x) {
  if (!(x > 0) || !Number.isFinite(x)) return x;
  const e = Math.floor(Math.log10(x)), m = x / 10 ** e;
  let best = 1;
  for (const c of [1, 2, 5, 10]) if (Math.abs(Math.log10(m / c)) < Math.abs(Math.log10(m / best))) best = c;
  return Number((best * 10 ** e).toPrecision(12));
}
const round12 = (x) => Number(x.toPrecision(12));

/**
 * Konversi untuk satu kontrol yang nilainya disimpan dalam satuan `from` (id satuan UNIT_DEFS: 'bar', 'K', 'C', 'kg/s' …),
 * bukan satuan dasar. Dipakai slider dan isian: nilai di store TETAP dalam `from`; hanya tampilan, min / max / langkah, dan
 * bacaan isian yang memakai satuan pilihan. Bila satuan pilihan = `from`, semua fungsi identitas (angka SI tidak berubah).
 *   toDisp / fromDisp : nilai store ↔ nilai tampilan
 *   clamp             : jepit nilai store ke [min, max] (hasil konversi balik tidak pernah di luar rentang SI)
 *   range             : rentang tampilan dan langkah bulat; batas tampilan dibulatkan KELUAR ke kelipatan langkah, sehingga ujung
 *                       rentang SI tetap terjangkau; nilai di luar SI dijepit oleh clamp
 *   digits            : digit tampilan dari digit yang ditulis untuk satuan `from`
 * @param {ConvQty} qty @param {string} from
 * @param {{native?:string|null, kAsC?:boolean, unit?:string|null}} [o] unit = paksa satuan tampilan (tanpa membaca store)
 */
export function qtyConv(qty, from, { native = null, kAsC = false, unit: forced = null } = {}) {
  const unit = forced ?? qtyUnit(qty, native ?? from, kAsC); // forced = satuan eksplisit (uji / pemakaian murni tanpa store)
  const same = unit === from;
  const ratio = same ? 1 : toUnitDelta(qty, unit, 1) / toUnitDelta(qty, from, 1);
  const toDisp = same ? (v) => v : (v) => toUnit(qty, unit, fromUnit(qty, from, v));
  const fromDisp = same ? (x) => x : (x) => toUnit(qty, from, fromUnit(qty, unit, x));
  return {
    qty, from, unit, same, ratio, toDisp, fromDisp,
    clamp: (v, min, max) => Math.min(max, Math.max(min, v)),
    digits: (d) => (same ? d : digitsFor(qty, unit, d, from)),
    delta: (d) => d * ratio,
    /** @param {{min:number, max:number, step:number}} r rentang dalam satuan `from` */
    range(r) {
      if (same) return { min: r.min, max: r.max, step: r.step };
      const step = niceStep(r.step * ratio);
      return { min: round12(Math.floor(round12(toDisp(r.min) / step)) * step), max: round12(Math.ceil(round12(toDisp(r.max) / step)) * step), step };
    },
  };
}

/**
 * Baca isian angka dalam satuan tampilan → nilai dasar (koma / titik seperti parseNumber). min / max diberikan dalam
 * satuan DASAR; pembulatan pada batas ditoleransi sebesar 1e-9 relatif supaya "50,0 bar" tidak ditolak karena 5e6 − ε.
 * @param {string|number|null|undefined} text
 * @param {ConvQty} qty
 * @param {{min?:number, max?:number, minExclusive?:boolean, allowEmpty?:boolean, native?:string|null, lang?:NumLang}} [o]
 * @returns {{value:number|null, error:null|'empty'|'nan'|'min'|'max'}} value dalam satuan dasar
 */
export function checkQty(text, qty, { min = -Infinity, max = Infinity, minExclusive = false, allowEmpty = true, native = null, lang = numLang } = {}) {
  const r = checkNumber(text, { allowEmpty, lang });
  if (r.error || r.value == null) return r;
  const base = fromQty(r.value, qty, native);
  const tol = 1e-9 * Math.max(1, Math.abs(base));
  if (minExclusive ? !(base > min) : base < min - tol) return { value: null, error: 'min' };
  if (base > max + tol) return { value: null, error: 'max' };
  const clamped = Math.min(max, Math.max(min, base));
  return { value: Number.isFinite(clamped) ? clamped : base, error: null };
}
/** parseQty = checkQty tanpa batas; null bila kosong, NaN bila bukan angka. */
export function parseQty(text, qty, o = {}) {
  const r = checkQty(text, qty, { ...o, min: -Infinity, max: Infinity });
  return r.error === 'nan' ? NaN : r.value;
}

/**
 * Isian angka untuk kontrol berkonversi (qtyConv): koma / titik, galat 'empty' | 'nan' | 'min' | 'max' dihitung di satuan TAMPILAN
 * (min / max dikonversi), dan nilai sah dikembalikan dalam satuan simpanan (`from`) serta dijepit ke [min, max] sehingga pembulatan
 * tidak pernah keluar rentang. min / max dalam satuan simpanan.
 * @param {string|number|null|undefined} text @param {ReturnType<typeof qtyConv>} conv
 * @param {{min?:number, max?:number, minExclusive?:boolean, allowEmpty?:boolean, lang?:NumLang}} [o]
 * @returns {{value:number|null, error:null|'empty'|'nan'|'min'|'max'}}
 */
export function checkConv(text, conv, { min = -Infinity, max = Infinity, minExclusive = false, allowEmpty = true, lang = numLang } = {}) {
  const disp = (v) => (Number.isFinite(v) ? conv.toDisp(v) : v);
  const r = checkNumber(text, { min: disp(min), max: disp(max), minExclusive, allowEmpty, lang });
  if (r.error || r.value == null) return r;
  return { value: conv.same ? r.value : conv.clamp(conv.fromDisp(r.value), min, max), error: null };
}

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
/** Notasi ilmiah tampilan: 6e16 → "6×10¹⁶"; mantissa ikut bahasa (1.5×10³ / 1,5×10³). */
export function sci(x, digits = 0) {
  if (!Number.isFinite(x) || x === 0) return fmt(x, digits);
  const e = Math.floor(Math.log10(Math.abs(x)));
  return `${fmt(x / 10 ** e, digits)}×10${String(e).split('').map((c) => SUP[c]).join('')}`;
}

/**
 * Nilai untuk kotak isian: desimal sesuai bahasa, tanpa pemisah ribuan, nol di belakang dibuang (0.5 / 0,5; 1500).
 * @param {number|null|undefined} x @param {{maxDigits?:number, lang?:NumLang}} [o] @returns {string} '' bila kosong
 */
export function formatInput(x, { maxDigits = 6, lang = numLang } = {}) {
  if (x == null || !Number.isFinite(x)) return '';
  return formatter(lang, 0, false, maxDigits).format(x);
}

/**
 * Baca isian angka pengguna. Koma dan titik sama-sama diterima; bahasa UI hanya menentukan satu kasus ambigu
 * (satu pemisah diikuti tepat tiga digit). Aturan:
 *   - tanpa pemisah: "1500" → 1500;
 *   - dua jenis pemisah: yang terakhir = desimal, yang lain = ribuan ("1.500,5" → 1500.5; "1,500.5" → 1500.5);
 *   - satu jenis pemisah yang muncul lebih dari sekali = ribuan, tiap kelompok tepat 3 digit ("1.500.000" → 1500000);
 *   - satu pemisah yang muncul sekali = DESIMAL ("0,5" dan "0.5" → 0.5; "1.5" dan "1,5" → 1.5), KECUALI pemisah ribuan
 *     bahasa itu (ID: titik; EN: koma) dengan tepat tiga digit di belakangnya dan bagian depan 1–3 digit yang bukan
 *     0 ("1.500" → 1500 di ID; "1,500" → 1500 di EN; "12.345" → 12345). Bagian depan 0 tetap desimal ("0.500" → 0.5
 *     di ID). Pemisah lawannya selalu desimal: di ID "1,500" → 1.5, di EN "1.500" → 1.5.
 * Spasi (termasuk spasi tipis / tak terputus) di dalam angka dibuang; tanda minus "-" atau "−" diterima.
 * @param {string|number|null|undefined} text
 * @param {NumLang} [lang] bahasa UI (bawaan: bahasa format angka aktif)
 * @returns {number|null} null bila kosong; NaN bila bukan angka
 */
export function parseNumber(text, lang = numLang) {
  if (typeof text === 'number') return Number.isFinite(text) ? text : NaN;
  let s = String(text ?? '').replace(/[\s\u00a0\u202f\u2009]/g, '').replace(/^\u2212/, '-');
  if (s === '') return null;
  if (!/^[+-]?[\d.,]+$/.test(s) || !/\d/.test(s)) return NaN;
  const sign = s[0] === '-' ? -1 : 1;
  s = s.replace(/^[+-]/, '');
  const dots = (s.match(/\./g) ?? []).length, commas = (s.match(/,/g) ?? []).length;
  /** "1.500.000" / "1.500" (dengan desimal terpisah): kelompok ribuan harus 1–3 digit lalu tepat 3 digit */
  const groupsOk = (int, sep) => new RegExp(`^\\d{1,3}(\\${sep}\\d{3})+$`).test(int);
  const thousandsSep = lang === 'id' ? '.' : ',';
  let int = s, frac = '';
  if (dots && commas) {
    const dec = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',', grp = dec === '.' ? ',' : '.';
    if ((dec === '.' ? dots : commas) !== 1) return NaN;
    [int, frac] = s.split(dec);
    if (!groupsOk(int, grp)) return NaN;
    int = int.split(grp).join('');
  } else if (dots + commas > 1) {
    const grp = dots ? '.' : ',';
    if (!groupsOk(s, grp)) return NaN;
    int = s.split(grp).join('');
  } else if (dots + commas === 1) {
    const sep = dots ? '.' : ',';
    [int, frac] = s.split(sep);
    // pemisah ribuan bahasa ini + tepat 3 digit di belakang + bagian depan 1–3 digit bukan 0 → ribuan
    if (sep === thousandsSep && /^[1-9]\d{0,2}$/.test(int) && /^\d{3}$/.test(frac)) { int += frac; frac = ''; }
  }
  if (!/^\d*$/.test(int) || !/^\d*$/.test(frac) || (int === '' && frac === '')) return NaN;
  return sign * Number(`${int || '0'}.${frac || '0'}`);
}

/**
 * Validasi isian angka (pengganti min/max milik type="number"). Pesan galat dibentuk pemanggil dari `error` (STR.input).
 * @param {string|number|null|undefined} text
 * @param {{min?:number, max?:number, minExclusive?:boolean, allowEmpty?:boolean, lang?:NumLang}} [o]
 * @returns {{value:number|null, error:null|'empty'|'nan'|'min'|'max'}}
 */
export function checkNumber(text, { min = -Infinity, max = Infinity, minExclusive = false, allowEmpty = true, lang = numLang } = {}) {
  const v = parseNumber(text, lang);
  if (v == null) return allowEmpty ? { value: null, error: null } : { value: null, error: 'empty' };
  if (Number.isNaN(v)) return { value: null, error: 'nan' };
  if (minExclusive ? !(v > min) : v < min) return { value: null, error: 'min' };
  if (v > max) return { value: null, error: 'max' };
  return { value: v, error: null };
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
/** Escape teks konten presenter sebelum disisipkan ke HTML. */
export const escapeHtml = (t) => String(t).replace(/[&<>"]/g, (c) => ESC[c]);

/** Jam timer presenter: 75 000 ms → "01:15"; ≥ 1 jam → "1:02:03" (sama di kedua bahasa). */
export function clock(ms) {
  const t = Math.max(0, Math.floor((ms ?? 0) / 1000)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const two = (x) => String(x).padStart(2, '0');
  return h ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`;
}

/** Tanggal + jam tampilan, ikut bahasa: "Oct 14, 2026, 8:30 AM" / "14 Okt 2026, 08.30". */
const dtf = new Map();
export function dateTime(d, lang = numLang) {
  if (!dtf.has(lang)) dtf.set(lang, new Intl.DateTimeFormat(LOCALE[lang], { dateStyle: 'medium', timeStyle: 'short' }));
  return dtf.get(lang).format(d);
}
