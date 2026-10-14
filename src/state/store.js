/**
 * store.js — store reaktif kecil, sumber kebenaran tunggal untuk parameter UI.
 * Alur: UI control → store.set → derive() → frame → { rig 3D, chart, HUD }.
 */
import { ENGINES, RPM_VISUAL, ANIM_SPEED, CYCLES, FLAME_MODES, GAS_TURBINES, EMISSION_BASIS, NOX_CALIB_DEFAULTS, LOAD_RANGE, GAS_COMPRESSOR } from '../model/presets.js';

/**
 * @typedef {Object} AppState
 * @property {'diesel'|'gas'} engine
 * @property {number} r        rasio kompresi
 * @property {number} phi      rasio ekuivalen global
 * @property {number} theta0   awal pembakaran (° ATDC, negatif = sebelum TDC)
 * @property {number} theta    sudut engkol saat ini (°), −360…+360
 * @property {number} rpmVisual rpm visual dasar (pada Animation speed 1×)
 * @property {number} animSpeed  Animation speed 0,1×–2× (global; loop utama mengalikan dt)
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
    /** Jumlah subscriber aktif (uji dispose antar-scene). */
    subscriberCount: () => subs.size,
    /** Kembali ke default; `override` opsional (mis. pertahankan pilihan mesin). */
    reset(override = {}) { set({ ...initial, ...override }); },
  };
}

/** Animation speed global (M8a): satu kontrol bersama di semua scene beranimasi. */
export const animInitialState = () => ({ animSpeed: ANIM_SPEED.default });
/** Patch Animation speed: di-clamp ke 0,1×–2× dan dibulatkan ke step; input tak valid diabaikan. */
export function animSpeedPatch(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return {};
  const k = Math.round(Math.min(ANIM_SPEED.max, Math.max(ANIM_SPEED.min, n)) / ANIM_SPEED.step) * ANIM_SPEED.step;
  return { animSpeed: Math.round(k * 10) / 10 };
}

