/**
 * hud.js — panel angka. Tiap item: label, nilai (fungsi dari frame), satuan, tooltip rumus.
 * DOM hanya disentuh bila teks berubah.
 */

/**
 * @typedef {{id:string, label:string, unit?:string, tip?:string, value:(f:any)=>string}} HudItem
 * @param {HTMLElement} container
 * @param {HudItem[]} items
 * @param {{level?:string, note?:string}} [opts]
 */
export function createHud(container, items, { level, note } = {}) {
  const root = document.createElement('div');
  root.className = 'hud';
  const cells = items.map((it) => {
    const c = document.createElement('div');
    c.className = 'hud__item';
    c.tabIndex = 0;
    if (it.tip) c.dataset.tip = it.tip;
    c.innerHTML = `<div class="hud__label">${it.label}</div><div class="hud__value num"><span class="v"></span>${it.unit ? `<span class="u">${it.unit}</span>` : ''}</div>`;
    root.appendChild(c);
    return { it, v: c.querySelector('.v'), last: '' };
  });
  if (level || note) {
    const n = document.createElement('div');
    n.className = 'hud__note';
    n.innerHTML = `${level ? `<span class="level">${level}</span>` : ''}${note ?? ''}`;
    root.appendChild(n);
  }
  container.appendChild(root);
  return {
    update(f) {
      for (const c of cells) {
        const s = c.it.value(f);
        if (s !== c.last) { c.v.textContent = s; c.last = s; }
      }
    },
    dispose() { root.remove(); },
  };
}
