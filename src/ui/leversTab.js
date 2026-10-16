/**
 * leversTab.js — kartu kiri tab Levers Scene 9: sub-tab "Engine levers" (lima slider + sumbu sapuan + EGR nonaktif +
 * catatan beban) dan "Fuel" (slider komposisi gas, H₂S, sulfur solar + sifat dari frame). DOM murni: slider memanggil
 * callback (store.set); semua angka hasil (sifat bahan bakar, O₂ buang) datang dari frame derive.
 */
import { STR, signedDeg } from './strings.js';
import { fmt } from './format.js';
import { slider, segmented } from './controls.js';
import { LEVER_AXES, FUEL_SLIDERS } from '../model/presets.js';

const L = STR.scene9.leversTab, F = STR.scene9.fuelPanel;

/** Format nilai slider (konversi satuan tampilan saja: Pa → bar), dari strings.js. */
const FORMAT = { ...L.value, theta0: (v) => signedDeg(v) };

/**
 * @param {HTMLElement} container
 * @param {{onSub:(v:string)=>void, onAxis:(a:string)=>void, onLever:(axis:string, v:number)=>void,
 *   onGas:(key:string, v:number)=>void, onH2S:(v:number)=>void, onSulfur:(v:number)=>void}} cb
 */
export function createLeversTab(container, cb) {
  const el = document.createElement('div');
  el.className = 'lev-tab';
  container.appendChild(el);
  const sub = segmented({ label: '', options: ['engine', 'fuel'].map((k) => ({ value: k, label: L.sub[k] })), value: 'engine', onChange: (v) => cb.onSub(v) });
  sub.el.classList.add('lev-sub');
  el.append(sub.el);

  // ── Engine levers ──
  const eng = document.createElement('div');
  eng.className = 'lev-pane lev-pane--engine';
  const head = document.createElement('div');
  head.className = 'lev-head';
  head.innerHTML = '<span class="lev-engine" data-v="engine"></span><span class="reg__note" data-v="turbine" hidden></span>';
  const axis = segmented({ label: L.axis, options: LEVER_AXES.map((a) => ({ value: a, label: L.axes[a] })), value: 'theta0', onChange: (v) => cb.onAxis(v) });
  const sliders = {};
  const grid = document.createElement('div');
  grid.className = 'lev-sliders';
  let kindShown = null;
  for (const a of LEVER_AXES) {
    sliders[a] = slider({ label: L.labels[a].diesel ?? L.labels[a], min: 0, max: 1, step: 1, value: 0, format: FORMAT[a], onInput: (v) => cb.onLever(a, v) });
    sliders[a].el.dataset.axis = a;
    grid.append(sliders[a].el);
  }
  const egr = document.createElement('div');
  egr.className = 'ctl lev-egr is-locked';
  egr.innerHTML = `<span class="ctl__label">${L.egr}</span><span class="reg__note">${L.egrNA}</span><input type="range" disabled aria-label="${L.egr}" />`;
  grid.append(egr);
  const notes = document.createElement('div');
  notes.className = 'lev-notes';
  notes.innerHTML = `<p class="reg__note">${L.load}</p><p class="reg__note lev-strong">${L.loadSweep}</p>`;
  eng.append(head, axis.el, grid, notes);

  // ── Fuel ──
  const fuel = document.createElement('div');
  fuel.className = 'lev-pane lev-pane--fuel';
  fuel.innerHTML = `<p class="reg__note lev-strong">${F.noEffect}</p><h4 class="lev-h">${F.gasTitle}</h4><div class="lev-sliders lev-sliders--fuel" data-v="gas"></div>
    <p class="reg__note num" data-v="sum"></p><p class="reg__note num" data-v="props"></p><p class="reg__note" data-v="invalid" hidden></p>
    <h4 class="lev-h">${F.oilTitle}</h4><div class="lev-sliders lev-sliders--fuel" data-v="oil"></div><p class="reg__note num" data-v="oilProps"></p>`;
  const gasBox = fuel.querySelector('[data-v="gas"]'), oilBox = fuel.querySelector('[data-v="oil"]');
  const gasSl = {};
  for (const k of FUEL_SLIDERS.species) {
    gasSl[k] = slider({ label: F.species[k], ...FUEL_SLIDERS.pct, value: 0, digits: 1, unit: '%', onInput: (v) => cb.onGas(k, v) });
    gasBox.append(gasSl[k].el);
  }
  const h2s = slider({ label: F.h2s, ...FUEL_SLIDERS.h2s, value: 0, digits: 0, onInput: (v) => cb.onH2S(v) });
  gasBox.append(h2s.el);
  const sulfur = slider({ label: F.sulfur, ...FUEL_SLIDERS.sulfur, value: 0, digits: 2, onInput: (v) => cb.onSulfur(v) });
  oilBox.append(sulfur.el);
  el.append(eng, fuel);

  const V = (k) => el.querySelector(`[data-v="${k}"]`);
  const set = (n, t) => { if (n.textContent !== t) n.textContent = t; };
  return {
    el,
    /**
     * @param {any} lev frame deriveLevers @param {any} fu frame deriveFuel @param {any} s state (p9Sub, fuelGas, fuelH2S, fuelS)
     */
    update(lev, fu, s) {
      const subV = s.p9Sub === 'fuel' ? 'fuel' : 'engine';
      sub.set(subV);
      eng.hidden = subV !== 'engine'; fuel.hidden = subV !== 'fuel';
      set(V('engine'), L.engine(L.engines[lev.kind]));
      const t = V('turbine'); t.hidden = !lev.turbineHeader; if (lev.turbineHeader) set(t, L.turbineNote);
      axis.set(lev.axis);
      if (kindShown !== lev.kind) {
        kindShown = lev.kind;
        for (const a of LEVER_AXES) {
          const g = lev.grid[a];
          sliders[a].setRange(g);
          sliders[a].el.querySelector('.ctl__label').textContent = a === 'theta0' ? L.labels.theta0[lev.kind] : L.labels[a];
        }
      }
      for (const a of LEVER_AXES) {
        sliders[a].set(lev.levers[a]);
        sliders[a].el.classList.toggle('is-axis', a === lev.axis);
      }
      // fuel
      const comp = s.fuelGas ?? {};
      for (const k of FUEL_SLIDERS.species) gasSl[k].set(comp[k] ?? 0);
      h2s.set(s.fuelH2S ?? 0);
      sulfur.set(s.fuelS ?? 0);
      set(V('sum'), F.sum(fu.compSum));
      set(V('props'), F.props(fu.gas.MW, fu.gas.LHV_MJ_per_kg, fu.gas.AFR_stoich_mass, fu.gas.CO2_kg_per_GJ_LHV, fu.exhaustO2.gas));
      set(V('oilProps'), F.oilProps(fu.exhaustO2.diesel));
      const inv = V('invalid'); inv.hidden = !fu.compInvalid; if (fu.compInvalid) set(inv, F.invalid);
    },
    dispose() { el.remove(); },
  };
}
