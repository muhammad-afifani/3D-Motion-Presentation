/**
 * calibrationPanel.js — panel Calibration Scene 4 & 6 (DOM murni). Tidak menghitung apa pun:
 * tombol Apply/Reset memanggil callback (aksi di state/calibration.js), nilai tampil dari `view`.
 *
 * Dock (M8a): panel tidak menimpa tampilan 3D. Isi lama `container` dibungkus `.dock-main` (overlay & label 3D
 * ikut, tetap sejajar dengan canvas) dan panel menjadi kolom di sampingnya; tombol Collapse melipatnya jadi strip.
 */
import { STR } from './strings.js';
import { fmt } from './format.js';

const T = STR.scene4.calib;

/**
 * @param {HTMLElement} container
 * @param {{onApplyEngine:(kind:string, target:number)=>void, onApplyDln:(cfg:'single'|'twin', target:number)=>void, onReset:()=>void, onClose:()=>void}} cb
 */
export function createCalibrationPanel(container, cb) {
  const main = document.createElement('div');
  main.className = 'dock-main';
  main.append(...container.childNodes);
  container.classList.add('has-dock');
  container.appendChild(main);
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
  const dlnRow = (k) => `
    <div class="cal-row">
      <div class="cal-row__head"><b>${T.dlnRows[k]}</b><span class="cal-factor num" data-v="f-dln-${k}"></span></div>
      <div class="cal-row__dim" data-v="d-dln-${k}"></div>
      <label class="cal-input"><span>${T.targetDln}</span>
        <input type="number" min="0.1" step="0.5" inputmode="decimal" data-in="dln-${k}" /></label>
      <div class="cal-actions"><button type="button" class="btn btn--sm" data-apply="dln-${k}">${T.apply}</button><span class="cal-status" data-v="s-dln-${k}"></span></div>
    </div>`;
  el.innerHTML = `
    <button type="button" class="cal-panel__tab" data-expand data-tip="${T.collapseTip}">${T.expand} »</button>
    <div class="cal-panel__body">
    <div class="cal-panel__head"><b>${T.title}</b><span class="cal-actions"><button type="button" class="btn btn--sm" data-collapse data-tip="${T.collapseTip}">« ${T.collapse}</button><button type="button" class="btn btn--sm" data-close>${T.close} <kbd>${T.key}</kbd></button></span></div>
    <p class="cal-note">${T.note}</p>
    <h4>${T.engineTitle}</h4>
    ${engineRow('diesel')}
    ${engineRow('gas')}
    <h4>${T.dlnTitle}</h4>
    ${dlnRow('single')}
    ${dlnRow('twin')}
    <div class="cal-row__dim cal-basis" data-v="basis"></div>
    <div class="cal-row__dim">${T.usedBy}</div>
    <div class="cal-actions cal-actions--end"><button type="button" class="btn btn--sm" data-reset>${T.reset}</button></div>
    </div>`;
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
  for (const k of ['single', 'twin']) q(`[data-apply="dln-${k}"]`).addEventListener('click', () => { const v = readTarget(`dln-${k}`); if (v != null) cb.onApplyDln(k, v); });
  q('[data-reset]').addEventListener('click', () => cb.onReset());
  q('[data-close]').addEventListener('click', () => cb.onClose());
  const setCollapsed = (on) => { el.classList.toggle('is-collapsed', !!on); };
  q('[data-collapse]').addEventListener('click', () => setCollapsed(true));
  q('[data-expand]').addEventListener('click', () => setCollapsed(false));
  // panah/angka di input tidak boleh memicu pintasan scene
  el.addEventListener('keydown', (e) => { if (e.target instanceof HTMLInputElement) e.stopPropagation(); });

  return {
    el,
    main,
    get open() { return !el.hidden; },
    get collapsed() { return el.classList.contains('is-collapsed'); },
    /** Buka (selalu dalam keadaan terbentang) / tutup. */
    setOpen(on) { el.hidden = !on; if (on) setCollapsed(false); },
    setCollapsed,
    /**
     * @param {{calEngine:{diesel:number,gas:number}, calDln:{single:number,twin:number}, defaults:{engine:{diesel:number,gas:number}, dln:{single:number,twin:number}},
     *   literature:{engine:{diesel:number,gas:number}, dlnPpm:number, dlnRefO2:number}, basisText:string}} v
     */
    update(v) {
      for (const k of ['diesel', 'gas']) {
        setText(V(`f-${k}`), `${T.factor} ×${fmt(v.calEngine[k], 3)}`);
        setText(V(`d-${k}`), T.defaultEngine(v.defaults.engine[k]));
        setText(V(`lit-${k}`), T.litEngine(v.literature.engine[k]));
      }
      for (const k of ['single', 'twin']) {
        setText(V(`f-dln-${k}`), `${T.factor} ×${fmt(v.calDln[k], 2)}`);
        setText(V(`d-dln-${k}`), T.defaultDln(v.defaults.dln[k], v.literature.dlnPpm, v.literature.dlnRefO2));
      }
      setText(V('basis'), v.basisText);
      if (!prefilled) {
        prefilled = true;
        input('diesel').value = String(v.literature.engine.diesel);
        input('gas').value = String(v.literature.engine.gas);
        input('dln-single').value = String(v.literature.dlnPpm);
        input('dln-twin').value = String(v.literature.dlnPpm);
      }
    },
    setStatus(k, text) { setText(V(`s-${k}`), text); },
    dispose() { el.remove(); container.classList.remove('has-dock'); container.prepend(...main.childNodes); main.remove(); },
  };
}
