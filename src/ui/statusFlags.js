/**
 * statusFlags.js — pill kecil di bilah atas: "Custom calibration (session only)" bila faktor kalibrasi ≠ default.
 * Faktor kalibrasi tidak disimpan (persist.js); pill ini mengingatkan bahwa nilai custom hanya berlaku selama sesi.
 */
import { STR } from './strings.js';
import { isDefaultCalib } from '../state/store.js';

/**
 * @param {HTMLElement} parent
 * @param {{get:()=>any, subscribe:(fn:any)=>()=>void}} store
 */
export function createCalibFlag(parent, store) {
  const el = document.createElement('span');
  el.className = 'pill pill--flag calib-flag';
  el.textContent = STR.app.calibFlag;
  el.dataset.tip = STR.app.calibFlagTip;
  parent.prepend(el);
  const render = (s) => { el.hidden = isDefaultCalib(s); };
  render(store.get());
  const unsub = store.subscribe((s, prev, changed) => { if (changed.includes('calEngine') || changed.includes('calDln')) render(s); });
  return { el, dispose() { unsub(); el.remove(); } };
}