/** Patch "reset parameter" (tombol R): kembali ke preset mesin aktif, θ dan mesin tetap; Animation speed ke 1×. */
export function resetPatch(s) {
  const d = defaultState(s.engine);
  return { r: d.r, phi: d.phi, theta0: d.theta0, rpmVisual: d.rpmVisual, ...animInitialState() };
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

// ── Scene 3 (pembakaran) ──

/** Default Scene 3 untuk satu mode. fTin = null → suhu masuk dari model (lihat deriveFlame). */
export function flameDefaults(mode = 'diesel') {
  const m = FLAME_MODES[mode];
  return { fMode: mode, fPhi: m.phi, fPhiLocal: m.phiLocal ?? FLAME_MODES.diesel.phiLocal, fTin: null };
}

/** State awal Scene 3 (termasuk preferensi tampilan). */
export const flameInitialState = () => ({ ...flameDefaults('diesel'), fFocus: true });

/** Langkah waktu yang berputar di jendela [lo, hi) (fokus jendela pembakaran); hormati jeda/beku. */
export function tickWindowPatch(s, dt, lo, hi) {
  if (!s.playing || s.frozen) return {};
  const span = hi - lo;
  let th = s.theta < lo || s.theta >= hi ? lo : s.theta + 6 * s.rpmVisual * dt;
  if (th >= hi) th = lo + ((th - lo) % span);
  return { theta: th };
}

// ── Global: tampilan (M8b) — hanya visual; derive* tidak membaca kunci ini ──
export const QUALITY_ORDER = Object.freeze(['auto', 'high', 'low']);
export const BLOOM_ORDER = Object.freeze(['auto', 'on', 'off']);
/** Quality (Auto/High/Low) dan Bloom (Auto/On/Off) global; qTier = tier efektif dari pengontrol (tidak disimpan). */
export const displayInitialState = () => ({ quality: 'auto', bloomMode: 'auto', qTier: 0 });
const cycle = (order, v) => order[(order.indexOf(v) + 1) % order.length];
/** Patch tombol B (semua scene): Auto → On → Off → Auto. */
export const bloomCyclePatch = (s) => ({ bloomMode: cycle(BLOOM_ORDER, s.bloomMode) });
/** Patch tombol Q: Auto → High → Low → Auto. */
export const qualityCyclePatch = (s) => ({ quality: cycle(QUALITY_ORDER, s.quality) });
/** Patch pengaturan tampilan dari panel H / data tersimpan; nilai tak dikenal diabaikan. */
export function displayPatch({ quality, bloomMode } = {}) {
  const out = {};
  if (QUALITY_ORDER.includes(quality)) out.quality = quality;
  if (BLOOM_ORDER.includes(bloomMode)) out.bloomMode = bloomMode;
  return out;
}

// ── Scene 5 (turbin gas) ──

/** Default parameter turbin gas per konfigurasi (nilai desain dari presets = default thermo.js). */
export function gtDefaults(cfg = 'generator') {
  const d = GAS_TURBINES[cfg].design;
  return {
    gCfg: cfg, gRp: d.rp, gT3: d.T3, gEtaC: d.etaC,
    gEtaT: d.etaT ?? GAS_TURBINES.generator.design.etaT,
    gEtaGG: d.etaGG ?? GAS_TURBINES.compressorDrive.design.etaGG,
    gEtaPT: d.etaPT ?? GAS_TURBINES.compressorDrive.design.etaPT,
  };
}
/** State awal Scene 5 (ambient ISO 15 °C). */
export const gtInitialState = () => ({ ...gtDefaults('generator'), gTamb: 15 });

// ── Scene 4 (NOx) — key terpisah: n* ──

/** Default Scene 4 per engine: timing = preset thermo.js (θ0). */
export const noxDefaults = (engine = 'diesel') => ({ nEngine: engine, nTheta0: ENGINES[engine].params.theta0 });
/** State awal Scene 4. */
export const noxInitialState = () => noxDefaults('diesel');

// ── Global: basis emisi & kalibrasi NOx (M4b) — dipakai semua scene yang menampilkan NOx ──

/** Basis tampilan ppm / mg/Nm³ (panel H). */
export const basisInitialState = () => ({ emRefO2: EMISSION_BASIS.refO2.default, emTrefC: EMISSION_BASIS.TrefC.default });
/** Patch basis: O₂ di-clamp ke 3–20 %, basis volume hanya 0 atau 25 °C; input tak valid diabaikan. */
export function basisPatch({ refO2, TrefC } = {}) {
  const out = {};
  const R = EMISSION_BASIS.refO2;
  if (refO2 != null && Number.isFinite(Number(refO2))) out.emRefO2 = Math.min(R.max, Math.max(R.min, Number(refO2)));
  if (TrefC != null && EMISSION_BASIS.TrefC.options.includes(Number(TrefC))) out.emTrefC = Number(TrefC);
  return out;
}
export const basisResetPatch = () => basisInitialState();
export const isDefaultBasis = (s) => s.emRefO2 === EMISSION_BASIS.refO2.default && s.emTrefC === EMISSION_BASIS.TrefC.default;

/** Kalibrasi NOx global: faktor engine per jenis + faktor DLN per konfigurasi turbin (single / twin, Scene 6). */
export const calibInitialState = () => ({ calEngine: { ...NOX_CALIB_DEFAULTS.engine }, calDln: { ...NOX_CALIB_DEFAULTS.dln } });
export const calibEnginePatch = (s, engine, calib) => ({ calEngine: { ...s.calEngine, [engine]: calib } });
/** @param {'single'|'twin'} cfg */
export const calibDlnPatch = (s, cfg, calib) => ({ calDln: { ...s.calDln, [cfg]: calib } });
export const calibResetPatch = () => calibInitialState();
/** true bila semua faktor kalibrasi = default (faktor tidak disimpan; nilai custom hanya berlaku selama sesi). */
export const isDefaultCalib = (s) => ['diesel', 'gas'].every((k) => s.calEngine?.[k] === NOX_CALIB_DEFAULTS.engine[k])
  && ['single', 'twin'].every((k) => s.calDln?.[k] === NOX_CALIB_DEFAULTS.dln[k]);

/**
 * Batas emisi yang diisi presenter (ppm @ basis aktif). Default KOSONG (null): tidak ada angka baku mutu di kode.
 * Dipakai jendela operasi Scene 6 dan M7.
 */
export const limitsInitialState = () => ({ limNOx: null, limCO: null });
/** Patch batas: kosong / tidak valid / ≤ 0 → null. */
export function limitsPatch({ nox, co } = {}) {
  const v = (x) => { if (x == null || String(x).trim() === '') return null; const n = Number(String(x).replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null; };
  const out = {};
  if (nox !== undefined) out.limNOx = v(nox);
  if (co !== undefined) out.limCO = v(co);
  return out;
}

// ── Scene 6 (part-load) ──
/** State awal Scene 6: beban 100 %, strategi single-shaft IGV. */
export const loadInitialState = () => ({ lLoad: LOAD_RANGE.max, lStrategy: 'igv', lAux: 'flame' });

// ── Scene 7 (kompresor gas) — satuan slider: bar, kg/kmol, kg/s, % N ──
/** State awal Scene 7 = demo case slide S7 (golden gasCompressor). */
export function compInitialState() {
  const d = GAS_COMPRESSOR.design;
  return { cPsuc: d.Psuc / 1e5, cPdis: d.Pdis / 1e5, cMW: d.MWgas, cMdot: d.mdot, cSpeed: 100 };
}
/** Patch tekanan: jaga Pdis ≥ minRatio·Psuc (geser yang tidak sedang diubah). */
export function compPressurePatch(s, { Psuc, Pdis }) {
  const k = GAS_COMPRESSOR.minRatio, R = GAS_COMPRESSOR.ranges;
  const round = (v, st) => Math.round(v / st) * st;
  if (Psuc != null) {
    const pd = Math.max(s.cPdis, Math.min(R.Pdis.max, Math.ceil(Psuc * k)));
    return { cPsuc: Psuc, cPdis: pd };
  }
  const ps = Math.min(s.cPsuc, Math.max(R.Psuc.min, round(Math.floor((Pdis / k) * 2) / 2, R.Psuc.step)));
  return { cPdis: Pdis, cPsuc: ps };
}

// ── Scene 8 (emisi gabungan) ──
/** State awal Scene 8: methane slip (%) gas engine & turbin. */
export const emisInitialState = () => ({ eSlip: 1 });

// ── Scene 9 (trade-off kebijakan) ──
/** State awal Scene 9: tab A, diesel pada timing preset, penalti 3 %. Satuan input batas (global, dipakai M7b): ppm. */
export const policyInitialState = () => ({ pTab: 'A', pEngine: 'diesel', pTheta0: ENGINES.diesel.params.theta0, pPenalty: 3, limUnit: 'ppm' });
/** Patch ganti engine panel A: timing ke preset engine tsb. */
export const policyEnginePatch = (engine) => ({ pEngine: engine, pTheta0: ENGINES[engine].params.theta0 });

// ── Scene 10–11 (konten presenter) ──
/** Scene 10: filter mesin untuk menyorot kartu ('all' | 'diesel' | 'gas' | 'turbine'). */
export const ctrlInitialState = () => ({ ctrlFilter: 'all' });
/** Scene 11: opsi diskusi yang disembunyikan (id → false); default semua tampil; mode edit checkbox. */
export const closingInitialState = () => ({ closingVisible: {}, closingEdit: false });
export const isOptionVisible = (s, id) => s.closingVisible?.[id] !== false;
export const closingTogglePatch = (s, id) => ({ closingVisible: { ...s.closingVisible, [id]: !isOptionVisible(s, id) } });
