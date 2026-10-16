// M10: cv(T) udara dari polinomial NASA (GRI-Mech 3.0) — golden terhadap NIST-JANAF dan Cantera, kontinuitas di 1000 K,
// dan konfirmasi bahwa siklus ideal, Brayton real/twin-shaft (cp konstan) dan DLN tidak berubah.
import { describe, it, expect } from 'vitest';
import {
  AIR_NASA7, airProps, cvOfT, kOfT, R_AIR, R_UNIV, otto, diesel, dual, braytonIdeal, braytonReal, twinShaft, dualIdealLimit,
  calibrateDLN, flameTemperature, noxRateRatio, ENGINE_PRESETS, ENGINE_NOX_CALIB,
} from '../src/model/thermo.js';
import { BASIS } from '../src/model/basis.js';
import { LOAD_DESIGNS } from '../src/model/presets.js';

const near = (got, want, tol, msg) => expect(Math.abs(got - want), msg ?? `got ${got}, want ${want}`).toBeLessThanOrEqual(tol);
const relDev = (got, want) => Math.abs(got / want - 1);

// NIST-JANAF Thermochemical Tables, 4th edition (M. W. Chase, J. Phys. Chem. Ref. Data Monograph 9, 1998):
// tabel N-023 (N₂ ref), O-029 (O₂ ref), Ar-001 (Ar ref), kolom Cp° [J/(mol·K)]. Salinan teks tabel dari janaf.nist.gov
// (dibaca dari paket PyPI "janaf" 1.4.0, yang membundel tabel yang sama).
const JANAF_CP = {
  300: { N2: 29.125, O2: 29.385, Ar: 20.786 },
  1000: { N2: 32.697, O2: 34.870, Ar: 20.786 },
  1500: { N2: 34.843, O2: 36.544, Ar: 20.786 },
  2000: { N2: 35.971, O2: 37.741, Ar: 20.786 },
};
// fraksi mol udara kering yang sama dengan AIR_NASA7 (N₂ 78,084 %, O₂ 20,946 %, Ar 0,934 %, dinormalkan)
const X = (() => { const x = { N2: 0.78084, O2: 0.20946, Ar: 0.00934 }; const s = x.N2 + x.O2 + x.Ar; return { N2: x.N2 / s, O2: x.O2 / s, Ar: x.Ar / s }; })();
/** cv udara dari JANAF dengan konversi yang sama dengan model: cv = R_AIR·(cp/R_u − 1). */
const cvJanaf = (T) => { const c = JANAF_CP[T]; return R_AIR * ((X.N2 * c.N2 + X.O2 * c.O2 + X.Ar * c.Ar) / R_UNIV - 1); };
// Cantera 3.2, gri30.yaml, campuran yang sama pada 1 atm: cp massa [J/(kg·K)] (R campuran 287,10 J/(kg·K))
const CANTERA_CP = { 300: 1003.564, 1000: 1142.753, 1500: 1210.112, 2000: 1250.854 };

describe('cv(T) udara: golden terhadap NIST-JANAF (4th ed., 1998)', () => {
  for (const T of [300, 1000, 1500, 2000]) {
    it(`${T} K: cvOfT dalam 0,5 % dari JANAF (cv ${cvJanaf(T).toFixed(1)} J/(kg·K))`, () => {
      expect(relDev(cvOfT(T), cvJanaf(T))).toBeLessThanOrEqual(0.005);
    });
  }
  it('fit linear lama menyimpang lebih dari 0,5 % di 1000–2000 K (alasan M10)', () => {
    const linear = (T) => R_AIR / 0.4 + 0.115 * (T - 300);
    for (const T of [1000, 1500, 2000]) expect(relDev(linear(T), cvJanaf(T)), String(T)).toBeGreaterThan(0.005);
  });
});

