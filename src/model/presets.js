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
