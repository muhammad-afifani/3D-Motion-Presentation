/**
 * deriveNox.js — state Scene 4 (NOx) + hasil cylinderSim + retardSweep → frame.
 * Semua angka dari thermo.js: cylinderSim (TbTrace/noTrace, NOx_*), retardSweep, zeldovichCurve, noxRateRatio.
 * Nilai visual (warna, ukuran gelembung, laju partikel) disiapkan di sini; rig/chart/HUD hanya membaca frame.
 */
import { zeldovichCurve, noxRateRatio, tempToRGB, logNorm, emissionAtBasis, MW } from '../model/thermo.js';
import { ENGINES, NOX_TIMING, NOX_ARRHENIUS, NOX_CALIB_DEFAULTS } from '../model/presets.js';
import { isDefaultBasis } from './store.js';
import { derive } from './derive.js';

/** Kunci state yang memicu cylinderSim ulang (Worker, debounce 80 ms). Basis emisi TIDAK (konversi saja). */
export const NOX_SIM_KEYS = ['nEngine', 'nTheta0', 'calEngine'];

/** Skala warna suhu Scene 4: lebih lebar dari Scene 1 (2600 K) agar zona terbakar 2200–3000 K terbedakan. */
export const NOX_TEMP_SCALE = { min: 300, max: 3000 };

/** Faktor kalibrasi NOx engine aktif (store global; default ENGINE_NOX_CALIB). */
export const engineCalib = (s) => s.calEngine?.[s.nEngine] ?? NOX_CALIB_DEFAULTS.engine[s.nEngine];

/** Parameter cylinderSim Scene 4: preset engine (sama dengan retardSweep) + timing dari slider + kalibrasi. */
export const noxSimParams = (s) => ({ ...ENGINES[s.nEngine].params, theta0: s.nTheta0, calib: engineCalib(s) });
export const noxSimKey = (s) => `${s.nEngine}|${s.nTheta0}|${engineCalib(s)}`;

/** Parameter retardSweep: semua langkah slider timing (preset yang sama, kalibrasi yang sama). */
export const noxSweepParams = (s) => ({ kind: s.nEngine, thetas: NOX_TIMING[s.nEngine].sweep, over: { calib: engineCalib(s) } });
export const noxSweepKey = (s) => `${s.nEngine}|${engineCalib(s)}`;

/** Basis tampilan aktif (store global). */
export const emissionBasis = (s) => ({ refO2: s.emRefO2 ?? 15, TrefC: s.emTrefC ?? 0, isDefault: isDefaultBasis({ emRefO2: s.emRefO2 ?? 15, emTrefC: s.emTrefC ?? 0 }) });

let curveMemo = null;
/** Kurva Arrhenius (laju Zeldovich relatif terhadap Tref), dihitung sekali. */
export function arrheniusCurve() {
  if (!curveMemo) {
    const A = NOX_ARRHENIUS;
    const pts = zeldovichCurve({ Tmin: A.Tmin, Tmax: A.Tmax, n: 80, Tref: A.Tref });
    curveMemo = { T: pts.map((p) => p.T), rel: pts.map((p) => p.rel), Tref: A.Tref };
  }
  return curveMemo;
}

/** Angka pesan kunci: +100 K pada Tref (1800 K) → ×N laju pembentukan NO. */
export const noxKeyNumbers = () => ({ ratio100: noxRateRatio(NOX_ARRHENIUS.Tref), Tref: NOX_ARRHENIUS.Tref });

/** Nilai jejak per-θ (array sejajar sim.th); di luar IVC…EVO → ujung terdekat. */
function traceAt(sim, arr, theta, { zeroStep = false } = {}) {
  const th = sim.th, n = th.length - 1;
  if (theta <= th[0]) return arr[0];
  if (theta >= th[n]) return arr[n];
  const u = (theta - th[0]) / (th[1] - th[0]);
  const i = Math.floor(u), t = u - i;
  const a = arr[i], b = arr[Math.min(i + 1, n)];
  if (zeroStep && (a === 0 || b === 0)) return t < 0.5 ? a : b; // tepi awal zona terbakar: jangan campur dengan 0
  return a + (b - a) * t;
}

/**
 * @param {any} s state store (nEngine, nTheta0, theta, rpmVisual)
 * @param {any} sim hasil cylinderSim(noxSimParams(s))
 * @param {any[]|null} sweep hasil retardSweep(noxSweepParams(s)) (boleh null/basi saat engine baru diganti)
 */
