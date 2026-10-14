/**
 * calibrationPanel.js — panel Calibration Scene 4 (DOM murni). Tidak menghitung apa pun:
 * tombol Apply/Reset memanggil callback (aksi di state/calibration.js), nilai tampil dari `view`.
 */
import { STR } from './strings.js';
import { fmt } from './format.js';

const T = STR.scene4.calib;

/**
 * @param {HTMLElement} container
 * @param {{onApplyEngine:(kind:string, target:number)=>void, onApplyDln:(target:number)=>void, onReset:()=>void, onClose:()=>void}} cb
 */
export function createCalibrationPanel(container, cb) {
  const el = document.createElement('div');
  el.className = 'cal-panel';
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', T.title);
  const engineRow = (k) => `
    <div class="cal-row" data-engine="${k}">
      <div class="cal-row__head"><b>${T.engines[k]}</b><span class="cal-factor num" data-v="f-${k}"></span></div>
      <div class="cal-row__dim" data-v="d-${k}"></div>
      <label class="cal-input"><span>${T.targetEngine}</span>
        <input type="number" min="0.01" step="0.1" inputmode="decimal" data-in="${k}" /></label>
      <div class="cal-row__dim" data-v="lit-${k}"></div>
      <div class="cal-actions"><button type="button" class="btn btn--sm" data-apply="${k}">${T.apply}</button><span class="cal-status" data-v="s-${k}"></span></div>
    </div>`;
  el.innerHTML = `
    <div class="cal-panel__head"><b>${T.title}</b><button type="button" class="btn btn--sm" data-close>${T.close} <kbd>${T.key}</kbd></button></div>
    <p class="cal-note">${T.note}</p>
    <h4>${T.engineTitle}</h4>
    ${engineRow('diesel')}
    ${engineRow('gas')}
    <h4>${T.dlnTitle}</h4>
    <div class="cal-row">
      <div class="cal-row__head"><b>${T.dlnShort}</b><span class="cal-factor num" data-v="f-dln"></span></div>
      <div class="cal-row__dim" data-v="d-dln"></div>
      <label class="cal-input"><span>${T.targetDln}</span>
        <input type="number" min="0.1" step="0.5" inputmode="decimal" data-in="dln" /></label>
      <div class="cal-row__dim cal-basis" data-v="basis"></div>
      <div class="cal-actions"><button type="button" class="btn btn--sm" data-apply="dln">${T.apply}</button><span class="cal-status" data-v="s-dln"></span></div>
      <div class="cal-row__dim">${T.usedBy}</div>
    </div>
    <div class="cal-actions cal-actions--end"><button type="button" class="btn btn--sm" data-reset>${T.reset}</button></div>`;
  container.appendChild(el);

  const q = (sel) => el.querySelector(sel);
  const V = (k) => q(`[data-v="${k}"]`);
  const input = (k) => /** @type {HTMLInputElement} */ (q(`[data-in="${k}"]`));
  const setText = (n, t) => { if (n.textContent !== t) n.textContent = t; };
  let prefilled = false;

  function readTarget(k) {
    const v = Number(String(input(k).value).replace(',', '.'));
    if (!(v > 0)) { setText(V(`s-${k}`), T.invalid); return null; }
    return v;
  }
  for (const k of ['diesel', 'gas']) q(`[data-apply="${k}"]`).addEventListener('click', () => { const v = readTarget(k); if (v != null) cb.onApplyEngine(k, v); });
  q('[data-apply="dln"]').addEventListener('click', () => { const v = readTarget('dln'); if (v != null) cb.onApplyDln(v); });
  q('[data-reset]').addEventListener('click', () => cb.onReset());
  q('[data-close]').addEventListener('click', () => cb.onClose());
  // panah/angka di input tidak boleh memicu pintasan scene
  el.addEventListener('keydown', (e) => { if (e.target instanceof HTMLInputElement) e.stopPropagation(); });

  return {
    el,
    get open() { return !el.hidden; },
    setOpen(on) { el.hidden = !on; },
    /**
     * @param {{calEngine:{diesel:number,gas:number}, calDln:number, defaults:{engine:{diesel:number,gas:number}, dln:number},
     *   literature:{engine:{diesel:number,gas:number}, dlnPpm:number, dlnRefO2:number}, basisText:string}} v
     */
    update(v) {
      for (const k of ['diesel', 'gas']) {
        setText(V(`f-${k}`), `${T.factor} ×${fmt(v.calEngine[k], 3)}`);
        setText(V(`d-${k}`), T.defaultEngine(v.defaults.engine[k]));
        setText(V(`lit-${k}`), T.litEngine(v.literature.engine[k]));
      }
      setText(V('f-dln'), `${T.factor} ×${fmt(v.calDln, 2)}`);
      setText(V('d-dln'), T.defaultDln(v.defaults.dln, v.literature.dlnPpm, v.literature.dlnRefO2));
      setText(V('basis'), v.basisText);
      if (!prefilled) {
        prefilled = true;
        input('diesel').value = String(v.literature.engine.diesel);
        input('gas').value = String(v.literature.engine.gas);
        input('dln').value = String(v.literature.dlnPpm);
      }
    },
    setStatus(k, text) { setText(V(`s-${k}`), text); },
    dispose() { el.remove(); },
  };
}
