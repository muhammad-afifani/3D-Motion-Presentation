/**
 * coverage.js — matriks cakupan model (M9 Step 04, tampil di tab Limits Scene 9): apa yang dihitung model,
 * neraca massa, semi-empiris, kualitatif + site input, atau tidak relevan. Kunci saja; teks di strings.js.
 * Dijaga tests/limitsTab.test.js agar sesuai EQUIPMENT.params dan field `modeled` di emission_formation.json.
 */
export const COVERAGE_PARAMS = Object.freeze(['NOx', 'CO', 'PM', 'SO2', 'CO2', 'UHC']);
export const COVERAGE_EQUIP = Object.freeze(['dieselEngine', 'gasEngine', 'gasTurbine']);
export const MODEL_COVERAGE = Object.freeze({
  NOx: Object.freeze({ dieselEngine: 'calibrated', gasEngine: 'calibrated', gasTurbine: 'calibrated' }),
  CO: Object.freeze({ dieselEngine: 'qualSite', gasEngine: 'qualSite', gasTurbine: 'semi' }),
  PM: Object.freeze({ dieselEngine: 'qualSite', gasEngine: 'na', gasTurbine: 'qualSiteOil' }),
  SO2: Object.freeze({ dieselEngine: 'massBalanceS', gasEngine: 'massBalanceS', gasTurbine: 'massBalanceS' }),
  CO2: Object.freeze({ dieselEngine: 'carbonBalance', gasEngine: 'carbonBalance', gasTurbine: 'carbonBalance' }),
  UHC: Object.freeze({ dieselEngine: 'na', gasEngine: 'co2eOnly', gasTurbine: 'qualitative' }),
});
