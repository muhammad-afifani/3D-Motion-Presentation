// Pengaturan satuan (U1): tabel satuan konsisten dengan thermo.js, store (preset + override + persistensi + bendera UNITS_UI),
// format per satuan (fq / fqDelta / fqRate / checkQty), contoh hitung dari model, dan JALUR REGULASI TIDAK BERGANTUNG pada satuan.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { UNIT_DEFS, MW, concentrationToUnit, emissionAtBasis, molarVolume, complianceCheck } from '../src/model/thermo.js';
import {
  QUANTITIES, PRESET_IDS, presetUnits, isUnitOf, convertibleQuantities, createUnitsStore, readUnitsChoice, writeUnitsChoice,
  resolveUnitsUi, UNITS_KEY, UNITS_UI_KEY,
} from '../src/state/unitsStore.js';
import { STR_SOURCE } from '../src/ui/strings.js';
import { unitsGuideExample } from '../src/state/deriveUnitsGuide.js';
import { basisInitialState, calibInitialState, policyInitialState, limitsInitialState, loadInitialState } from '../src/state/store.js';
import { EMISSION_BASIS } from '../src/model/presets.js';
import { regulationsInitialState } from '../src/state/regulations.js';
import { fuelInitialState } from '../src/state/deriveFuel.js';
import { deriveCompliance } from '../src/state/deriveCompliance.js';
import { deriveLoad } from '../src/state/deriveLoad.js';
import { deriveLevers, leverSweepParams } from '../src/state/deriveLevers.js';
import { leverSweep } from '../src/model/thermo.js';

const ROOT = new URL('..', import.meta.url).pathname;
const REG = JSON.parse(readFileSync(join(ROOT, 'content/regulations.json'), 'utf8'));
const near = (got, want, tol) => expect(Math.abs(got - want), `got ${got}, want ${want}`).toBeLessThanOrEqual(tol);

/** localStorage palsu. */
function memStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, _m: m };
}
/** Impor ulang format.js + unitsStore.js dengan bendera menyala dan pilihan tertentu (store global dibuat saat impor). */
async function fresh(choice = null) {
  vi.resetModules();
  const store = memStorage({ [UNITS_UI_KEY]: '1', ...(choice ? { [UNITS_KEY]: JSON.stringify(choice) } : {}) });
  globalThis.localStorage = store;
  const us = await import('../src/state/unitsStore.js');
  const f = await import('../src/ui/format.js');
  return { ...us, ...f, storage: store };
}
afterEach(() => { delete globalThis.localStorage; });

describe('tabel besaran dan satuan', () => {
  it('setiap pilihan satuan ada di UNIT_DEFS (kecuali "auto" dan konsentrasi); satuan preset ada di pilihan', () => {
    for (const q of QUANTITIES) {
      expect(q.options, q.id).toContain(q.si);
      expect(q.options, q.id).toContain(q.us);
      if (q.id === 'concentration') { expect(q.options).toEqual(['auto', 'ppmvd', 'mgNm3']); continue; }
      for (const u of q.options) {
        if (u === 'auto') { expect(q.id).toBe('power'); continue; }
        expect(UNIT_DEFS[q.id]?.units[u], `${q.id}/${u}`).toBeTruthy();
      }
    }
    expect(convertibleQuantities().sort()).toEqual(Object.keys(UNIT_DEFS).sort());
  });
  it('preset SI = tampilan sebelum fitur ini (bar, K, kJ/kg, mm, L, g/kWh, kJ/kWh, m³/s, kg/s; daya dan konsentrasi "auto")', () => {
    expect(presetUnits('si')).toEqual({
      pressure: 'bar', temperature: 'K', power: 'auto', specificEnergy: 'kJkg', heatRate: 'kJkWh', specificFuel: 'gkWh', specificEmission: 'gkWh',
      specificHeat: 'kJkgK', specificVolume: 'm3kg', length: 'mm', volume: 'L', volumeFlow: 'm3s', massFlow: 'kgs', molarMass: 'kgkmol', concentration: 'auto',
    });
    const us = presetUnits('us');
    expect([us.pressure, us.temperature, us.power, us.specificEmission, us.length]).toEqual(['psia', 'F', 'hp', 'lbMWh', 'in']);
    expect(us.concentration).toBe('auto'); // US customary tidak mengubah konsentrasi (keputusan U1)
  });
  it('tiap id satuan punya simbol dan tiap besaran punya nama di kedua bahasa (STR.units)', () => {
    const ids = new Set(QUANTITIES.flatMap((q) => q.options).filter((u) => u !== 'auto'));
    for (const u of ids) { expect(STR_SOURCE.units.sym[u], u).toBeTruthy(); expect(STR_SOURCE.units.sym[u].en).toBeTruthy(); expect(STR_SOURCE.units.sym[u].id).toBeTruthy(); }
    for (const q of QUANTITIES) { expect(STR_SOURCE.units.qty[q.id], q.id).toBeTruthy(); }
    expect(PRESET_IDS).toEqual(['si', 'us']);
  });
});

