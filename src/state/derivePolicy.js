/**
 * derivePolicy.js — state Scene 9 (trade-off kebijakan) → frame. Semua angka dari thermo.js:
 *   Levers : deriveLevers (leverSweep di Worker, satu tuas mesin; NOx pada basis regulasi + limit) + deriveFuel (komposisi)
 *   Panel B: ghgPenalty untuk tiga mesin (η dari deriveEmis: cylinderSim preset / braytonReal desain)
 *   Panel C: kurva Scene 6 (deriveLoad) + batas (NOx dari content/regulations.json atau override presenter; CO = isian
 *            permit/OEM); satuan tampilan ppm @ basis atau mg/Nm³. Jendela dan chip dihitung di deriveLoad lewat jalur regulasi.
 */
import { ghgPenalty, ppmToMgNm3, mgNm3ToPpm, MW } from '../model/thermo.js';
import { POLICY } from '../model/presets.js';
import { deriveEmis } from './deriveEmis.js';
import { deriveLoad } from './deriveLoad.js';
import { limitsPatch } from './store.js';
import { deriveLevers } from './deriveLevers.js';
import { deriveFuel } from './deriveFuel.js';
import { fallbackContent } from './content.js';

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
function panelC(s, regData) {
  const L = deriveLoad(s, regData);
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
    limits: { set: L.limits.set, nox: toDisplay(L.limits.nox, 'nox', unit, b), co: toDisplay(L.limits.co, 'co', unit, b), noxPpm: L.limits.nox, coPpm: L.limits.co, source: L.limits.source, override: L.limits.override,
      overrideShown: { nox: toDisplay(L.limits.override.nox, 'nox', unit, b), co: toDisplay(L.limits.override.co, 'co', unit, b) } },
    regulation: L.regulation,
    single: cfg('single'), twin: cfg('twin'),
  };
}

/**
 * @param {any} s state store (pTab, p9Lev, p9Axis, fuelGas, pPenalty, limUnit, limNOx, limCO, lLoad, lStrategy, calEngine, calDln, emRefO2, emTrefC)
 * @param {{rows:any[], ms:number}|null} sweep hasil leverSweep(leverSweepParams(s)) dari Worker (null bila belum/basi)
 * @param {any} [regData] isi content/regulations.json (default: salinan bawaan)
 */
export function derivePolicy(s, sweep, regData = fallbackContent('regulations')) {
  return { tab: s.pTab, levers: deriveLevers(s, sweep, regData), fuel: deriveFuel(s), B: panelB(s), C: panelC(s, regData), modelLevel: 'semiEmpirical' };
}
