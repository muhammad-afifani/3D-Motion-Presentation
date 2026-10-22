/**
 * numberInput.js — kotak isian angka pengguna: limit, site data, sulfur, Calibration, O₂ acuan.
 * Pengganti type="number": kotak teks dengan inputmode="decimal" sehingga koma maupun titik desimal diterima di semua
 * bahasa (Chromium berbahasa en menolak koma pada type="number"). Pembacaan dan validasi min/max lewat ui/format.js
 * (parseNumber, checkNumber); pesan galat dari STR.input mengikuti bahasa.
 *
 * Pesan galat tampil di SLOT TETAP di bawah kotak (.num-err: satu baris, tinggi dicadangkan sejak awal), jadi tata letak
 * tidak bergeser saat galat muncul dan tidak menutupi label. Slot bisa milik kotak itu sendiri (bawaan) atau dibagi satu
 * grup kotak (`errorHost`, mis. dua isian limit Scene 6); pada slot bersama, awalan `name` ("NOx: …") menyebut kotaknya.
 * Pesan satu baris dan pendek; yang terlalu panjang dipotong dengan elipsis dan teks lengkapnya ada di tooltip (title).
 */
import { STR } from './strings.js';
import { checkNumber, checkConv, formatInput, qtyConv } from './format.js';

const T = STR.input;
let seq = 0;
/** Slot bersama: kotak mana yang sedang memakai (agar kotak lain yang sah tidak menghapus galat kotak ini). */
const owners = new WeakMap();

/**
 * @param {HTMLInputElement} input kotak yang sudah ada di DOM (dibungkus di tempat)
 * @param {{min?:number, max?:number, minExclusive?:boolean, allowEmpty?:boolean, errorHost?:HTMLElement, name?:string,
 *   onCommit?:(v:number|null)=>void, qty?:string, from?:string, native?:string, kAsC?:boolean}} [o] onCommit dipanggil saat change dengan nilai sah (null = dikosongkan bila allowEmpty);
 *   errorHost = elemen slot galat bersama (kelas .num-err); name = awalan pesan pada slot bersama.
 *   qty + from (satuan tampilan, M13): min / max / set() / hasil read() / onCommit TETAP dalam satuan `from`; kotak menulis dan
 *   membaca satuan pilihan pengguna (koma / titik seperti biasa); batas dan pesan galat ditulis dalam satuan pilihan, dan hasil
 *   konversi balik dijepit ke [min, max] sehingga pembulatan tidak pernah keluar rentang.
 */
export function createNumberField(input, o = {}) {
  const conv = o.qty ? qtyConv(/** @type {any} */ (o.qty), o.from, { native: o.native ?? null, kAsC: !!o.kAsC }) : null;
  const toDisp = (v) => (conv && Number.isFinite(v) ? conv.toDisp(v) : v);
  let base = { min: o.min ?? -Infinity, max: o.max ?? Infinity };
  let range = { min: toDisp(base.min), max: toDisp(base.max) };
  const me = {};
  let invalid = false;
  input.type = 'text';
  input.inputMode = 'decimal';
  input.autocomplete = 'off';
  input.spellcheck = false;
  for (const a of ['min', 'max', 'step']) input.removeAttribute(a);
  const wrap = document.createElement('span');
  wrap.className = 'num-field';
  input.replaceWith(wrap);
  const err = o.errorHost ?? document.createElement('span');
  err.classList.add('num-err');
  if (!err.id) err.id = `num-err-${++seq}`;
  err.setAttribute('aria-live', 'polite');
  wrap.append(input);
  if (!o.errorHost) wrap.append(err);

  const message = (e) => (e === 'nan' ? T.nan : e === 'empty' ? T.empty : e === 'max' ? T.max(formatInput(range.max))
    : o.minExclusive ? T.above(formatInput(range.min)) : T.min(formatInput(range.min)));
  function showError(text) {
    invalid = !!text;
    if (text) {
      const full = o.name ? `${o.name}: ${text}` : text;
      owners.set(err, me);
      err.textContent = full;
      err.title = full;
      input.setAttribute('aria-describedby', err.id);
    } else {
      if (!o.errorHost || owners.get(err) === me) { err.textContent = ''; err.removeAttribute('title'); owners.delete(err); }
      input.removeAttribute('aria-describedby');
    }
    input.setAttribute('aria-invalid', String(invalid));
  }
  /** @returns {{value:number|null, ok:boolean}} */
  function read() {
    const opts = { minExclusive: !!o.minExclusive, allowEmpty: o.allowEmpty !== false };
    const r = conv ? checkConv(input.value, conv, { ...base, ...opts }) : checkNumber(input.value, { ...range, ...opts });
    showError(r.error ? message(r.error) : '');
    return { value: r.value, ok: !r.error };
  }
  input.addEventListener('change', () => { const r = read(); if (r.ok) o.onCommit?.(r.value); });
  input.addEventListener('input', () => { if (invalid) showError(''); });
  showError('');

  return {
    el: wrap,
    input,
    read,
    get invalid() { return invalid; },
    /** Nilai dari store; tidak menimpa kotak yang sedang diketik atau sedang menampilkan galat. @param {number|string|null|undefined} v */
    set(v) {
      if (document.activeElement === input || invalid) return;
      const n = typeof v === 'number' ? v : checkNumber(v).value;
      const s = n == null ? '' : formatInput(toDisp(n));
      if (input.value !== s) input.value = s;
    },
    /** @param {{min?:number, max?:number}} r */
    setRange(r) { base = { min: r.min ?? -Infinity, max: r.max ?? Infinity }; range = { min: toDisp(base.min), max: toDisp(base.max) }; },
  };
}
