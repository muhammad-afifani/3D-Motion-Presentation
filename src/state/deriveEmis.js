/**
 * deriveEmis.js — state Scene 8 (emisi gabungan) → frame. Semua angka dari thermo.js, kalibrasi dari store:
 *   diesel / gas engine : cylinderSim preset (NOx_gkWh, η rem, co2_gkWh)
 *   gas turbine (gen.)  : braytonReal desain + dlnFromResult (calDln.single) → ppmToGkWh (NOx, CO); co2Specific
 *   methane slip        : co2eWithSlip (gas engine & turbin; diesel tidak), GWP_CH4
 *   PM                  : kualitatif, tidak dimodelkan (tingkat tetap untuk partikel)
 */
import { cylinderSim, braytonReal, dlnFromResult, ppmToGkWh, co2Specific, co2eWithSlip, logNorm, emissionAtBasis, ENGINE_PRESETS, GWP_CH4, MW } from '../model/thermo.js';
import { EMIS, LOAD_DESIGNS, NOX_CALIB_DEFAULTS } from '../model/presets.js';
import { dlnCalib } from './deriveLoad.js';
import { emissionBasis } from './deriveNox.js';

const memo = new Map();
function cached(key, fn) {
  if (!memo.has(key)) { if (memo.size > 30) memo.clear(); memo.set(key, fn()); }
  return memo.get(key);
}

const engineAt = (kind, calib) => cached(`eng|${kind}|${calib}`, () => {
  const r = cylinderSim({ ...ENGINE_PRESETS[kind], calib });
  return { eta: r.etaBrake, nox: r.NOx_gkWh, co2: r.co2_gkWh, noxPpm: r.NOx_ppmvd_ref };
});
const turbineAt = (calib) => cached(`gt|${calib}`, () => {
  const d = braytonReal(LOAD_DESIGNS.single);
  const e = dlnFromResult(d, d, { calib });
  return {
    eta: d.eta, noxPpm: e.NOx_ppm, coPpm: e.CO_ppm,
    nox: ppmToGkWh({ ppm: e.NOx_ppm, MWspecies: MW.NO2, eta: d.eta, fuel: 'gas' }),
    co: ppmToGkWh({ ppm: e.CO_ppm, MWspecies: MW.CO, eta: d.eta, fuel: 'gas' }),
    co2: co2Specific(d.eta, 'gas'),
  };
});

/** @param {any} s state store (eSlip, calEngine, calDln, emRefO2, emTrefC) */
export function deriveEmis(s) {
  const slip = (s.eSlip ?? EMIS.slip.default) / 100;
  const calE = { diesel: s.calEngine?.diesel ?? NOX_CALIB_DEFAULTS.engine.diesel, gas: s.calEngine?.gas ?? NOX_CALIB_DEFAULTS.engine.gas };
  const calD = dlnCalib(s, 'single');
  const d = engineAt('diesel', calE.diesel), g = engineAt('gas', calE.gas), t = turbineAt(calD);
  const sg = co2eWithSlip({ eta: g.eta, slipFrac: slip, fuel: 'gas' });
  const st = co2eWithSlip({ eta: t.eta, slipFrac: slip, fuel: 'gas' });
  const basis = emissionBasis(s);
  const atBasis = (ppm, MWs) => emissionAtBasis({ ppm, refFrom: 15, refO2: basis.refO2, TrefK: 273.15 + basis.TrefC, MWspecies: MWs }).ppm;

  const rows = {
    // noxPpm15 / coPpm15: nilai model mentah ppmvd @ 15 % O₂ (untuk perbandingan regulasi lewat jalur regulasi)
    diesel: { id: 'diesel', eta: d.eta, nox: d.nox, co2: d.co2, co2e: d.co2, ch4: 0, slipApplies: false, pm: EMIS.pmLevel.diesel, noxPpm15: d.noxPpm },
    gas: { id: 'gas', eta: g.eta, nox: g.nox, co2: sg.co2, co2e: sg.co2e, ch4: sg.ch4_g, slipApplies: true, pm: EMIS.pmLevel.gas, noxPpm15: g.noxPpm },
    turbine: {
      id: 'turbine', eta: t.eta, nox: t.nox, co2: st.co2, co2e: st.co2e, ch4: st.ch4_g, slipApplies: true, pm: EMIS.pmLevel.turbine,
      noxPpm: atBasis(t.noxPpm, MW.NO2), coPpm: atBasis(t.coPpm, MW.CO), co: t.co, noxPpm15: t.noxPpm, coPpm15: t.coPpm,
    },
  };
  const list = EMIS.machines.map((k) => rows[k]);
  const max = (f) => Math.max(...list.map(f), 1e-12);
  // jumlah partikel (0…1) ∝ logNorm nilai frame relatif nilai terbesar antar mesin; PM = tingkat kualitatif tetap
  const particles = Object.fromEntries(list.map((r) => [r.id, {
    NOx: logNorm(r.nox, max((x) => x.nox), 2),
    CO2: logNorm(r.co2, max((x) => x.co2), 2),
    CH4: r.ch4 > 0 ? logNorm(r.ch4, max((x) => x.ch4), 2) : 0,
    PM: EMIS.pmParticles[r.pm],
  }]));

  return {
    slip, rows, list, particles,
    gwp: GWP_CH4,
    slipIncrease: sg.co2e / sg.co2 - 1,                      // sama untuk gas engine & turbin (tidak bergantung η)
    slipIncreaseTurbine: st.co2e / st.co2 - 1,
    gasVsDiesel: { co2: 1 - g.co2 / d.co2, co2e: 1 - sg.co2e / d.co2 },
    calib: { engine: calE, dln: calD, defaults: NOX_CALIB_DEFAULTS, literature: NOX_CALIB_DEFAULTS.literature },
    basis,
    modelLevel: 'semiEmpirical',
  };
}
