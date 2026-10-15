/**
 * deriveLoad.js — state Scene 6 (part-load) → frame. Semua angka dari thermo.js:
 *   kurva  : loadSweep(design, LOAD_LOADS, { mode, calib }) — mode 'single' (IGV) / 'fuelOnly' / 'twin'
 *   titik  : baris kurva yang sama pada beban slider (langkah 1 % → selalu di kurva)
 *   rig    : singleShaftLoad / twinShaftForLoad (fungsi yang dipakai loadSweep) → warna tahap, N_GG
 *   basis  : emissionAtBasis (ppmvd @15 % O₂ → basis aktif; CO dianggap @15 % O₂, lihat panel H)
 * Jendela operasi = rentang beban yang memenuhi NOx ≤ batas DAN CO ≤ batas (hanya bila kedua batas ada).
 * Batas (M9 Step 03): NOx dari content/regulations.json (grup turbin gas, bahan bakar gas) kecuali presenter mengisi
 * override; CO hanya dari isian presenter "Permit/OEM CO value" (tabel turbin tidak punya limit CO).
 * Perbandingan (jendela, chip) lewat jalur regulasi: nilai mentah @15 % O₂ → toRegulationBasis (21, 25 °C) vs limit mg/Nm³.
 * Garis batas di grafik dikonversi ke basis tampilan hanya untuk digambar.
 */
import {
  loadSweep, singleShaftLoad, twinShaftForLoad, compressorStages, turbineStages, emissionAtBasis,
  tempToRGB, flameColor, MW,
} from '../model/thermo.js';
import { LOAD_DESIGNS, LOAD_LOADS, LOAD_RANGE, NOX_CALIB_DEFAULTS, GT_STAGES, GAS_TURBINES } from '../model/presets.js';
import { TEMP_SCALE } from './derive.js';
import { emissionBasis } from './deriveNox.js';
import { fallbackContent } from './content.js';
import { regSelection, rowsFor, regLimitMg, complianceRows, overrideToRegMg, regMgToModelPpm, sourceOf } from './regulations.js';
import { toRegulationBasis, complianceStatus } from '../model/thermo.js';

const DEG = Math.PI / 180;
/** ṁ minimum IGV = igvMin default singleShaftLoad/loadSweep (0,7); sudut tutup penuh IGV (visual). */
export const IGV_MIN = 0.7;
const IGV_CLOSE_DEG = 55;

const memo = new Map();
function cached(key, fn) {
  if (!memo.has(key)) { if (memo.size > 40) memo.clear(); memo.set(key, fn()); }
  return memo.get(key);
}

/** Mode loadSweep konfigurasi + strategi. */
export const sweepMode = (cfg, strategy) => (cfg === 'twin' ? 'twin' : strategy === 'fuelOnly' ? 'fuelOnly' : 'single');
/** Faktor DLN aktif per konfigurasi (store global). */
export const dlnCalib = (s, cfg) => s.calDln?.[cfg] ?? NOX_CALIB_DEFAULTS.dln[cfg];

/** Kurva mentah loadSweep (ppmvd @15 % O₂) — di-cache per mode & kalibrasi. */
export function rawCurve(cfg, strategy, calib) {
  const mode = sweepMode(cfg, strategy);
  return cached(`raw|${mode}|${calib}`, () => loadSweep(LOAD_DESIGNS[cfg], LOAD_LOADS, { mode, calib }));
}

/** Kurva pada basis tampilan aktif (arrays sejajar, beban dalam %). */
function curveAt(cfg, strategy, calib, basis) {
  return cached(`cur|${cfg}|${strategy}|${calib}|${basis.refO2}|${basis.TrefC}`, () => {
    const raw = rawCurve(cfg, strategy, calib);
    const conv = (ppm, MWs) => emissionAtBasis({ ppm, refFrom: 15, refO2: basis.refO2, TrefK: 273.15 + basis.TrefC, MWspecies: MWs }).ppm;
    return {
      load: raw.map((r) => Math.round(r.load * 100)),
      eta: raw.map((r) => r.eta),
      T3: raw.map((r) => r.T3),
      Tflame: raw.map((r) => r.Tflame),
      nox: raw.map((r) => conv(r.NOx_ppm, MW.NO2)),
      co: raw.map((r) => conv(r.CO_ppm, MW.CO)),
      N: raw.map((r) => r.N),
      phiPz: raw.map((r) => r.phiPz),
      raw,
    };
  });
}

/**
 * Rentang beban (%) yang memenuhi kedua batas; null bila salah satu batas kosong.
 * @returns {null | {ranges: [number, number][], ok: boolean[]}} ranges = [bebanTinggi, bebanRendah]
 */
