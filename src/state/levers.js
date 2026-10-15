/**
 * levers.js — tuas mesin di atas preset (M9 Step 04). Model: cylinderSim di thermo.js.
 *   tersedia lewat slider : λ (phi), timing (theta0), rasio kompresi (r)
 *   tersedia di model     : intake T (Tivc), boost (Pivc), rpm (N) — state levTivc / levPivc / levN; null = nilai preset,
 *                           sehingga default menghasilkan angka identik dengan sebelumnya (dijaga tests/levers.test.js)
 *   bukan tuas terpisah   : load (diesel lewat λ, gas engine lewat boost)
 *   tidak tersedia        : EGR (butuh suhu nyala dan komposisi dengan pengencer; tidak ada korelasi bersumber di model)
 */
export const LEVER_STATUS = Object.freeze({
  lambda: 'slider', timing: 'slider', compressionRatio: 'slider',
  intakeT: 'model', boost: 'model', rpm: 'model',
  load: 'indirect', egr: 'notAvailable',
});

export const leverInitialState = () => ({ levTivc: null, levPivc: null, levN: null });

/** Override parameter cylinderSim dari state tuas (hanya yang diisi). */
export function leverOverrides(s) {
  const o = {};
  if (Number.isFinite(s.levTivc)) o.Tivc = s.levTivc;
  if (Number.isFinite(s.levPivc)) o.Pivc = s.levPivc;
  if (Number.isFinite(s.levN)) o.N = s.levN;
  return o;
}
export const leverKey = (s) => `${s.levTivc ?? ''}|${s.levPivc ?? ''}|${s.levN ?? ''}`;
