/**
 * controls.js — kontrol DOM murni (slider, segmented, tombol). Kontrol hanya memanggil
 * callback (yang melakukan store.set); nilai tampilan disinkronkan lewat set().
 */
import { fmt, qtyConv } from './format.js';
import { STR, unitSym } from './strings.js';
import { createHelpButton } from './helpButton.js';

let uid = 0;

/**
 * @param {{label:string, unit?:string, min:number, max:number, step:number, value:number,
 *   digits?:number, tip?:string, help?:string, format?:(v:number)=>string, onInput:(v:number)=>void,
 *   qty?:string, from?:string, native?:string, kAsC?:boolean}} o
 *   help = id kartu bantuan ⓘ (content/help.json): tombol di samping label
 *   qty + from (satuan tampilan, M13): min / max / step / value / onInput TETAP dalam satuan `from` (id satuan UNIT_DEFS, mis.
 *   'bar', 'K', 'C', 'kgs'); kontrol menampilkan dan menggeser dalam satuan pilihan pengguna, dengan langkah bulat, dan nilai
 *   yang dikirim ke onInput selalu dijepit ke [min, max] SI. Simbol satuan dari pilihan (o.unit diabaikan). Tanpa qty: seperti dulu.
 */
export function slider(o) {
  const id = `ctl-${++uid}`;
  const el = document.createElement('div');
  el.className = 'ctl ctl--slider';
  el.innerHTML = `
    <label for="${id}" class="ctl__label">${o.label}</label>
    <output class="ctl__value num" for="${id}"></output>
    <input id="${id}" type="range" />`;
  const labelEl = el.querySelector('label');
  if (o.tip) labelEl.dataset.tip = o.tip;
  if (o.help) { labelEl.after(createHelpButton(o.help, { describes: el }).el); el.classList.add('has-help'); }
  labelEl.dataset.locked = STR.common.locked; // ditampilkan CSS saat slider terkunci
  const input = el.querySelector('input');
  const out = el.querySelector('output');
  const conv = o.qty ? qtyConv(/** @type {any} */ (o.qty), o.from, { native: o.native ?? null, kAsC: !!o.kAsC }) : null;
  const sym = conv ? unitSym(/** @type {any} */ (o.qty), o.native ?? o.from, !!o.kAsC) : o.unit;
  const show = (v) => {
    if (o.format) { out.textContent = o.format(v); return; }
    out.textContent = `${fmt(conv ? conv.toDisp(v) : v, conv ? conv.digits(o.digits ?? 1) : (o.digits ?? 1))}${sym ? ` ${sym}` : ''}`;
  };
  let lim = { min: o.min, max: o.max };
  function setRange(r) {
    lim = { min: r.min, max: r.max };
    const d = conv ? conv.range(r) : r;
    input.min = String(d.min); input.max = String(d.max); input.step = String(d.step);
  }
  setRange(o);
  input.value = String(conv ? conv.toDisp(o.value) : o.value);
  show(o.value);
  input.addEventListener('input', () => {
    const v = conv && !conv.same ? conv.clamp(conv.fromDisp(Number(input.value)), lim.min, lim.max) : Number(input.value);
    show(v);
    o.onInput(v);
  });
  // panah kiri/kanan dipakai navigasi scene; hentikan agar tidak bentrok saat slider fokus
  input.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.stopPropagation(); });
  return {
    el,
    input,
    /** Sinkron dari store tanpa memicu onInput. */
    set(v) { const d = conv ? conv.toDisp(v) : v; if (Number(input.value) !== d) input.value = String(d); show(v); },
    setRange,
    /** Kunci/lepas slider (mis. θ saat beku). */
    setLocked(on) { input.disabled = !!on; el.classList.toggle('is-locked', !!on); },
  };
}

/**
 * @param {{label:string, tip?:string, help?:string, options:{value:string, label:string, key?:string}[], value:string, onChange:(v:string)=>void}} o
 */
export function segmented(o) {
  const el = document.createElement('div');
  el.className = 'ctl ctl--seg';
  el.setAttribute('role', 'radiogroup');
  el.setAttribute('aria-label', o.label);
  el.innerHTML = `<span class="ctl__label">${o.label}</span><div class="seg"></div>`;
  if (o.tip) el.querySelector('.ctl__label').dataset.tip = o.tip;
  if (o.help) {
    const lab = el.querySelector('.ctl__label'), head = document.createElement('div');
    head.className = 'ctl__head';
    lab.replaceWith(head);
    head.append(lab, createHelpButton(o.help, { describes: el }).el);
  }
  const wrap = el.querySelector('.seg');
  const btns = o.options.map((op) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'seg__btn';
    b.setAttribute('role', 'radio');
    b.innerHTML = `${op.label}${op.key ? ` <kbd>${op.key}</kbd>` : ''}`;
    b.addEventListener('click', () => o.onChange(op.value));
    wrap.appendChild(b);
    return [op.value, b];
  });
  function set(v) { for (const [val, b] of btns) { b.classList.toggle('is-on', val === v); b.setAttribute('aria-checked', String(val === v)); } }
  set(o.value);
  return { el, set };
}

/** @param {{label:string, key?:string, tip?:string, help?:string, onClick:()=>void}} o help = id kartu bantuan ⓘ (di pojok kanan atas tombol; el = pembungkus) */
export function button(o) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn';
  if (o.tip) b.dataset.tip = o.tip;
  const setLabel = (label) => { b.innerHTML = `${label}${o.key ? ` <kbd>${o.key}</kbd>` : ''}`; };
  setLabel(o.label);
  b.addEventListener('click', o.onClick);
  let el = b;
  if (o.help) {
    el = document.createElement('span');
    el.className = 'btn-wrap';
    el.append(b, createHelpButton(o.help, { describes: b }).el);
  }
  return {
    el, setLabel,
    setTip(t) { if (t) b.dataset.tip = t; else delete b.dataset.tip; },
    setOn(on) { b.classList.toggle('is-on', !!on); b.setAttribute('aria-pressed', String(!!on)); },
    setDisabled(on) { b.disabled = !!on; },
  };
}
