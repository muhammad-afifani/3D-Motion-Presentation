// Pengaturan satuan U2: slider, isian, HUD, overlay, dan pesan memakai satuan pilihan lewat fq / fqDelta / fqRate.
// Bukti: (1) preset SI menulis teks yang SAMA dengan sebelum U2 (kalimat dan HUD; snapshot browser per scene: scripts/e2e/unitsnap.mjs);
// (2) slider tiap besaran × satuan: langkah bulat, hasil konversi balik tidak pernah di luar rentang SI; (3) isian koma / titik per satuan;
// (4) selisih suhu dan laju per derajat tanpa offset (tes arah); (5) jalur regulasi tidak tersentuh.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { UNIT_DEFS } from '../src/model/thermo.js';
import { QUANTITIES, UNITS_KEY, UNITS_UI_KEY } from '../src/state/unitsStore.js';
import { qtyConv, niceStep, checkConv, fq, parseNumber } from '../src/ui/format.js';
import { GAS_COMPRESSOR, GT_RANGES, FLAME_RANGES, CYCLES, LOAD_RANGE } from '../src/model/presets.js';

const ROOT = new URL('..', import.meta.url).pathname;
const near = (got, want, tol) => expect(Math.abs(got - want), `got ${got}, want ${want}`).toBeLessThanOrEqual(tol);
function memStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
}
async function fresh(choice = null) {
  vi.resetModules();
  globalThis.localStorage = memStorage({ [UNITS_UI_KEY]: '1', ...(choice ? { [UNITS_KEY]: JSON.stringify(choice) } : {}) });
  const f = await import('../src/ui/format.js');
  const st = await import('../src/ui/strings.js');
  f.setNumberLang('en'); st.applyStringLang('en');
  return { ...f, ...st };
}
afterEach(() => { delete globalThis.localStorage; });
const US = { v: 1, preset: 'us', overrides: {} };

/** Slider yang memakai satuan pilihan (qty, satuan simpanan, rentang) persis seperti di scene. */
const SLIDERS = [
  { name: 'Scene 2 / 5 T3', qty: 'temperature', from: 'K', r: GT_RANGES.T3 },
  { name: 'Scene 2 Brayton T3', qty: 'temperature', from: 'K', r: CYCLES.brayton.ranges.T3 },
  { name: 'Scene 3 T_in', qty: 'temperature', from: 'K', r: FLAME_RANGES.Tin },
  { name: 'Scene 5 T ambient (°C)', qty: 'temperature', from: 'C', r: GT_RANGES.Tamb, kAsC: true },
  { name: 'Scene 7 P suction', qty: 'pressure', from: 'bar', r: GAS_COMPRESSOR.ranges.Psuc },
  { name: 'Scene 7 P discharge', qty: 'pressure', from: 'bar', r: GAS_COMPRESSOR.ranges.Pdis },
  { name: 'Scene 7 massa molar gas', qty: 'molarMass', from: 'kgkmol', r: GAS_COMPRESSOR.ranges.MW },
  { name: 'Scene 7 laju massa', qty: 'massFlow', from: 'kgs', r: GAS_COMPRESSOR.ranges.mdot },
];
const OPTIONS = (qty) => QUANTITIES.find((q) => q.id === qty).options.filter((u) => u !== 'auto');
const isNice = (x) => { const m = x / 10 ** Math.floor(Math.log10(x)); return [1, 2, 5, 10].some((c) => Math.abs(m - c) < 1e-9); };

