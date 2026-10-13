/**
 * presets.js — preset unit + rentang slider.
 *
 * Nilai parameter engine diambil langsung dari ENGINE_PRESETS di thermo.js (tidak disalin),
 * supaya hanya ada satu sumber angka. File ini hanya menambah label dan rentang kontrol.
 */
import { ENGINE_PRESETS } from './thermo.js';

/**
 * @typedef {{min:number, max:number, step:number}} Range
 * @typedef {{label:string, cycle:string, params:object, ranges:Record<string, Range>}} EnginePreset
 */

/** @type {Record<'diesel'|'gas', EnginePreset>} */
export const ENGINES = {
  diesel: {
    label: 'Diesel',
    cycle: 'Diesel / Dual (penyalaan kompresi)',
    params: ENGINE_PRESETS.diesel,
    ranges: {
      r: { min: 12, max: 22, step: 0.5 },
      phi: { min: 0.3, max: 0.8, step: 0.01 },
      theta0: { min: -16, max: 6, step: 0.5 },
    },
  },
  gas: {
    label: 'Gas engine',
    cycle: 'Otto (busi, lean-burn)',
    params: ENGINE_PRESETS.gas,
    ranges: {
      r: { min: 8, max: 14, step: 0.5 },
      phi: { min: 0.5, max: 0.75, step: 0.01 },
      theta0: { min: -30, max: -4, step: 0.5 },
    },
  },
};

/** Rentang rpm visual (slow-motion). N mesin sebenarnya tetap dari preset. */
export const RPM_VISUAL = { min: 2, max: 120, step: 1, default: 20 };

/**
 * Preset turbin: objek kosong = pakai default fungsi thermo.js
 * (braytonReal / twinShaft). Dipakai mulai M5.
 */
export const TURBINE_PRESETS = {
  gtGen: { label: 'Turbin generator (single-shaft)', design: {} },
  gtComp: { label: 'Turbin kompresor (twin-shaft)', design: {} },
};

/**
 * Scene 2 — siklus. Default = input golden test (bagian 12) agar angka acuan terbaca di layar.
 * `engine` = mesin nyata pembanding di mode Real (cylinderSim); Brayton real = braytonReal.
 * Rentang r mode Ideal lebih lebar dari mesin nyata (mis. Otto r=18 untuk perbandingan teori).
 */
export const CYCLES = {
  otto: { label: 'Otto', engine: 'gas', defaults: { r: 10 }, ranges: { r: { min: 6, max: 22, step: 0.5 } } },
  diesel: { label: 'Diesel', engine: 'diesel', defaults: { r: 18, rc: 2 }, ranges: { r: { min: 12, max: 24, step: 0.5 }, rc: { min: 1.2, max: 3.5, step: 0.05 } } },
  dual: { label: 'Dual', engine: 'diesel', defaults: { r: 16, rc: 1.4, rp: 1.5 }, ranges: { r: { min: 12, max: 24, step: 0.5 }, rc: { min: 1.1, max: 3, step: 0.05 }, rp: { min: 1.05, max: 2.5, step: 0.05 } } },
  brayton: { label: 'Brayton', engine: null, defaults: { rpB: 15, T3: 1500 }, ranges: { rpB: { min: 4, max: 40, step: 0.5 }, T3: { min: 1100, max: 1800, step: 10 } } },
};
