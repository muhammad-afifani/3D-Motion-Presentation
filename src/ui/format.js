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
