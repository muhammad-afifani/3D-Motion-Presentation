// M9 Step 04: fungsi bahan bakar (neraca atom, hukum Hess) — golden tabel pack (hitung tangan, toleransi 0,5 %),
// tes sifat, validasi input. Nilai LHV dibandingkan dengan pack; selisih > 0,5 % dilaporkan, tidak disesuaikan.
import { describe, it, expect } from 'vitest';
import { fuelGasProps, so2FromFuelSulfur, exhaustO2FromLambda, bisect, FUEL_GAS_SPECIES, PRODUCT_DHF, MW, ATOMIC_WEIGHT } from '../src/model/thermo.js';

const near = (got, want, rel = 0.005) => expect(Math.abs(got / want - 1), `got ${got}, want ${want}`).toBeLessThanOrEqual(rel);
const GAS_A = { CH4: 90, C2H6: 5, C3H8: 2, N2: 1, CO2: 2 };

describe('fuelGasProps: golden pack', () => {
  it('CH₄ murni: MW 16,043; LHV ≈ 50,0 MJ/kg; AFR 17,19; CO₂ 2,743 kg/kg; ≈ 54,9 kg/GJ; V₀ 11,90 / 12,99 Nm³/kg; n_air 9,52; n_dry 8,52', () => {
    const g = fuelGasProps({ CH4: 1 });
    near(g.MW, 16.043); near(g.LHV_MJ_per_kg, 50.0); near(g.AFR_stoich_mass, 17.19); near(g.CO2_kg_per_kg_fuel, 2.743);
    near(g.CO2_kg_per_GJ_LHV, 54.9); near(g.dryFlueV0_Nm3_per_kg.C0, 11.90); near(g.dryFlueV0_Nm3_per_kg.C25, 12.99);
    near(g.airMolPerMolFuel, 9.52); near(g.dryFlueMolPerMolFuel, 8.52);
  });
  it('Gas A (CH₄ 90, C₂H₆ 5, C₃H₈ 2, N₂ 1, CO₂ 2 % mol): MW 17,98; LHV ≈ 46,4; AFR 15,91; CO₂ 2,643; ≈ 57,0 kg/GJ; V₀ 11,08', () => {
    const g = fuelGasProps(GAS_A);
    near(g.MW, 17.98); near(g.LHV_MJ_per_kg, 46.4); near(g.AFR_stoich_mass, 15.91); near(g.CO2_kg_per_kg_fuel, 2.643);
    near(g.CO2_kg_per_GJ_LHV, 57.0); near(g.dryFlueV0_Nm3_per_kg.C0, 11.08);
  });
  it('C₃H₈ murni: MW 44,097; CO₂ 2,994 kg/kg; AFR 15,63', () => {
    const g = fuelGasProps({ C3H8: 1 });
    near(g.MW, 44.097); near(g.CO2_kg_per_kg_fuel, 2.994); near(g.AFR_stoich_mass, 15.63);
  });
  it('LHV molar hukum Hess: n-C₄H₁₀ ≈ 2657,6 dan H₂S ≈ 518,1 kJ/mol (ΔHf dari pemilik proyek, to verify)', () => {
    near(fuelGasProps({ C4H10: 1 }).LHV_kJ_per_mol, 2657.6, 1e-4);
    near(FUEL_GAS_SPECIES.H2S.dHf - PRODUCT_DHF.H2O - PRODUCT_DHF.SO2, 518.1, 1e-4);
  });
  it('massa molar konsisten dengan MW model (NO₂, CO₂ dari massa atom)', () => {
    near(ATOMIC_WEIGHT.C + 2 * ATOMIC_WEIGHT.O, MW.CO2, 1e-4);
  });
});

