/**
 * deriveAssumptions.js — data panel asumsi (tombol H). Semua nilai dari thermo.js / presets / store;
 * ui/assumptions.js hanya menampilkan. Teks ada di ui/strings.js (STR.assumptions).
 */
import { ZELDOVICH, flameTemperature, emissionAtBasis, MW } from '../model/thermo.js';
import { NOX_CALIB_DEFAULTS, EMISSION_BASIS } from '../model/presets.js';
import { isDefaultBasis } from './store.js';

const FLAME_PHIS = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
const FLAME_TIN = 300; // K

/** Tingkat model per grafik (kunci; judul grafik diambil dari strings.js di ui/assumptions.js). */
export const CHART_LEVELS = [
  { scene: 1, chart: 's1pv', levels: ['semiEmpirical'] },
  { scene: 1, chart: 's1pth', levels: ['semiEmpirical'] },
  { scene: 2, chart: 's2cycle', levels: ['ideal', 'real'] },
  { scene: 2, chart: 's2schem', levels: ['ideal'] },
  { scene: 2, chart: 's2wf', levels: ['semiEmpirical'] },
  { scene: 3, chart: 's3flame', levels: ['semiEmpirical'] },
  { scene: 3, chart: 's3bars', levels: ['semiEmpirical'] },
  { scene: 4, chart: 's4trade', levels: ['semiEmpirical'] },
  { scene: 4, chart: 's4arr', levels: ['semiEmpirical'] },
  { scene: 5, chart: 's5cycle', levels: ['real'] },
  { scene: 6, chart: 's6emis', levels: ['semiEmpirical'] },
  { scene: 6, chart: 's6aux', levels: ['semiEmpirical'] },
];

let flameRows = null;

/** @param {any} s state store (emRefO2, emTrefC, calEngine, calDln) */
export function deriveAssumptions(s) {
  flameRows ??= FLAME_PHIS.map((phi) => ({ phi, gas: flameTemperature(phi, FLAME_TIN, 'gas'), diesel: flameTemperature(phi, FLAME_TIN, 'diesel') }));
  const ex = emissionAtBasis({ ppm: EMISSION_BASIS.examplePpm15, refFrom: 15, refO2: s.emRefO2, TrefK: 273.15 + s.emTrefC, MWspecies: MW.NO2 });
  return {
    zeldovich: ZELDOVICH,
    basis: { refO2: s.emRefO2, TrefC: s.emTrefC, isDefault: isDefaultBasis(s), range: EMISSION_BASIS.refO2, options: EMISSION_BASIS.TrefC.options },
    example: { ppm15: EMISSION_BASIS.examplePpm15, ppm: ex.ppm, mgNm3: ex.mgNm3 },
    calib: { engine: s.calEngine, dln: s.calDln, defaults: NOX_CALIB_DEFAULTS, literature: NOX_CALIB_DEFAULTS.literature },
    flame: { Tin: FLAME_TIN, rows: flameRows },
    chartLevels: CHART_LEVELS,
  };
}
