// M9 Step 04: tuas mesin. Default tuas baru (intake T, boost, rpm) = preset → hasil identik dengan sebelumnya.
// Tes ARAH (bukan nilai absolut) terhadap literatur (Heywood): bila model berlawanan, tes gagal dan dilaporkan.
import { describe, it, expect } from 'vitest';
import { cylinderSim, dlnEmissions, coDLN, ENGINE_PRESETS } from '../src/model/thermo.js';
import { ENGINES } from '../src/model/presets.js';
import { defaultState } from '../src/state/store.js';
import { simParams } from '../src/state/derive.js';
import { noxSimParams } from '../src/state/deriveNox.js';
import { leverInitialState, leverOverrides, LEVER_STATUS } from '../src/state/levers.js';
import { STR } from '../src/ui/strings.js';

const base = (engine) => ({ ...defaultState(engine), ...leverInitialState() });
const sim = (engine, extra = {}) => cylinderSim(simParams({ ...base(engine), ...extra }));

describe('tuas baru: default identik', () => {
  for (const engine of ['diesel', 'gas']) {
    it(`${engine}: simParams default = preset + r/φ/θ₀ (tanpa override), hasil cylinderSim sama persis`, () => {
      const p = ENGINES[engine].params;
      expect(leverOverrides(base(engine))).toEqual({});
      expect(simParams(base(engine))).toEqual({ ...p, r: p.r, phi: p.phi, theta0: p.theta0 });
      const a = sim(engine), b = cylinderSim({ ...ENGINE_PRESETS[engine] });
      expect(a.Pmax).toBe(b.Pmax); expect(a.etaBrake).toBe(b.etaBrake); expect(a.NOx_gkWh).toBe(b.NOx_gkWh);
    });
  }
  it('Scene 4: noxSimParams default tanpa override', () => {
    const s = { nEngine: 'diesel', nTheta0: ENGINES.diesel.params.theta0, calEngine: { diesel: 0.17, gas: 0.17 }, ...leverInitialState() };
    expect(['Tivc', 'Pivc', 'N'].every((k) => noxSimParams(s)[k] === ENGINES.diesel.params[k])).toBe(true);
  });
  it('status tuas: EGR "not available"; load tidak terpisah; intake T, boost, rpm ada di model', () => {
    expect(LEVER_STATUS.egr).toBe('notAvailable');
    expect(LEVER_STATUS.load).toBe('indirect');
    expect([LEVER_STATUS.intakeT, LEVER_STATUS.boost, LEVER_STATUS.rpm]).toEqual(['model', 'model', 'model']);
    expect(STR.assumptions.engine.leverStatus.notAvailable).toBe('not available in this model');
  });
});

describe('tes arah: diesel', () => {
  const P = ENGINES.diesel.params, ref = sim('diesel');
  it('retard timing → NOx turun, efisiensi turun', () => {
    const r = sim('diesel', { theta0: P.theta0 + 4 });
    expect(r.NOx_gkWh).toBeLessThan(ref.NOx_gkWh); expect(r.etaBrake).toBeLessThan(ref.etaBrake);
  });
  it('intake T turun → NOx turun', () => {
    expect(sim('diesel', { levTivc: P.Tivc - 20 }).NOx_gkWh).toBeLessThan(ref.NOx_gkWh);
  });
});

describe('tes arah: gas engine', () => {
  const P = ENGINES.gas.params, ref = sim('gas');
  it('λ naik (φ turun, sisi lean) → NOx turun', () => {
    expect(sim('gas', { phi: P.phi * 0.9 }).NOx_gkWh).toBeLessThan(ref.NOx_gkWh);
  });
  it('spark retard → NOx turun, efisiensi turun', () => {
    const r = sim('gas', { theta0: P.theta0 + 4 });
    expect(r.NOx_gkWh).toBeLessThan(ref.NOx_gkWh); expect(r.etaBrake).toBeLessThan(ref.etaBrake);
  });
  it('intake T turun → NOx turun', () => {
    expect(sim('gas', { levTivc: P.Tivc - 20 }).NOx_gkWh).toBeLessThan(ref.NOx_gkWh);
  });
});

describe('tes arah: turbin DLN', () => {
  it('flame T turun → NOx turun dan CO (coDLN) naik', () => {
    const hi = dlnEmissions({ T2: 700, P3: 15e5, phiPz: 0.55 }), lo = dlnEmissions({ T2: 700, P3: 15e5, phiPz: 0.45 });
    expect(lo.Tflame).toBeLessThan(hi.Tflame);
    expect(lo.NOx_ppm).toBeLessThan(hi.NOx_ppm);
    expect(lo.CO_ppm).toBeGreaterThan(hi.CO_ppm);
    expect(coDLN(1600)).toBeGreaterThan(coDLN(1700));
  });
});
