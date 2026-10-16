// Scene 9: ghgPenalty (B), kurva Scene 6 + batas presenter (C). Tab Levers (pengganti panel A): tests/levers.test.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ghgPenalty, co2eWithSlip, GWP_CH4, ppmToMgNm3, mgNm3ToPpm, mgNm3ToPpmReg, MW } from '../src/model/thermo.js';
import { fmt } from '../src/ui/format.js';
import { policyInitialState, calibInitialState, basisInitialState, limitsInitialState, loadInitialState } from '../src/state/store.js';
import { derivePolicy, limitsInputPatch, toDisplay } from '../src/state/derivePolicy.js';
import { deriveLoad } from '../src/state/deriveLoad.js';
import { hudItems, resultLine, keyMessage } from '../src/scenes/policy.js';
import { STR } from '../src/ui/strings.js';

const near = (got, want, tol) => expect(Math.abs(got - want), `got ${got}, want ${want}`).toBeLessThanOrEqual(tol);
const st = (extra = {}) => ({ ...policyInitialState(), pTab: 'C', // default tab kini Limits (Step 05a); tes di sini memakai tab B/C secara eksplisit
  ...calibInitialState(), ...basisInitialState(), ...limitsInitialState(), ...loadInitialState(), ...extra });
// Contoh batas HANYA untuk tes (aplikasi default kosong; tidak ada angka baku mutu di kode)
const TEST_LIMITS = { limNOx: 10, limCO: 25 };

describe('Scene 9 panel B: ghgPenalty', () => {
  it('tiga mesin = ghgPenalty(η model); penalti 3 %: gas engine 478 → 492 (+3 %)', () => {
    const f = derivePolicy(st({ pTab: 'B', pPenalty: 3 }), null);
    for (const m of f.B.machines) {
      const g = ghgPenalty({ eta: m.eta, fuelPenaltyPct: 3, fuel: m.id === 'diesel' ? 'diesel' : 'gas' });
      expect(m.current.co2_1).toBe(g.co2_1);
      near(m.current.co2_1 / m.current.co2_0, 1.03, 1e-12);
      const i = f.B.penalty.indexOf(3);
      expect(m.co2[i]).toBe(g.co2_1);
    }
    const gas = f.B.machines.find((m) => m.id === 'gas');
    near(gas.current.co2_0, 477.8, 0.2); near(gas.current.co2_1, 492.1, 0.2);
    expect(keyMessage(f)).toMatch(/A 3\.0 % fuel penalty raises specific CO₂ by 3\.0 %/);
  });
});

describe('Scene 9 tab GHG: CO₂ dan CO₂e dengan methane slip', () => {
  it('CO₂e = co2eWithSlip(η setelah penalti, slip) untuk mesin gas; diesel tanpa CO₂e; CO₂ biasa tanpa slip', () => {
    const f = derivePolicy(st({ pTab: 'B', pPenalty: 3, eSlip: 1.5 }), null);
    expect(f.B.gwp).toBe(GWP_CH4); expect(f.B.gwp).toBe(29.8); expect(f.B.gwpRef).toBe('ipcc-ar6-wg1-ch7');
    for (const m of f.B.machines) {
      if (m.id === 'diesel') { expect(m.co2e).toBeNull(); expect(m.currentE).toBeNull(); continue; }
      const g = ghgPenalty({ eta: m.eta, fuelPenaltyPct: 3, fuel: 'gas' });
      const e = co2eWithSlip({ eta: g.eta1, slipFrac: 0.015, fuel: 'gas' });
      expect(m.currentE.co2e).toBe(e.co2e);
      expect(m.currentE.co2).toBeCloseTo(m.current.co2_1, 9); // CO₂ biasa pada titik yang sama: tanpa slip
      expect(m.co2e[f.B.penalty.indexOf(3)]).toBe(e.co2e);
      expect(m.co2eVsSlip[0]).toBeCloseTo(m.current.co2_1, 9); // slip 0 → CO₂e = CO₂
      expect(m.co2eVsSlip.at(-1)).toBeGreaterThan(m.co2eVsSlip[0]);
    }
    expect(f.B.slips[0]).toBe(0); expect(f.B.slips.at(-1)).toBe(3);
    expect(STR.scene9.B.slipNote(f.B.gwp)).toBe('Methane slip is not in plain CO₂. CO₂e = CO₂ + GWP × CH₄ slip, with GWP 29.8 (IPCC AR6, 100-year).');
    const ids = hudItems(f).map((x) => x.id);
    expect(ids).toEqual(['pen', 'slip', 'co2diesel', 'co2gas', 'co2turbine', 'co2egas', 'co2eturbine', 'share']);
  });
});