describe('slider berkonversi: langkah bulat dan rentang SI tidak pernah terlewati (tiap besaran × satuan)', () => {
  for (const sp of SLIDERS) {
    for (const unit of OPTIONS(sp.qty)) {
      it(`${sp.name} → ${unit}`, () => {
        const c = qtyConv(sp.qty, sp.from, { unit: unit, kAsC: sp.kAsC });
        const d = c.range(sp.r);
        if (c.same) { expect(d).toEqual({ min: sp.r.min, max: sp.r.max, step: sp.r.step }); return; }
        // langkah: 1 / 2 / 5 × 10^k, dalam faktor 2,5 dari langkah SI yang dikonversi
        expect(isNice(d.step), `langkah ${d.step}`).toBe(true);
        const exact = sp.r.step * c.ratio;
        expect(d.step / exact).toBeLessThan(2.5); expect(d.step / exact).toBeGreaterThan(0.4);
        // batas tampilan membungkus rentang SI dan jatuh pada kelipatan langkah
        expect(d.min).toBeLessThanOrEqual(c.toDisp(sp.r.min) + 1e-9); expect(d.max).toBeGreaterThanOrEqual(c.toDisp(sp.r.max) - 1e-9);
        near(d.min / d.step, Math.round(d.min / d.step), 1e-9); near(d.max / d.step, Math.round(d.max / d.step), 1e-9);
        // geser di seluruh jangkauan: hasil konversi balik selalu di dalam [min, max] SI
        let n = 0;
        for (let x = d.min; x <= d.max + d.step / 2; x += d.step) {
          const v = c.clamp(c.fromDisp(x), sp.r.min, sp.r.max);
          expect(v).toBeGreaterThanOrEqual(sp.r.min); expect(v).toBeLessThanOrEqual(sp.r.max);
          n++;
        }
        expect(n).toBeGreaterThan(3);
        // ujung rentang: tepat min dan max SI (bukan di luar karena pembulatan)
        expect(c.clamp(c.fromDisp(d.min), sp.r.min, sp.r.max)).toBe(Math.max(sp.r.min, Math.min(sp.r.max, c.fromDisp(d.min))));
        // nilai SI → tampilan → SI kembali (tanpa pembulatan tampilan)
        for (const v of [sp.r.min, (sp.r.min + sp.r.max) / 2, sp.r.max, sp.r.min + sp.r.step]) near(c.fromDisp(c.toDisp(v)), v, 1e-9 * Math.max(1, Math.abs(v)));
      });
    }
  }
  it('langkah wajar per satuan contoh: 10 K → 20 °F (bukan 18), 0,5 bar → 10 psia, 5 K tetap 5 °C', () => {
    expect(qtyConv('temperature', 'K', { unit: 'F' }).range({ min: 1200, max: 1700, step: 10 }).step).toBe(20);
    expect(qtyConv('temperature', 'K', { unit: 'C' }).range({ min: 1200, max: 1700, step: 10 }).step).toBe(10);
    expect(qtyConv('pressure', 'bar', { unit: 'psia' }).range({ min: 5, max: 40, step: 0.5 }).step).toBe(10);
    expect(qtyConv('pressure', 'bar', { unit: 'kPa' }).range({ min: 5, max: 40, step: 0.5 }).step).toBe(50);
    expect(qtyConv('massFlow', 'kgs', { unit: 'lbs' }).range({ min: 5, max: 30, step: 0.5 }).step).toBe(1);
    expect(qtyConv('temperature', 'C', { unit: 'F', kAsC: true }).range({ min: -10, max: 50, step: 1 }).step).toBe(2);
  });
  it('satuan sama dengan satuan simpanan: identitas persis (angka SI tidak bergeser)', () => {
    for (const sp of SLIDERS) {
      const c = qtyConv(sp.qty, sp.from, { unit: sp.from });
      expect(c.same).toBe(true);
      for (const v of [sp.r.min, 301.37, sp.r.max]) { expect(c.toDisp(v)).toBe(v); expect(c.fromDisp(v)).toBe(v); }
      expect(c.digits(2)).toBe(2);
    }
  });
  it('niceStep: 1 / 2 / 5 × 10^k terdekat (skala log)', () => {
    expect([niceStep(18), niceStep(7.25), niceStep(0.5), niceStep(0.9), niceStep(3), niceStep(0.0164)]).toEqual([20, 10, 0.5, 1, 2, 0.02]);
    expect(niceStep(0)).toBe(0);
  });
});

