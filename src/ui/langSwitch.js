/**
 * langSwitch.js — sakelar EN | ID di slot bahasa header kanan (M11): [Explore (M)] [EN/ID] [Dark/Light] [Model OK].
 * Hanya tampilan: memanggil onChange; state bahasa global ada di state/langStore.js (kunci etel:lang). Label dan
 * tooltip dua bahasa lewat tr(); set(lang) menyegarkannya. Tidak ikut ekspor PNG.
 */
import { STR } from './strings.js';
import { tr } from '../state/lang.js';

const T = STR.lang;

/** @param {{value:'en'|'id', onChange:(l:'en'|'id')=>void}} o */
export function createLangSwitch({ value, onChange }) {
  const el = document.createElement('div');
  el.className = 'theme-switch lang-switch';
  el.setAttribute('role', 'radiogroup');
  el.dataset.snapSkip = '';
  const btns = /** @type {const} */ (['en', 'id']).map((l) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'theme-switch__btn';
    b.setAttribute('role', 'radio');
    b.lang = l;
    b.dataset.lang = l;
    b.textContent = T[l];
    b.addEventListener('click', () => onChange(l));
    el.appendChild(b);
    return b;
  });
  const set = (l) => {
    for (const b of btns) { const on = b.dataset.lang === l; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', String(on)); }
    el.setAttribute('aria-label', tr(T.label, l));
    el.dataset.tip = tr(T.tip, l);
  };
  set(value);
  return { el, set };
}
