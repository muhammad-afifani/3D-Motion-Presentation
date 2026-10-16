// M9 Step 05b: Scene 9 tab Levers — sapuan satu tuas (leverSweep), NOx mg/Nm³ pada basis regulasi + garis limit,
// titik operasi dari satu frame, tab Limits mengikuti slider, panel Fuel (komposisi tidak mengubah NOx/CO).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { leverSweep, cylinderSim, toRegulationBasis, ENGINE_PRESETS, MW } from '../src/model/thermo.js';
import { LEVER_GRID, LEVER_AXES, FUEL_SLIDERS } from '../src/model/presets.js';
import { policyInitialState, calibInitialState, basisInitialState, limitsInitialState, loadInitialState } from '../src/state/store.js';
import { regulationsInitialState } from '../src/state/regulations.js';
import { fuelInitialState, fuelGasPatch, deriveFuel } from '../src/state/deriveFuel.js';
import { deriveLevers, leverSweepParams, leverSweepKey, leverPatch, leverEngine, isLeversModified, leversResetPatch, leversInitialState } from '../src/state/deriveLevers.js';
import { deriveCompliance } from '../src/state/deriveCompliance.js';
import { deriveEmis } from '../src/state/deriveEmis.js';
import { derivePolicy } from '../src/state/derivePolicy.js';
import { hudItems, keyMessage } from '../src/scenes/policy.js';
import { STR } from '../src/ui/strings.js';

const REG = JSON.parse(readFileSync(new URL('../content/regulations.json', import.meta.url), 'utf8'));
const near = (got, want, tol) => expect(Math.abs(got - want), `got ${got}, want ${want}`).toBeLessThanOrEqual(tol);
const st = (extra = {}) => ({ ...policyInitialState(), pTab: 'levers', ...calibInitialState(), ...basisInitialState(), ...limitsInitialState(), ...loadInitialState(), ...regulationsInitialState(), ...fuelInitialState(), ...extra });
const sweepOf = (s) => { const p = leverSweepParams(s); return { rows: leverSweep(p.kind, p.param, p.values, p.over), ms: 1 }; };
const frame = (s) => deriveLevers(s, sweepOf(s), REG);
const gasHead = { regEquip: 'gasEngine', regFuel: 'gas' };
const regNox = (cls, fuel) => REG.groups.find((g) => g.id === 'engine').rows.find((r) => r.param === 'NOx' && r.class === cls && r.fuel === fuel).limit;

describe('Scene 9 tab Levers: state dan sapuan', () => {
  it('state awal = preset, terpisah dari tuas Scene 1/4; mesin mengikuti header', () => {
    const s = st();
    expect(s.p9Lev).toEqual({}); expect(leversInitialState().p9Axis).toBe('theta0');
    expect(isLeversModified(s)).toBe(false);
    expect(leverEngine(s)).toBe('diesel');
    expect(leverEngine(st(gasHead))).toBe('gas');
    expect(leverEngine(st({ regEquip: 'gasTurbine', pEngine: 'gas' }))).toBe('gas'); // header turbin → mesin terakhir
    for (const k of ['nTheta0', 'levTivc', 'levPivc', 'levN', 'theta0', 'phi']) expect(Object.keys(leverPatch(s, 'diesel', 'phi', 0.6))).not.toContain(k);
  });
  it('slider di-snap ke grid dan menjadi sumbu sapuan; kunci sapuan berubah hanya bila tuas lain / mesin berubah', () => {
    const s = st();
    const p = leverPatch(s, 'diesel', 'phi', 0.612);
    expect(p.p9Lev.diesel.phi).toBe(0.6); expect(p.p9Axis).toBe('phi');
    const s2 = { ...s, ...p };
    expect(isLeversModified(s2)).toBe(true);
    // menggeser tuas sumbu: titik bergerak di kurva yang sama (tanpa sapuan baru)
    expect(leverSweepKey({ ...s2, ...leverPatch(s2, 'diesel', 'phi', 0.45) })).toBe(leverSweepKey(s2));
    expect(leverSweepKey({ ...s2, ...leverPatch(s2, 'diesel', 'Tivc', 330) })).not.toBe(leverSweepKey(s2));
    expect(leversResetPatch()).toEqual({ p9Lev: {}, fuelGas: { CH4: 100 } });
    expect(isLeversModified({ ...s2, ...leversResetPatch() })).toBe(false);
  });
  it('tanpa EGR: sumbu = lima tuas; EGR tampil nonaktif "not available in this model"', () => {
    expect(LEVER_AXES).toEqual(['theta0', 'phi', 'Tivc', 'Pivc', 'N']);
    expect(STR.scene9.leversTab.egrNA).toBe('not available in this model');
    expect(STR.scene9.leversTab.loadSweep).toBe('Sweeping fuel-air equivalence or boost also changes engine load.');
    expect(STR.scene9.leversTab.load).toMatch(/diesel uses fuel-air equivalence as the load proxy; the gas engine uses boost/);
  });
  it('sapuan basi / belum ada → ready false; pending di tab Limits saat dimodifikasi', () => {
    const s = { ...st(), ...leverPatch(st(), 'diesel', 'N', 1150) };
    const f = deriveLevers(s, null, REG);
    expect(f.ready).toBe(false); expect(f.point).toBeNull();
    const c = deriveCompliance(s, REG, f);
    const nox = c.rows.find((r) => r.param === 'NOx');
    expect(nox.status).toBe('notModeled'); expect(nox.reason).toBe('pending');
  });
});

