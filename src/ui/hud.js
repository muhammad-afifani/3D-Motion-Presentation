import { STR } from './strings.js';

/**
 * hud.js — panel angka. Tiap item: label, nilai (fungsi dari frame), satuan, tooltip rumus.
 * DOM hanya disentuh bila teks berubah.
 */

/**
 * @typedef {{id:string, label:string, unit?:string, tip?:string, model?:string, sub?:string|((f:any)=>string), flag?:string, value:(f:any)=>string}} HudItem
 *   model = label model kecil di bawah angka (mis. fungsi thermo.js sumber angka);
 *   sub = baris kecil di bawah angka (mis. basis emisi; fungsi = dihitung ulang dari frame tiap update); flag = penanda menonjol.
 * @param {HTMLElement} container
 * @param {HudItem[]} items
 * @param {{level?:string, basis?:string|string[], note?:string}} [opts] level = kata level model; basis = kelompok Basis
 *   (tag "Basis · level" membuka kartu Basis lewat penangan klik global ui/basisCard.js)
 */
export function createHud(container, items, { level, basis, note } = {}) {
  const root = document.createElement('div');
  root.className = 'hud';
  const cells = items.map((it) => {
    const c = document.createElement('div');
    c.className = 'hud__item';
    c.tabIndex = 0;
    if (it.tip) c.dataset.tip = it.tip;
    c.innerHTML = `<div class="hud__label">${it.label}</div><div class="hud__value num"><span class="v"></span>${it.unit ? `<span class="u">${it.unit}</span>` : ''}</div>${it.model ? `<div class="hud__model">${it.model}</div>` : ''}${it.sub ? `<div class="hud__sub">${typeof it.sub === 'function' ? '' : it.sub}</div>` : ''}${it.flag ? `<div class="hud__flag">${it.flag}</div>` : ''}`;
    if (it.flag) c.classList.add('is-flag');
    root.appendChild(c);
    return { it, v: c.querySelector('.v'), last: '', sub: typeof it.sub === 'function' ? c.querySelector('.hud__sub') : null, lastSub: '' };
  });
  if (level || note) {
    const n = document.createElement('div');
    n.className = 'hud__note';
    if (level) {
      const tag = document.createElement('span');
      tag.className = 'level';
      tag.textContent = `${STR.basis.tag} · ${level}`;
      if (basis) {
        tag.setAttribute('role', 'button');
        tag.tabIndex = 0;
        tag.dataset.basis = Array.isArray(basis) ? basis.join(',') : basis;
        tag.dataset.tip = STR.basis.tagTip;
      }
      n.appendChild(tag);
    }
    if (note) n.insertAdjacentHTML('beforeend', note);
    root.appendChild(n);
  }
  container.appendChild(root);
  return {
    update(f) {
      for (const c of cells) {
        const s = c.it.value(f);
        if (s !== c.last) { c.v.textContent = s; c.last = s; }
        if (c.sub) { const t = c.it.sub(f); if (t !== c.lastSub) { c.sub.textContent = t; c.lastSub = t; } }
      }
    },
    dispose() { root.remove(); },
  };
}