describe('isian berkonversi: koma dan titik di satuan terpilih, galat di satuan tampilan, hasil dijepit ke rentang SI', () => {
  it('target emisi mesin g/kWh → lb/MWh dan g/(hp·h): koma maupun titik, EN dan ID', () => {
    for (const unit of OPTIONS('specificEmission')) {
      const c = qtyConv('specificEmission', 'gkWh', { unit });
      const f = UNIT_DEFS.specificEmission.units[unit].factor;
      const typed = (11.1 * f).toFixed(3);
      for (const lang of ['en', 'id']) for (const t of [typed, typed.replace('.', ',')]) {
        // "xx.yyy" di ID adalah ribuan hanya bila bagian depan 1–3 digit bukan 0 dan tepat 3 digit di belakang: pakai 2 desimal untuk menghindari kasus itu
        const t2 = Number(t.replace(',', '.')).toFixed(2).replace('.', t.includes(',') ? ',' : '.');
        const r = checkConv(t2, c, { min: 0, minExclusive: true, allowEmpty: false, lang });
        expect(r.error, `${unit} ${lang} ${t2}`).toBeNull();
        near(r.value, 11.1, 0.02 / f + 0.01);
      }
    }
  });
  it('galat di satuan tampilan: bukan angka, kosong, di bawah / di atas rentang; nilai tepat di batas dijepit (tidak keluar rentang)', () => {
    const c = qtyConv('pressure', 'bar', { unit: 'psia' });
    const range = { min: 5, max: 40 };
    expect(checkConv('abc', c, range).error).toBe('nan');
    expect(checkConv('', c, { ...range, allowEmpty: false }).error).toBe('empty');
    expect(checkConv('', c, range)).toEqual({ value: null, error: null });
    expect(checkConv('70', c, range).error).toBe('min');      // 70 psia = 4,8 bar < 5 bar
    expect(checkConv('600', c, range).error).toBe('max');     // 600 psia = 41,4 bar > 40 bar
    for (const [t, want] of [['72,53', 5], ['580,1', 40], ['300', 300 / 14.5037738]]) {
      const r = checkConv(t, c, range);
      expect(r.error, t).toBeNull();
      expect(r.value).toBeGreaterThanOrEqual(5); expect(r.value).toBeLessThanOrEqual(40);
      near(r.value, want, 0.01);
    }
    // di bawah batas tampilan (72,5189 psia = 5 bar): galat 'min', bukan dijepit diam-diam
    expect(checkConv('72,5', c, range).error).toBe('min');
  });
  it('isian suhu dan selisih: °F → K lewat offset; nilai di batas bawah SI tidak turun di bawahnya', () => {
    const c = qtyConv('temperature', 'K', { unit: 'F' });
    near(checkConv('80,33', c, { min: 250, max: 1000 }).value, 300, 1e-6);
    near(checkConv('80.33', c, { min: 250, max: 1000 }).value, 300, 1e-6);
    expect(checkConv('-300', c, { min: 250, max: 1000 }).error).toBe('min'); // −300 °F = 185 K
  });
  it('parseNumber: pemisah ribuan ID / EN tetap dipatuhi di isian satuan (1.630 psia di ID = 1630)', () => {
    expect(parseNumber('1.630', 'id')).toBe(1630); expect(parseNumber('1,630', 'en')).toBe(1630);
    expect(parseNumber('1,63', 'id')).toBe(1.63); expect(parseNumber('1.63', 'en')).toBe(1.63);
  });
});