describe('Scene 9 tab Levers: grafik dan titik operasi dari satu frame', () => {
  it('setiap titik sapuan = cylinderSim dengan tuas lain dari slider; NOx mg/Nm³ lewat jalur regulasi', () => {
    let s = st();
    s = { ...s, ...leverPatch(s, 'diesel', 'Tivc', 340) };
    s = { ...s, ...leverPatch(s, 'diesel', 'phi', 0.55) };
    const f = frame(s);
    expect(f.axis).toBe('phi'); expect(f.values).toEqual(LEVER_GRID.diesel.phi.sweep);
    const r = f.rows[f.i];
    const sim = cylinderSim({ ...ENGINE_PRESETS.diesel, Tivc: 340, phi: 0.55, calib: leverSweepParams(s).over.calib });
    expect(r.value).toBe(0.55);
    near(r.etaBrake, sim.etaBrake, 1e-12);
    const b = REG.groups.find((g) => g.id === 'engine').basis;
    near(f.point.noxMg, toRegulationBasis({ ppm: sim.NOx_ppmvd_ref, refFrom: 15, molarMass: MW.NO2, basis: b }).mgNm3, 1e-9);
    // titik operasi berada di kurva
    expect(f.noxMg[f.i]).toBe(f.point.noxMg); expect(f.etaPct[f.i]).toBe(f.point.etaBrake * 100);
    expect(f.x[f.i]).toBe(f.currentX);
  });
  it('boost: sumbu grafik dalam bar (tampilan); nilai model tetap Pa', () => {
    const s0 = st();
    const s = { ...s0, ...leverPatch(s0, 'diesel', 'Pivc', 2.2e5) };
    const f = frame(s);
    expect(f.current).toBe(2.2e5); expect(f.currentX).toBeCloseTo(2.2, 12);
  });
  it('garis limit dari regulations.json berubah saat kelas kapasitas diganti; chip = complianceStatus', () => {
    const f1 = frame(st({ regClass: '100-500' })), f2 = frame(st({ regClass: '500-1000' }));
    expect(f1.limit.mg).toBe(regNox('100-500', 'oil')); expect(f2.limit.mg).toBe(regNox('500-1000', 'oil'));
    expect(f1.limit.mg).not.toBe(f2.limit.mg);
    expect(f1.point.noxMg).toBe(f2.point.noxMg); // model sama; hanya limit yang berganti
    const fg = frame(st({ ...gasHead, regClass: '1000-3000' }));
    expect(fg.kind).toBe('gas'); expect(fg.limit.mg).toBe(regNox('1000-3000', 'gas'));
    expect(['within', 'above']).toContain(fg.point.status);
    expect(fg.point.status).toBe(fg.point.noxMg <= fg.limit.mg ? 'within' : 'above');
  });
  it('tab Limits membaca frame yang sama: NOx mesin mengikuti slider tuas', () => {
    const s0 = st();
    const s = { ...s0, ...leverPatch(s0, 'diesel', 'theta0', 2) };
    const f = frame(s);
    const c = deriveCompliance(s, REG, f), c0 = deriveCompliance(s0, REG, frame(s0));
    const n = c.rows.find((r) => r.param === 'NOx'), n0 = c0.rows.find((r) => r.param === 'NOx');
    near(n.model, f.point.noxMg, 1e-9);
    expect(n.model).toBeLessThan(n0.model); // retard → NOx turun
    // preset tanpa geseran: identik dengan jalur lama (cylinderSim preset)
    near(c0.rows.find((r) => r.param === 'NOx').model, deriveCompliance(s0, REG).rows.find((r) => r.param === 'NOx').model, 1e-9);
  });
  // M10: jejak tekanan baru (cv(T) NASA) + faktor 0,185; dulu −30,6 % / +3,0 %
  it('port panel A: diesel −4° → 0°: NOx g/kWh −30,2 %, CO₂ +3,1 %; Δ di preset = 0', () => {
    const s0 = st();
    const f = frame({ ...s0, ...leverPatch(s0, 'diesel', 'theta0', 0) });
    near(f.delta.noxGkWh, -30.2, 0.1); near(f.delta.co2, 3.06, 0.05);
    const p = frame(s0);
    expect(p.delta.noxGkWh).toBe(0); expect(p.delta.eta).toBe(0); expect(p.atPreset).toBe(true);
  });
  // M10: dulu 2,57 → 0,74 (−71,1 %), CO₂ +5,2 %
  it('port panel A: gas −14° → −6°: NOx 2,46 → 0,73 g/kWh (−71 %), CO₂ +5,3 %', () => {
    const s0 = st(gasHead);
    expect(frame(s0).levers.theta0).toBe(ENGINE_PRESETS.gas.theta0);
    const f = frame({ ...s0, ...leverPatch(s0, 'gas', 'theta0', -6) });
    near(f.presetPoint.NOx_gkWh, 2.465, 0.01); near(f.point.NOx_gkWh, 0.725, 0.01);
    near(f.delta.noxGkWh, -70.6, 0.2); near(f.delta.co2, 5.34, 0.05);
  });
  it('HUD: NOx dengan basis di samping angka, chip "Model value vs limit (indicative)", η, CO₂, waktu sapuan', () => {
    const s = st();
    const f = derivePolicy(s, sweepOf(s), REG);
    const it = hudItems(f);
    expect(it.map((x) => x.id)).toEqual(['nox', 'st', 'eta', 'co2', 'pmax', 'o2', 'lam', 'ms']);
    expect(it[0].sub).toBe('as NO₂, dry, @ 15 % O₂, 25 °C (mg/Nm³)');
    expect(it[1].label).toBe('Model value vs limit (indicative)');
    expect(['Within', 'Above']).toContain(it[1].value(f));
    expect(it.find((x) => x.id === 'ms').value(f)).toBe('1');
    expect(STR.scene9.leversTab.caption('b', null)).toMatch(/Calibrated to typical literature level, not site data/);
    expect(keyMessage(f)).toBe(STR.scene9.leversTab.messagePreset('Diesel engine'));
    const s2 = { ...s, ...leverPatch(s, 'diesel', 'theta0', 0) };
    expect(keyMessage(derivePolicy(s2, sweepOf(s2), REG))).toMatch(/^Timing on the Diesel engine: NOx −\d+ %, brake η −\d\.\d % versus its preset value \(model, indicative\)\.$/);
  });
});