describe('cv(T) udara: pembanding Cantera (koefisien yang sama)', () => {
  it('cp model = cp Cantera × R_AIR/R_campuran dalam 0,01 % (300 / 1000 / 1500 / 2000 K)', () => {
    const Rmix = (R_UNIV * 1000) / AIR_NASA7.MW;
    for (const [T, cp] of Object.entries(CANTERA_CP)) expect(relDev(airProps(Number(T)).cp, cp * (R_AIR / Rmix)), T).toBeLessThanOrEqual(1e-4);
  });
  it('cvOfT = airProps().cv; kOfT = 1 + R/cv; k turun dengan suhu (1,40 → 1,30)', () => {
    for (const T of [300, 800, 1000, 1400, 2500]) { near(cvOfT(T), airProps(T).cv, 1e-9); near(kOfT(T), 1 + R_AIR / cvOfT(T), 1e-12); }
    near(kOfT(300), 1.4, 0.005);
    expect(kOfT(2000)).toBeLessThan(1.31);
  });
});

describe('kontinuitas polinomial NASA di 1000 K (batas rentang lo / hi)', () => {
  const lo = airProps(AIR_NASA7.Tmid, 'lo'), hi = airProps(AIR_NASA7.Tmid, 'hi');
  it('cp kontinu (selisih < 0,01 %)', () => expect(relDev(hi.cp, lo.cp)).toBeLessThan(1e-4));
  it('h kontinu (selisih < 0,01 % dari cp·T)', () => expect(Math.abs(hi.h - lo.h) / (lo.cp * AIR_NASA7.Tmid)).toBeLessThan(1e-4));
  it('s° kontinu (selisih < 0,01 %)', () => expect(relDev(hi.s0, lo.s0)).toBeLessThan(1e-4));
  it('rentang lo dipakai di bawah 1000 K, hi di atasnya', () => {
    near(airProps(999.9).cp, airProps(999.9, 'lo').cp, 1e-9);
    near(airProps(1000).cp, airProps(1000, 'hi').cp, 1e-9);
  });
});

describe('basis.js: catatan M10', () => {
  it('deviasi fit linear dihapus; arah bias sisa dan beda basis properti mesin vs turbin tertulis', () => {
    const c = BASIS.cvOfT;
    expect(c.knownIssue).toBe("Pmax and efficiency slightly overestimated; products' cv not modeled (whole charge treated as air).");
    expect(JSON.stringify(c)).not.toMatch(/7\.5 %|linear/i);
    expect(c.assumptions.join(' ')).toMatch(/Engine cycle uses temperature-dependent cp\(T\); the gas-turbine cycles use constant cp and k\. The two are not on the same property basis\./);
    for (const k of ['braytonReal', 'twinShaft']) expect(BASIS[k].assumptions.join(' '), k).toMatch(/not the temperature-dependent air properties of the engine model/);
    expect(c.toVerify).toEqual([]);
    expect(ENGINE_NOX_CALIB).toBe(0.185);
  });
});

describe('M10 tidak mengubah siklus ideal, Brayton real / twin-shaft (cp konstan), DLN, suhu nyala', () => {
  it('siklus ideal: Otto r 10 0,6019; Diesel r 18 rc 2 0,6316; Brayton rp 15 0,5387; batas dual preset diesel 0,6321', () => {
    near(otto({ r: 10 }).eta, 0.6019, 1e-4); near(diesel({ r: 18, rc: 2 }).eta, 0.6316, 1e-4);
    near(braytonIdeal({ rp: 15 }).eta, 0.5387, 1e-4); near(dual({ r: 16, rp: 1.5, rc: 1.4 }).eta, 0.655, 1e-3);
    near(dualIdealLimit({ ...ENGINE_PRESETS.diesel }).eta, 0.6321, 1e-4);
  });
  it('braytonReal η 0,3777 / T2 674,9 K / T4 843,4 K; twinShaft η 0,4047 (sama dengan sebelum M10)', () => {
    const b = braytonReal({});
    near(b.eta, 0.3777, 1e-4); near(b.T2, 674.9, 0.1); near(b.T4, 843.4, 0.1);
    near(twinShaft({}).eta, 0.4047, 1e-4);
  });
  it('kalibrasi DLN 14,33 / 4,38; suhu nyala dan rasio Zeldovich tidak bergantung pada cv(T)', () => {
    near(calibrateDLN({ design: LOAD_DESIGNS.single }).calib, 14.33, 0.005);
    near(calibrateDLN({ mode: 'twin', design: LOAD_DESIGNS.twin }).calib, 4.38, 0.005);
    near(flameTemperature(0.5, 300), 1530, 1);
    near(noxRateRatio(1800), 7.1, 0.2);
  });
});
