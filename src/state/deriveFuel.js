/**
 * deriveFuel.js — bahan bakar → frame (M9 Step 04). Semua angka dari thermo.js (neraca atom / massa):
 *   gas    : fuelGasProps(komposisi di store; default CH₄ murni, tanpa UI komposisi di Step 04)
 *   O₂ buang: exhaustO2FromLambda pada λ preset (λ = 1/φ): diesel dengan neraca solar, gas engine dengan komposisi gas
 *   SO₂    : so2FromFuelSulfur — hanya bila presenter mengisi sulfur bahan bakar (solar % berat, gas H₂S ppmv);
 *            kosong → null (chip "Not modeled": butuh input), tidak ada nilai sulfur default di kode.
 */
import { fuelGasProps, exhaustO2FromLambda, so2FromFuelSulfur, mgNm3ToPpmReg, OIL_DEFAULT, MW } from '../model/thermo.js';
import { ENGINES } from '../model/presets.js';

export const fuelInitialState = () => ({ fuelGas: { CH4: 1 }, fuelS: null, fuelH2S: null });

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
  const comp = s.fuelGas ?? { CH4: 1 };
  const gas = fuelGasProps(comp);
  const lam = { diesel: 1 / ENGINES.diesel.params.phi, gas: 1 / ENGINES.gas.params.phi };
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
  return { gas, lambda: lam, exhaustO2: o2, so2: { oil: so2('oil'), gas: so2('gas') }, sulfur: { oil: s.fuelS ?? null, gas: s.fuelH2S ?? null } };
}
