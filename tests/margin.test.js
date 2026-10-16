// M10: margin kepatuhan (%) — golden di thermo.js, diteruskan ke baris kepatuhan (tab Limits, Scene 6, HUD Levers);
// keterangan "margin is smaller than model uncertainty" bila |margin| < 10 %. Status Within / Above tidak berubah.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { complianceStatus, complianceMargin, complianceCheck, MARGIN_UNCERTAINTY_PCT } from '../src/model/thermo.js';
import { policyInitialState, calibInitialState, basisInitialState, limitsInitialState, loadInitialState } from '../src/state/store.js';
import { regulationsInitialState } from '../src/state/regulations.js';
import { fuelInitialState } from '../src/state/deriveFuel.js';
import { deriveCompliance } from '../src/state/deriveCompliance.js';
import { deriveLoad } from '../src/state/deriveLoad.js';
import { deriveLevers, leverSweepParams, leverPatch } from '../src/state/deriveLevers.js';
import { leverSweep } from '../src/model/thermo.js';
import { regLine } from '../src/scenes/partload.js';
import { statusSub } from '../src/scenes/policy.js';
import { STR } from '../src/ui/strings.js';

const REG = JSON.parse(readFileSync(new URL('../content/regulations.json', import.meta.url), 'utf8'));
const near = (got, want, tol) => expect(Math.abs(got - want), `got ${got}, want ${want}`).toBeLessThanOrEqual(tol);
const st = (extra = {}) => ({ ...policyInitialState(), ...calibInitialState(), ...basisInitialState(), ...limitsInitialState(), ...loadInitialState(), ...regulationsInitialState(), ...fuelInitialState(), ...extra });
const R = STR.regulation;

describe('complianceMargin / complianceCheck (thermo.js)', () => {
  it('margin = (limit − value) / limit × 100; positif di bawah limit, negatif di atas, 0 tepat di limit', () => {
    near(complianceMargin(292, 300), 2.6667, 1e-3);
    near(complianceMargin(316, 300), -5.3333, 1e-3);
    near(complianceMargin(1368, 2300), 40.5217, 1e-3);
    expect(complianceMargin(300, 300)).toBe(0);
    for (const [v, l] of [[null, 300], [300, null], [NaN, 300], [300, 0], [300, -5], [300, Infinity]]) expect(complianceMargin(v, l), `${v},${l}`).toBeNull();
  });
  it('status sama persis dengan complianceStatus; small bila |margin| < 10 % (kedua sisi limit)', () => {
    expect(MARGIN_UNCERTAINTY_PCT).toBe(10);
    for (const [v, l] of [[292, 300], [316, 300], [300, 300], [1368, 2300], [null, 300], [5, null], [271, 300], [269, 300]]) {
      expect(complianceCheck(v, l).status, `${v},${l}`).toBe(complianceStatus(v, l));
    }
    expect(complianceCheck(292, 300)).toEqual({ status: 'within', marginPct: complianceMargin(292, 300), small: true });
    expect(complianceCheck(316, 300).small).toBe(true);
    expect(complianceCheck(300, 300)).toEqual({ status: 'within', marginPct: 0, small: true });
    expect(complianceCheck(270, 300).small).toBe(false); // tepat 10 % → tidak kecil
    expect(complianceCheck(271, 300).small).toBe(true);
    expect(complianceCheck(1368, 2300).small).toBe(false);
    expect(complianceCheck(null, 300)).toEqual({ status: 'notModeled', marginPct: null, small: false });
  });
});

describe('margin di baris kepatuhan dan di layar', () => {
  it('gas engine (faktor 0,185): Within +2,7 % di 100–500 kW dan Above −2,5 % di 1000–3000 kW, keduanya "smaller than model uncertainty"', () => {
    const a = deriveCompliance(st({ regEquip: 'gasEngine', regClass: '100-500', regFuel: 'gas' }), REG).rows.find((r) => r.param === 'NOx');
    expect(a.status).toBe('within'); near(a.marginPct, 2.7, 0.3); expect(a.marginSmall).toBe(true);
    const b = deriveCompliance(st({ regEquip: 'gasEngine', regClass: '1000-3000', regFuel: 'gas' }), REG).rows.find((r) => r.param === 'NOx');
    expect(b.status).toBe('above'); near(b.marginPct, -2.5, 0.3); expect(b.marginSmall).toBe(true);
    const d = deriveCompliance(st({ regEquip: 'dieselEngine', regClass: '500-1000', regFuel: 'oil' }), REG).rows.find((r) => r.param === 'NOx');
    expect(d.status).toBe('within'); expect(d.marginPct).toBeGreaterThan(10); expect(d.marginSmall).toBe(false);
    expect(deriveCompliance(st(), REG).marginNotePct).toBe(MARGIN_UNCERTAINTY_PCT);
  });
  it('Not modeled tanpa margin (alasan tetap tertulis)', () => {
    const co = deriveCompliance(st({ regEquip: 'gasTurbine', regFuel: 'gas' }), REG).rows.find((r) => r.param === 'CO');
    expect(co.status).toBe('notModeled'); expect(co.marginPct).toBeNull(); expect(co.marginSmall).toBe(false);
  });
  it('teks: margin bertanda dan keterangan ketidakpastian; Scene 6 menulis margin di samping status', () => {
    expect(R.margin(2.667)).toBe('margin +2.7 %');
    expect(R.margin(-2.46)).toBe('margin −2.5 %');
    expect(R.marginSmall).toBe('margin is smaller than model uncertainty');
    expect(R.marginTip(10)).toMatch(/Within ±10 % the difference is smaller than the model uncertainty; the status does not change\./);
    const line = regLine(deriveLoad(st(), REG));
    expect(line).toMatch(/NOx Within \(margin \+\d+(\.\d)? %/);
    expect(line).toMatch(/\(indicative\)/);
  });
  it('HUD Levers: margin di bawah chip; keterangan muncul bila margin < 10 %', () => {
    const sweep = (s) => { const p = leverSweepParams(s); return { rows: leverSweep(p.kind, p.param, p.values, p.over), ms: 1 }; };
    const g = st({ regEquip: 'gasEngine', regClass: '100-500', regFuel: 'gas' });
    const L = deriveLevers(g, sweep(g), REG);
    expect(L.point.status).toBe('within'); expect(L.point.marginSmall).toBe(true);
    expect(statusSub(L)).toMatch(/· margin \+2\.\d % · margin is smaller than model uncertainty$/);
    const g2 = { ...g, ...leverPatch(g, 'gas', 'theta0', -6) }; // retard → NOx jauh di bawah limit
    const L2 = deriveLevers(g2, sweep(g2), REG);
    expect(L2.point.marginSmall).toBe(false);
    expect(statusSub(L2)).not.toMatch(/model uncertainty/);
  });
});