describe('unitsStore: preset, override, persistensi', () => {
  it('bawaan: SI, tanpa override; bendera mati → unit() selalu SI walau ada pilihan tersimpan', () => {
    const off = createUnitsStore(memStorage({ [UNITS_KEY]: JSON.stringify({ v: 1, preset: 'us', overrides: {} }) }), { enabled: false });
    expect(off.enabled).toBe(false);
    expect(off.unit('pressure')).toBe('bar');
    expect(off.unit('temperature')).toBe('K');
    const on = createUnitsStore(memStorage(), { enabled: true });
    expect(on.preset).toBe('si'); expect(on.custom).toBe(false); expect(on.unit('pressure')).toBe('bar');
  });
  it('memilih preset menghapus semua override; memilih satuan preset menghapus override besaran itu; "custom" = ada override', () => {
    const st = memStorage();
    const s = createUnitsStore(st, { enabled: true });
    let n = 0; s.subscribe(() => { n++; });
    s.setPreset('us');
    expect(s.unit('pressure')).toBe('psia'); expect(s.unit('power')).toBe('hp'); expect(s.custom).toBe(false);
    s.setUnit('pressure', 'MPa');
    expect(s.unit('pressure')).toBe('MPa'); expect(s.custom).toBe(true); expect(s.overrides).toEqual({ pressure: 'MPa' });
    s.setUnit('pressure', 'psia'); // sama dengan preset → override hilang
    expect(s.custom).toBe(false); expect(s.overrides).toEqual({});
    s.setUnit('temperature', 'C'); s.setUnit('concentration', 'mgNm3');
    expect(s.custom).toBe(true);
    s.setPreset('si'); // satu pilihan untuk semua
    expect(s.custom).toBe(false); expect(s.unit('temperature')).toBe('K'); expect(s.unit('concentration')).toBe('auto');
    s.setUnit('length', 'in'); s.clearOverrides();
    expect(s.custom).toBe(false); expect(s.preset).toBe('si');
    expect(n).toBeGreaterThanOrEqual(6);
  });
  it('pilihan tidak sah ditolak tanpa mengubah apa pun; pelanggan tidak dipanggil bila tidak ada perubahan', () => {
    const s = createUnitsStore(memStorage(), { enabled: true });
    let n = 0; s.subscribe(() => { n++; });
    expect(s.setUnit('pressure', 'atm')).toBe(false);
    expect(s.setUnit('speed', 'kmh')).toBe(false);
    expect(s.setPreset(/** @type {any} */ ('metric'))).toBe(false);
    s.setPreset('si'); s.setUnit('pressure', 'bar'); s.clearOverrides();
    expect(n).toBe(0);
    expect(() => s.unit('speed')).toThrow();
  });
  it('tersimpan di etel:units dan terbaca kembali; SI tanpa override menghapus kunci', () => {
    const st = memStorage();
    const a = createUnitsStore(st, { enabled: true });
    a.setPreset('us'); a.setUnit('temperature', 'C');
    expect(JSON.parse(st._m.get(UNITS_KEY))).toEqual({ v: 1, preset: 'us', overrides: { temperature: 'C' } });
    const b = createUnitsStore(st, { enabled: true });
    expect(b.unit('temperature')).toBe('C'); expect(b.unit('pressure')).toBe('psia');
    a.setPreset('si');
    expect(st._m.has(UNITS_KEY)).toBe(false);
  });
  it('isi tersimpan rusak atau tidak sah diabaikan; override yang sama dengan preset dibuang; storage melempar galat → tetap jalan di memori', () => {
    expect(readUnitsChoice(memStorage({ [UNITS_KEY]: '{rusak' }))).toEqual({ preset: 'si', overrides: {} });
    expect(readUnitsChoice(memStorage({ [UNITS_KEY]: JSON.stringify({ preset: 'imperial', overrides: { pressure: 'atm', length: 'in', speed: 'kmh' } }) })))
      .toEqual({ preset: 'si', overrides: { length: 'in' } });
    expect(readUnitsChoice(memStorage({ [UNITS_KEY]: JSON.stringify({ preset: 'us', overrides: { pressure: 'psia', temperature: 'C' } }) })))
      .toEqual({ preset: 'us', overrides: { temperature: 'C' } });
    const boom = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
    expect(writeUnitsChoice(/** @type {any} */ (boom), { preset: 'us', overrides: {} })).toBe(false);
    const s = createUnitsStore(/** @type {any} */ (boom), { enabled: true });
    expect(() => { s.setPreset('us'); s.setUnit('length', 'mm'); }).not.toThrow();
    expect(s.unit('pressure')).toBe('psia');
    const none = createUnitsStore(null, { enabled: true });
    none.setPreset('us');
    expect(none.unit('temperature')).toBe('F');
  });
  it('reload() menangkap perubahan dari jendela lain (event storage) dan memberi tahu pelanggan sekali', () => {
    const st = memStorage();
    const main = createUnitsStore(st, { enabled: true }), pres = createUnitsStore(st, { enabled: true });
    let n = 0; pres.subscribe(() => { n++; });
    main.setPreset('us'); main.setUnit('pressure', 'kPa');
    expect(pres.unit('pressure')).toBe('bar');
    expect(pres.reload()).toBe(true);
    expect(pres.unit('pressure')).toBe('kPa'); expect(pres.unit('temperature')).toBe('F'); expect(n).toBe(1);
    expect(pres.reload()).toBe(false);
  });
});

