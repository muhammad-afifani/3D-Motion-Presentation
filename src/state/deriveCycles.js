/**
 * deriveCycles.js — state Scene 2 → frame (siklus ideal vs real).
 * Semua angka berasal dari thermo.js. Fungsi di sini hanya memilih model, menyiapkan kurva
 * dari cycle.sample() / array cylinderSim, dan menginterpolasi titik berjalan di sepanjang
 * polyline yang SAMA dengan yang digambar (titik selalu tepat di kurva P-v dan T-s).
 */
import {
  otto, diesel, dual, braytonIdeal, braytonReal, simStates, engineGeometry,
  valveLift, tempToRGB, flameColor, lossWaterfall,
} from '../model/thermo.js';
import { CYCLES, ENGINES } from '../model/presets.js';
import { derive as deriveEngine, TEMP_SCALE } from './derive.js';

export const SAMPLE_N = 120;
const HEAT_FLASH_DEG = 4; // jendela visual (°) untuk pemanasan isokorik yang "seketika" di TDC

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

/** Mesin nyata pembanding (preset ENGINES) untuk jenis siklus piston; null untuk Brayton. */
export const engineOf = (kind) => CYCLES[kind].engine;

/** r mesin nyata: r slider di-clamp ke rentang mesin (knocking/batas mekanis). */
export function rEngine(s) {
  const e = engineOf(s.cKind);
  if (!e) return null;
  const R = ENGINES[e].ranges.r;
  return clamp(s.cR, R.min, R.max);
}

// ── job berat (Worker) ──
export const realSimParams = (s) => ({ ...ENGINES[engineOf(s.cKind)].params, r: rEngine(s) });
export const realSimKey = (s) => (engineOf(s.cKind) ? `${engineOf(s.cKind)}|${rEngine(s)}` : 'none');
export const waterfallParams = (s) => ({ kind: engineOf(s.cKind), over: { r: rEngine(s) }, opts: { window: 'preset' } });
export const waterfallKey = realSimKey;

// ── kurva ──

/**
 * Peran proses untuk pewarnaan: kompresi (pertama), pelepasan panas (terakhir), pemanasan
 * (isokorik/isobarik di tengah), ekspansi (sisanya). Teks nama proses ada di ui/strings.js.
 */
function procRole(type, i, n) {
  if (i === 0) return 'compression';
  if (i === n - 1) return 'rejection';
  return type === 'isochoric' || type === 'isobaric' ? 'heat' : 'expansion';
}

/** cycle.sample() → polyline per proses dengan array v, P, T, s. */
function procsFromCycle(cycle, n = SAMPLE_N) {
  const sampled = cycle.sample(n);
  return sampled.map((p, i) => {
    const m = p.pts.length;
    const v = new Float64Array(m), P = new Float64Array(m), T = new Float64Array(m), s = new Float64Array(m);
    p.pts.forEach((q, j) => { v[j] = q.v; P[j] = q.P; T[j] = q.T; s[j] = q.s; });
    return { type: p.type, role: procRole(p.type, i, sampled.length), v, P, T, s };
  });
}

const stateList = (cycle) => cycle.states.map((st, i) => ({ label: String(i + 1), T: st.T, P: st.P, v: st.v, s: st.s }));

const memo = new Map();
function cached(key, fn) {
  if (!memo.has(key)) { if (memo.size > 64) memo.clear(); memo.set(key, fn()); }
  return memo.get(key);
}

/** Siklus ideal untuk jenis + parameter slider; `init` opsional (T1, P1, qin) untuk pembanding real. */
export function idealCycle(s, init = {}) {
  const r = s.cR;
  switch (s.cKind) {
    case 'otto': return otto({ r, ...init });
    case 'diesel': return diesel({ r, rc: s.cRc, ...init });
    case 'dual': return dual({ r, rp: s.cRp, rc: s.cRc, ...init });
    default: return braytonIdeal({ rp: s.cRpB, T3: s.cT3 });
  }
}

function idealPack(s, init, tag) {
  const key = `${tag}|${s.cKind}|${s.cR}|${s.cRc}|${s.cRp}|${s.cRpB}|${s.cT3}|${JSON.stringify(init)}`;
  return cached(key, () => {
    const cycle = idealCycle(s, init);
    return { cycle, procs: procsFromCycle(cycle), states: stateList(cycle) };
  });
}

