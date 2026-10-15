// Step 03 (M9): chip kepatuhan di Scene 6 dan Scene 9 — semua perbandingan lewat jalur regulasi (21, 25 °C),
// override limit presenter ditandai, CO turbin hanya dari isian permit/OEM, site data diutamakan, pemilih di store.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { MW, ppmToMgNm3Reg, toRegulationBasis } from '../src/model/thermo.js';
import { basisInitialState, calibInitialState, limitsInitialState, loadInitialState, policyInitialState, createStore } from '../src/state/store.js';
import { deriveLoad } from '../src/state/deriveLoad.js';
import { deriveCompliance } from '../src/state/deriveCompliance.js';
import { regulationsInitialState, regSelectionPatch, siteDataPatch } from '../src/state/regulations.js';
import { readSaved, writeSaved, PERSIST_FIELDS } from '../src/state/persist.js';
import { limitSourceText } from '../src/scenes/policy.js';
import { STR } from '../src/ui/strings.js';

const regs = JSON.parse(readFileSync(new URL('../content/regulations.json', import.meta.url), 'utf8'));
const st = (x = {}) => ({ ...policyInitialState(), ...calibInitialState(), ...basisInitialState(), ...limitsInitialState(), ...loadInitialState(), ...regulationsInitialState(), theta: 0, ...x });
const near = (got, want, rel = 1e-9) => expect(Math.abs(got / want - 1)).toBeLessThanOrEqual(rel);
const gtNoxMg = regs.groups.find((g) => g.id === 'gas-turbine').rows.find((r) => r.fuel === 'gas' && r.param === 'NOx').limit;

describe('Scene 9 strip: deriveCompliance', () => {
  it('diesel engine (default): NOx model dari preset, CO Not modeled, kalimat single-cylinder tampil', () => {
    const f = deriveCompliance(st(), regs);
    expect(f.sel.equip).toBe('dieselEngine'); expect(f.sel.fuel).toBe('oil');
    expect(f.isEngine).toBe(true);
    const nox = f.rows.find((r) => r.param === 'NOx');
    expect(nox.valueSource).toBe('model'); expect(nox.limitSource).toBe('regulation');
    expect(f.rows.find((r) => r.param === 'CO')?.status ?? 'notModeled').toBe('notModeled');
    expect(STR.regulation.singleCylinder).toBe('Model is a single-cylinder preset. The capacity class only selects the limit.');
  });
  it('gas engine terkalibrasi berada di atas limit kelas mana pun (tampil apa adanya, kalibrasi tidak disetel)', () => {
    for (const cls of ['100-500', '500-1000', '1000-3000']) {
      const f = deriveCompliance(st({ regEquip: 'gasEngine', regClass: cls, regFuel: 'gas' }), regs);
      expect(f.rows.find((r) => r.param === 'NOx').status, cls).toBe('above');
    }
    expect(calibInitialState().calEngine.gas).toBeGreaterThan(0); // faktor default tidak diubah di sini
  });
  it('turbin gas: NOx Within, CO Not modeled (tanpa limit) sampai isian permit/OEM; lalu limit ditandai "permit/OEM value (user input)"', () => {
    const base = st({ regEquip: 'gasTurbine', regFuel: 'gas' });
    const f = deriveCompliance(base, regs);
    expect(f.rows.find((r) => r.param === 'NOx').status).toBe('within');
    const co = f.rows.find((r) => r.param === 'CO');
    expect(co.status).toBe('notModeled'); expect(co.reason).toBe('noLimit');
    const g = deriveCompliance({ ...base, limCO: 50 }, regs).rows.find((r) => r.param === 'CO');
    expect(g.limitSource).toBe('permit'); expect(g.status).not.toBe('notModeled');
    expect(STR.regulation.limitSource.permit).toBe('permit/OEM value (user input)');
  });
  it('override NOx presenter aktif → chip menulis "limit: user override"; hanya berlaku untuk turbin gas', () => {
    const t = deriveCompliance(st({ regEquip: 'gasTurbine', regFuel: 'gas', limNOx: 5 }), regs).rows.find((r) => r.param === 'NOx');
    expect(t.limitSource).toBe('override');
    expect(STR.regulation.limitSource[t.limitSource]).toBe('limit: user override');
    near(t.limit, ppmToMgNm3Reg(5, MW.NO2, 25));
    const e = deriveCompliance(st({ regEquip: 'gasEngine', regFuel: 'gas', limNOx: 5 }), regs).rows.find((r) => r.param === 'NOx');
    expect(e.limitSource).toBe('regulation');
  });
  it('turbin oil: nilai model Not modeled (DLN hanya gas), limit tetap tampil', () => {
    const f = deriveCompliance(st({ regEquip: 'gasTurbine', regFuel: 'oil' }), regs);
    expect(f.turbineOil).toBe(true);
    const nox = f.rows.find((r) => r.param === 'NOx');
    expect(nox.model).toBe(null); expect(nox.limit).not.toBe(null); expect(nox.status).toBe('notModeled');
  });
  it('site data diutamakan dan ditandai; per equipment; basis tampilan non-default tidak mengubah chip', () => {
    let s = st({ regEquip: 'gasEngine', regFuel: 'gas', regClass: '1000-3000' });
    s = { ...s, ...siteDataPatch(s, 'gasEngine', 'NOx', 'value', '100') };
    const f = deriveCompliance(s, regs);
    const nox = f.rows.find((r) => r.param === 'NOx');
    expect(nox.valueSource).toBe('site'); expect(nox.site).toBe(100); expect(nox.status).toBe('within');
    expect(deriveCompliance({ ...s, regEquip: 'dieselEngine', regFuel: 'oil' }, regs).rows.find((r) => r.param === 'NOx').valueSource).toBe('model');
    const alt = deriveCompliance({ ...s, emRefO2: 3, emTrefC: 0 }, regs);
    expect(alt.displayDiffers).toBe(true);
    expect(alt.rows.map((r) => r.status)).toEqual(f.rows.map((r) => r.status));
  });
});

