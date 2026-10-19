/**
 * themeSwitch.js — sakelar Dark / Light di header kanan (bagian B), di antara slot EN/ID dan lencana Model OK.
 * Hanya tampilan: memanggil onChange; main.js memasang tema, menyimpannya (etel:theme), dan menggambar ulang grafik.
 * Tidak ikut ekspor PNG (data-snap-skip).
 */
import { STR } from './strings.js';

const T = STR.theme;

/**
 * @param {{value:'dark'|'light', onChange:(t:'dark'|'light')=>void}} o
 * @returns {{el:HTMLElement, set:(t:'dark'|'light')=>void, relabel:()=>void}}
 */
export function createThemeSwitch({ value, onChange }) {
  const el = document.createElement('div');
  el.className = 'theme-switch';
  el.setAttribute('role', 'radiogroup');
  el.dataset.snapSkip = '';
  const btns = /** @type {const} */ (['dark', 'light']).map((t) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'theme-switch__btn';
    b.setAttribute('role', 'radio');
    b.dataset.theme = t;
    b.addEventListener('click', () => onChange(t));
    el.appendChild(b);
    return b;
  });
  const set = (t) => { for (const b of btns) { const on = b.dataset.theme === t; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', String(on)); } };
  /** Teks dari STR.theme (dua bahasa); dipanggil lagi saat bahasa berubah. */
  const relabel = () => { el.setAttribute('aria-label', T.label); el.dataset.tip = T.tip; for (const b of btns) b.textContent = T[b.dataset.theme]; };
  relabel();
  set(value);
  return { el, set, relabel };
}