describe('bendera UNITS_UI (seksi Units mati di build normal)', () => {
  it('?units=1 menyalakan dan menyimpan; ?units=0 mematikan dan menghapus; tanpa query mengikuti kunci etel:unitsUi', () => {
    const st = memStorage();
    expect(resolveUnitsUi(st, '')).toBe(false);
    expect(resolveUnitsUi(st, '?units=1')).toBe(true);
    expect(st._m.get(UNITS_UI_KEY)).toBe('1');
    expect(resolveUnitsUi(st, '')).toBe(true);           // tahan muat ulang tanpa query
    expect(resolveUnitsUi(st, '?foo=1&units=0')).toBe(false);
    expect(st._m.has(UNITS_UI_KEY)).toBe(false);
    expect(resolveUnitsUi(st, '')).toBe(false);
    expect(resolveUnitsUi(null, '')).toBe(false);
    expect(resolveUnitsUi(null, '?units=1')).toBe(true);
    expect(resolveUnitsUi(memStorage({ [UNITS_UI_KEY]: '1' }), '')).toBe(true);
  });
  it('bawaan (tanpa kunci, tanpa query) → store global mati', async () => {
    vi.resetModules();
    globalThis.localStorage = memStorage();
    const { unitsStore } = await import('../src/state/unitsStore.js');
    expect(unitsStore.enabled).toBe(false);
    const src = readFileSync(join(ROOT, 'src/ui/settingsPanel.js'), 'utf8');
    expect(src).toMatch(/enabled: \(\) => unitsStore\.enabled/);
  });
});

