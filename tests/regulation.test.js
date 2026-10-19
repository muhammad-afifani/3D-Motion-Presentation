// Step 03 (M9): lapisan data regulasi. Golden hitung tangan (toleransi 0,5 %), dua jalur koreksi O₂,
// complianceStatus, validasi skema regulations.json, loader, dan larangan angka limit di src/.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  MW, correctToRefO2, correctToRefO2Reg, O2_AIR_REG, molarVolumeReg, ppmToMgNm3Reg, mgNm3ToPpmReg, toRegulationBasis, complianceStatus,
} from '../src/model/thermo.js';
import { validateRegulations, loadContent, fallbackContent, CONTENT_FILES } from '../src/state/content.js';
import { EQUIPMENT, regSelection, regSelectionPatch, rowsFor, complianceRows, siteToRegMg, overrideToRegMg, regMgToModelPpm, groupOf } from '../src/state/regulations.js';

const ROOT = new URL('..', import.meta.url).pathname;
const regs = JSON.parse(readFileSync(join(ROOT, 'content/regulations.json'), 'utf8'));
const near = (got, want, rel = 0.005) => expect(Math.abs(got / want - 1)).toBeLessThanOrEqual(rel);
const BASIS = { refO2Pct: 15, TrefC: 25, PatmAbs: 1 };

describe('golden jalur regulasi (hitung tangan, toleransi 0,5 %)', () => {
  it('volume molar ideal V = R·T/P: 22,414 L/mol (0 °C), 24,465 L/mol (25 °C)', () => {
    near(molarVolumeReg(0), 22.414, 1e-4);
    near(molarVolumeReg(25), 24.465, 1e-4);
  });
  it('mg/Nm³ NO₂ @25 °C → ppm: 320 → 170,2; 285 → 151,6; 300 → 159,5', () => {
    near(mgNm3ToPpmReg(320, MW.NO2, 25), 170.2);
    near(mgNm3ToPpmReg(285, MW.NO2, 25), 151.6);
    near(mgNm3ToPpmReg(300, MW.NO2, 25), 159.5);
  });
  it('ppm NO₂ → mg/Nm³: 168 → 315,9 (25 °C) dan 344,8 (0 °C); 730 → 1373; 15 → 28,2', () => {
    near(ppmToMgNm3Reg(168, MW.NO2, 25), 315.9);
    near(ppmToMgNm3Reg(168, MW.NO2, 0), 344.8);
    near(ppmToMgNm3Reg(730, MW.NO2, 25), 1373);
    near(ppmToMgNm3Reg(15, MW.NO2, 25), 28.2);
  });
  it('massa molar NO₂ 46,005 dan CO 28,010; konversi bolak-balik', () => {
    expect(MW.NO2).toBe(46.005);
    expect(MW.CO).toBe(28.010);
    near(mgNm3ToPpmReg(ppmToMgNm3Reg(123, MW.CO, 25), MW.CO, 25), 123, 1e-12);
  });
  it('faktor koreksi O₂ regulasi (21 − 15)/21 = 0,2857 (diukur 0 % O₂, acuan 15 %)', () => {
    expect(O2_AIR_REG).toBe(21);
    near(correctToRefO2Reg(1, 0, 15), 0.2857, 1e-4);
  });
  it('toRegulationBasis: ppm @15 % O₂ → mg/Nm³ basis grup (15 %, 25 °C)', () => {
    const r = toRegulationBasis({ ppm: 168, refFrom: 15, molarMass: MW.NO2, basis: BASIS });
    near(r.mgNm3, 315.9);
    expect(r.ppm).toBe(168);
  });
});

