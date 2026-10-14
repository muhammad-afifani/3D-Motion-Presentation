/**
 * deriveFlame.js — state Scene 3 → frame (pembakaran, φ, suhu nyala).
 * Semua angka dari thermo.js: flameTemperature, flameColor, cylinderSim/sampleSim (piston),
 * braytonReal (T₂ turbin), qinPerKgAir (pelepasan panas zona premix).
 */
import {
  cylinderSim, sampleSim, flameTemperature, flameColor, braytonReal, qinPerKgAir, phiFromQinPerKgAir,
} from '../model/thermo.js';
import { ENGINES, FLAME_MODES, FLAME_RANGES } from '../model/presets.js';
import { derive as deriveEngine, cycleCurve } from './derive.js';

/** Titik patah tabel T_ad (φ) dan faktor preheat di thermo.js → kurva polyline = fungsi persis. */
const PHI_BREAKS = [0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.05, 1.1, 1.2, 1.4, 1.6];
const FOCUS_PAD = 15; // ° sebelum θ0 dan sesudah akhir pembakaran (jendela fokus)

/** Grid φ kurva: titik patah dalam rentang + grid rata 0,01 (berurutan, unik). */
export function phiGrid(min = FLAME_RANGES.phi.min, max = FLAME_RANGES.phi.max) {
  const set = new Set();
  for (let i = 0; Math.round(min * 100) + i <= Math.round(max * 100); i++) set.add((Math.round(min * 100) + i) / 100);
  for (const b of PHI_BREAKS) if (b >= min && b <= max) set.add(b);
  return [...set].sort((a, b) => a - b);
}
const GRID = phiGrid();

/** Kurva T_ad(φ) pada suhu masuk Tin. */
export function flameCurve(Tin, fuel) {
  const phi = Float64Array.from(GRID), T = new Float64Array(GRID.length);
  for (let i = 0; i < GRID.length; i++) T[i] = flameTemperature(GRID[i], Tin, fuel);
  return { phi, T, Tin, fuel };
}

// ── job berat (Worker): cylinderSim mesin piston pada φ slider (tanpa NOx; tidak dipakai di Scene 3) ──
export const flameSimParams = (s) => {
  const m = FLAME_MODES[s.fMode];
  return { ...ENGINES[m.engine].params, phi: s.fPhi, ...(m.phiLocal != null ? { phiLocal: s.fPhiLocal } : {}), nox: false };
};
export const flameSimKey = (s) => (FLAME_MODES[s.fMode].engine ? `${s.fMode}|${s.fPhi}|${s.fPhiLocal}` : 'none');

const memo = new Map();
const cached = (k, fn) => { if (!memo.has(k)) memo.set(k, fn()); return memo.get(k); };

/** Simulasi preset (φ preset) — untuk suhu masuk model & bar perbandingan. */
const presetSim = (engine) => cached(`preset|${engine}`, () => cylinderSim({ ...ENGINES[engine].params, nox: false }));
/** Simulasi acuan φ = maks slider — normalisasi laju pelepasan panas (nyala terbesar = 1). */
const refSim = (engine) => cached(`ref|${engine}`, () => cylinderSim({ ...ENGINES[engine].params, phi: FLAME_RANGES.phi.max, nox: false }));
const turbineRef = () => cached('brayton', () => braytonReal({}));

/** Suhu campuran masuk dari model: piston = T gas saat θ0 (akhir kompresi, belum terbakar); turbin = T₂. */
export function modelTin(mode) {
  const m = FLAME_MODES[mode];
  if (!m.engine) return turbineRef().T2;
  const sim = presetSim(m.engine);
  return sampleSim(sim, sim.params.theta0).T;
}

/** Jendela fokus pembakaran (°) untuk mode piston. */
export function focusWindow(mode) {
  const m = FLAME_MODES[mode];
  if (!m.engine) return null;
  const p = ENGINES[m.engine].params;
  return { lo: p.theta0 - FOCUS_PAD, hi: p.theta0 + p.dur + FOCUS_PAD };
}