describe('preset SI: teks identik dengan sebelum U2 (kalimat dan HUD)', () => {
  it('kalimat yang dikonversi menulis persis seperti dulu', async () => {
    const { STR } = await fresh({ v: 1, preset: 'si', overrides: {} });
    expect(STR.scene1.formula.VcVal(0.0031416, 16)).toBe('3.142 L (r = 16.0)');
    expect(STR.scene3.overlay.mixDiesel(0.6, 0.9, 100.4)).toBe('Non-homogeneous mixture: mean φ 0.60, flame zone φ 0.90 (ΔT +100 K)');
    expect(STR.scene3.overlay.mixTurbine(0.5, 700)).toBe('Lean premix: premix-zone φ 0.50, T_in = T₂ 700 K');
    expect(STR.scene3.overlay.phaseTurbine(1500e3)).toBe('Premix-zone q_in 1,500 kJ/kg air · flame size ∝ q_in');
    expect(STR.scene3.notes.premix(1500, 0.4)).toBe('Premix-zone φ, not the overall turbine φ (T₃ 1,500 K ≈ 0.40)');
    expect(STR.scene3.notes.tinManual(700)).toBe('Manual T_in (model: 700 K)');
    expect(STR.scene3.tinValue(300, true)).toBe('300 K (manual)');
    expect(STR.scene4.messageWithNumbers(7.1, 1800)).toBe('NOx rises exponentially with temperature: +100 K at 1,800 K ≈ ×7.1 NO formation rate (Zeldovich model).');
    expect(STR.scene5.messageWithNumbers(0.4, 0.005)).toBe('The compressor consumes ±40% of the turbine work. A hot ambient cuts power by ±0.50%/°C (model).');
    expect(STR.scene5.hud.power.label(20)).toBe('Power (ṁ = 20 kg/s)');
    expect(STR.scene5.hud.power.tip(20)).toBe('Shaft power = ṁ · w_net. ṁ = 20 kg/s is an example size (generic industrial class), not unit data.');
    expect(STR.scene5.hud.derate.tip(false)).toBe('Power loss per °C above ISO 15 °C.');
    expect(STR.scene5.hud.derate.tip(true)).toBe('Power loss per °C above ISO 15 °C.\nAt 15 °C it is computed at the 35 °C reference.');
    expect(STR.scene5.hud.refSuffix()).toBe(' (ref 35 °C)');
    expect(STR.scene5.overlay.ambient(35, 0.93)).toBe('Ambient 35 °C → power −7.0% vs ISO');
    expect(STR.scene5.overlay.t45(1100)).toBe('T₄.₅ (between the GG turbine and the power turbine) = 1,100 K');
    expect(STR.scene7.demoCase(20)).toBe('Demo case (ṁ = 20.0 kg/s)');
    expect(STR.scene9.leversTab.value.Tivc(320)).toBe('320 K');
    expect(STR.scene9.leversTab.value.Pivc(2e5)).toBe('2.0 bar');
    expect(STR.scene4.calib.litEngine(11.1)).toBe('typical literature ≈ 11.1 g/kWh');
    expect(STR.scene4.calib.doneDln(15, 1900)).toBe('Done: 15.0 ppmvd at design flame T 1,900 K');
    expect(STR.scene4.calib.targetEngine()).toBe('Target NOx at preset timing [g/kWh]');
    expect(STR.scene8.hud.slip.value(0.01, 2.5)).toBe('1.0 % · 2.50 g/kWh');
  });
  it('mesin HUD: tile dikonversi di SI sama dengan fmt lama', async () => {
    const { fq, fmt } = await fresh({ v: 1, preset: 'si', overrides: {} });
    expect(fq(112.4e5, 'pressure', { digits: 1 })).toBe(fmt(112.4, 1));
    expect(fq(1500e3, 'specificEnergy', { digits: 0 })).toBe(fmt(1500, 0));
    expect(fq(25.3e6, 'power', { digits: 2, native: 'MW' })).toBe(fmt(25.3, 2));
    expect(fq(0.0314, 'volumeFlow', { digits: 3 })).toBe(fmt(0.0314, 3));
    expect(fq(7.5e-5 * 0 + 11.06, 'specificEmission', { digits: 2 })).toBe(fmt(11.06, 2));
  });
});

