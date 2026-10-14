/**
 * contentBanner.js — banner galat konten presenter (JSON ditemukan tetapi rusak / skema salah).
 * Tidak tampil bila tidak ada galat (termasuk saat file tidak bisa di-fetch → isi bawaan tanpa banner).
 */
import { STR } from './strings.js';

const T = STR.content;

/** Teks galat (diekspor untuk tes). @param {{file:string, errors:{field:string, code:string, detail?:string}[]}} r */
export function contentErrorText(r) {
  if (!r?.errors?.length) return '';
  return T.error(r.file, r.errors.map((e) => T.item(e.field, T.codes[e.code] ?? e.code, e.detail)).join('; '));
}

/** @param {HTMLElement} container */
export function createContentBanner(container) {
  const el = document.createElement('div');
  el.className = 'content-error';
  el.setAttribute('role', 'alert');
  el.hidden = true;
  el.innerHTML = `<b>${T.errorTitle}</b><span></span>`;
  container.appendChild(el);
  const span = el.querySelector('span');
  return {
    el,
    show(r) { const t = contentErrorText(r); el.hidden = !t; span.textContent = t; },
    dispose() { el.remove(); },
  };
}
