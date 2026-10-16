/**
 * formulaToggle.js — panel rumus di atas visual 3D dapat dilipat (bagian A). Setiap `.overlay--formula` di scene
 * mendapat chip "ƒ Formula" di pojok kiri atas viewport 3D; satu pilihan global (store.formulaOpen, disimpan lewat
 * persist.js) berlaku di semua scene. Isi rumus dan angka tidak berubah (tetap dari frame scene). Chip tidak ikut
 * ekspor PNG (data-snap-skip); panel yang terbuka ikut tergambar.
 */
import { STR } from './strings.js';

const F = STR.formula;
let seq = 0;

/**
 * @param {HTMLElement} root kontainer scene (#app)
 * @param {{get:()=>any, set:(p:any)=>void, subscribe:(fn:any)=>()=>void}} store
 * @returns {{dispose:()=>void, count:number}}
 */
export function attachFormulaToggles(root, store) {
  const pairs = [...root.querySelectorAll('.overlay--formula')].map((panel) => {
    if (!panel.id) panel.id = `formula-panel-${++seq}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'f-toggle';
    btn.dataset.snapSkip = '';
    btn.setAttribute('aria-controls', panel.id);
    btn.innerHTML = '<span class="f-toggle__icon" aria-hidden="true"></span><span class="f-toggle__label"></span><span class="f-toggle__caret" aria-hidden="true"></span>';
    btn.querySelector('.f-toggle__icon').textContent = F.icon;
    btn.querySelector('.f-toggle__label').textContent = F.label;
    btn.addEventListener('click', () => store.set({ formulaOpen: !store.get().formulaOpen }));
    panel.parentElement.insertBefore(btn, panel);
    panel.classList.add('overlay--formula-toggled');
    return { panel, btn };
  });
  const apply = (open) => {
    for (const { panel, btn } of pairs) {
      panel.classList.toggle('is-collapsed', !open);
      btn.setAttribute('aria-expanded', String(open));
      btn.classList.toggle('is-open', open);
      btn.dataset.tip = open ? F.hide : F.show;
      btn.querySelector('.f-toggle__caret').textContent = open ? '▾' : '▸';
    }
  };
  apply(!!store.get().formulaOpen);
  const unsub = store.subscribe((s, prev, changed) => { if (changed.includes('formulaOpen')) apply(!!s.formulaOpen); });
  return {
    count: pairs.length,
    dispose() { unsub(); for (const { panel, btn } of pairs) { btn.remove(); panel.classList.remove('overlay--formula-toggled', 'is-collapsed'); } },
  };
}

/**
 * Kotak panel rumus seperti saat terbuka, walau sedang terlipat (diukur sinkron, tanpa repaint). Dipakai untuk
 * membingkai kamera agar bingkai 3D sama di kedua keadaan dan tidak melompat saat chip ditekan.
 * @param {HTMLElement} panel
 * @returns {DOMRect}
 */
export function openPanelRect(panel) {
  const collapsed = panel.classList.contains('is-collapsed'), toggled = panel.classList.contains('overlay--formula-toggled');
  panel.classList.remove('is-collapsed');
  panel.classList.add('overlay--formula-toggled');
  const r = panel.getBoundingClientRect();
  if (collapsed) panel.classList.add('is-collapsed');
  if (!toggled) panel.classList.remove('overlay--formula-toggled');
  return r;
}
