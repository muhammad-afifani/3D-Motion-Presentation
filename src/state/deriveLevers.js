/**
 * deriveLevers.js — tab Levers Scene 9 (M9 Step 05b) → frame. Semua angka dari thermo.js:
 *   sapuan  : leverSweep(mesin, sumbu, grid LEVER_GRID, tuas lain = nilai slider Scene 9) di Web Worker
 *   NOx     : NOx_ppmvd @15 % O₂ → mg/Nm³ basis regulasi lewat toRegulationBasis (jalur regulasi, 21 / 25 °C)
 *   limit   : baris regulasi grup mesin untuk kelas & bahan bakar header (garis grafik + chip, complianceStatus)
 *   O₂ buang: exhaustO2FromLambda pada λ = 1/φ slider
 * Titik operasi = baris sapuan pada nilai slider (grid memuat semua nilai slider) → grafik, HUD, dan tab Limits membaca
 * frame yang sama. State slider milik Scene 9 (p9Lev), terpisah dari tuas Scene 1/4.
 */
import { toRegulationBasis, complianceStatus, MW } from '../model/thermo.js';
import { ENGINES, LEVER_GRID, LEVER_AXES, LEVER_AXIS_DISPLAY, NOX_CALIB_DEFAULTS } from '../model/presets.js';
import { EQUIPMENT, regSelection, rowsFor, regLimitMg, sourceOf } from './regulations.js';

export const LEVER_ENGINES = Object.freeze(['diesel', 'gas']);
/** p9Lev: { diesel?: {theta0?, phi?, Tivc?, Pivc?, N?}, gas?: {...} } — nilai yang tidak diisi = preset. */
export const leversInitialState = () => ({ p9Axis: 'theta0', p9Lev: {}, p9Sub: 'engine' });

const engineCalib = (s, kind) => s.calEngine?.[kind] ?? NOX_CALIB_DEFAULTS.engine[kind];

/** Mesin tab Levers: mengikuti equipment header (diesel / gas engine); header turbin → mesin terakhir (pEngine). */
export function leverEngine(s) {
  const m = EQUIPMENT[s.regEquip]?.model;
  return m === 'diesel' || m === 'gas' ? m : (LEVER_ENGINES.includes(s.pEngine) ? s.pEngine : 'diesel');
}

/** Nilai kelima tuas untuk satu mesin (preset bila belum digeser). */
export function leverValues(s, kind) {
  const p = ENGINES[kind].params;
  const base = Object.fromEntries(LEVER_AXES.map((a) => [a, p[a]]));
  const set = s.p9Lev?.[kind] ?? {};
  for (const a of LEVER_AXES) if (Number.isFinite(set[a])) base[a] = set[a];
  return base;
}

/** Patch slider: nilai di-snap ke grid; menggeser slider juga menjadikannya sumbu sapuan. */
export function leverPatch(s, kind, axis, value) {
  const g = LEVER_GRID[kind][axis].sweep;
  const v = g.reduce((a, b) => (Math.abs(b - value) < Math.abs(a - value) ? b : a), g[0]);
  return { p9Lev: { ...s.p9Lev, [kind]: { ...s.p9Lev?.[kind], [axis]: v } }, p9Axis: axis };
}

/** true bila tuas Scene 9 atau komposisi gas berbeda dari preset (lencana "Modified"). */
export function isLeversModified(s) {
  const lev = LEVER_ENGINES.some((k) => { const v = leverValues(s, k); return LEVER_AXES.some((a) => v[a] !== ENGINES[k].params[a]); });
  const comp = s.fuelGas ?? { CH4: 100 };
  const fuel = !(comp.CH4 > 0) || Object.entries(comp).some(([k, x]) => k !== 'CH4' && x > 0);
  return lev || fuel;
}
/** Reset to preset: tuas Scene 9 dan komposisi gas kembali ke preset (sulfur bahan bakar = input analisis, tetap). */
export const leversResetPatch = () => ({ p9Lev: {}, fuelGas: { CH4: 100 } });

