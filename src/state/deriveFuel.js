/**
 * deriveFuel.js — bahan bakar → frame (M9 Step 04). Semua angka dari thermo.js (neraca atom / massa):
 *   gas    : fuelGasProps(komposisi di store; default CH₄ murni, tanpa UI komposisi di Step 04)
 *   O₂ buang: exhaustO2FromLambda pada λ preset (λ = 1/φ): diesel dengan neraca solar, gas engine dengan komposisi gas
 *   SO₂    : so2FromFuelSulfur — hanya bila presenter mengisi sulfur bahan bakar (solar % berat, gas H₂S ppmv);
 *            kosong → null (chip "Not modeled": butuh input), tidak ada nilai sulfur default di kode.
 */
import { fuelGasProps, exhaustO2FromLambda, so2FromFuelSulfur, mgNm3ToPpmReg, OIL_DEFAULT, MW } from '../model/thermo.js';
import { leverValues } from './deriveLevers.js';

/** fuelGas: % mol per komponen (slider Scene 9, dinormalkan di fuelGasProps); default CH₄ murni. */
export const fuelInitialState = () => ({ fuelGas: { CH4: 100 }, fuelS: null, fuelH2S: null });
/** Patch slider komposisi: nilai % mol (negatif → 0). */
export const fuelGasPatch = (s, key, v) => ({ fuelGas: { ...(s.fuelGas ?? {}), [key]: Math.max(0, Number(v) || 0) } });

/** Patch input sulfur presenter: kosong / tidak valid / negatif → null. */
export function fuelSulfurPatch(key, value) {
  const n = Number(String(value ?? '').replace(',', '.'));
  const ok = String(value ?? '').trim() !== '' && Number.isFinite(n) && n >= 0;
  return { [key]: ok ? n : null };
}

/**
 * @param {any} s state (fuelGas, fuelS, fuelH2S)
 * @param {{refO2Pct:number, TrefC:number}|null} [basis] basis grup regulasi (SO₂ dihitung pada O₂ dan suhu ini)
 */
export function deriveFuel(s, basis = null) {
  // komposisi dari slider Scene 9; total nol / tidak valid → CH₄ murni untuk perhitungan, ditandai invalid
  let comp = s.fuelGas ?? { CH4: 1 }, gas, invalid = false;
  try { gas = fuelGasProps(comp); } catch { invalid = true; comp = { CH4: 1 }; gas = fuelGasProps(comp); }
  // λ = 1/φ dari slider tuas Scene 9 (preset bila belum digeser)
  const lam = { diesel: 1 / leverValues(s, 'diesel').phi, gas: 1 / leverValues(s, 'gas').phi };
  const o2 = {
    diesel: exhaustO2FromLambda(lam.diesel, { oil: { ...OIL_DEFAULT, S: s.fuelS ?? 0 } }),
    gas: exhaustO2FromLambda(lam.gas, comp),
  };
  const ref = basis ?? { refO2Pct: 15, TrefC: 25 };
  const so2 = (fuel) => {
    const S = fuel === 'oil' ? s.fuelS : s.fuelH2S;
    if (S == null) return null;
    const r = so2FromFuelSulfur({ fuel, sulfur: S, composition: comp }, ref.refO2Pct, ref.TrefC);
    // ppm @ O₂ acuan pada basis volume yang sama (untuk baris kepatuhan, yang mengonversi lagi lewat jalur regulasi)
    return { ...r, ppmAtRef: mgNm3ToPpmReg(r.mgNm3, MW.SO2, ref.TrefC) };
  };
  const compSum = Object.values(s.fuelGas ?? { CH4: 100 }).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  return { gas, compInvalid: invalid, compSum, lambda: lam, exhaustO2: o2, so2: { oil: so2('oil'), gas: so2('gas') }, sulfur: { oil: s.fuelS ?? null, gas: s.fuelH2S ?? null } };
}