describe('fuelGasProps: sifat dan validasi', () => {
  it('menambah C₂H₆ pada CH₄ menaikkan CO₂ per GJ', () => {
    expect(fuelGasProps({ CH4: 95, C2H6: 5 }).CO2_kg_per_GJ_LHV).toBeGreaterThan(fuelGasProps({ CH4: 1 }).CO2_kg_per_GJ_LHV);
  });
  it('menambah N₂ dan CO₂ inert menurunkan LHV per kg', () => {
    const base = fuelGasProps({ CH4: 1 }).LHV_MJ_per_kg;
    expect(fuelGasProps({ CH4: 95, N2: 5 }).LHV_MJ_per_kg).toBeLessThan(base);
    expect(fuelGasProps({ CH4: 95, CO2: 5 }).LHV_MJ_per_kg).toBeLessThan(base);
  });
  it('normalisasi otomatis: persen dan fraksi memberi hasil sama', () => {
    near(fuelGasProps(GAS_A).LHV_MJ_per_kg, fuelGasProps({ CH4: 0.9, C2H6: 0.05, C3H8: 0.02, N2: 0.01, CO2: 0.02 }).LHV_MJ_per_kg, 1e-12);
  });
  it('menolak fraksi negatif, total nol, komponen tak dikenal', () => {
    expect(() => fuelGasProps({ CH4: -1, C2H6: 2 })).toThrow();
    expect(() => fuelGasProps({ CH4: 0 })).toThrow();
    expect(() => fuelGasProps({})).toThrow();
    expect(() => fuelGasProps({ CH4: 1, Xe: 1 })).toThrow();
    expect(() => fuelGasProps({ CH4: 1, H2S_ppmv: -5 })).toThrow();
  });
});

describe('so2FromFuelSulfur (neraca massa, ref 15 % O₂, 25 °C, kering)', () => {
  it('solar C 86,5 % H 13 % S 0,5 %: SO₂ ≈ 251 mg/Nm³, V₀ kering ≈ 11,37 Nm³/kg (25 °C)', () => {
    const r = so2FromFuelSulfur({ fuel: 'oil', sulfur: 0.5 }, 15, 25);
    near(r.mgNm3, 251); near(r.V0dry_Nm3_per_kg, 11.37);
  });
  it('solar S 0,05 % / 0,10 % → ≈ 25 / 50 mg/Nm³', () => {
    near(so2FromFuelSulfur({ fuel: 'oil', sulfur: 0.05 }).mgNm3, 25.1, 0.01);
    near(so2FromFuelSulfur({ fuel: 'oil', sulfur: 0.1 }).mgNm3, 50.2, 0.01);
  });
  it('S solar yang menghasilkan 160 / 120 mg/Nm³ ≈ 0,32 / 0,24 % berat', () => {
    const inv = (t) => bisect((S) => so2FromFuelSulfur({ fuel: 'oil', sulfur: S }).mgNm3 - t, 0, 2, { tol: 1e-7 });
    near(inv(160), 0.32, 0.01); near(inv(120), 0.24, 0.01);
  });
  it('gas: H₂S ppmv → SO₂ sebanding; 0 ppmv → 0; tanpa SO₃', () => {
    expect(so2FromFuelSulfur({ fuel: 'gas', sulfur: 0 }).mgNm3).toBe(0);
    const a = so2FromFuelSulfur({ fuel: 'gas', sulfur: 10 }).mgNm3, b = so2FromFuelSulfur({ fuel: 'gas', sulfur: 20 }).mgNm3;
    near(b / a, 2, 1e-4);
    expect(() => so2FromFuelSulfur({ fuel: 'oil', sulfur: -1 })).toThrow();
  });
});

describe('exhaustO2FromLambda', () => {
  it('CH₄ murni: λ 1,5 → 7,51 %; 1,8 → 9,89 %; 2,0 → 11,06 % (kering)', () => {
    near(exhaustO2FromLambda(1.5), 7.51); near(exhaustO2FromLambda(1.8), 9.89); near(exhaustO2FromLambda(2.0), 11.06);
  });
  it('λ ≤ 1 → 0; naik monoton dengan λ; solar memakai neraca minyak', () => {
    expect(exhaustO2FromLambda(1)).toBe(0); expect(exhaustO2FromLambda(0.9)).toBe(0);
    expect(exhaustO2FromLambda(1.7)).toBeGreaterThan(exhaustO2FromLambda(1.6));
    const oil = exhaustO2FromLambda(2, { oil: { C: 86.5, H: 13 } });
    expect(oil).toBeGreaterThan(10); expect(oil).toBeLessThan(12);
  });
});