function braytonRealPack(s) {
  return cached(`br|${s.cRpB}|${s.cT3}`, () => {
    const cycle = braytonReal({ rp: s.cRpB, T3: s.cT3 });
    return { cycle, procs: procsFromCycle(cycle), states: stateList(cycle) };
  });
}

const realCache = new WeakMap();
/** Polyline fase tertutup cylinderSim (IVC→EVO) + titik acuan 1–4. */
function realPistonPack(sim) {
  let p = realCache.get(sim);
  if (p) return p;
  const { v, s } = simStates(sim);
  const n = sim.th.length;
  const iTheta0 = Math.max(0, sim.th.findIndex((t) => t >= sim.params.theta0));
  let iPmax = 0;
  for (let i = 0; i < n; i++) if (sim.P[i] > sim.P[iPmax]) iPmax = i;
  const at = (i, label, noteKey) => ({ label, noteKey, T: sim.T[i], P: sim.P[i], v: v[i], s: s[i], theta: sim.th[i] });
  p = {
    procs: [
      { type: 'real', role: 'real', v, P: sim.P, T: sim.T, s },
      { type: 'closing', role: 'closing', v: Float64Array.of(v[n - 1], v[0]), P: Float64Array.of(sim.P[n - 1], sim.P[0]), T: Float64Array.of(sim.T[n - 1], sim.T[0]), s: Float64Array.of(s[n - 1], s[0]) },
    ],
    states: [at(0, '1', 'ivc'), at(iTheta0, '2', 'soc'), at(iPmax, '3', 'pmax'), at(n - 1, '4', 'evo')],
    v, s,
  };
  realCache.set(sim, p);
  return p;
}

// ── titik berjalan ──

/** Interpolasi pada polyline proses `pr` di indeks j + u (u∈[0,1]). */
function onProc(pr, procIndex, j, u) {
  const k = Math.min(j + 1, pr.v.length - 1);
  return { proc: procIndex, j, u, v: lerp(pr.v[j], pr.v[k], u), P: lerp(pr.P[j], pr.P[k], u), T: lerp(pr.T[j], pr.T[k], u), s: lerp(pr.s[j], pr.s[k], u) };
}

/** Cari titik pada proses dengan volume spesifik v (proses monoton terhadap v). */
function locateByV(pr, procIndex, v) {
  const m = pr.v.length;
  const inc = pr.v[m - 1] >= pr.v[0];
  for (let j = 0; j < m - 1; j++) {
    const a = pr.v[j], b = pr.v[j + 1];
    if ((inc && v >= a && v <= b) || (!inc && v <= a && v >= b)) return onProc(pr, procIndex, j, b === a ? 0 : (v - a) / (b - a));
  }
  // di luar rentang (pembulatan): ambil ujung terdekat
  return Math.abs(v - pr.v[0]) <= Math.abs(v - pr.v[m - 1]) ? onProc(pr, procIndex, 0, 0) : onProc(pr, procIndex, m - 2, 1);
}

/**
 * Siklus ideal piston: θ → volume piston (geometri mesin pada r yang sama) → titik di kurva.
 * −180…0: kompresi 1→2. 0…180: proses setelah TDC (isokorik = lompatan di TDC/BDC).
 * Di luar itu (langkah buang/isap): siklus air-standard tidak punya pertukaran gas → titik di state 1.
 */
export function idealPistonPoint(procs, states, theta, geo) {
  const vr = geo.V(theta) / geo.V(180);
  const v = states[0].v * vr;
  if (theta >= -180 && theta < 0) return { ...locateByV(procs[0], 0, v), stroke: 'compression' };
  if (theta >= 0 && theta <= 180) {
    for (let i = 1; i < procs.length - 1; i++) {
      const pr = procs[i];
      if (pr.type === 'isochoric') continue;
      const lo = Math.min(pr.v[0], pr.v[pr.v.length - 1]), hi = Math.max(pr.v[0], pr.v[pr.v.length - 1]);
      if (v >= lo - 1e-12 && v <= hi + 1e-12) return { ...locateByV(pr, i, v), stroke: 'expansion' };
    }
    const last = procs[procs.length - 2];
    return { ...onProc(last, procs.length - 2, last.v.length - 2, 1), stroke: 'expansion' };
  }
  const st = states[0];
  return { proc: -1, j: 0, u: 0, v: st.v, P: st.P, T: st.T, s: st.s, stroke: 'exchange' };
}

