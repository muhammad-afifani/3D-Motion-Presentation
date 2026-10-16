/**
 * regHeader.js — header Scene 9 (semua tab): pemilih equipment, kelas kapasitas, bahan bakar (store, Step 03),
 * indikator basis regulasi, banner "transcribed" selama verified:false. DOM murni; data dari deriveCompliance.
 */
import { STR } from './strings.js';
import { segmented } from './controls.js';
import { EQUIPMENT_ORDER } from '../state/regulations.js';

const R = STR.regulation;

/** @param {HTMLElement} container @param {{onSelect:(p:{equip?:string, cls?:string, fuel?:string})=>void}} cb */
export function createRegHeader(container, cb) {
  const el = document.createElement('div');
  el.className = 'reg-head';
  el.innerHTML = `<div class="reg__pick"></div><div class="reg-head__info"><span class="reg__basis num" data-v="basis"></span><span class="reg__banner reg__banner--sm" data-v="banner" hidden></span></div>`;
  container.appendChild(el);
  const pick = el.querySelector('.reg__pick');
  const equip = segmented({ label: R.equipment, options: EQUIPMENT_ORDER.map((k) => ({ value: k, label: R.equipments[k] })), value: EQUIPMENT_ORDER[0], onChange: (v) => cb.onSelect({ equip: v }) });
  const fuel = segmented({ label: R.fuel, options: ['oil', 'gas'].map((k) => ({ value: k, label: R.fuels[k] })), value: 'oil', onChange: (v) => cb.onSelect({ fuel: v }) });
  const clsWrap = document.createElement('label');
  clsWrap.className = 'ctl reg__cls';
  clsWrap.innerHTML = `<span class="ctl__label">${R.capacity}</span><select></select>`;
  const clsSel = /** @type {HTMLSelectElement} */ (clsWrap.querySelector('select'));
  clsSel.addEventListener('change', () => cb.onSelect({ cls: clsSel.value }));
  pick.append(equip.el, clsWrap, fuel.el);
  const V = (k) => el.querySelector(`[data-v="${k}"]`);
  const set = (n, t) => { if (n.textContent !== t) n.textContent = t; };
  let clsKey = '';
  return {
    el,
    /** @param {ReturnType<import('../state/deriveCompliance.js').deriveCompliance>} f */
    update(f) {
      equip.set(f.sel.equip);
      fuel.set(f.sel.fuel);
      for (const b of fuel.el.querySelectorAll('.seg__btn')) b.disabled = f.sel.fuels.length < 2;
      const ck = f.sel.classes.map((c) => c.id).join('|');
      if (ck !== clsKey) { clsKey = ck; clsSel.innerHTML = f.sel.classes.map((c) => `<option value="${c.id}">${c.label}</option>`).join(''); }
      if (clsSel.value !== f.sel.cls) clsSel.value = f.sel.cls ?? '';
      clsSel.disabled = f.sel.classes.length < 2;
      set(V('basis'), f.basis ? `${R.basis(f.basis.refO2Pct, f.basis.TrefC, f.basis.NOxAs)} · ${R.basisChips}` : '');
      const b = V('banner');
      b.hidden = f.verified;
      if (!f.verified) set(b, `⚠ ${R.banner}`);
    },
    dispose() { el.remove(); },
  };
}
