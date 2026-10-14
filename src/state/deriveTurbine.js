/**
 * deriveTurbine.js — state Scene 5 → frame (turbin gas: Brayton dari dekat).
 *   Generator (single-shaft)          → braytonReal / braytonDerated
 *   Compressor drive (twin-shaft)     → twinShaft() via twinShaftCycle (sama dengan Scene 6)
 * Warna tahap dari compressorStages/turbineStages (tahap terakhir = T₂/T₄/T₄₅/T₅ model).
 * Nilai visual (warna, intensitas, sudut rotor) disiapkan di sini; rig hanya membaca frame.
 */
import {
  braytonReal, braytonDerated, twinShaftCycle, compressorStages, turbineStages,
  tempToRGB, flameColor, dlnFromResult,
} from '../model/thermo.js';
import { GAS_TURBINES, GT_RANGES, GT_STAGES } from '../model/presets.js';
import { TEMP_SCALE } from './derive.js';
import { procsFromCycle, braytonPoint, BRAYTON_REAL_ROLES, SAMPLE_N } from './deriveCycles.js';

const TWIN_ROLES = ['compression', 'heat', 'expansion', 'expansion', 'rejection'];
const DEG = Math.PI / 180;

/** Parameter fungsi model dari state slider. */
export function gtParams(s) {
  const g = GAS_TURBINES[s.gCfg];
  return s.gCfg === 'generator'
    ? { rp: s.gRp, T3: s.gT3, etaC: s.gEtaC, etaT: s.gEtaT, mdot: g.mdot }
    : { rpDesign: s.gRp, T3: s.gT3, etaC: s.gEtaC, etaGG: s.gEtaGG, etaPT: s.gEtaPT, mdotDesign: g.mdot };
}

/** Siklus model pada ambient tertentu. */
function cycleAt(cfg, p, TambC) {
  return cfg === 'generator' ? braytonDerated(p, { TambC }) : twinShaftCycle(p, { TambC });
}

const memo = new Map();
function cached(key, fn) {
  if (!memo.has(key)) { if (memo.size > 48) memo.clear(); memo.set(key, fn()); }
  return memo.get(key);
}

const rgbOf = (T) => tempToRGB(T, TEMP_SCALE.min, TEMP_SCALE.max);
const stageList = (arr) => arr.map((x) => ({ T: x.T, rgb: rgbOf(x.T) }));

/** Paket siklus + kurva untuk satu set parameter (di-cache). */
function pack(cfg, p, TambC) {
  return cached(`${cfg}|${JSON.stringify(p)}|${TambC}`, () => {
    const res = cycleAt(cfg, p, TambC);
    const twin = cfg !== 'generator';
    const labels = twin ? ['1', '2', '3', '4.5', '5'] : ['1', '2', '3', '4'];
    const states = res.states.map((st, i) => ({ label: labels[i], T: st.T, P: st.P, v: st.v, s: st.s }));
    const procs = procsFromCycle(res, SAMPLE_N, twin ? TWIN_ROLES : BRAYTON_REAL_ROLES);
    const T1 = res.params.T1;
    const stages = twin
      ? {
        comp: stageList(compressorStages(T1, res.rp, p.etaC, GT_STAGES.compressor)),
        turb: stageList(turbineStages(res.T3, res.epsGG, p.etaGG, GT_STAGES.ggTurbine)),
        pt: stageList(turbineStages(res.T45, res.rpt, p.etaPT, GT_STAGES.powerTurbine)),
      }
      : {
        comp: stageList(compressorStages(T1, res.rp, p.etaC, GT_STAGES.compressor)),
        turb: stageList(turbineStages(res.T3, res.rpt, p.etaT, GT_STAGES.turbine)),
        pt: [],
      };
    return { res, states, procs, stages };
  });
}

/** qin terbesar dalam rentang slider (T3 maks, rp min) → normalisasi intensitas nyala. */
function qinRef(cfg, p) {
  const big = { ...p, T3: GT_RANGES.T3.max, ...(cfg === 'generator' ? { rp: GT_RANGES.rp.min } : { rpDesign: GT_RANGES.rp.min }) };
  return cached(`qref|${cfg}|${JSON.stringify(big)}`, () => cycleAt(cfg, big, 15).qin);
}

/** Angka pesan kunci dari model: back-work ratio & derating @35 °C (preset generator). */
export function gtKeyNumbers() {
  return cached('key', () => {
    const p = gtParams({ gCfg: 'generator', gRp: GAS_TURBINES.generator.design.rp, gT3: GAS_TURBINES.generator.design.T3, gEtaC: GAS_TURBINES.generator.design.etaC, gEtaT: GAS_TURBINES.generator.design.etaT });
    const d = braytonDerated(p, { TambC: 35 });
    return { bwr: braytonReal(p).backWorkRatio, perDegC: d.perDegC };
  });
}

/**
 * @param {any} s state store (g*, theta, rpmVisual)
 */
export function deriveTurbine(s) {
  const cfg = s.gCfg, twin = cfg !== 'generator';
  const p = gtParams(s);
  const cur = pack(cfg, p, s.gTamb);
  const iso = s.gTamb === 15 ? cur : pack(cfg, p, 15);
  const res = cur.res;
  // derating %/°C: pada 15 °C (0/0) dihitung di acuan 35 °C
  const perDegRef = s.gTamb === 15;
  const perDegC = perDegRef ? pack(cfg, p, 35).res.perDegC : res.perDegC;
  const pt = braytonPoint(cur.procs, s.theta);
  const dln = dlnFromResult(res, iso.res);
  const N = twin ? { gg: res.Ngg ?? 1, pt: 1 } : { gg: 1, pt: 1, rpm: GAS_TURBINES.generator.Nrpm };

  return {
    cfg, twin, theta: s.theta, Tamb: s.gTamb,
    modelLevel: 'real',
    procs: cur.procs, states: cur.states, ghost: s.gTamb === 15 ? null : iso.procs,
    procSet: twin ? 'twin' : 'generator',
    point: { ...pt, visible: true },
    pointRGB: rgbOf(pt.T),
    tempScale: TEMP_SCALE,
    stages: cur.stages,
    eta: res.eta,
    heatRate: res.heatRate,           // kJ/kWh
    power: res.power,                 // W (ṁ preset)
    mdot: GAS_TURBINES[cfg].mdot,
    bwr: res.backWorkRatio,
    T2: res.T2, T3: res.T3, Texh: twin ? res.T5 : res.T4, T45: twin ? res.T45 : null,
    derate: res.derate,
    perDegC, perDegRef,
    N,
    rotor: { angleGG: s.theta * N.gg * DEG, anglePT: s.theta * N.pt * DEG },
    flame: { intensity: Math.min(1, res.qin / qinRef(cfg, p)), color: flameColor(dln.phiPz), phiPz: dln.phiPz, Tflame: dln.Tflame },
  };
}