describe('dua jalur koreksi O₂ (20,9 = tampilan, 21 = regulasi)', () => {
  it('identik bila O₂ ukur = O₂ acuan', () => {
    for (const o2 of [0, 3, 11, 15]) expect(correctToRefO2Reg(100, o2, o2)).toBe(correctToRefO2(100, o2, o2));
  });
  it('berbeda di luar itu (mis. 100 ppm @ 3 % → 15 %: 20,9 memberi 33,5, 21 memberi 33,3)', () => {
    const disp = correctToRefO2(100, 3, 15), reg = correctToRefO2Reg(100, 3, 15);
    near(disp, 100 * 5.9 / 17.9, 1e-12);
    near(reg, 100 * 6 / 18, 1e-12);
    expect(Math.abs(disp - reg)).toBeGreaterThan(0.1);
  });
  it('semua perbandingan ke limit di state/ dan ui/ hanya lewat jalur regulasi (tanpa correctToRefO2 20,9 / emissionAtBasis)', () => {
    const src = readFileSync(join(ROOT, 'src/state/regulations.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(src).toMatch(/correctToRefO2Reg/);
    expect(src).not.toMatch(/\bcorrectToRefO2\b(?!Reg)|emissionAtBasis|ppmToMgNm3\b(?!Reg)|mgNm3ToPpm\b(?!Reg)/);
  });
});

describe('complianceStatus', () => {
  it('≤ limit = within (nilai sama dengan limit = within); > limit = above', () => {
    expect(complianceStatus(320, 320)).toBe('within');
    expect(complianceStatus(319.9, 320)).toBe('within');
    expect(complianceStatus(320.0001, 320)).toBe('above');
  });
  it('null / tak terhingga = notModeled (tidak dimodelkan atau tidak ada limit)', () => {
    expect(complianceStatus(null, 320)).toBe('notModeled');
    expect(complianceStatus(10, null)).toBe('notModeled');
    expect(complianceStatus(undefined, undefined)).toBe('notModeled');
    expect(complianceStatus(NaN, 1)).toBe('notModeled');
  });
});

describe('content/regulations.json', () => {
  it('sama dengan seed dan lolos validasi', () => {
    const seed = JSON.parse(readFileSync(join(ROOT, 'docs/m9_pack/seeds/regulations.seed.json'), 'utf8'));
    // D2: teks dua bahasa { en, id }; sisi en sama dengan seed (nama resmi tetap satu string)
    const enOnly = (v) => (Array.isArray(v) ? v.map(enOnly) : v && typeof v === 'object' ? (Object.keys(v).length === 2 && 'en' in v && 'id' in v ? v.en : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enOnly(x)]))) : v);
    expect(enOnly(regs)).toEqual(seed);
    expect(validateRegulations(regs)).toEqual([]);
  });
  it('semua grup masih verified:false (flag hanya diubah pemilik proyek)', () => {
    expect(regs.groups.every((g) => g.verified === false)).toBe(true);
  });
  it('tabel turbin (Permen LH 13/2009) tidak punya limit CO; tabel mesin hanya dari Permen LHK 11/2021', () => {
    const gt = regs.groups.find((g) => g.id === 'gas-turbine');
    expect(gt.rows.some((r) => r.param === 'CO')).toBe(false);
    const eng = regs.groups.find((g) => g.id === 'engine');
    expect(eng.source).toBe('PermenLHK11-2021');
    expect(regs.groups.filter((g) => g.source === 'PermenLH13-2009').map((g) => g.id)).toEqual(['gas-turbine']);
  });
  const bad = (mut) => { const j = structuredClone(regs); mut(j); return validateRegulations(j).map((e) => `${e.field}:${e.code}`); };
  it('validasi menolak unit salah, refO2Pct bukan angka, sumber tidak terdaftar, kelas tidak dikenal', () => {
    expect(bad((j) => { j.groups[0].rows[0].unit = 'ppm'; })).toContain('groups[0].rows[0].unit:regUnit');
    expect(bad((j) => { j.groups[0].basis.refO2Pct = '15'; })).toContain('groups[0].basis.refO2Pct:regO2');
    expect(bad((j) => { j.groups[1].source = 'PermenX'; })).toContain('groups[1].source:regSource');
    expect(bad((j) => { j.groups[1].rows[0].class = '9999'; })).toContain('groups[1].rows[0].class:regClass');
    expect(bad((j) => { j.groups[0].rows[0].limit = -1; })).toContain('groups[0].rows[0].limit:positive');
    expect(bad((j) => { j.groups[0].rows[0].fuel = 'coal'; })).toContain('groups[0].rows[0].fuel:regFuel');
    expect(bad((j) => { j.groups[0].verified = 'no'; })).toContain('groups[0].verified:boolean');
    expect(bad((j) => { j.version = 2; })).toContain('version:version');
    expect(validateRegulations([])).toEqual([{ field: '(root)', code: 'notObject' }]);
  });
  it('loader: fallback bawaan; JSON rusak / skema salah → fallback + daftar galat (tidak crash)', async () => {
    expect(CONTENT_FILES.regulations).toBe('regulations.json');
    expect(fallbackContent('regulations')).toEqual(regs);
    const res = (body) => async () => ({ ok: true, headers: { get: () => 'application/json' }, text: async () => body });
    const ok = await loadContent('regulations', { fetchFn: res(JSON.stringify(regs)), base: '/' });
    expect(ok.source).toBe('file');
    const broken = await loadContent('regulations', { fetchFn: res('{'), base: '/' });
    expect(broken.source).toBe('fallback'); expect(broken.errors[0].code).toBe('parse');
    const wrong = structuredClone(regs); wrong.groups[0].rows[0].unit = 'ppm';
    const w = await loadContent('regulations', { fetchFn: res(JSON.stringify(wrong)), base: '/' });
    expect(w.source).toBe('fallback'); expect(w.errors.map((e) => e.code)).toContain('regUnit');
  });
});

