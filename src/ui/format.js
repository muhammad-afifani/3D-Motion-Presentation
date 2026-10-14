/** Format angka tampilan: locale id-ID (koma desimal). Konversi satuan hanya di lapisan ini. */
const cache = new Map();

/** @param {number|null|undefined} x @param {number} [digits=1] */
export function fmt(x, digits = 1) {
  if (x == null || !Number.isFinite(x)) return '–';
  let f = cache.get(digits);
  if (!f) {
    f = new Intl.NumberFormat('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    cache.set(digits, f);
  }
  return f.format(x);
}

/** Persen dari fraksi (0,441 → "44,1"). */
export const pct = (x, digits = 1) => fmt(x * 100, digits);

export const toBar = (Pa) => Pa / 1e5;
export const toLiter = (m3) => m3 * 1e3;
export const toMm = (m) => m * 1e3;

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
/** Notasi ilmiah tampilan: 6e16 → "6×10¹⁶". */
export function sci(x, digits = 0) {
  if (!Number.isFinite(x) || x === 0) return fmt(x, digits);
  const e = Math.floor(Math.log10(Math.abs(x)));
  return `${fmt(x / 10 ** e, digits)}×10${String(e).split('').map((c) => SUP[c]).join('')}`;
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
/** Escape teks konten presenter sebelum disisipkan ke HTML. */
export const escapeHtml = (t) => String(t).replace(/[&<>"]/g, (c) => ESC[c]);

/** Jam timer presenter: 75 000 ms → "01:15"; ≥ 1 jam → "1:02:03". */
export function clock(ms) {
  const t = Math.max(0, Math.floor((ms ?? 0) / 1000)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const two = (x) => String(x).padStart(2, '0');
  return h ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`;
}