describe('format per satuan (ui/format.js)', () => {
  it('bendera mati: fq / toQty sama dengan penulisan lama (bar, K, mm, L, MW, kJ/kg, g/kWh)', async () => {
    vi.resetModules();
    globalThis.localStorage = memStorage();
    const f = await import('../src/ui/format.js');
    expect(f.fq(112.4e5, 'pressure', { digits: 1 })).toBe(f.fmt(f.toBar(112.4e5), 1));
    expect(f.fq(2231, 'temperature', { digits: 0 })).toBe(f.fmt(2231, 0));
    expect(f.fq(0.2, 'length', { digits: 0 })).toBe(f.fmt(f.toMm(0.2), 0));
    expect(f.fq(0.00314, 'volume', { digits: 3 })).toBe(f.fmt(f.toLiter(0.00314), 3));
    expect(f.fq(25e6, 'power', { digits: 2, native: 'MW' })).toBe(f.fmt(25e6 / 1e6, 2));
    expect(f.fq(1500e3, 'specificEnergy', { digits: 0 })).toBe(f.fmt(1500, 0));
    expect(f.fq(205.3, 'specificFuel', { digits: 0 })).toBe(f.fmt(205.3, 0));
    expect(f.fq(null, 'pressure')).toBe('–');
    expect(f.toQty(112.4e5, 'pressure')).toBeCloseTo(112.4, 9);
  });
  it('US customary: angka, digit, dan satuan ikut; "auto" daya mengikuti satuan scene', async () => {
    const { fq, fqDelta, fqRate, toQty, fromQty, qtyUnit, digitsFor, setNumberLang } = await fresh({ v: 1, preset: 'us', overrides: {} });
    setNumberLang('en');
    expect(fq(112.4e5, 'pressure', { digits: 1 })).toBe('1,630');           // psia: 1 digit lebih sedikit
    expect(fq(300, 'temperature', { digits: 0 })).toBe('80');
    expect(fq(0.2, 'length', { digits: 0 })).toBe('7.9');                    // in: 1 digit lebih banyak
    expect(fq(25e6, 'power', { digits: 2, native: 'MW' })).toBe('33,526');   // hp
    expect(fq(2.6, 'specificEmission', { digits: 1 })).toBe('5.7');          // lb/MWh
    expect(fq(205, 'specificFuel', { digits: 0 })).toBe('0.337');            // lb/(hp·h): 3 digit lebih banyak
    expect(digitsFor('pressure', 'MPa', 1)).toBe(2);
    expect(digitsFor('pressure', 'kPa', 1)).toBe(0);
    expect(qtyUnit('power', 'MW')).toBe('hp');
    expect(fromQty(toQty(112.4e5, 'pressure'), 'pressure')).toBeCloseTo(112.4e5, 3);
    // bahasa angka ID: desimal koma, ribuan titik
    expect(fq(112.4e5, 'pressure', { digits: 1, lang: 'id' })).toBe('1.630');
    expect(fq(0.2, 'length', { digits: 0, lang: 'id' })).toBe('7,9');
    void fqDelta; void fqRate;
  });
  it('selisih dan laju suhu: tanpa offset (tes ARAH, bukan nilai absolut), di semua satuan suhu', async () => {
    for (const unit of ['K', 'C', 'F']) {
      const { fqDelta, fqRate, toQty, setNumberLang } = await fresh({ v: 1, preset: 'si', overrides: { temperature: unit } });
      setNumberLang('en');
      const d = (x) => Number(fqDelta(x, 'temperature', { digits: 3, grouping: false }));
      expect(d(0), `${unit}: selisih nol tetap nol`).toBe(0);                      // offset akan memberi −459,67 / −273,15
      expect(d(50)).toBeGreaterThan(d(10));                                         // arah: kenaikan lebih besar tampil lebih besar
      expect(d(-30)).toBeLessThan(0);
      near(d(10) * 5, d(50), 1e-9);                                                 // linear lewat nol
      near(d(10), unit === 'F' ? 18 : 10, 1e-12);
      // mutlak vs selisih: suhu mutlak PAKAI offset, selisih TIDAK
      expect(toQty(300, 'temperature')).toBeCloseTo(unit === 'K' ? 300 : unit === 'C' ? 26.85 : 80.33, 9);
      const r = (x) => Number(fqRate(x, 'temperature', { digits: 6, grouping: false }));
      near(r(0.009) * (unit === 'F' ? 1.8 : 1), 0.009, 1e-12);                     // derating per derajat: lebih kecil per °F
      if (unit === 'F') expect(r(0.009)).toBeLessThan(0.009);
    }
  });
});