describe('pemilih dan baris kepatuhan (state/regulations.js)', () => {
  it('equipment → grup; kelas default = kelas pertama; bahan bakar engine dikunci', () => {
    const s = regSelection({ regEquip: 'gasEngine', regClass: null, regFuel: 'oil' }, regs);
    expect(s.group.id).toBe('engine');
    expect(s.cls).toBe(regs.groups.find((g) => g.id === 'engine').capacityClasses[0].id);
    expect(s.fuel).toBe('gas');
    const t = regSelection({ regEquip: 'gasTurbine', regClass: 'x', regFuel: 'oil' }, regs);
    expect(t.cls).toBe('all'); expect(t.fuel).toBe('oil');
    expect(regSelectionPatch({ regEquip: 'gasEngine', regClass: '1000-3000', regFuel: 'gas' }, regs, { equip: 'gasTurbine' })).toEqual({ regEquip: 'gasTurbine', regClass: 'all', regFuel: 'gas' });
  });
  it('gas engine terkalibrasi 168 ppm → ≈ 316 mg/Nm³: Above untuk 285 dan 300 (tampil apa adanya)', () => {
    for (const cls of ['1000-3000', '500-1000', '100-500']) {
      const sel = regSelection({ regEquip: 'gasEngine', regClass: cls, regFuel: 'gas' }, regs);
      const nox = complianceRows(sel, { NOx: 168 }).find((r) => r.param === 'NOx');
      near(nox.model, 315.9);
      expect(nox.limit).toBe(rowsFor(sel.group, cls, 'gas').find((r) => r.param === 'NOx').limit);
      expect(nox.status).toBe('above');
      expect(nox.limitSource).toBe('regulation');
    }
  });
  it('diesel 730 ppm ≈ 1373 mg/Nm³ < limit kelas 1000-3000 → Within; CO engine Not modeled (model tidak menghitung)', () => {
    const sel = regSelection({ regEquip: 'dieselEngine', regClass: '1000-3000', regFuel: 'oil' }, regs);
    const rows = complianceRows(sel, { NOx: 730 });
    expect(rows.find((r) => r.param === 'NOx').status).toBe('within');
    const co = rows.find((r) => r.param === 'CO');
    expect(co.status).toBe('notModeled'); expect(co.reason).toBe('noValue');
  });
  it('turbin gas: NOx DLN 15 ppm ≈ 28 mg/Nm³ Within; CO tanpa limit regulasi → Not modeled sampai ada nilai permit/OEM', () => {
    const sel = regSelection({ regEquip: 'gasTurbine', regClass: 'all', regFuel: 'gas' }, regs);
    const rows = complianceRows(sel, { NOx: 15, CO: 10 });
    near(rows.find((r) => r.param === 'NOx').model, 28.2);
    expect(rows.find((r) => r.param === 'NOx').status).toBe('within');
    const co = rows.find((r) => r.param === 'CO');
    expect(co.limit).toBe(null); expect(co.status).toBe('notModeled'); expect(co.reason).toBe('noLimit');
    const withPermit = complianceRows(sel, { NOx: 15, CO: 10 }, { overrides: { CO: 50 }, overrideKind: { CO: 'permit' } }).find((r) => r.param === 'CO');
    expect(withPermit.limitSource).toBe('permit'); expect(withPermit.status).toBe('within');
  });
  it('override limit presenter → limitSource "override"; site data diutamakan dan ditandai', () => {
    const sel = regSelection({ regEquip: 'gasEngine', regClass: '1000-3000', regFuel: 'gas' }, regs);
    const ov = complianceRows(sel, { NOx: 168 }, { overrides: { NOx: 200 } }).find((r) => r.param === 'NOx');
    expect(ov.limitSource).toBe('override');
    near(ov.limit, ppmToMgNm3Reg(200, MW.NO2, 25));
    const site = complianceRows(sel, { NOx: 168 }, { siteData: { NOx: { value: '250', unit: 'mg', o2: '15' } } }).find((r) => r.param === 'NOx');
    expect(site.valueSource).toBe('site'); expect(site.site).toBe(250); expect(site.status).toBe('within');
  });
  it('site data dalam ppm @ O₂ lain dikoreksi lewat jalur regulasi (21)', () => {
    const v = siteToRegMg({ value: 100, unit: 'ppm', o2: 3 }, 'NOx', BASIS);
    near(v, ppmToMgNm3Reg(100 * 6 / 18, MW.NO2, 25), 1e-12);
    expect(siteToRegMg({ value: '', unit: 'mg', o2: 15 }, 'NOx', BASIS)).toBe(null);
    expect(siteToRegMg({ value: 5, unit: 'mg', o2: 22 }, 'NOx', BASIS)).toBe(null);
  });
  it('limit → ppm @15 % (untuk garis kurva) kebalikan dari jalur regulasi', () => {
    near(regMgToModelPpm(320, 'NOx', BASIS), 170.2);
    near(overrideToRegMg(regMgToModelPpm(320, 'NOx', BASIS), 'NOx', 15, BASIS), 320, 1e-12);
  });
  it('setiap equipment menunjuk grup yang ada di regulations.json', () => {
    for (const k of Object.keys(EQUIPMENT)) expect(groupOf(regs, k), k).toBeTruthy();
  });
});

describe('angka limit tidak tertanam di src/', () => {
  function files(dir, out = []) {
    for (const f of readdirSync(join(ROOT, dir))) {
      const p = join(dir, f);
      if (statSync(join(ROOT, p)).isDirectory()) files(p, out); else if (/\.(js|mjs)$/.test(f)) out.push(p);
    }
    return out;
  }
  it('tidak ada literal 285, 320, 2300, 3400 di src/**/*.js (di luar komentar)', () => {
    const hits = [];
    for (const f of files('src')) {
      const code = readFileSync(join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      for (const n of ['285', '320', '2300', '3400']) if (new RegExp(`(?<![\\d.])${n}(?![\\d.])`).test(code)) hits.push(`${f}: ${n}`);
    }
    expect(hits).toEqual([]);
  });
});
