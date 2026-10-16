/**
 * regulations.js — pilihan regulasi (equipment, kelas kapasitas, bahan bakar) dan pencarian limit di
 * content/regulations.json. Angka limit TIDAK ada di kode: semuanya dibaca dari file konten.
 * Semua perbandingan ke limit memakai jalur regulasi thermo.js (toRegulationBasis: koreksi O₂ dengan 21,
 * volume pada basis grup) lalu complianceStatus. Jalur tampilan (20,9) tidak pernah dipakai di sini.
 */
import { toRegulationBasis, correctToRefO2Reg, ppmToMgNm3Reg, mgNm3ToPpmReg, complianceStatus, MW } from '../model/thermo.js';

/**
 * Equipment → grup regulasi (id di regulations.json) dan bahan bakar yang mungkin.
 * model = sumber nilai model; params = parameter yang dihitung model (lainnya "Not modeled");
 * formation = kunci equipment di content/emission_formation.json (kartu Formation).
 * Engine: model tidak menghitung CO dan PM. SO₂ = neraca massa sulfur bahan bakar (butuh input sulfur; M9 Step 04).
 * Turbin oil: model DLN hanya untuk gas → NOx/CO tanpa nilai model; SO₂ tetap neraca massa.
 */
export const EQUIPMENT = Object.freeze({
  dieselEngine: Object.freeze({ formation: 'diesel', group: 'engine', fuels: Object.freeze(['oil']), model: 'diesel', params: Object.freeze({ oil: Object.freeze(['NOx', 'SO2']) }) }),
  gasEngine: Object.freeze({ formation: 'gas-engine', group: 'engine', fuels: Object.freeze(['gas']), model: 'gas', params: Object.freeze({ gas: Object.freeze(['NOx', 'SO2']) }) }),
  gasTurbine: Object.freeze({ formation: 'turbine', group: 'gas-turbine', fuels: Object.freeze(['gas', 'oil']), model: 'turbine', params: Object.freeze({ gas: Object.freeze(['NOx', 'CO', 'SO2']), oil: Object.freeze(['SO2']) }) }),
});
export const EQUIPMENT_ORDER = Object.freeze(['dieselEngine', 'gasEngine', 'gasTurbine']);
/** Urutan parameter di chip dan tabel; massa molar untuk konversi ppm ↔ mg/Nm³ (NOx sebagai NO₂). */
export const REG_PARAMS = Object.freeze(['NOx', 'CO', 'PM', 'SO2', 'Opacity']);
export const PARAM_MW = Object.freeze({ NOx: MW.NO2, CO: MW.CO, SO2: MW.SO2 });
/** Parameter dengan input site data (bisa diukur CEMS / uji emisi dan dibandingkan dalam mg/Nm³). */
export const SITE_PARAMS = Object.freeze(['NOx', 'CO']);

export const regulationsInitialState = () => ({ regEquip: 'dieselEngine', regClass: null, regFuel: 'oil', siteData: {} });

export const groupOf = (data, equip) => data?.groups?.find((g) => g.id === EQUIPMENT[equip]?.group) ?? null;
export const sourceOf = (data, group) => data?.sources?.find((x) => x.id === group?.source) ?? null;

/** Pilihan yang sah terhadap data (kelas default = kelas pertama grup; bahan bakar dikunci untuk engine). */
export function regSelection(s, data) {
  const equip = EQUIPMENT[s.regEquip] ? s.regEquip : 'dieselEngine';
  const E = EQUIPMENT[equip];
  const g = groupOf(data, equip);
  const classes = g?.capacityClasses ?? [];
  const cls = classes.some((c) => c.id === s.regClass) ? s.regClass : (classes[0]?.id ?? null);
  const fuel = E.fuels.includes(s.regFuel) ? s.regFuel : E.fuels[0];
  return { equip, cls, fuel, group: g, classes, fuels: E.fuels };
}

/** Patch store saat pemilih diubah (nilai tidak sah diabaikan; kelas/bahan bakar dinormalisasi). */
export function regSelectionPatch(s, data, { equip, cls, fuel } = {}) {
  const next = { ...s };
  if (equip !== undefined && EQUIPMENT[equip]) { next.regEquip = equip; if (equip !== s.regEquip) next.regClass = null; }
  if (cls !== undefined) next.regClass = cls;
  if (fuel !== undefined) next.regFuel = fuel;
  const sel = regSelection(next, data);
  return { regEquip: sel.equip, regClass: sel.cls, regFuel: sel.fuel };
}

/**
 * Patch site data (input presenter) untuk satu equipment + parameter. field: 'value' | 'unit' | 'o2'.
 * Tidak divalidasi di sini (nilai mentah input); konversi + validasi di siteToRegMg.
 */
export function siteDataPatch(s, equip, param, field, value) {
  const cur = s.siteData?.[equip]?.[param] ?? { value: '', unit: 'mg', o2: '' };
  return { siteData: { ...s.siteData, [equip]: { ...s.siteData?.[equip], [param]: { ...cur, [field]: value } } } };
}