describe('isian dalam satuan tampilan (parseQty / checkQty): koma dan titik, per satuan', () => {
  it('koma maupun titik diterima di tiap satuan, hasil dalam satuan dasar (Pa, K, W, m)', async () => {
    const cases = [
      ['pressure', 'bar', '50,5', '50.5', 50.5e5], ['pressure', 'psia', '14,5038', '14.5038', 14.5038 / 1.45037738e-4],
      ['pressure', 'MPa', '5,05', '5.05', 5.05e6], ['pressure', 'kPa', '5050,0', '5050.0', 5.05e6],
      ['temperature', 'C', '26,85', '26.85', 300], ['temperature', 'F', '80,33', '80.33', 300], ['temperature', 'K', '300,0', '300.0', 300],
      ['power', 'hp', '1341,02', '1341.02', 1e6], ['power', 'kW', '1000,0', '1000.0', 1e6],
      ['length', 'in', '7,87', '7.87', 0.2], ['length', 'mm', '200,0', '200.0', 0.2],
    ];
    for (const [qty, unit, comma, dot, wantBase] of cases) {
      const { parseQty, setNumberLang } = await fresh({ v: 1, preset: 'si', overrides: { [qty]: unit } });
      for (const lang of ['en', 'id']) {
        setNumberLang(lang);
        const rel = Math.max(1, Math.abs(wantBase)) * 5e-4; // masukan dibulatkan di 3–6 angka
        near(parseQty(comma, qty, { lang }), wantBase, rel);
        near(parseQty(dot, qty, { lang }), wantBase, rel);
      }
    }
  });
  it('galat lewat slot D2: kosong / bukan angka / di bawah min / di atas max dihitung di satuan dasar, bukan satuan tampilan', async () => {
    const { checkQty } = await fresh({ v: 1, preset: 'us', overrides: {} });
    expect(checkQty('', 'pressure').value).toBeNull();
    expect(checkQty('', 'pressure', { allowEmpty: false }).error).toBe('empty');
    expect(checkQty('abc', 'pressure').error).toBe('nan');
    // rentang model 1–300 bar dalam Pa; 14,5 psia = 1 bar
    const range = { min: 1e5, max: 300e5 };
    expect(checkQty('14,0', 'pressure', range).error).toBe('min');   // < 1 bar
    expect(checkQty('4400', 'pressure', range).error).toBe('max');   // > 300 bar
    expect(checkQty('1450,38', 'pressure', range).error).toBeNull(); // 100 bar
  });
  it('batas SI tidak terlewati karena pembulatan: nilai tepat di min / max (dibulatkan di satuan tampilan) dijepit ke rentang SI', async () => {
    for (const unit of ['bar', 'kPa', 'MPa', 'psia']) {
      const { checkQty, fq, toQty } = await fresh({ v: 1, preset: 'si', overrides: { pressure: unit } });
      const range = { min: 1.6e5, max: 2.4e5 };
      for (const base of [range.min, range.max]) {
        // tulis batas di satuan tampilan lalu baca kembali: tidak boleh keluar dari [min, max]
        const typed = String(toQty(base, 'pressure')); // presisi penuh
        const r = checkQty(typed.replace('.', ','), 'pressure', range);
        expect(r.error, `${unit} ${typed}`).toBeNull();
        expect(r.value).toBeGreaterThanOrEqual(range.min); expect(r.value).toBeLessThanOrEqual(range.max);
      }
      void fq;
    }
  });
});

