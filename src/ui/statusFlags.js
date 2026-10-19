/**
 * statusFlags.js — pill kecil di bilah atas:
 *   - "Custom calibration (session only)" bila faktor kalibrasi ≠ default (faktor tidak disimpan, persist.js);
 *   - "Quality reduced (Auto)" bila Quality Auto sedang menurunkan kualitas visual (klik → pengaturan Display).
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
  return { el, relabel() { el.textContent = STR.app.calibFlag; el.dataset.tip = STR.app.calibFlagTip; }, dispose() { unsub(); el.remove(); } };
}

/**
 * @param {HTMLElement} parent
 * @param {{get:()=>any, subscribe:(fn:any)=>()=>void}} store
 * @param {() => void} onClick buka pengaturan Display (panel H)
 */
export function createQualityFlag(parent, store, onClick) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'pill pill--flag quality-flag';
  el.textContent = STR.app.qualityFlag;
  el.dataset.tip = STR.app.qualityFlagTip;
  el.addEventListener('click', onClick);
  parent.prepend(el);
  const render = (s) => { el.hidden = !(s.quality === 'auto' && s.qTier > 0); };
  render(store.get());
  const unsub = store.subscribe((s, prev, changed) => { if (changed.includes('quality') || changed.includes('qTier')) render(s); });
  return { el, relabel() { el.textContent = STR.app.qualityFlag; el.dataset.tip = STR.app.qualityFlagTip; }, dispose() { unsub(); el.remove(); } };
}