describe('Scene 9 tab Levers: panel Fuel', () => {
  it('komposisi gas mengubah MW, LHV, AFR, CO₂/GJ, O₂ buang; NOx dan CO tidak berubah', () => {
    const s0 = st(gasHead);
    let s = s0;
    s = { ...s, ...fuelGasPatch(s, 'C2H6', 8) };
    s = { ...s, ...fuelGasPatch(s, 'N2', 4) };
    const a = deriveFuel(s0), b = deriveFuel(s);
    for (const k of ['MW', 'LHV_MJ_per_kg', 'AFR_stoich_mass', 'CO2_kg_per_GJ_LHV']) expect(b.gas[k]).not.toBe(a.gas[k]);
    expect(b.exhaustO2.gas).not.toBe(a.exhaustO2.gas);
    expect(isLeversModified(s)).toBe(true);
    const la = frame(s0), lb = frame(s);
    expect(lb.point.noxMg).toBe(la.point.noxMg);
    expect(leverSweepKey(s)).toBe(leverSweepKey(s0));
    expect(deriveEmis(s).rows.gas.coPpm15).toBe(deriveEmis(s0).rows.gas.coPpm15);
    const ca = deriveCompliance(s0, REG, la), cb = deriveCompliance(s, REG, lb);
    for (const p of ['NOx', 'CO']) expect(cb.rows.find((r) => r.param === p)?.model).toBe(ca.rows.find((r) => r.param === p)?.model);
    expect(STR.scene9.fuelPanel.noEffect).toMatch(/^Composition does not change NOx or CO in this model\./);
  });
  it('O₂ buang mengikuti slider φ (λ = 1/φ); semua fraksi nol → CH₄ murni, ditandai', () => {
    const s0 = st();
    const s = { ...s0, ...leverPatch(s0, 'diesel', 'phi', 0.4) };
    expect(deriveFuel(s).lambda.diesel).toBeCloseTo(1 / 0.4, 12);
    expect(deriveFuel(s).exhaustO2.diesel).toBeGreaterThan(deriveFuel(s0).exhaustO2.diesel);
    const z = deriveFuel(st({ fuelGas: { CH4: 0 } }));
    expect(z.compInvalid).toBe(true); expect(z.gas.MW).toBe(deriveFuel(st()).gas.MW);
    expect(FUEL_SLIDERS.species).toEqual(['CH4', 'C2H6', 'C3H8', 'C4H10', 'N2', 'CO2']);
    expect(STR.scene9.fuelPanel.species.C4H10).toBe('C₄H₁₀+');
  });
});