/** Brayton: θ −360…360 dipetakan ke 4 proses (180° per proses), titik di sepanjang sampel proses. */
export function braytonPoint(procs, theta) {
  const u = clamp((theta + 360) / 180, 0, 3.999999);
  const i = Math.floor(u), t = u - i;
  const pr = procs[i];
  const f = t * (pr.v.length - 1), j = Math.min(pr.v.length - 2, Math.floor(f));
  return { ...onProc(pr, i, j, f - j), stroke: 'flow', t };
}

/** Real piston: titik dari array cylinderSim + simStates (interpolasi sama dengan sampleSim). */
function realPistonPoint(sim, pack, theta) {
  const th = sim.th, n = th.length, lo = th[0], hi = th[n - 1];
  if (theta < lo || theta > hi) return null;
  const f = ((theta - lo) / (hi - lo)) * (n - 1), j = Math.min(n - 2, Math.floor(f));
  return onProc(pack.procs[0], 0, j, f - j);
}

// ── frame ──

const geoCache = new Map();
function geometryFor(engine, r) {
  const k = `${engine}|${r}`;
  if (!geoCache.has(k)) { if (geoCache.size > 64) geoCache.clear(); geoCache.set(k, engineGeometry({ ...ENGINES[engine].params, r })); }
  return geoCache.get(k);
}

let keyNumbersCache = null;
/** Angka pesan kunci dari model: awal & akhir waterfall (window preset) gas dan diesel. */
export function keyNumbers() {
  if (!keyNumbersCache) {
    const g = lossWaterfall('gas', {}, { window: 'preset' }), d = lossWaterfall('diesel', {}, { window: 'preset' });
    keyNumbersCache = { idealLo: g[0].eta, idealHi: d[0].eta, brakeLo: g[g.length - 1].eta, brakeHi: d[d.length - 1].eta };
  }
  return keyNumbersCache;
}

/**
 * @param {any} s  state store (key c*, theta, rpmVisual)
 * @param {{sim?: any, waterfall?: any[]}} ctx  hasil Worker (cylinderSim mesin pembanding, lossWaterfall)
 */
