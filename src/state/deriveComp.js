/**
 * deriveComp.js — state Scene 7 (kompresor gas + hukum affinitas) → frame. Semua angka dari thermo.js:
 *   proses   : gasCompressor (rp, head, daya, T discharge), suctionFlow (Q volumetrik)
 *   speed    : speedForHead (dari head saja) → speed yang dibutuhkan; rig berputar dengan speed ini
 *   what-if  : affinity({ N0: N dibutuhkan, N1: slider Speed }) dari titik proses (Ideal, η tetap)
 *   turbin   : compressorTrain → beban compressor drive (Scene 5/6), N_GG, flame T, NOx, CO (basis aktif)
 */
import { compressorTrain, suctionFlow, affinity, emissionAtBasis, tempToRGB, MW } from '../model/thermo.js';
import { GAS_COMPRESSOR, LOAD_DESIGNS, LOAD_RANGE } from '../model/presets.js';
import { emissionBasis } from './deriveNox.js';
import { dlnCalib } from './deriveLoad.js';

const DEG = Math.PI / 180;
/** Skala warna suhu Scene 7 (gas proses ~300–480 K); legenda memakai skala yang sama. */
export const COMP_TEMP_SCALE = { min: 280, max: 500 };
const LOAD_LIMITS = [LOAD_RANGE.min / 100, LOAD_RANGE.max / 100];

/** Parameter gasCompressor dari state (bar → Pa). */
export const compParams = (s) => ({ Psuc: s.cPsuc * 1e5, Pdis: s.cPdis * 1e5, Tsuc: GAS_COMPRESSOR.design.Tsuc, MWgas: s.cMW, mdot: s.cMdot });

const memo = new Map();
function cached(key, fn) {
  if (!memo.has(key)) { if (memo.size > 60) memo.clear(); memo.set(key, fn()); }
  return memo.get(key);
}

/** Rangkaian kompresor → turbin (di-cache per kondisi proses & kalibrasi). */
function train(comp, calib) {
  return cached(`${JSON.stringify(comp)}|${calib}`, () =>
    compressorTrain({ comp, compDesign: GAS_COMPRESSOR.design, gtDesign: LOAD_DESIGNS.twin, calib, loadRange: LOAD_LIMITS }));
}

/** @param {any} s state store (cPsuc, cPdis, cMW, cMdot, cSpeed, calDln, emRefO2, emTrefC, theta) */
export function deriveComp(s) {
  const comp = compParams(s);
  const calib = dlnCalib(s, 'twin');
  const t = train(comp, calib);
  const t0 = train(GAS_COMPRESSOR.design, calib);          // titik desain kompresor (demo case)
  const g = t.comp;
  const Q = suctionFlow(comp), Qd = suctionFlow(GAS_COMPRESSOR.design);
  const Nreq = t.Nreq;
  const Nw = s.cSpeed / 100;
  const what = affinity({ N0: Nreq, N1: Nw, Q0: Q, H0: g.head, P0: g.power });
  const basis = emissionBasis(s);
  const conv = (ppm, MWs) => emissionAtBasis({ ppm, refFrom: 15, refO2: basis.refO2, TrefK: 273.15 + basis.TrefC, MWspecies: MWs }).ppm;

  // kurva affinity melalui titik proses: N = 50 … max(110 %, N dibutuhkan + 5 %)
  const sw = GAS_COMPRESSOR.speedSweep;
  const nMax = Math.min(160, Math.max(sw.max, Math.ceil(Nreq * 100 / 5) * 5 + 5));
  const curve = cached(`curve|${Q}|${g.head}|${g.power}|${Nreq}|${nMax}`, () => {
    const N = [], q = [], h = [], p = [];
    for (let n = sw.min; n <= nMax; n += sw.step) {
      const a = affinity({ N0: Nreq, N1: n / 100, Q0: Q, H0: g.head, P0: g.power });
      N.push(n); q.push(a.Q); h.push(a.H / 1e3); p.push(a.P / 1e6);
    }
    return { N, Q: q, H: h, P: p };
  });

  // warna gas sepanjang lintasan (suction → discharge), skala COMP_TEMP_SCALE
  const rgb = (T) => tempToRGB(T, COMP_TEMP_SCALE.min, COMP_TEMP_SCALE.max);
  const nC = 8;
  const gasRGB = Array.from({ length: nC }, (_, i) => rgb(comp.Tsuc + ((g.Tdis - comp.Tsuc) * i) / (nC - 1)));

  const theta = s.theta ?? 0;
  return {
    comp: { rp: g.rp, head: g.head, power: g.power, Tdis: g.Tdis, Tsuc: comp.Tsuc, Psuc: comp.Psuc, Pdis: comp.Pdis, MWgas: comp.MWgas, mdot: comp.mdot, Q, Qd, Hd: t0.comp.head, Pd: t0.comp.power },
    Nreq,
    whatIf: { N: Nw, Q: what.Q, H: what.H, P: what.P, ratio: Nw / Nreq },
    curve,
    train: {
      ptPower: t.ptPower, loadRaw: t.loadRaw, load: t.load, inRange: t.inRange, Ngg: t.Ngg, Tflame: t.Tflame,
      nox: conv(t.NOx_ppm, MW.NO2), co: conv(t.CO_ppm, MW.CO), calib,
    },
    design: { load: t0.loadRaw, Tflame: t0.Tflame, Nreq: t0.Nreq },
    shift: { dN: Nreq - t0.Nreq, dLoad: t.loadRaw - t0.loadRaw, dTflame: t.Tflame - t0.Tflame, atDesign: JSON.stringify(comp) === JSON.stringify(GAS_COMPRESSOR.design) },
    basis,
    gasRGB,
    tempScale: COMP_TEMP_SCALE,
    rotor: { angle: theta * Nreq * DEG },
    flowVis: Math.min(2.5, Q / Qd),
    modelLevel: 'real',
  };
}