/** Nilai sumbu grafik dalam satuan tampilan (boost Pa → bar; tuas lain apa adanya). */
export const leverAxisValue = (axis, v) => v * (LEVER_AXIS_DISPLAY[axis]?.scale ?? 1);

/** Parameter job Worker leverSweep. */
export function leverSweepParams(s) {
  const kind = leverEngine(s), axis = LEVER_AXES.includes(s.p9Axis) ? s.p9Axis : 'theta0';
  const v = leverValues(s, kind);
  const over = { calib: engineCalib(s, kind) };
  for (const a of LEVER_AXES) if (a !== axis) over[a] = v[a];
  return { kind, param: axis, values: LEVER_GRID[kind][axis].sweep, over };
}
export const leverSweepKey = (s) => { const p = leverSweepParams(s); return `${p.kind}|${p.param}|${LEVER_AXES.map((a) => p.over[a] ?? '').join(',')}|${p.over.calib}`; };

/** Grup + baris regulasi untuk mesin tab Levers (kelas & bahan bakar header bila header = mesin yang sama). */
function engineLimit(s, regData, kind) {
  const equip = kind === 'diesel' ? 'dieselEngine' : 'gasEngine';
  const sel = regSelection(s.regEquip === equip ? s : { ...s, regEquip: equip, regClass: null, regFuel: null }, regData);
  const mg = regLimitMg(rowsFor(sel.group, sel.cls, sel.fuel), 'NOx');
  return { sel, mg, basis: sel.group?.basis ?? null, cls: sel.classes.find((c) => c.id === sel.cls)?.label ?? null, source: sourceOf(regData, sel.group)?.short ?? null, verified: sel.group?.verified === true };
}

/**
 * @param {any} s state @param {{rows:any[], ms:number}|null} sweep hasil Worker (null bila belum/basi) @param {any} regData
 */
export function deriveLevers(s, sweep, regData) {
  const p = leverSweepParams(s);
  const kind = p.kind, axis = p.param, values = p.values;
  const cur = leverValues(s, kind);
  const lim = engineLimit(s, regData, kind);
  const ok = sweep && sweep.rows?.length === values.length && sweep.rows.every((r, i) => r.value === values[i]);
  const base = {
    kind, axis, values, x: values.map((v) => leverAxisValue(axis, v)), levers: cur, current: cur[axis], currentX: leverAxisValue(axis, cur[axis]), grid: LEVER_GRID[kind],
    limit: lim, turbineHeader: EQUIPMENT[s.regEquip]?.model === 'turbine', atPreset: LEVER_AXES.every((a) => cur[a] === ENGINES[kind].params[a]), modified: isLeversModified(s), ms: sweep?.ms ?? null,
  };
  if (!ok || !lim.basis) return { ...base, ready: false, rows: null, point: null };
  const mg = (ppm) => toRegulationBasis({ ppm, refFrom: 15, molarMass: MW.NO2, basis: lim.basis }).mgNm3;
  const rows = sweep.rows.map((r) => ({ ...r, noxMg: mg(r.NOx_ppm) }));
  const i = values.indexOf(cur[axis]);
  const pt = rows[i];
  const presetIdx = values.indexOf(ENGINES[kind].params[axis]);
  const ref = rows[presetIdx] ?? pt;
  const d = (a, b) => (a / b - 1) * 100;
  return {
    ...base, ready: true, rows, i,
    noxMg: rows.map((r) => r.noxMg), eta: rows.map((r) => r.etaBrake), etaPct: rows.map((r) => r.etaBrake * 100),
    point: { ...pt, status: complianceStatus(pt.noxMg, lim.mg) },
    presetPoint: ref, presetX: leverAxisValue(axis, ref.value),
    delta: { noxMg: d(pt.noxMg, ref.noxMg), noxGkWh: d(pt.NOx_gkWh, ref.NOx_gkWh), eta: d(pt.etaBrake, ref.etaBrake), co2: d(pt.co2_gkWh, ref.co2_gkWh) },
  };
}