export function deriveNox(s, sim, sweep) {
  const base = derive({ ...s, engine: s.nEngine }, sim);
  const scale = NOX_TEMP_SCALE;
  const theta = s.theta;
  const rgb = (T) => tempToRGB(T, scale.min, scale.max);

  // zona terbakar pada θ ini (jejak dari loop engineNOx yang sama dengan NOx_gkWh)
  const Tb = traceAt(sim, sim.TbTrace, theta, { zeroStep: true });
  const nNO = sim.nNOkmol;
  const noFrac = nNO > 0 ? traceAt(sim, sim.noTrace, theta) / nNO : 0;
  // laju pembentukan NO pada θ, dinyatakan dalam g/kWh per derajat (integralnya = NOx_gkWh)
  const dNo = Math.max(0, traceAt(sim, sim.noTrace, theta + 0.5) - traceAt(sim, sim.noTrace, theta - 0.5));
  const rate = nNO > 0 ? (dNo / nNO) * sim.NOx_gkWh : 0;
  const burning = Tb > 0 && base.xb > 0.002;

  // retardSweep: kurva NOx–η; abaikan hasil basi (engine lain atau panjang tidak cocok)
  const T = NOX_TIMING[s.nEngine];
  const sw = sweep && sweep.length === T.sweep.length && sweep.every((p, i) => p.theta0 === T.sweep[i]) ? sweep : null;
  const presetTheta0 = ENGINES[s.nEngine].params.theta0;
  const preset = sw?.find((p) => p.theta0 === presetTheta0) ?? null;
  const noxMax = sw ? Math.max(...sw.map((p) => p.NOx_gkWh)) : sim.NOx_gkWh;
  // pemetaan visual partikel (skala log): acuan = NOx terbesar di sapuan terbentuk dalam ±8°
  const spawn = burning || rate > 0 ? logNorm(rate, noxMax / 8, 2) : 0;

  const A = NOX_ARRHENIUS;
  const TbPeak = sim.TburnedMax;
  // ppmvd & mg/Nm³ (sebagai NO₂, kering) pada basis tampilan aktif — konversi di thermo.js
  const basis = emissionBasis(s);
  const refFrom = sim.params.refO2 ?? 15;
  const noxAtBasis = emissionAtBasis({ ppm: sim.NOx_ppmvd_ref, refFrom, refO2: basis.refO2, TrefK: 273.15 + basis.TrefC, MWspecies: MW.NO2 });

  return {
    ...base,
    kind: 'nox',
    engine: s.nEngine,
    tempScale: scale,
    gasRGB: rgb(base.T),
    theta0: s.nTheta0, presetTheta0,
    timingRange: { min: T.min, max: T.max, step: T.step },
    burned: { visible: burning, T: Tb, rgb: burning ? rgb(Tb) : [0, 0, 0], xb: base.xb, radius: Math.cbrt(Math.max(0, base.xb)) },
    no: { frac: noFrac, rate, spawn },
    TbPeak,
    NOx: { gkWh: sim.NOx_gkWh, ...noxAtBasis, TrefC: basis.TrefC, basisDefault: basis.isDefault, ppmSim: sim.NOx_ppmvd_ref, refO2Sim: refFrom, calib: sim.params.calib ?? 1 },
    calib: sim.params.calib ?? 1,
    calibDefault: NOX_CALIB_DEFAULTS.engine[s.nEngine],
    calDln: s.calDln ?? NOX_CALIB_DEFAULTS.dln, // {single, twin}
    tradeoff: sw ? {
      eta: sw.map((p) => p.etaBrake), nox: sw.map((p) => p.NOx_gkWh), theta0: sw.map((p) => p.theta0),
      preset: preset && { eta: preset.etaBrake, nox: preset.NOx_gkWh, theta0: preset.theta0 },
    } : null,
    current: { eta: sim.etaBrake, nox: sim.NOx_gkWh, co2: sim.co2_gkWh, theta0: s.nTheta0 },
    vsPreset: preset ? { nox: sim.NOx_gkWh / preset.NOx_gkWh - 1, co2: sim.co2_gkWh / preset.co2_gkWh - 1, eta: sim.etaBrake - preset.etaBrake } : null,
    arrhenius: {
      curve: arrheniusCurve(),
      peak: { T: TbPeak, rel: noxRateRatio(A.Tref, TbPeak - A.Tref) },
      live: burning ? { T: Tb, rel: noxRateRatio(A.Tref, Tb - A.Tref) } : null,
      ratioPeak: noxRateRatio(TbPeak),
      ratioRef: noxRateRatio(A.Tref),
      engineBand: A.engineBand, dlnBand: A.dlnBand,
    },
    modelLevel: 'semiEmpirical',
  };
}