describe('US customary: kalimat, tile, dan arah selisih suhu', () => {
  it('tekanan, suhu, daya, energi, emisi di kalimat dan tile ikut satuan', async () => {
    const { STR, fq, unitSym } = await fresh(US);
    expect(STR.scene1.formula.VcVal(0.0031416, 16)).toBe('191.7 in³ (r = 16.0)');
    expect(STR.scene3.tinValue(300, false)).toBe('80 °F (model)');
    expect(STR.scene3.overlay.phaseTurbine(1500e3)).toBe('Premix-zone q_in 645 Btu/lb air · flame size ∝ q_in');
    expect(STR.scene5.hud.power.label(20)).toBe('Power (ṁ = 44 lb/s)');
    expect(STR.scene9.leversTab.value.Pivc(2e5)).toBe('29 psia');
    expect(STR.scene4.calib.targetEngine()).toBe('Target NOx at preset timing [lb/MWh]');
    expect(fq(25.3e6, 'power', { digits: 2, native: 'MW' })).toBe('33,928');
    expect(unitSym('power', 'MW')).toBe('hp'); expect(unitSym('pressure')).toBe('psia'); expect(unitSym('specificEmission')).toBe('lb/MWh');
  });
  it('SELISIH suhu: tanpa offset (arah): 100 K → +180 °F, nol tetap nol, naik lebih besar → angka lebih besar; absolut memakai offset', async () => {
    const { STR, fqDelta } = await fresh(US);
    expect(STR.scene3.overlay.mixDiesel(0.6, 0.9, 100)).toMatch(/\(ΔT \+180 °F\)$/);
    expect(STR.scene3.overlay.mixDiesel(0.6, 0.9, 0)).toMatch(/\(ΔT \+0 °F\)$/);          // offset akan memberi −459
    expect(STR.scene4.messageWithNumbers(7.1, 1800)).toMatch(/^NOx rises exponentially with temperature: \+180 °F at 2,780 °F ≈ ×7\.1/);
    const d = (x) => Number(fqDelta(x, 'temperature', { digits: 3, grouping: false }));
    expect(d(50)).toBeGreaterThan(d(10)); expect(d(10)).toBeGreaterThan(d(0)); expect(d(-10)).toBeLessThan(0);
    near(d(50) / d(10), 5, 1e-9);
    // Scene 7: selisih T nyala (naik / turun / nol), mutlak T nyala dengan offset
    const m = STR.scene7.messageShift(1, 0.02, 0.8, 0.01, 50);
    expect(m).toMatch(/premix-zone flame T \+90 °F versus/);
    expect(STR.scene7.messageShift(1, 0.02, 0.8, 0.01, -50)).toMatch(/flame T −90 °F versus/);
    expect(STR.scene7.messageShift(1, 0.02, 0.8, 0.01, 0)).toMatch(/flame T \+0 °F versus/);
    expect(STR.scene7.messageDesign(1, 0.8, 1900)).toMatch(/flame T 2,960 °F \(model\)/);
  });
  it('derating %/K: laju per derajat dibagi 1,8 di °F; ambient ditulis dalam °C bila K dipilih, °F bila F', async () => {
    const f1 = await fresh(US);
    const msg = f1.STR.scene5.messageWithNumbers(0.4, 0.005);
    expect(msg).toMatch(/±0\.28%\/°F \(model\)/);
    expect(f1.STR.scene5.hud.derate.tip(true)).toBe('Power loss per °F above ISO 59 °F.\nAt 59 °F it is computed at the 95 °F reference.');
    expect(f1.STR.scene5.overlay.ambient(35, 0.93)).toBe('Ambient 95 °F → power −7.0% vs ISO');
    expect(f1.ratePerSym('%', 'temperature', { kAsC: true })).toBe('%/°F');
    const f2 = await fresh({ v: 1, preset: 'si', overrides: { temperature: 'K' } });
    expect(f2.STR.scene5.overlay.ambient(35, 0.93)).toBe('Ambient 35 °C → power −7.0% vs ISO'); // K tidak dipakai untuk suhu ambient
    expect(f2.ratePerSym('%', 'temperature', { kAsC: true })).toBe('%/°C');
    const f3 = await fresh({ v: 1, preset: 'si', overrides: { temperature: 'C' } });
    expect(f3.STR.scene3.overlay.mixDiesel(0.6, 0.9, 100)).toMatch(/\(ΔT \+100 °C\)$/);
    expect(f3.STR.scene3.tinValue(300, false)).toBe('27 °C (model)');
  });
  it('slider ambient (°C simpanan) lewat K ke °F: 35 °C → 95 °F; langkah 1 °C → 2 °F; rentang −10…50 °C → 14…122 °F', () => {
    const c = qtyConv('temperature', 'C', { unit: 'F', kAsC: true });
    near(c.toDisp(35), 95, 1e-9); near(c.fromDisp(95), 35, 1e-9);
    expect(c.range(GT_RANGES.Tamb)).toEqual({ min: 14, max: 122, step: 2 });
    expect(c.clamp(c.fromDisp(122), -10, 50)).toBe(50);
  });
});