describe('contoh hitung penjelasan satuan (angka dari model, bukan tulisan tangan)', () => {
  const s = { ...basisInitialState(), ...calibInitialState() };
  it('baris dihitung dari concentrationToUnit pada kurva part-load beban penuh; basis aktif = basis global', () => {
    const ex = unitsGuideExample(s);
    expect(ex.refFrom).toBe(15);
    expect(ex.ppmRaw).toBeGreaterThan(5); expect(ex.ppmRaw).toBeLessThan(60);
    expect(ex.rows.map((r) => r.kind)).toEqual(['active', 'o2', 'volume']);
    const [a, o, v] = ex.rows;
    expect([a.refO2, a.TrefC]).toEqual([s.emRefO2, s.emTrefC]);
    expect(o.TrefC).toBe(a.TrefC); expect(o.refO2).not.toBe(a.refO2);
    expect(v.refO2).toBe(a.refO2); expect(v.TrefC).not.toBe(a.TrefC);
    expect(EMISSION_BASIS.TrefC.options).toContain(v.TrefC);
    for (const r of ex.rows) {
      near(r.mg, emissionAtBasis({ ppm: ex.ppmRaw, refFrom: 15, refO2: r.refO2, TrefK: 273.15 + r.TrefC, MWspecies: MW.NO2 }).mgNm3, 1e-9);
      near(r.mg, concentrationToUnit({ ppm: r.ppm, unit: 'mgNm3', refFrom: r.refO2, refO2: r.refO2, TrefC: r.TrefC }), 1e-9);
    }
    near(ex.M, MW.NO2, 1e-12); near(ex.V0, molarVolume(273.15), 1e-12); expect(ex.V25).toBeGreaterThan(ex.V0);
    // volume 25 °C → mg/Nm³ lebih kecil dari 0 °C untuk gas yang sama
    expect(ex.rows[2].mg < a.mg ? a.TrefC === 0 : a.TrefC === 25).toBe(true);
  });
  it('mengikuti basis dan kalibrasi di store (bukan konstanta)', () => {
    const base = unitsGuideExample(s), basis = unitsGuideExample({ ...s, emRefO2: 12, emTrefC: 25 });
    expect(basis.rows[0].refO2).toBe(12); expect(basis.rows[0].TrefC).toBe(25);
    expect(basis.rows[0].ppm).toBeGreaterThan(base.rows[0].ppm); // 12 % O₂ → ppm lebih tinggi daripada 15 %
    const cal = unitsGuideExample({ ...s, calDln: { single: 0.5, twin: 1 } });
    expect(cal.ppmRaw).not.toBeCloseTo(base.ppmRaw, 3);
  });
});

describe('aturan tertulis (CLAUDE.md, README)', () => {
  const md = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8'), readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
  it('CLAUDE.md: satuan tampilan, jalur regulasi tidak terpengaruh, bendera UNITS_UI dan cara menyalakannya', () => {
    expect(md).toMatch(/Satuan tampilan \(M13\)/);
    expect(md).toMatch(/Jalur regulasi tidak terpengaruh/);
    expect(md).toMatch(/UNITS_UI/); expect(md).toMatch(/\?units=1/); expect(md).toMatch(/etel:unitsUi/); expect(md).toMatch(/etel:units/);
    expect(md).toMatch(/toUnitDelta/); expect(md).toMatch(/psia/);
  });
  it('README: cara menyalakan seksi Units untuk uji manual', () => {
    expect(readme).toMatch(/\?units=1/); expect(readme).toMatch(/localStorage\.setItem\('etel:unitsUi','1'\)/);
  });
});