export function deriveCycles(s, { sim = null, waterfall = null } = {}) {
  const kind = s.cKind, mode = s.cMode, theta = s.theta;
  const isPiston = kind !== 'brayton';
  const engine = engineOf(kind);
  const notes = [];
  const knockMax = ENGINES.gas.ranges.r.max;
  // catatan sebagai kunci + parameter; teks di ui/strings.js (scene2.notes)
  if (kind === 'otto' && s.cR > knockMax && mode === 'ideal') notes.push({ key: 'knockIdeal', rMax: knockMax });
  if (kind === 'otto' && mode === 'real') notes.push({ key: 'knockReal', rMax: knockMax });

  const out = { kind, mode, theta, isPiston, engine, notes, tempScale: TEMP_SCALE };
  const ideal = idealPack(s, {}, 'ideal');

  if (!isPiston) {
    const real = mode === 'real' ? braytonRealPack(s) : null;
    const main = real ?? ideal;
    const pt = braytonPoint(main.procs, theta);
    Object.assign(out, {
      modelLevel: real ? 'real' : 'ideal',
      procSet: real ? 'braytonReal' : 'brayton',
      procs: main.procs, states: main.states, ghost: real ? ideal.procs : null,
      point: { ...pt, visible: true, labelKey: 'proc' },
      rig: null,
      schematic: { proc: pt.proc, t: pt.t, T: pt.T, gasRGB: tempToRGB(pt.T, TEMP_SCALE.min, TEMP_SCALE.max),
        stations: main.states.map((st) => ({ label: st.label, T: st.T, rgb: tempToRGB(st.T, TEMP_SCALE.min, TEMP_SCALE.max) })) },
      eta: {
        ideal: ideal.cycle.eta, real: real?.cycle.eta ?? null, gap: real ? ideal.cycle.eta - real.cycle.eta : null,
        bwr: (real ?? ideal).cycle.backWorkRatio, wnet: (real ?? ideal).cycle.wnet,
        T2: real?.cycle.T2 ?? ideal.states[1].T, T4: real?.cycle.T4 ?? ideal.states[3].T,
      },
      waterfall: [
        { key: 'braytonIdeal', eta: ideal.cycle.eta, delta: 0 },
        ...(real ? [{ key: 'braytonReal', eta: real.cycle.eta, delta: real.cycle.eta - ideal.cycle.eta }] : []),
      ],
      waterfallLevel: real ? 'real' : 'ideal',
    });
    return out;
  }

  // ── piston ──
  const preset = ENGINES[engine].params;
  if (mode === 'ideal' || !sim) {
    const geo = geometryFor(engine, s.cR);
    const pt = idealPistonPoint(ideal.procs, ideal.states, theta, geo);
    const pr = pt.proc >= 0 ? ideal.procs[pt.proc] : null;
    const isochoricHeat = ideal.procs.findIndex((p, i) => i > 0 && p.type === 'isochoric' && i < ideal.procs.length - 1) >= 0;
    const heatNow = (pr && pr.type === 'isobaric') || (isochoricHeat && theta >= 0 && theta < HEAT_FLASH_DEG);
    const hc = geo.Vc / geo.A;
    out.rig = {
      fuel: preset.fuel, theta, pistonPos: geo.pistonPos(theta), T: pt.T,
      gasRGB: tempToRGB(pt.T, TEMP_SCALE.min, TEMP_SCALE.max),
      valveIn: valveLift(theta, -360, -180), valveEx: valveLift(theta, 180, 360), // air-standard: tanpa overlap
      // visual pembakaran: Otto = kilasan muka nyala di TDC; Diesel/Dual = semburan selama pemanasan
      dxbNorm: heatNow ? 1 : 0, xb: heatNow && kind === 'otto' ? theta / HEAT_FLASH_DEG : 0,
      flameRGB: flameColor(preset.phi), tempScale: TEMP_SCALE,
      geom: { bore: geo.bore, stroke: geo.stroke, conrod: geo.conrod, a: geo.a, hc, theta0: 0 },
    };
    Object.assign(out, {
      modelLevel: 'ideal',
      procSet: kind,
      procs: ideal.procs, states: ideal.states, ghost: null,
      point: { ...pt, visible: true, labelKey: pt.stroke === 'exchange' ? 'exchangeIdeal' : 'proc' },
      eta: {
        ideal: ideal.cycle.eta, mep: ideal.cycle.mep, qin: ideal.cycle.qin,
        Tmax: Math.max(...ideal.states.map((x) => x.T)), Pmax: Math.max(...ideal.states.map((x) => x.P)),
        ottoSameR: kind !== 'otto' ? otto({ r: s.cR }).eta : null,
      },
    });
  } else {
    const pack = realPistonPack(sim);
    const q = sim.params;
    const qin = sim.Qtot / sim.mass; // panas pembakaran real per kg muatan (J/kg)
    const ghost = kind === 'dual' ? null : idealPack(s, { T1: q.Tivc, P1: q.Pivc, qin }, 'ghost');
    const ref = ghost ?? ideal; // Dual: pembanding = ideal pada rp, rc slider (q_in tidak disamakan)
    const pt = realPistonPoint(sim, pack, theta);
    out.rig = deriveEngine({ theta, rpmVisual: s.rpmVisual, engine }, sim);
    if (kind === 'dual') notes.push({ key: 'dualRef' });
    Object.assign(out, {
      modelLevel: 'semiEmpirical',
      procSet: 'real',
      procs: pack.procs, states: pack.states, ghost: ghost ? ghost.procs : null,
      point: pt ? { ...pt, visible: true, labelKey: 'closedReal' } : { visible: false, labelKey: 'exchangeReal' },
      eta: {
        ideal: ref.cycle.eta, ind: sim.etaInd, brake: sim.etaBrake, gap: ref.cycle.eta - sim.etaBrake, gapInd: ref.cycle.eta - sim.etaInd,
        Pmax: sim.Pmax, Tmax: sim.Tmax, qin, rcGhost: ghost && kind === 'diesel' ? ghost.cycle.rc : null, rReal: q.r,
      },
    });
  }
  out.waterfall = waterfall;
  out.waterfallLevel = 'semiEmpirical';
  out.waterfallEngine = engine;
  out.rEngine = rEngine(s);
  return out;
}
