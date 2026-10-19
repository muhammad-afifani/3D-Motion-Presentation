/**
 * limitsInput.js — input batas emisi yang diisi presenter (ppmvd @ basis aktif). Default kosong.
 * DOM murni: perubahan dikirim lewat callback (store.set(limitsPatch(...))). Dipakai Scene 6 dan M7.
 */
import { STR } from './strings.js';
import { createHelpButton } from './helpButton.js';
import { createNumberField } from './numberInput.js';

const T = STR.scene6.limits;

/**
 * @param {HTMLElement} container
 * @param {{onChange:(p:{nox?:number|'', co?:number|''})=>void, onClear:()=>void}} cb  nilai sudah dibaca (koma / titik); '' = kosong
 */
export function createLimitsInput(container, cb) {
  const el = document.createElement('div');
  el.className = 'ctl ctl--lim';
  el.innerHTML = `
    <span class="ctl__label">${T.title}</span>
    <div class="lim__row">
      <label class="lim__in"><span data-lbl="nox">${T.nox}</span><input placeholder="${T.placeholder}" data-lim="nox" /></label>
      <label class="lim__in"><span data-lbl="co">${T.co}</span><input placeholder="${T.placeholderCo}" data-lim="co" /></label>
      <button type="button" class="btn btn--sm" data-clear>${T.clear}</button>
    </div>
    <div class="lim__basis" data-v="basis"></div>
    <div class="num-err" data-v="err"></div>`;
  el.querySelector('.ctl__label').dataset.tip = T.tip;
  { // ⓘ di baris label (pembungkus agar tidak menambah baris grid)
    const lab = el.querySelector('.ctl__label'), head = document.createElement('div');
    head.className = 'ctl__head';
    lab.replaceWith(head);
    head.append(lab, createHelpButton('ui.limitOverride', { describes: el }).el);
  }
  container.appendChild(el);
  // koma / titik desimal; kosong = tanpa limit; batas bawah 0 (≤ 0 dibaca kosong oleh limitsPatch)
  const fields = Object.fromEntries(['nox', 'co'].map((k) => {
    const input = /** @type {HTMLInputElement} */ (el.querySelector(`[data-lim="${k}"]`));
    input.addEventListener('keydown', (e) => { if (e.key !== 'Escape') e.stopPropagation(); });
    // galat tampil di slot bersama di bawah baris basis (tinggi dicadangkan; tidak menutupi label)
    return [k, createNumberField(input, { min: 0, errorHost: /** @type {HTMLElement} */ (el.querySelector('[data-v="err"]')), name: k === 'nox' ? 'NOx' : 'CO', onCommit: (v) => cb.onChange({ [k]: v ?? '' }) })];
  }));
  el.querySelector('[data-clear]').addEventListener('click', () => cb.onClear());
  const basisEl = el.querySelector('[data-v="basis"]');
  return {
    el,
    /** @param {{nox:number|null, co:number|null, basisText:string, labels?:{nox:string, co:string}}} v */
    update(v) {
      if (v.labels) for (const k of ['nox', 'co']) { const l = el.querySelector(`[data-lbl="${k}"]`); if (l.textContent !== v.labels[k]) l.textContent = v.labels[k]; }
      for (const k of ['nox', 'co']) fields[k].set(v[k] == null ? null : Math.round(v[k] * 100) / 100);
      if (basisEl.textContent !== v.basisText) basisEl.textContent = v.basisText;
    },
    dispose() { el.remove(); },
  };
}