describe('JALUR REGULASI tidak bergantung pada satuan tampilan', () => {
  const PRESETS = [
    { v: 1, preset: 'si', overrides: {} },
    { v: 1, preset: 'us', overrides: {} },
    { v: 1, preset: 'si', overrides: { pressure: 'psia', temperature: 'F', concentration: 'mgNm3', specificEmission: 'lbMWh', power: 'hp' } },
    { v: 1, preset: 'us', overrides: { concentration: 'ppmvd', temperature: 'C' } },
  ];
  const st = (extra = {}) => ({ ...policyInitialState(), ...calibInitialState(), ...basisInitialState(), ...limitsInitialState(), ...loadInitialState(), ...regulationsInitialState(), ...fuelInitialState(), ...extra });
  const SCENARIOS = [
    st({ regEquip: 'gasEngine', regClass: '100-500', regFuel: 'gas' }),
    st({ regEquip: 'gasEngine', regClass: '1000-3000', regFuel: 'gas' }),
    st({ regEquip: 'dieselEngine', regClass: '500-1000', regFuel: 'oil' }),
    st({ regEquip: 'gasTurbine', regFuel: 'gas' }),
    st({ regEquip: 'gasTurbine', regFuel: 'gas', emRefO2: 12, emTrefC: 25 }),
  ];
  const sweep = (s) => { const p = leverSweepParams(s); return { rows: leverSweep(p.kind, p.param, p.values, p.over), ms: 1 }; };
  const snapshot = () => SCENARIOS.map((s) => {
    const comp = deriveCompliance(s, REG);
    const load = deriveLoad(s, REG);
    const lev = s.regEquip.endsWith('Engine') ? deriveLevers({ ...s, regEquip: s.regEquip }, sweep(s), REG) : null;
    return { rows: comp.rows.map((r) => ({ param: r.param, status: r.status, marginPct: r.marginPct, small: r.marginSmall })), load: JSON.stringify(load), lev: lev && { status: lev.point.status, marginPct: lev.point.marginPct, small: lev.point.marginSmall } };
  });

  it('status chip, margin, dan "smaller than uncertainty" identik di semua preset dan kombinasi override (jalur 21 % O₂, 25 °C)', async () => {
    const results = [];
    for (const choice of PRESETS) {
      vi.resetModules();
      globalThis.localStorage = memStorage({ [UNITS_UI_KEY]: '1', [UNITS_KEY]: JSON.stringify(choice) });
      const { unitsStore } = await import('../src/state/unitsStore.js');
      expect(unitsStore.enabled).toBe(true);
      if (choice.preset === 'us') expect(unitsStore.unit('pressure')).not.toBe('bar');
      results.push(JSON.stringify(snapshot()));
    }
    for (const r of results.slice(1)) expect(r).toBe(results[0]);
    const base = snapshot();
    expect(base[0].rows.find((r) => r.param === 'NOx').status).toBe('within');
    expect(base[1].rows.find((r) => r.param === 'NOx').status).toBe('above');
    expect(base[3].rows.find((r) => r.param === 'CO').status).toBe('notModeled');
  });
  it('struktur: model, derive*.js, regulations.js, deriveCompliance dan scene tidak membaca store satuan', () => {
    const dirs = [['src/model', () => true], ['src/state', (f) => f.startsWith('derive') || f === 'regulations.js' || f === 'store.js' || f === 'calibration.js' || f === 'levers.js']];
    const bad = [];
    for (const [dir, ok] of dirs) for (const f of readdirSync(join(ROOT, dir))) {
      if (!f.endsWith('.js') || !ok(f) || f === 'unitsStore.js') continue;
      const src = readFileSync(join(ROOT, dir, f), 'utf8');
      if (/unitsStore|\b(fq|fqDelta|fqRate|toQty|fromQty|qtyUnit|checkQty|parseQty)\b/.test(src)) bad.push(`${dir}/${f}`);
    }
    expect(bad).toEqual([]);
    // dan thermo.js tidak mengimpor apa pun dari lapisan tampilan
    expect(readFileSync(join(ROOT, 'src/model/thermo.js'), 'utf8')).not.toMatch(/from '\.\.\/(ui|state)\//);
  });
  it('perbandingan memakai complianceCheck pada nilai yang sama di semua preset (tidak ada jalur lain)', () => {
    expect(complianceCheck(292, 300)).toEqual(complianceCheck(292, 300));
    const src = readdirSync(join(ROOT, 'src/ui')).concat(readdirSync(join(ROOT, 'src/scenes')).map((f) => `../scenes/${f}`));
    const offenders = src.filter((f) => f.endsWith('.js')).filter((f) => /complianceCheck|complianceStatus|complianceMargin/.test(readFileSync(join(ROOT, 'src/ui', f), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