describe('konsentrasi: tile tunggal mengikuti satuan, Scene 4 tetap berdampingan', () => {
  it('fqConc: ppmvd bawaan; mg/Nm³ pada basis tampilan (NO₂ 46,005; CO 28,010) di 0 dan 25 °C', async () => {
    const a = await fresh({ v: 1, preset: 'si', overrides: { concentration: 'mgNm3' } });
    near(Number(a.fqConc(25, { species: 'nox', refO2: 15, TrefC: 0, digits: 2, grouping: false })), 51.31, 0.01);
    near(Number(a.fqConc(25, { species: 'nox', refO2: 15, TrefC: 25, digits: 2 })), 47.01, 0.01);
    near(Number(a.fqConc(25, { species: 'co', refO2: 15, TrefC: 0, digits: 2 })), 31.24, 0.01);
    expect(a.concUnit('ppmvd')).toBe('mgNm3');
    expect(a.concSym('ppmvd')).toBe('mg/Nm³');
    const b = await fresh({ v: 1, preset: 'si', overrides: {} });
    expect(b.fqConc(25, { species: 'nox', refO2: 15, TrefC: 0, digits: 1 })).toBe('25.0');
    expect(b.concUnit('ppmvd')).toBe('ppmvd'); expect(b.concSym('ppmvd')).toBe('ppmvd'); expect(b.concSym('mgNm3')).toBe('mg/Nm³');
    const c = await fresh({ v: 1, preset: 'us', overrides: {} });
    expect(c.concUnit('mgNm3')).toBe('mgNm3'); // US customary tidak mengubah konsentrasi
  });
  it('fqConcReg: NOx mg/Nm³ @25 °C → ppmvd lewat mgNm3ToPpmReg (batas 320 mg/Nm³ = 170,2 ppm); mg tetap bila "auto"', async () => {
    const a = await fresh({ v: 1, preset: 'si', overrides: { concentration: 'ppmvd' } });
    near(Number(a.fqConcReg(320, { species: 'nox', TrefC: 25, digits: 2 })), 170.2, 0.1);
    const b = await fresh({ v: 1, preset: 'si', overrides: {} });
    expect(b.fqConcReg(320, { species: 'nox', TrefC: 25, digits: 0 })).toBe('320');
  });
});

describe('penjaga struktur U2', () => {
  const read = (f) => readFileSync(join(ROOT, f), 'utf8');
  it('HUD dan slider di scenes/ tidak lagi menulis satuan tetap (kecuali grafik batang = U3 dan persen)', () => {
    const bad = [];
    for (const f of readdirSync(join(ROOT, 'src/scenes')).filter((x) => x.endsWith('.js'))) {
      read(`src/scenes/${f}`).split('\n').forEach((l, i) => {
        if (/createBarChart\(/.test(l)) return; // grafik batang: U3
        if (/(?:unit|label):\s*(?:U|SU)\.(?:bar|K|kJkg|kJkWh|MW|gkWh|degC|mm|L|kgs|m3s)\b/.test(l)) bad.push(`${f}:${i + 1}`);
        if (/\b(toMm|toLiter)\(/.test(l)) bad.push(`${f}:${i + 1} toMm/toLiter`);
      });
    }
    expect(bad).toEqual([]);
  });
  it('main.js: ganti satuan memasang ulang scene seperti ganti bahasa; satuan isian batas mengikuti konsentrasi', () => {
    const m = read('src/main.js');
    expect(m).toMatch(/unitsStore\.subscribe\(\(\) => \{ syncLimUnit\(\); relangView\(\); \}\)/);
    expect(m).toMatch(/limUnit: u === 'mgNm3' \? 'mg' : 'ppm'/);
  });
  it('slider berkonversi: nilai di store tetap satuan simpanan (qty + from) dan jalur regulasi tidak membaca fq', () => {
    const c = read('src/ui/controls.js');
    expect(c).toMatch(/qtyConv/); expect(c).toMatch(/o\.qty/);
    for (const f of readdirSync(join(ROOT, 'src/state')).filter((x) => x.startsWith('derive') || x === 'regulations.js')) {
      expect(read(`src/state/${f}`), f).not.toMatch(/\b(fqConc|fqConcReg|qtyConv|fqFrom)\b/);
    }
  });
});
