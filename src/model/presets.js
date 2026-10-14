/**
 * presets.js — preset unit + rentang slider.
 *
 * Nilai parameter engine diambil langsung dari ENGINE_PRESETS di thermo.js (tidak disalin),
 * supaya hanya ada satu sumber angka. File ini hanya menambah rentang kontrol; label tampilan ada di ui/strings.js.
 */
import { ENGINE_PRESETS } from './thermo.js';

/**
 * @typedef {{min:number, max:number, step:number}} Range
 * @typedef {{params:object, ranges:Record<string, Range>}} EnginePreset
 */

/** @type {Record<'diesel'|'gas', EnginePreset>} */
export const ENGINES = {
  diesel: {
    params: ENGINE_PRESETS.diesel,
    ranges: {
      r: { min: 12, max: 22, step: 0.5 },
      phi: { min: 0.3, max: 0.8, step: 0.01 },
      theta0: { min: -16, max: 6, step: 0.5 },
    },
  },
  gas: {
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
  gtGen: { design: {} }, // turbin generator (single-shaft)
  gtComp: { design: {} }, // turbin kompresor (twin-shaft)
};

/**
 * Scene 2 — siklus. Default = input golden test (bagian 12) agar angka acuan terbaca di layar.
 * `engine` = mesin nyata pembanding di mode Real (cylinderSim); Brayton real = braytonReal.
 * Rentang r mode Ideal lebih lebar dari mesin nyata (mis. Otto r=18 untuk perbandingan teori).
 */
export const CYCLES = {
  otto: { engine: 'gas', defaults: { r: 10 }, ranges: { r: { min: 6, max: 22, step: 0.5 } } },
  diesel: { engine: 'diesel', defaults: { r: 18, rc: 2 }, ranges: { r: { min: 12, max: 24, step: 0.5 }, rc: { min: 1.2, max: 3.5, step: 0.05 } } },
  dual: { engine: 'diesel', defaults: { r: 16, rc: 1.4, rp: 1.5 }, ranges: { r: { min: 12, max: 24, step: 0.5 }, rc: { min: 1.1, max: 3, step: 0.05 }, rp: { min: 1.05, max: 2.5, step: 0.05 } } },
  brayton: { engine: null, defaults: { rpB: 15, T3: 1500 }, ranges: { rpB: { min: 4, max: 40, step: 0.5 }, T3: { min: 1100, max: 1800, step: 10 } } },
};

/**
 * Scene 3 — pembakaran. φ default piston = preset ENGINE_PRESETS; turbin = φ zona premix desain
 * (sama dengan default phiPzDesign di loadSweep/dlnFromResult thermo.js).
 */
export const FLAME_MODES = {
  diesel: { engine: 'diesel', fuel: 'diesel', phi: ENGINE_PRESETS.diesel.phi, phiLocal: ENGINE_PRESETS.diesel.phiLocal },
  gas: { engine: 'gas', fuel: 'gas', phi: ENGINE_PRESETS.gas.phi, phiLocal: null },
  turbine: { engine: null, fuel: 'gas', phi: 0.5, phiLocal: null },
};
export const FLAME_RANGES = {
  phi: { min: 0.3, max: 1.2, step: 0.01 },
  phiLocal: { min: 0.5, max: 1.2, step: 0.01 },
  Tin: { min: 250, max: 1000, step: 5 },
};

/**
 * Scene 5 — turbin gas. Nilai desain = default fungsi thermo.js (dijaga tes golden):
 *   generator       → braytonReal  (single-shaft, N tetap)
 *   compressorDrive → twinShaft    (gas generator + free power turbine)
 * mdot 20 kg/s = kelas industri generik (±7 MW), hanya untuk HUD daya absolut.
 */
export const GAS_TURBINES = {
  generator: { model: 'braytonReal', design: { rp: 15, T3: 1500, etaC: 0.87, etaT: 0.90 }, mdot: 20, Nrpm: 3000 },
  compressorDrive: { model: 'twinShaft', design: { rp: 20, T3: 1450, etaC: 0.86, etaGG: 0.89, etaPT: 0.90 }, mdot: 20 },
};
export const GT_RANGES = {
  rp: { min: 6, max: 30, step: 0.5 },
  T3: { min: 1200, max: 1700, step: 10 },
  etaC: { min: 0.78, max: 0.92, step: 0.005 },
  etaT: { min: 0.82, max: 0.94, step: 0.005 },
  Tamb: { min: -10, max: 50, step: 1 },
};
/** Jumlah tahap rig 3D (visual). */
export const GT_STAGES = { compressor: 10, turbine: 3, ggTurbine: 2, powerTurbine: 2 };
