/**
 * langSwitch.js — sakelar EN | ID di slot bahasa header kanan (M11): [Explore (M)] [EN/ID] [Dark/Light] [Model OK].
 * Hanya tampilan: memanggil onChange; state bahasa (etel:lang) dikelola state/lang.js lewat learnHost. Untuk sementara
 * mengganti teks Landing, About, dan Learn saja. Tidak ikut ekspor PNG.
 */
import { STR } from './strings.js';

const T = STR.lang;

/** @param {{value:'en'|'id', onChange:(l:'en'|'id')=>void}} o */
export function createLangSwitch({ value, onChange }) {
  const el = document.createElement('div');
  el.className = 'theme-switch lang-switch';
  el.setAttribute('role', 'radiogroup');
  el.setAttribute('aria-label', T.label);
  el.dataset.tip = T.tip;
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
  const set = (l) => { for (const b of btns) { const on = b.dataset.lang === l; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', String(on)); } };
  set(value);
  return { el, set };
}
