/**
 * derive.js — jembatan state → frame. Satu-satunya tempat yang memanggil thermo.js
 * untuk scene. Rig 3D, chart, dan HUD hanya membaca `frame` hasil fungsi ini.
 */
import { cylinderSim, sampleSim, valveLift, engineGeometry } from '../model/thermo.js';
import { ENGINES } from '../model/presets.js';

/** Kunci state yang memicu hitung ulang cylinderSim (perubahan θ saja tidak). */
export const SIM_KEYS = ['engine', 'r', 'phi', 'theta0'];

/** Parameter cylinderSim dari state UI. */
export function simParams(state) {
  return { ...ENGINES[state.engine].params, r: state.r, phi: state.phi, theta0: state.theta0 };
}

export const simKey = (state) => SIM_KEYS.map((k) => state[k]).join('|');

/** Jalankan simulasi silinder untuk state (sinkron; versi Worker ada di simClient). */
export function runSim(state) {
  return cylinderSim(simParams(state));
}

/**
 * Bentuk ulang hasil cylinderSim yang dikirim tanpa fungsi (mis. dari Web Worker):
 * `geo` berisi fungsi sehingga dibangun ulang dari params di sisi penerima.
 */
export function hydrateSim(packed) {
  return { ...packed, geo: engineGeometry(packed.params) };
}

/**
 * @typedef {Object} Frame
 * @property {number} theta  sudut engkol (°)
 * @property {number} V      volume silinder (m³)
 * @property {number} P      tekanan (Pa)
 * @property {number} T      suhu rata-rata gas (K)
 * @property {number|null} s entropi (belum tersedia untuk silinder; null)
 * @property {number} xb     fraksi terbakar
 * @property {number} dxb    laju pembakaran (1/°)
 * @property {string} phase  intake | kompresi | ekspansi | exhaust
 * @property {number} pistonPos posisi piston dari TDC (m)
 */

/**
 * Hitung frame untuk satu sudut engkol dari state + hasil simulasi yang sama.
 * @param {import('./store.js').AppState} state
 * @param {ReturnType<typeof cylinderSim>} sim
 * @returns {Frame & Record<string, any>}
 */
export function derive(state, sim) {
  const theta = state.theta;
  const q = sim.params, geo = sim.geo;
  const st = sampleSim(sim, theta);
  // laju pembakaran dari kurva xb model (beda hingga terpusat, selang 1°)
  const dxb = Math.max(0, sampleSim(sim, Math.min(theta + 0.5, 359.99)).xb - sampleSim(sim, Math.max(theta - 0.5, -360)).xb);

  return {
    kind: 'engine',
    engine: state.engine,
    fuel: q.fuel,
    theta,
    V: st.V, P: st.P, T: st.T, s: null, xb: st.xb, dxb,
    phase: st.phase,
    pistonPos: st.pistonPos,
    valveIn: valveLift(theta, -360, q.ivc),
    valveEx: valveLift(theta, q.evo, 360),
    phi: q.phi,
    phiLocal: q.phiLocal ?? q.phi,
    Tflame: sim.TburnedMax ?? null,
    // emisi (indikatif; NOx terkalibrasi ENGINE_NOX_CALIB)
    NOx: { gkWh: sim.NOx_gkWh ?? null, ppm: sim.NOx_ppmvd_ref ?? null, refO2: q.refO2 ?? 15, calib: q.calib ?? 1 },
    CO: null, // tidak dimodelkan untuk engine
    CO2: { gkWh: sim.co2_gkWh },
    PM: null, // kualitatif (Scene 8)
    eta: { ind: sim.etaInd, brake: sim.etaBrake },
    power: sim.powerKW * 1e3,
    load: 1,
    N: q.N,
    summary: {
      Pmax: sim.Pmax, thetaPmax: sim.thetaPmax, imepG: sim.imepG, bmep: sim.bmep,
      etaInd: sim.etaInd, etaBrake: sim.etaBrake, bsfc: sim.bsfc, Tmax: sim.Tmax,
    },
    geom: {
      bore: geo.bore, stroke: geo.stroke, conrod: geo.conrod, a: geo.a, A: geo.A,
      Vd: geo.Vd, Vc: geo.Vc, r: geo.r, ivc: q.ivc, evo: q.evo, theta0: q.theta0,
    },
    modelLevel: 'Semi-empiris',
  };
}
