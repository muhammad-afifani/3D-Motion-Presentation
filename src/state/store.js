/**
 * store.js — store reaktif kecil, sumber kebenaran tunggal untuk parameter UI.
 * Alur: UI control → store.set → derive() → frame → { rig 3D, chart, HUD }.
 */
import { ENGINES, RPM_VISUAL } from '../model/presets.js';

/**
 * @typedef {Object} AppState
 * @property {'diesel'|'gas'} engine
 * @property {number} r        rasio kompresi
 * @property {number} phi      rasio ekuivalen global
 * @property {number} theta0   awal pembakaran (° ATDC, negatif = sebelum TDC)
 * @property {number} theta    sudut engkol saat ini (°), −360…+360
 * @property {number} rpmVisual rpm animasi (slow-motion)
 * @property {boolean} playing
 */

/** State default untuk satu jenis mesin (nilai dari preset thermo.js). */
export function defaultState(engine = 'diesel') {
  const p = ENGINES[engine].params;
  return { engine, r: p.r, phi: p.phi, theta0: p.theta0, theta: -360, rpmVisual: RPM_VISUAL.default, playing: true };
}

/**
 * @template S
 * @param {S} initial
 */
export function createStore(initial) {
  let state = { ...initial };
  /** @type {Set<(s:S, prev:S, changed:string[]) => void>} */
  const subs = new Set();

  /** @param {Partial<S> | ((s:S) => Partial<S>)} patch */
  function set(patch) {
    const prev = state;
    const delta = typeof patch === 'function' ? patch(state) : patch;
    const next = { ...state, ...delta };
    const changed = Object.keys(delta).filter((k) => next[k] !== prev[k]);
    if (!changed.length) return;
    state = next;
    for (const fn of subs) fn(state, prev, changed);
  }

  return {
    get: () => state,
    set,
    /** @param {(s:S, prev:S, changed:string[]) => void} fn */
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    /** Kembali ke default; `override` opsional (mis. pertahankan pilihan mesin). */
    reset(override = {}) { set({ ...initial, ...override }); },
  };
}