describe('Scene 9 panel C: baku mutu seragam', () => {
  it('kalimat model dijaga: single-shaft "cliff" CO setelah IGV habis; twin-shaft bergeser dan menyempit', () => {
    expect(STR.scene9.C.model).toMatch(/single-shaft\) shows a CO "cliff" once the IGV runs out/);
    expect(STR.scene9.C.model).toMatch(/twin-shaft\): the operating window shifts and narrows/);
    expect(STR.scene9.C.model).toMatch(/CO line appears only when a permit or OEM CO value is entered/);
  });
  it('tanpa isian presenter: NOx dari regulations.json, CO kosong (tabel turbin tanpa limit CO) → ajakan mengisi, tanpa jendela', () => {
    const f = derivePolicy(st({ pTab: 'C' }), null);
    expect(f.C.limits.set).toBe(false);
    expect(resultLine(f)).toBe(STR.scene9.C.prompt);
    expect(keyMessage(f)).toBe(STR.scene9.messageC);
    expect(f.C.single.window).toBeNull();
    // Step 03: limit NOx default kini dibaca dari file regulasi (bukan kosong); nilainya tidak ditulis di tes
    const regs = JSON.parse(readFileSync(new URL('../content/regulations.json', import.meta.url), 'utf8'));
    const gtNox = regs.groups.find((g) => g.id === 'gas-turbine').rows.find((r) => r.fuel === 'gas' && r.param === 'NOx').limit;
    expect(hudItems(f).find((x) => x.id === 'ln').value(f)).toBe(fmt(mgNm3ToPpmReg(gtNox, MW.NO2, 25), 1));
    expect(f.C.limits.source).toEqual({ nox: 'regulation', co: null });
    expect(hudItems(f).find((x) => x.id === 'lc').value(f)).toBe(STR.scene9.hud.empty);
  });
  it('batas terisi (contoh hanya di tes): jendela = deriveLoad; pelanggaran CO diarsir pada beban CO > batas', () => {
    const s = st({ pTab: 'C', ...TEST_LIMITS });
    const f = derivePolicy(s, null), L = deriveLoad(s);
    expect(f.C.single.window.ranges).toEqual(L.single.window.ranges);
    expect(f.C.twin.window.ranges).toEqual([[90, 44]]);
    for (const cfg of ['single', 'twin']) {
      for (const [hi, lo] of f.C[cfg].coViolation) {
        for (let p = lo; p <= hi; p++) expect(L[cfg].curve.co[L[cfg].curve.load.indexOf(p)]).toBeGreaterThan(25);
      }
    }
    expect(f.C.twin.coViolation).toEqual([[43, 40]]);
    expect(resultLine(f)).toBe('Model result at these limits: load window Generator = 67–68 %; Compressor drive = 44–90 %.');
  });
  it('toggle satuan: mg/Nm³ = ppmToMgNm3 (NOx sebagai NO₂, CO sebagai CO, basis volume aktif); input mg → disimpan ppm', () => {
    const s = st({ pTab: 'C', ...TEST_LIMITS, limUnit: 'mg', emTrefC: 25 });
    const f = derivePolicy(s, null);
    near(f.C.limits.nox, ppmToMgNm3(10, MW.NO2, 298.15), 1e-12);
    near(f.C.limits.co, ppmToMgNm3(25, MW.CO, 298.15), 1e-12);
    near(f.C.single.nox[0], toDisplay(deriveLoad(s).single.curve.nox[0], 'nox', 'mg', f.C.basis), 1e-12);
    const p = limitsInputPatch(s, { nox: '20', co: '30' });
    near(p.limNOx, mgNm3ToPpm(20, MW.NO2, 298.15), 1e-12); near(p.limCO, mgNm3ToPpm(30, MW.CO, 298.15), 1e-12);
    expect(limitsInputPatch(st(), { nox: '12,5' })).toEqual({ limNOx: 12.5 });
    expect(hudItems(f).find((x) => x.id === 'ln').sub).toBe('as NO₂, dry, @ 15 % O₂, 25 °C (mg/Nm³)');
    expect(hudItems(f).find((x) => x.id === 'lc').sub).toBe('as CO, dry, @ 15 % O₂, 25 °C (mg/Nm³)');
    expect(limitsInputPatch(st(), { co: '' })).toEqual({ limCO: null });
  });
  it('HUD menampilkan basis lengkap di samping batas; judul & disclaimer permanen', () => {
    const f = derivePolicy(st({ pTab: 'C', ...TEST_LIMITS }), null);
    const it2 = hudItems(f);
    expect(it2.find((x) => x.id === 'ln').sub).toBe('as NO₂, dry (ppmvd), @ 15 % O₂, 0 °C');
    expect(it2.find((x) => x.id === 'lc').sub).toBe('as CO, dry (ppmvd), @ 15 % O₂, 0 °C');
    expect(STR.scene9.titles.C).toBe('One limit value, two machines with different operating windows.');
    expect(STR.scene9.disclaimer('a', 'b')).toMatch(/^Limits come from content\/regulations\.json .*no limit is written in the code/);
  });
  it('tidak ada angka batas di kode aplikasi; tanpa klaim konfigurasi "lebih buruk"', () => {
    for (const p of ['../src/scenes/policy.js', '../src/state/derivePolicy.js']) {
      const src = readFileSync(new URL(p, import.meta.url), 'utf8');
      expect(src).not.toMatch(/lim(NOx|CO)\s*[:=]\s*\d/);
    }
    expect(readFileSync(new URL('../src/scenes/policy.js', import.meta.url), 'utf8')).not.toMatch(/model\/thermo/);
    expect(JSON.stringify(STR.scene9)).not.toMatch(/lebih buruk|meledak|worse|explod|blow up/i);
  });
});
