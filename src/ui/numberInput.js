/**
 * numberInput.js — kotak isian angka pengguna (Paket D1): limit, site data, sulfur, Calibration, O₂ acuan.
 * Pengganti type="number": kotak teks dengan inputmode="decimal" sehingga koma maupun titik desimal diterima di semua
 * bahasa (Chromium berbahasa en menolak koma pada type="number"). Pembacaan dan validasi min/max lewat ui/format.js
 * (parseNumber, checkNumber); pesan galat dari STR.input mengikuti bahasa dan tampil di gelembung kecil di atas kotak
 * (tanpa menggeser tata letak). Nilai dari store ditampilkan dengan formatInput (desimal sesuai bahasa).
 */
import { STR } from './strings.js';
import { checkNumber, formatInput } from './format.js';

const T = STR.input;
let seq = 0;

/**
 * @param {HTMLInputElement} input kotak yang sudah ada di DOM (dibungkus di tempat)
 * @param {{min?:number, max?:number, minExclusive?:boolean, allowEmpty?:boolean, onCommit?:(v:number|null)=>void}} [o]
 *   onCommit dipanggil saat change dengan nilai sah (null = dikosongkan bila allowEmpty)
 */
export function createNumberField(input, o = {}) {
  let range = { min: o.min ?? -Infinity, max: o.max ?? Infinity };
  input.type = 'text';
  input.inputMode = 'decimal';
  input.autocomplete = 'off';
  input.spellcheck = false;
  for (const a of ['min', 'max', 'step']) input.removeAttribute(a);
  const wrap = document.createElement('span');
  wrap.className = 'num-field';
  input.replaceWith(wrap);
  const err = document.createElement('span');
  err.className = 'num-field__err';
  err.id = `num-err-${++seq}`;
  err.setAttribute('role', 'alert');
  err.hidden = true;
  wrap.append(input, err);

  const message = (e) => (e === 'nan' ? T.nan : e === 'empty' ? T.empty : e === 'max' ? T.max(formatInput(range.max))
    : o.minExclusive ? T.above(formatInput(range.min)) : T.min(formatInput(range.min)));
  function showError(text) {
    err.textContent = text;
    err.hidden = !text;
    input.setAttribute('aria-invalid', String(!!text));
    if (text) input.setAttribute('aria-describedby', err.id); else input.removeAttribute('aria-describedby');
  }
  /** @returns {{value:number|null, ok:boolean}} */
  function read() {
    const r = checkNumber(input.value, { ...range, minExclusive: !!o.minExclusive, allowEmpty: o.allowEmpty !== false });
    showError(r.error ? message(r.error) : '');
    return { value: r.value, ok: !r.error };
  }
  input.addEventListener('change', () => { const r = read(); if (r.ok) o.onCommit?.(r.value); });
  input.addEventListener('input', () => { if (!err.hidden) showError(''); });
  showError('');

  return {
    el: wrap,
    input,
    read,
    get invalid() { return !err.hidden; },
    /** Nilai dari store; tidak menimpa kotak yang sedang diketik atau sedang menampilkan galat. @param {number|string|null|undefined} v */
    set(v) {
      if (document.activeElement === input || !err.hidden) return;
      const n = typeof v === 'number' ? v : checkNumber(v).value;
      const s = n == null ? '' : formatInput(n);
      if (input.value !== s) input.value = s;
    },
    /** @param {{min?:number, max?:number}} r */
    setRange(r) { range = { min: r.min ?? -Infinity, max: r.max ?? Infinity }; },
  };
}
