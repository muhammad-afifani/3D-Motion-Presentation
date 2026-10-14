/**
 * derivePolicy.js — state Scene 9 (trade-off kebijakan) → frame. Semua angka dari thermo.js:
 *   Panel A: retardSweep (diesel / gas, kalibrasi dari store) → NOx, η rem, CO₂ vs timing; Δ % terhadap preset
 *   Panel B: ghgPenalty untuk tiga mesin (η dari deriveEmis: cylinderSim preset / braytonReal desain)
 *   Panel C: kurva Scene 6 (deriveLoad) + batas presenter; satuan ppm @ basis atau mg/Nm³ (ppmToMgNm3 / mgNm3ToPpm)
 */
import { ghgPenalty, ppmToMgNm3, mgNm3ToPpm, MW } from '../model/thermo.js';
import { ENGINES, NOX_TIMING, POLICY, NOX_CALIB_DEFAULTS } from '../model/presets.js';
import { deriveEmis } from './deriveEmis.js';
import { deriveLoad } from './deriveLoad.js';
import { limitsPatch } from './store.js';

export const engineCalibOf = (s, kind) => s.calEngine?.[kind] ?? NOX_CALIB_DEFAULTS.engine[kind];
/** Parameter retardSweep panel A (Worker). */
export const policySweepParams = (s) => ({ kind: s.pEngine, thetas: NOX_TIMING[s.pEngine].sweep, over: { calib: engineCalibOf(s, s.pEngine) } });
export const policySweepKey = (s) => `${s.pEngine}|${engineCalibOf(s, s.pEngine)}`;

const pct = (a, b) => (a / b - 1) * 100;

/** Panel A dari hasil retardSweep (null bila sapuan belum/basi). */
function panelA(s, sweep) {
  const T = NOX_TIMING[s.pEngine];
  if (!sweep || sweep.length !== T.sweep.length || !sweep.every((p, i) => p.theta0 === T.sweep[i])) return null;
  const preset = ENGINES[s.pEngine].params.theta0;
  const ip = T.sweep.indexOf(preset), ic = T.sweep.indexOf(s.pTheta0);
  const P = sweep[ip], cur = sweep[ic];
  return {
    engine: s.pEngine, theta: T.sweep, preset, i: ic, ip,
    nox: sweep.map((p) => p.NOx_gkWh), eta: sweep.map((p) => p.etaBrake), co2: sweep.map((p) => p.co2_gkWh),
    dEta: sweep.map((p) => pct(p.etaBrake, P.etaBrake)), dCo2: sweep.map((p) => pct(p.co2_gkWh, P.co2_gkWh)),
    current: { theta0: s.pTheta0, nox: cur.NOx_gkWh, eta: cur.etaBrake, co2: cur.co2_gkWh },
    presetPoint: { nox: P.NOx_gkWh, eta: P.etaBrake, co2: P.co2_gkWh },
    delta: { nox: pct(cur.NOx_gkWh, P.NOx_gkWh), eta: pct(cur.etaBrake, P.etaBrake), co2: pct(cur.co2_gkWh, P.co2_gkWh) },
    extreme: { theta0: T.sweep.at(-1), nox: pct(sweep.at(-1).NOx_gkWh, P.NOx_gkWh), co2: pct(sweep.at(-1).co2_gkWh, P.co2_gkWh) },
  };
}

/** Panel B: CO₂ spesifik vs penalti untuk diesel, gas engine, gas turbine. */
function panelB(s) {
  const e = deriveEmis({ ...s, eSlip: 0 });
  const R = POLICY.penalty;
  const pen = [];
  for (let p = R.min; p <= R.max + 1e-9; p += R.step) pen.push(Math.round(p * 10) / 10);
  const machines = e.list.map((r) => {
    const fuel = r.id === 'diesel' ? 'diesel' : 'gas';
    const curve = pen.map((p) => ghgPenalty({ eta: r.eta, fuelPenaltyPct: p, fuel }));
    const cur = ghgPenalty({ eta: r.eta, fuelPenaltyPct: s.pPenalty, fuel });
    return { id: r.id, eta: r.eta, co2: curve.map((g) => g.co2_1), dCo2: curve.map((g) => g.co2_1 - g.co2_0), current: cur };
  });
  return { penalty: pen, value: s.pPenalty, machines };
}

/** Konversi tampilan ppm @ basis ↔ mg/Nm³ (NOx sebagai NO₂, CO sebagai CO; basis volume aktif). */
export function toDisplay(ppm, species, unit, basis) {
  if (ppm == null) return null;
  return unit === 'mg' ? ppmToMgNm3(ppm, species === 'nox' ? MW.NO2 : MW.CO, 273.15 + basis.TrefC) : ppm;
}
/** Patch batas dari input presenter dalam satuan aktif → disimpan sebagai ppm @ basis (kanonik). */
export function limitsInputPatch(s, input) {
  const unit = s.limUnit ?? 'ppm', TrefK = 273.15 + (s.emTrefC ?? 0);
  const conv = (x, MWs) => {
    if (x == null || String(x).trim() === '') return x;
    const n = Number(String(x).replace(',', '.'));
    if (!Number.isFinite(n)) return x;
    return unit === 'mg' ? mgNm3ToPpm(n, MWs, TrefK) : n;
  };
  const out = {};
  if ('nox' in input) out.nox = conv(input.nox, MW.NO2);
  if ('co' in input) out.co = conv(input.co, MW.CO);
  return limitsPatch(out);
}

/** Panel C: kurva Scene 6 dalam satuan aktif, batas, arsiran pelanggaran CO, jendela beban. */
function panelC(s) {
  const L = deriveLoad(s);
  const unit = s.limUnit ?? 'ppm', b = L.basis;
  const conv = (arr, sp) => arr.map((v) => toDisplay(v, sp, unit, b));
  const cfg = (c) => {
    const k = L[c];
    const co = k.curve.co, viol = [];
    if (L.limits.co != null) {
      let start = -1;
      for (let i = 0; i <= co.length; i++) {
        const bad = i < co.length && co[i] > L.limits.co;
        if (bad && start < 0) start = i;
        if (!bad && start >= 0) { viol.push([k.curve.load[start], k.curve.load[i - 1]]); start = -1; }
      }
    }
    return { load: k.curve.load, nox: conv(k.curve.nox, 'nox'), co: conv(co, 'co'), coViolation: viol, window: k.window, point: { load: L.load, nox: toDisplay(k.point.nox, 'nox', unit, b), co: toDisplay(k.point.co, 'co', unit, b) } };
  };
  return {
    unit, basis: b, strategy: L.strategy,
    limits: { set: L.limits.set, nox: toDisplay(L.limits.nox, 'nox', unit, b), co: toDisplay(L.limits.co, 'co', unit, b), noxPpm: L.limits.nox, coPpm: L.limits.co },
    single: cfg('single'), twin: cfg('twin'),
  };
}

/**
 * @param {any} s state store (pTab, pEngine, pTheta0, pPenalty, limUnit, limNOx, limCO, lLoad, lStrategy, calEngine, calDln, emRefO2, emTrefC)
 * @param {any[]|null} sweep hasil retardSweep(policySweepParams(s))
 */
export function derivePolicy(s, sweep) {
  return { tab: s.pTab, A: panelA(s, sweep), B: panelB(s), C: panelC(s), modelLevel: 'semiEmpirical' };
}