describe('Scene 6: limit turbin dan chip pada beban', () => {
  it('tanpa isian: NOx dari file regulasi (garis = limit pada basis tampilan), CO tidak ada → tanpa jendela', () => {
    const L = deriveLoad(st(), regs);
    expect(L.limits.source).toEqual({ nox: 'regulation', co: null });
    expect(L.limits.co).toBe(null); expect(L.single.window).toBe(null);
    expect(L.regulation.verified).toBe(false); expect(L.regulation.short).toBe('Permen LH 13/2009');
  });
  it('chip pada beban = jalur regulasi atas titik mentah kurva', () => {
    const L = deriveLoad(st({ lLoad: 70 }), regs);
    for (const cfg of ['single', 'twin']) {
      const i = L[cfg].i, raw = L[cfg].curve.raw[i];
      const nox = L[cfg].compliance.find((r) => r.param === 'NOx');
      near(nox.model, toRegulationBasis({ ppm: raw.NOx_ppm, refFrom: 15, molarMass: MW.NO2, basis: L.regulation.basis }).mgNm3);
      expect(nox.limit).toBe(gtNoxMg);
    }
  });
  it('permit CO diisi → jendela dihitung lewat jalur regulasi; garis CO berlabel permit/OEM', () => {
    const L = deriveLoad(st({ limCO: 25 }), regs);
    expect(L.limits.source.co).toBe('permit');
    expect(L.single.window).not.toBe(null);
    expect(STR.scene6.charts.limit.co).toBe('CO: permit/OEM value (user input)');
    expect(limitSourceText('override', L.regulation)).toBe('limit: user override');
    expect(limitSourceText('regulation', L.regulation)).toBe('limit: Permen LH 13/2009');
  });
});

describe('pemilih regulasi di store dan persistensi', () => {
  it('satu sumber di store; patch menormalkan kelas dan bahan bakar', () => {
    const store = createStore(st());
    store.set(regSelectionPatch(store.get(), regs, { equip: 'gasEngine' }));
    expect(store.get().regFuel).toBe('gas');
    expect(store.get().regClass).toBe('100-500');
    store.set(regSelectionPatch(store.get(), regs, { cls: '1000-3000' }));
    expect(store.get().regClass).toBe('1000-3000');
  });
  it('equipment / kelas / bahan bakar tersimpan; site data tidak', () => {
    for (const k of ['regEquip', 'regClass', 'regFuel']) expect(PERSIST_FIELDS).toContain(k);
    expect(PERSIST_FIELDS).not.toContain('siteData');
    const mem = new Map();
    const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
    writeSaved(storage, { ...st(), regEquip: 'gasTurbine', regClass: 'all', regFuel: 'oil', siteData: { gasTurbine: { NOx: { value: '9' } } } }, 9);
    const r = readSaved(storage, [9]);
    expect(r.patch).toMatchObject({ regEquip: 'gasTurbine', regClass: 'all', regFuel: 'oil' });
    expect(r.patch.siteData).toBeUndefined();
    mem.set('etel:v1', JSON.stringify({ v: 1, data: { regEquip: 'boiler', regFuel: 'coal', regClass: 5 }, scene: 9 }));
    const bad = readSaved(storage, [9]).patch;
    expect(bad.regEquip).toBeUndefined(); expect(bad.regFuel).toBeUndefined(); expect(bad.regClass).toBeUndefined();
  });
});
