// Golden test: tabel docs/PROMPT_simulasi_3D.md bagian 12 (toleransi sesuai tabel).
import { describe, it, expect } from 'vitest';
import {
  otto, diesel, dual, braytonIdeal, braytonReal, braytonDerated, co2Specific,
  cylinderSim, ENGINE_PRESETS, noxThermal, twinShaft, gasCompressor, selfTest,
} from '../src/model/thermo.js';

/** |got − want| ≤ tol */
const near = (got, want, tol) => {
  expect(Number.isFinite(got)).toBe(true);
  expect(Math.abs(got - want), `got ${got}, want ${want} ± ${tol}`).toBeLessThanOrEqual(tol);
};

describe('Siklus ideal piston', () => {
  it('otto({r:10}).eta = 0,602', () => near(otto({ r: 10 }).eta, 0.602, 0.001));
  it('diesel({r:18, rc:2}).eta = 0,632', () => near(diesel({ r: 18, rc: 2 }).eta, 0.632, 0.001));
  it('otto({r:18}).eta = 0,685', () => near(otto({ r: 18 }).eta, 0.685, 0.001));
  it('dual({r:16, rp:1.5, rc:1.4}).eta = 0,655', () => near(dual({ r: 16, rp: 1.5, rc: 1.4 }).eta, 0.655, 0.001));
});

describe('Brayton', () => {
  it('braytonIdeal({rp:15}).eta = 0,539', () => near(braytonIdeal({ rp: 15 }).eta, 0.539, 0.001));
  it('braytonReal({}) η / T2 / T4 = 0,378 / 675 K / 843 K', () => {
    const b = braytonReal({});
    near(b.eta, 0.378, 0.005);
    near(b.T2, 675, 2);
    near(b.T4, 843, 3);
  });
  it('braytonDerated({}, {TambC:35}).derate = 0,865', () => near(braytonDerated({}, { TambC: 35 }).derate, 0.865, 0.005));
});

describe('CO₂ spesifik', () => {
  it('co2Specific(0.35, gas) = 577,0 g/kWh', () => near(co2Specific(0.35, 'gas'), 577.0, 0.3));
  it('co2Specific(0.42, diesel) = 635,1 g/kWh', () => near(co2Specific(0.42, 'diesel'), 635.1, 0.3));
});

describe('cylinderSim preset', () => {
  const sd = cylinderSim(ENGINE_PRESETS.diesel);
  const sg = cylinderSim(ENGINE_PRESETS.gas);
  it('diesel: Pmax 116 bar / η rem 0,441 / BSFC 192 g/kWh', () => {
    near(sd.Pmax / 1e5, 116, 3);
    near(sd.etaBrake, 0.441, 0.005);
    near(sd.bsfc, 192, 3);
  });
  it('gas: Pmax 109 bar / η rem 0,423 / BSFC 177 g/kWh', () => {
    near(sg.Pmax / 1e5, 109, 3);
    near(sg.etaBrake, 0.423, 0.005);
    near(sg.bsfc, 177, 3);
  });
  it('NOx terkalibrasi diesel 10,7 / gas 2,6 g/kWh', () => {
    near(sd.NOx_gkWh, 10.7, 0.5);
    near(sg.NOx_gkWh, 2.6, 0.2);
  });
});

describe('Emisi & turbin', () => {
  it('noxThermal: rasio laju 1900 K / 1800 K = 7,1', () => {
    // laju awal k0 pada P = 15 bar, φ = 0,5 (rasio praktis tak bergantung P dan φ)
    const a = noxThermal({ T: 1900, P: 15e5, phi: 0.5 });
    const b = noxThermal({ T: 1800, P: 15e5, phi: 0.5 });
    near(a.k0 / b.k0, 7.1, 0.2);
  });
  it('twinShaft({}) η / T2 / T45 / T5 = 0,405 / 742 / 1049 / 760 K', () => {
    const t = twinShaft({});
    near(t.eta, 0.405, 0.005);
    near(t.T2, 742, 3);
    near(t.T45, 1049, 5);
    near(t.T5, 760, 5);
  });
  it('gasCompressor head 172 kJ/kg / daya 4,31 MW', () => {
    const g = gasCompressor({ Psuc: 20e5, Pdis: 60e5, Tsuc: 308, MWgas: 18, mdot: 20 });
    near(g.headKJ, 172, 1);
    near(g.power / 1e6, 4.31, 0.03);
  });
});

describe('selfTest', () => {
  it('selfTest().failed = 0', () => {
    const r = selfTest();
    expect(r.failed, JSON.stringify(r.results.filter((x) => !x.ok))).toBe(0);
    expect(r.passed).toBe(14);
  });
});