/** Entri bar perbandingan suhu nyala zona reaksi (mode aktif memakai slider). */
function comparison(s, Tin) {
  const row = (mode, phi) => {
    const m = FLAME_MODES[mode];
    const tin = s.fMode === mode ? Tin : modelTin(mode);
    return { mode, phi, Tin: tin, T: flameTemperature(phi, tin, m.fuel), color: flameColor(phi), active: s.fMode === mode };
  };
  return [
    row('diesel', s.fMode === 'diesel' ? s.fPhiLocal : FLAME_MODES.diesel.phiLocal),
    row('gas', s.fMode === 'gas' ? s.fPhi : FLAME_MODES.gas.phi),
    row('turbine', s.fMode === 'turbine' ? s.fPhi : FLAME_MODES.turbine.phi),
  ];
}

/**
 * @param {any} s state store (key f*, theta, rpmVisual, engine shared keys tidak dipakai)
 * @param {{sim?: any}} ctx  cylinderSim mesin piston pada φ slider (Worker)
 */
export function deriveFlame(s, { sim = null } = {}) {
  const mode = s.fMode, m = FLAME_MODES[mode], fuel = m.fuel;
  const Tmodel = modelTin(mode);
  const Tin = s.fTin ?? Tmodel;
  const phi = s.fPhi;
  const phiLocal = mode === 'diesel' ? s.fPhiLocal : null;
  const curve = flameCurve(Tin, fuel);
  const curve300 = flameCurve(300, fuel);

  // labelKey → teks di ui/strings.js (scene3.points)
  const main = { labelKey: mode === 'diesel' ? 'phiGlobalHypo' : mode === 'turbine' ? 'phiPremix' : 'phiMixture', phi, T: flameTemperature(phi, Tin, fuel) };
  const points = [main];
  if (phiLocal != null) points.push({ labelKey: 'phiLocal', phi: phiLocal, T: flameTemperature(phiLocal, Tin, fuel), local: true });
  // T nyala yang benar-benar terjadi di zona reaksi: diesel = φ lokal; lainnya = φ campuran
  const zone = points[points.length - 1];

  const out = {
    mode, fuel, theta: s.theta, Tin, TinModel: Tmodel, TinManual: s.fTin != null,
    phi, phiLocal, curve, curve300, points,
    Tflame: zone.T, // suhu nyala adiabatik saat terbakar (bukan suhu puncak zona terbakar Scene 4)
    dTlocal: phiLocal != null ? zone.T - main.T : null,
    preheatGain: (main.T - flameTemperature(phi, 300, fuel)) / (Tin - 300 || 1),
    color: flameColor(phi),
    coreColor: flameColor(zone.phi),
    outerColor: flameColor(phi),
    bars: comparison(s, Tin),
    modelLevel: 'semiEmpirical',
    focus: focusWindow(mode),
  };

  if (!m.engine) {
    const q = qinPerKgAir(phi, fuel), qMax = qinPerKgAir(FLAME_RANGES.phi.max, fuel);
    const b = turbineRef();
    Object.assign(out, {
      intensity: q / qMax, qin: q, rig: null,
      phiOverall: phiFromQinPerKgAir(b.qin, 'gas', b.params.combEff), T3: b.T3,
    });
    return out;
  }

  // piston: laju pelepasan panas dQ/dθ = Qtot·dxb/dθ, dinormalisasi ke φ maks slider
  const use = sim ?? presetSim(m.engine);
  const ref = refSim(m.engine);
  const f = deriveEngine({ theta: s.theta, rpmVisual: s.rpmVisual, animSpeed: s.animSpeed, engine: m.engine }, use);
  const dQ = use.Qtot * f.dxb, dQref = ref.Qtot * cycleCurve(ref).dxbMax;
  Object.assign(out, {
    intensity: Math.min(1, dQ / dQref), dQdTheta: dQ, qin: qinPerKgAir(use.params.phi, fuel), simPhi: use.params.phi,
    rig: { pistonPos: f.pistonPos, xb: f.xb, theta: s.theta, theta0: use.params.theta0, geom: f.geom, phase: f.phase },
  });
  return out;
}