export function operatingWindow(curve, limNOx, limCO) {
  if (limNOx == null || limCO == null) return null;
  const ok = curve.load.map((_, i) => curve.nox[i] <= limNOx && curve.co[i] <= limCO);
  const ranges = [];
  let start = -1;
  for (let i = 0; i <= ok.length; i++) {
    if (i < ok.length && ok[i]) { if (start < 0) start = i; } else if (start >= 0) { ranges.push([curve.load[start], curve.load[i - 1]]); start = -1; }
  }
  return { ranges, ok };
}

/**
 * Jendela operasi pada basis regulasi: titik mentah (ppmvd @15 % O₂) → mg/Nm³ basis grup, dibanding limit mg/Nm³.
 * @param {{NOx_ppm:number, CO_ppm:number, load:number}[]} raw @param {{nox:number|null, co:number|null}} limMg @param {any} basis basis grup
 */
export function operatingWindowReg(raw, limMg, basis) {
  if (limMg.nox == null || limMg.co == null) return null;
  const mg = (ppm, molarMass) => toRegulationBasis({ ppm, refFrom: 15, molarMass, basis }).mgNm3;
  const ok = raw.map((r) => complianceStatus(mg(r.NOx_ppm, MW.NO2), limMg.nox) === 'within' && complianceStatus(mg(r.CO_ppm, MW.CO), limMg.co) === 'within');
  const load = raw.map((r) => Math.round(r.load * 100));
  const ranges = [];
  let start = -1;
  for (let i = 0; i <= ok.length; i++) {
    if (i < ok.length && ok[i]) { if (start < 0) start = i; } else if (start >= 0) { ranges.push([load[start], load[i - 1]]); start = -1; }
  }
  return { ranges, ok };
}

/**
 * Batas turbin gas (Scene 6 / Scene 9 panel C). Sumber: 'regulation' | 'override' (presenter) | 'permit' (CO, isian presenter).
 * @returns {{sel:any, basis:any, verified:boolean, mg:{nox:number|null, co:number|null}, display:{nox:number|null, co:number|null}, source:{nox:string|null, co:string|null}}}
 */
export function turbineLimits(s, regData, displayBasis) {
  const sel = regSelection({ regEquip: 'gasTurbine', regFuel: 'gas' }, regData);
  const g = sel.group, basis = g?.basis ?? null;
  const rows = rowsFor(g, sel.cls, sel.fuel);
  const regMg = (p) => regLimitMg(rows, p);
  const toDisplay = (ppm15, MWs) => (ppm15 == null ? null : emissionAtBasis({ ppm: ppm15, refFrom: 15, refO2: displayBasis.refO2, TrefK: 273.15 + displayBasis.TrefC, MWspecies: MWs }).ppm);
  const one = (p, lim, MWs) => {
    if (lim != null && basis) return { mg: overrideToRegMg(lim, p, displayBasis.refO2, basis), display: lim, source: regMg(p) == null && p === 'CO' ? 'permit' : 'override' };
    if (lim != null) return { mg: null, display: lim, source: 'override' };
    const mg = basis ? regMg(p) : null;
    return { mg, display: mg == null ? null : toDisplay(regMgToModelPpm(mg, p, basis), MWs), source: mg == null ? null : 'regulation' };
  };
  const n = one('NOx', s.limNOx ?? null, MW.NO2), c = one('CO', s.limCO ?? null, MW.CO);
  return { sel, basis, verified: g?.verified === true, mg: { nox: n.mg, co: c.mg }, display: { nox: n.display, co: c.display }, source: { nox: n.source, co: c.source } };
}

/** Rig: warna tahap & IGV dari fungsi part-load yang sama dengan loadSweep. */
function rigFrame(cfg, strategy, L) {
  return cached(`rig|${cfg}|${strategy}|${L}`, () => {
    const d = LOAD_DESIGNS[cfg];
    const rgb = (T) => tempToRGB(T, TEMP_SCALE.min, TEMP_SCALE.max);
    const list = (a) => a.map((x) => ({ T: x.T, rgb: rgb(x.T) }));
    if (cfg === 'twin') {
      const r = twinShaftForLoad(d, L);
      const epsGG = r.P3 / (r.rpt * (d.P1 ?? 101325)); // P4.5 = rpt·P1 (twinShaft)
      return {
        stages: {
          comp: list(compressorStages(r.T1, r.rp, d.etaC, GT_STAGES.compressor)),
          turb: list(turbineStages(r.T3, epsGG, d.etaGG, GT_STAGES.ggTurbine)),
          pt: list(turbineStages(r.T45, r.rpt, d.etaPT, GT_STAGES.powerTurbine)),
        },
        T2: r.T2, Texh: r.T5, T45: r.T45, mdotFrac: r.mdot / d.mdotDesign, igv: null,
      };
    }
    const r = singleShaftLoad(d, L, { igvMin: strategy === 'fuelOnly' ? 1 : IGV_MIN });
    const mdotFrac = r.mdot / d.mdot;
    const open = strategy === 'fuelOnly' ? 1 : mdotFrac; // bukaan IGV ∝ ṁ/ṁ_desain (1 … 0,7)
    return {
      stages: {
        comp: list(compressorStages(r.params.T1, r.rp, d.etaC, GT_STAGES.compressor)),
        turb: list(turbineStages(r.T3, r.rpt, d.etaT, GT_STAGES.turbine)),
        pt: [],
      },
      T2: r.T2, Texh: r.T4, T45: null, mdotFrac,
      igv: { open, angle: ((1 - open) / (1 - IGV_MIN)) * IGV_CLOSE_DEG * DEG, closed: strategy !== 'fuelOnly' && L <= IGV_MIN + 1e-9 },
    };
  });
}

