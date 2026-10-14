/**
 * limitsInput.js — input batas emisi yang diisi presenter (ppmvd @ basis aktif). Default kosong.
 * DOM murni: perubahan dikirim lewat callback (store.set(limitsPatch(...))). Dipakai Scene 6 dan M7.
 */
import { STR } from './strings.js';

const T = STR.scene6.limits;

/**
 * @param {HTMLElement} container
 * @param {{onChange:(p:{nox?:string, co?:string})=>void, onClear:()=>void}} cb
 */
export function createLimitsInput(container, cb) {
  const el = document.createElement('div');
  el.className = 'ctl ctl--lim';
  el.innerHTML = `
    <span class="ctl__label">${T.title}</span>
    <div class="lim__row">
      <label class="lim__in"><span>${T.nox}</span><input type="number" min="0" step="0.5" inputmode="decimal" placeholder="${T.placeholder}" data-lim="nox" /></label>
      <label class="lim__in"><span>${T.co}</span><input type="number" min="0" step="1" inputmode="decimal" placeholder="${T.placeholder}" data-lim="co" /></label>
      <button type="button" class="btn btn--sm" data-clear>${T.clear}</button>
    </div>
    <div class="lim__basis" data-v="basis"></div>`;
  el.querySelector('.ctl__label').dataset.tip = T.tip;
  container.appendChild(el);
  const inp = (k) => /** @type {HTMLInputElement} */ (el.querySelector(`[data-lim="${k}"]`));
  for (const k of ['nox', 'co']) {
    inp(k).addEventListener('change', () => cb.onChange({ [k]: inp(k).value }));
    inp(k).addEventListener('keydown', (e) => { if (e.key !== 'Escape') e.stopPropagation(); });
  }
  el.querySelector('[data-clear]').addEventListener('click', () => cb.onClear());
  const basisEl = el.querySelector('[data-v="basis"]');
  return {
    el,
    /** @param {{nox:number|null, co:number|null, basisText:string}} v */
    update(v) {
      for (const k of ['nox', 'co']) {
        if (document.activeElement === inp(k)) continue;
        const s = v[k] == null ? '' : String(v[k]);
        if (inp(k).value !== s) inp(k).value = s;
      }
      if (basisEl.textContent !== v.basisText) basisEl.textContent = v.basisText;
    },
    dispose() { el.remove(); },
  };
}
