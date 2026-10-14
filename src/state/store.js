/**
 * store.js — store reaktif kecil, sumber kebenaran tunggal untuk parameter UI.
 * Alur: UI control → store.set → derive() → frame → { rig 3D, chart, HUD }.
 */
import { ENGINES, RPM_VISUAL, CYCLES } from '../model/presets.js';

/**
 * @typedef {Object} AppState
 * @property {'diesel'|'gas'} engine
 * @property {number} r        rasio kompresi
 * @property {number} phi      rasio ekuivalen global
 * @property {number} theta0   awal pembakaran (° ATDC, negatif = sebelum TDC)
 * @property {number} theta    sudut engkol saat ini (°), −360…+360
 * @property {number} rpmVisual rpm animasi (slow-motion)
 * @property {boolean} playing
 * @property {boolean} frozen   beku: waktu berhenti, θ terkunci (slider θ & Spasi tidak berlaku)
 */

/** State default untuk satu jenis mesin (nilai dari preset thermo.js). */
export function defaultState(engine = 'diesel') {
  const p = ENGINES[engine].params;
  return { engine, r: p.r, phi: p.phi, theta0: p.theta0, theta: -360, rpmVisual: RPM_VISUAL.default, playing: true, frozen: false };
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

/** Patch "reset parameter" (tombol R): kembali ke preset mesin aktif, θ dan mesin tetap. */
export function resetPatch(s) {
  const d = defaultState(s.engine);
  return { r: d.r, phi: d.phi, theta0: d.theta0, rpmVisual: d.rpmVisual };
}

/** Patch ganti mesin: parameter ke preset mesin baru; θ dan status animasi dipertahankan. */
export function engineSwitchPatch(s, engine) {
  return { ...defaultState(engine), theta: s.theta, rpmVisual: s.rpmVisual, playing: s.playing, frozen: s.frozen };
}

/*
 * Jeda vs beku (dipisah):
 *  - Spasi = jeda/putar animasi. Saat jeda, θ masih bisa digeser lewat slider.
 *  - F     = beku: waktu berhenti DAN θ terkunci (slider θ & Spasi diabaikan) agar presenter
 *            bisa menunjuk satu state; melepas beku kembali ke status putar/jeda sebelumnya.
 */

/** Patch tombol Spasi. Diabaikan ({}) saat beku. */
export const togglePlayPatch = (s) => (s.frozen ? {} : { playing: !s.playing });

/** Patch tombol F. */
export const toggleFreezePatch = (s) => ({ frozen: !s.frozen });

/** Patch slider θ: menjeda animasi; diabaikan ({}) saat beku. */
export const scrubPatch = (s, theta) => (s.frozen ? {} : { theta, playing: false });

/** Patch langkah waktu: θ maju 6·rpm·dt derajat bila berputar dan tidak beku. */
export function tickPatch(s, dt) {
  if (!s.playing || s.frozen) return {};
  return { theta: ((((s.theta + 6 * s.rpmVisual * dt + 360) % 720) + 720) % 720) - 360 };
}

// ── Scene 2 (siklus) — key terpisah dari Scene 1 agar slider tidak saling memengaruhi ──

/** Default parameter siklus untuk satu jenis (input golden test). */
export function cycleDefaults(kind = 'otto') {
  const d = CYCLES[kind].defaults;
  return {
    cKind: kind,
    cR: d.r ?? CYCLES.otto.defaults.r,
    cRc: d.rc ?? CYCLES.diesel.defaults.rc,
    cRp: d.rp ?? CYCLES.dual.defaults.rp,
    cRpB: d.rpB ?? CYCLES.brayton.defaults.rpB,
    cT3: d.T3 ?? CYCLES.brayton.defaults.T3,
  };
}

/** State awal Scene 2 (mode Ideal, Otto). */
export const cycleInitialState = () => ({ ...cycleDefaults('otto'), cMode: 'ideal' });

/** Rentang r untuk jenis + mode: mode Real memakai rentang mesin nyata pembanding. */
export function cycleRRange(kind, mode) {
  const c = CYCLES[kind];
  if (!c.engine || mode !== 'real') return c.ranges.r;
  return ENGINES[c.engine].ranges.r;
}

const clampTo = (v, r) => Math.min(r.max, Math.max(r.min, v));

/** Patch ganti jenis siklus: parameter ke default jenis tsb (mode dipertahankan, r di-clamp). */
export function cycleKindPatch(s, kind) {
  const d = cycleDefaults(kind);
  const rr = cycleRRange(kind, s.cMode);
  return rr ? { ...d, cR: clampTo(d.cR, rr) } : d;
}

/** Patch toggle Ideal ↔ Real: r di-clamp ke rentang mode baru. */
export function cycleModePatch(s, mode) {
  const rr = cycleRRange(s.cKind, mode);
  return rr ? { cMode: mode, cR: clampTo(s.cR, rr) } : { cMode: mode };
}