/** Baris limit untuk pilihan (kelas + bahan bakar). */
export const rowsFor = (group, cls, fuel) => (group?.rows ?? []).filter((r) => r.class === cls && r.fuel === fuel);
/** Limit mg/Nm³ satu parameter dari baris pilihan (null bila tidak ada atau satuannya bukan mg/Nm³). */
export const regLimitMg = (rows, param) => rows.find((r) => r.param === param && r.unit === 'mg/Nm3')?.limit ?? null;

/**
 * Nilai site data (input presenter) → mg/Nm³ pada basis regulasi.
 * ppm: dianggap kering @ o2 % → koreksi O₂ 21 → mg pada TrefC grup. mg/Nm³: dianggap kering, volume pada basis grup
 * (TrefC grup) @ o2 % → koreksi O₂ 21. Kosong / tidak valid → null.
 * @param {{value:any, unit:'mg'|'ppm', o2:any}|undefined} v @param {string} param @param {{refO2Pct:number, TrefC:number, PatmAbs?:number}} basis
 */
export function siteToRegMg(v, param, basis) {
  if (!v) return null;
  const num = (x) => { const n = Number(String(x ?? '').replace(',', '.')); return String(x ?? '').trim() !== '' && Number.isFinite(n) ? n : null; };
  const value = num(v.value), o2 = num(v.o2) ?? basis.refO2Pct;
  if (value == null || value < 0 || o2 < 0 || o2 >= 21) return null;
  const atRef = correctToRefO2Reg(value, o2, basis.refO2Pct);
  return v.unit === 'ppm' ? ppmToMgNm3Reg(atRef, PARAM_MW[param], basis.TrefC, basis.PatmAbs ?? 1) : atRef;
}

/**
 * Limit override presenter (limNOx / limCO di store, ppm @ basis tampilan dari input lama) → mg/Nm³ pada basis regulasi.
 * Koreksi O₂ jalur regulasi (21) dari O₂ tampilan ke O₂ grup; volume pada basis grup.
 */
export function overrideToRegMg(ppmDisplay, param, displayO2, basis) {
  if (ppmDisplay == null) return null;
  return ppmToMgNm3Reg(correctToRefO2Reg(ppmDisplay, displayO2, basis.refO2Pct), PARAM_MW[param], basis.TrefC, basis.PatmAbs ?? 1);
}

/** Limit mg/Nm³ pada basis regulasi → ppm @ 15 % O₂ (basis asli model) lewat jalur regulasi, untuk digambar di kurva. */
export function regMgToModelPpm(mg, param, basis) {
  if (mg == null) return null;
  return correctToRefO2Reg(mgNm3ToPpmReg(mg, PARAM_MW[param], basis.TrefC, basis.PatmAbs ?? 1), basis.refO2Pct, 15);
}

/**
 * Baris kepatuhan per parameter.
 * @param {{group:any, cls:string, fuel:string, equip:string}} sel
 * @param {Record<string, number|null>} modelPpm15 nilai model ppmvd @ 15 % O₂ per parameter (null = tidak dimodelkan)
 * @param {{siteData?:Record<string, any>, overrides?:Record<string, number|null>, overrideKind?:Record<string,'override'|'permit'>, displayO2?:number, needsInput?:string[]}} [opt]
 *   needsInput: parameter yang dimodelkan tetapi menunggu input presenter (mis. SO₂ tanpa sulfur bahan bakar)
 */
export function complianceRows(sel, modelPpm15, { siteData = {}, overrides = {}, overrideKind = {}, displayO2 = 15, needsInput = [], pending = [] } = {}) {
  const g = sel.group;
  if (!g) return [];
  const basis = g.basis;
  const rows = rowsFor(g, sel.cls, sel.fuel);
  const params = REG_PARAMS.filter((p) => rows.some((r) => r.param === p) || modelPpm15[p] != null || overrides[p] != null);
  return params.map((param) => {
    const row = rows.find((r) => r.param === param) ?? null;
    const mw = PARAM_MW[param];
    const model = modelPpm15[param] != null && mw ? toRegulationBasis({ ppm: modelPpm15[param], refFrom: 15, molarMass: mw, basis }).mgNm3 : null;
    const site = SITE_PARAMS.includes(param) ? siteToRegMg(siteData[param], param, basis) : null;
    const ov = overrides[param] != null ? overrideToRegMg(overrides[param], param, displayO2, basis) : null;
    let limit = null, limitSource = null;
    if (ov != null) { limit = ov; limitSource = overrideKind[param] ?? 'override'; } else if (row && row.unit === 'mg/Nm3') { limit = row.limit; limitSource = 'regulation'; }
    const value = site ?? model;
    return {
      param, row, model, site, limit, limitSource, unit: row?.unit ?? 'mg/Nm3',
      valueSource: site != null ? 'site' : model != null ? 'model' : null,
      status: complianceStatus(value, limit),
      reason: limit == null ? 'noLimit' : value == null ? (needsInput.includes(param) ? 'needsInput' : pending.includes(param) ? 'pending' : 'noValue') : null,
    };
  });
}
