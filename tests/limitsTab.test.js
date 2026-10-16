// M9 Step 05a: Scene 9 lima tab, tab Limits (kolom, alasan Not modeled, matriks cakupan), baris regulasi Scene 6.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { MODEL_COVERAGE, COVERAGE_PARAMS, COVERAGE_EQUIP } from '../src/state/coverage.js';
import { EQUIPMENT, regulationsInitialState } from '../src/state/regulations.js';
import { POLICY } from '../src/model/presets.js';
import { policyInitialState, basisInitialState, calibInitialState, limitsInitialState, loadInitialState } from '../src/state/store.js';
import { deriveLoad } from '../src/state/deriveLoad.js';
import { deriveCompliance } from '../src/state/deriveCompliance.js';
import { WIDE_TABS, keyMessage } from '../src/scenes/policy.js';
import { regLine } from '../src/scenes/partload.js';
import { STR } from '../src/ui/strings.js';

const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const regs = read('content/regulations.json');
const form = read('content/emission_formation.json');
const st = (x = {}) => ({ ...policyInitialState(), ...calibInitialState(), ...basisInitialState(), ...limitsInitialState(), ...loadInitialState(), ...regulationsInitialState(), theta: 0, ...x });

describe('Scene 9: lima tab', () => {
  it('urutan 1 Limits, 2 Formation, 3 Levers, 4 Load window, 5 GHG; default tab Limits', () => {
    expect(POLICY.tabs).toEqual(['limits', 'formation', 'levers', 'C', 'B']);
    expect(POLICY.tabs.map((t) => STR.scene9.tabs[t])).toEqual(['Limits', 'Formation', 'Levers', 'Load window', 'GHG']);
    expect(policyInitialState().pTab).toBe('limits');
    expect(WIDE_TABS).toEqual(['limits', 'formation']);
    expect(STR.scene9.title).toBe('Regulated emissions: how they form and what controls them');
    expect(keyMessage({ tab: 'limits' })).toBe(STR.scene9.messageLimits);
  });
  it('tabel Limits: kolom parameter, limit, unit, metode uji, model, site data, status', () => {
    expect(STR.scene9.limitsTab.head).toEqual(['Parameter', 'Limit', 'Unit', 'Test method', 'Model', 'Site data', 'Status']);
  });
  it('setiap "Not modeled" punya alasan yang tertulis', () => {
    for (const equip of ['dieselEngine', 'gasEngine', 'gasTurbine']) for (const fuel of EQUIPMENT[equip].fuels) {
      const f = deriveCompliance(st({ regEquip: equip, regFuel: fuel }), regs);
      for (const r of f.rows.filter((x) => x.status === 'notModeled')) expect(STR.regulation.reason[r.reason], `${equip}/${fuel}/${r.param}`).toBeTruthy();
    }
  });
  it('kalimat komposisi: NOx dan CO tidak bergantung komposisi; frame NOx/CO tetap saat komposisi gas berubah', () => {
    expect(STR.scene9.limitsTab.composition).toMatch(/NOx and CO in this model do not depend on composition/);
    const a = deriveCompliance(st({ regEquip: 'gasEngine', regFuel: 'gas' }), regs);
    const b = deriveCompliance(st({ regEquip: 'gasEngine', regFuel: 'gas', fuelGas: { CH4: 80, C2H6: 10, N2: 10 } }), regs);
    expect(b.rows.find((r) => r.param === 'NOx').model).toBe(a.rows.find((r) => r.param === 'NOx').model);
    expect(b.fuel.exhaustO2).not.toBe(a.fuel.exhaustO2); // O₂ buang memang berubah
  });
});

describe('matriks cakupan model', () => {
  it('lengkap untuk 6 parameter × 3 equipment, semua label tersedia', () => {
    for (const p of COVERAGE_PARAMS) for (const e of COVERAGE_EQUIP) expect(STR.scene9.limitsTab.coverage[MODEL_COVERAGE[p][e]], `${p}/${e}`).toBeTruthy();
  });
  it('konsisten dengan parameter yang dihitung (EQUIPMENT.params): NOx dan SO₂ semua, CO hanya turbin', () => {
    for (const e of COVERAGE_EQUIP) {
      const computed = new Set(Object.values(EQUIPMENT[e].params).flat());
      expect(MODEL_COVERAGE.NOx[e]).toBe('calibrated'); expect(computed.has('NOx')).toBe(true);
      expect(MODEL_COVERAGE.SO2[e]).toBe('massBalanceS'); expect(computed.has('SO2')).toBe(true);
      expect(computed.has('CO')).toBe(MODEL_COVERAGE.CO[e] === 'semi');
    }
  });
  it('konsisten dengan field modeled di emission_formation.json', () => {
    const MAP = { calibrated: ['calibrated'], semi: ['semi-empirical'], qualSite: ['site-input', 'qualitative'], qualSiteOil: ['site-input'], massBalanceS: ['mass-balance'], carbonBalance: ['mass-balance'], qualitative: ['qualitative'], co2eOnly: ['qualitative'] };
    for (const e of COVERAGE_EQUIP) {
      const params = form.equipment[EQUIPMENT[e].formation].params;
      for (const p of COVERAGE_PARAMS) {
        if (!params[p]) continue;
        expect(MAP[MODEL_COVERAGE[p][e]] ?? [], `${e}/${p}`).toContain(params[p].modeled);
      }
    }
  });
});

describe('Scene 6: satu baris cek regulasi (bukan overlay di atas 3D)', () => {
  it('memuat "(indicative)", kedua konfigurasi, dan alasan untuk Not modeled', () => {
    const L = deriveLoad(st({ regEquip: 'gasTurbine' }), regs);
    const t = regLine(L);
    expect(t).toMatch(/\(indicative\)/);
    expect(t).toMatch(/Generator \(single-shaft\): NOx Within/);
    expect(t).toMatch(/CO Not modeled \(no limit in this table\)/);
    expect(t).toMatch(/transcribed table/);
    expect(STR.regulation.scene6Tip).toMatch(/Esc or ←/);
  });
  it('template Scene 6 tidak lagi memuat overlay regulasi; tautan membuka Scene 9 tab Limits dengan jalan kembali', () => {
    const src = readFileSync(new URL('../src/scenes/partload.js', import.meta.url), 'utf8');
    expect(src).not.toMatch(/overlay--reg/);
    expect(src).toMatch(/pTab: 'limits', p9Return: meta\.number/);
    const pol = readFileSync(new URL('../src/scenes/policy.js', import.meta.url), 'utf8');
    expect(pol).toMatch(/e\.key === 'Escape' \|\| e\.key === 'ArrowLeft'\) && store\.get\(\)\.p9Return != null/);
  });
});