/** Satu konfigurasi pada beban slider. */
function configFrame(s, cfg, basis, lim) {
  const strategy = cfg === 'twin' ? 'twin' : s.lStrategy;
  const calib = dlnCalib(s, cfg);
  const curve = curveAt(cfg, strategy, calib, basis);
  const i = curve.load.indexOf(s.lLoad);
  const L = s.lLoad / 100;
  const rig = rigFrame(cfg, strategy, L);
  const fuelFrac = (L * curve.eta[0]) / curve.eta[i]; // laju bahan bakar relatif desain = beban·η_desain/η
  return {
    cfg, strategy, calib, calibDefault: NOX_CALIB_DEFAULTS.dln[cfg],
    curve,
    i,
    point: {
      load: s.lLoad, eta: curve.eta[i], T3: curve.T3[i], Tflame: curve.Tflame[i], nox: curve.nox[i], co: curve.co[i], N: curve.N[i], phiPz: curve.phiPz[i],
    },
    window: lim.basis ? operatingWindowReg(curve.raw, lim.mg, lim.basis) : null,
    compliance: complianceRows(lim.sel, { NOx: curve.raw[i].NOx_ppm, CO: curve.raw[i].CO_ppm }, {
      overrides: { NOx: s.limNOx ?? null, CO: s.limCO ?? null }, overrideKind: { NOx: 'override', CO: lim.source.co ?? 'permit' }, displayO2: basis.refO2,
    }),
    ...rig,
    flame: { intensity: Math.max(0.15, Math.min(1, fuelFrac)), color: flameColor(curve.phiPz[i]) },
    N: cfg === 'twin' ? { gg: curve.N[i], pt: null } : { gg: 1, rpm: GAS_TURBINES.generator.Nrpm },
  };
}

/** Angka pesan kunci dari kurva (tanpa batas): penahanan flame T single & pergeseran twin. */
export function curveFacts(single, twin) {
  const c = single.curve, t = twin.curve;
  const T100 = c.Tflame[0];
  let iHold = 0;
  while (iHold + 1 < c.load.length && Math.abs(c.Tflame[iHold + 1] - T100) < 0.5) iHold++;
  const iNext = Math.min(c.load.length - 1, iHold + 10); // 10 % beban sesudahnya
  const at = (cv, p) => cv.load.indexOf(p);
  const i50 = at(t, 50);
  return {
    holdT: T100, holdLoad: c.load[iHold], nextLoad: c.load[iNext], coRatio: c.co[iNext] / c.co[iHold],
    twinDT: t.Tflame[0] - t.Tflame[i50], twinNoxRatio: t.nox[i50] / t.nox[0], twinCoRatio: t.co[i50] / t.co[0],
  };
}

/**
 * @param {any} s state store (lLoad, lStrategy, calDln, limNOx, limCO, emRefO2, emTrefC, theta)
 * @param {any} [regData] isi content/regulations.json (default: salinan bawaan)
 */
export function deriveLoad(s, regData = fallbackContent('regulations')) {
  const basis = emissionBasis(s);
  const lim = turbineLimits(s, regData, basis);
  const single = configFrame(s, 'single', basis, lim);
  const twin = configFrame(s, 'twin', basis, lim);
  // nox/co = garis pada basis tampilan (ppmvd); source = asal limit; override = isian presenter (kosong = dari regulasi)
  const limits = {
    nox: lim.display.nox, co: lim.display.co, set: lim.display.nox != null && lim.display.co != null,
    source: lim.source, override: { nox: s.limNOx ?? null, co: s.limCO ?? null },
  };
  const regulation = { basis: lim.basis, verified: lim.verified, group: lim.sel.group?.id ?? null, source: lim.sel.group?.source ?? null, short: sourceOf(regData, lim.sel.group)?.short ?? null };
  const theta = s.theta ?? 0;
  single.rotor = { angleGG: theta * DEG, anglePT: theta * DEG };
  twin.rotor = { angleGG: theta * twin.N.gg * DEG, anglePT: theta * DEG }; // N_PT tidak dimodelkan: putaran visual tetap
  return {
    load: s.lLoad, loadRange: LOAD_RANGE, strategy: s.lStrategy, aux: s.lAux,
    basis, limits, regulation,
    single, twin,
    facts: curveFacts(single, twin),
    tempScale: TEMP_SCALE,
    modelLevel: 'semiEmpirical',
  };
}
