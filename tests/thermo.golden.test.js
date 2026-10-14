// Golden test: tabel docs/PROMPT_simulasi_3D.md bagian 12 (toleransi sesuai tabel).
import { describe, it, expect } from 'vitest';
import {
  otto, diesel, dual, braytonIdeal, braytonReal, braytonDerated, co2Specific,
  cylinderSim, ENGINE_PRESETS, noxThermal, twinShaft, gasCompressor, selfTest,
  lossWaterfall, simStates, flameTemperature, qinPerKgAir, phiFromQinPerKgAir,
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

describe('Waterfall (lossWaterfall)', () => {
  const pct = (wf) => wf.map((x) => x.eta * 100);
  const nearAll = (got, want) => { expect(got.length).toBe(want.length); got.forEach((g, i) => near(g, want[i], 0.1)); };
  // window 'full' (default, fase tertutup ±180°) — golden lama dipertahankan
  it('full: diesel 67,0 → 62,3 → 58,3 → 50,6 → 44,9 %', () => nearAll(pct(lossWaterfall('diesel')), [67.0, 62.3, 58.3, 50.6, 44.9]));
  it('full: gas 61,7 → 56,6 → 53,9 → 47,1 → 43,1 %', () => nearAll(pct(lossWaterfall('gas')), [61.7, 56.6, 53.9, 47.1, 43.1]));
  // window 'preset' (IVC/EVO preset) — dipakai Scene 2, langkah terakhir = η rem HUD
  it('preset: diesel 67,0 → 61,7 → 57,5 → 49,9 → 44,1 %', () => nearAll(pct(lossWaterfall('diesel', {}, { window: 'preset' })), [67.0, 61.7, 57.5, 49.9, 44.1]));
  it('preset: gas 61,7 → 55,8 → 53,1 → 46,4 → 42,3 %', () => nearAll(pct(lossWaterfall('gas', {}, { window: 'preset' })), [61.7, 55.8, 53.1, 46.4, 42.3]));
  it('preset: langkah terakhir = η rem cylinderSim preset', () => {
    for (const k of ['diesel', 'gas']) {
      const wf = lossWaterfall(k, {}, { window: 'preset' });
      near(wf[wf.length - 1].eta, cylinderSim(ENGINE_PRESETS[k]).etaBrake, 1e-12);
    }
  });
});

describe('simStates (entropi cylinderSim untuk T-s real)', () => {
  for (const [k, sEvo] of [['diesel', 854.5], ['gas', 1014.3]]) {
    it(`${k}: kompresi adiabatik Δs ≈ 0; s(EVO) − s(IVC) = ${sEvo} J/(kg·K)`, () => {
      const sim = cylinderSim(ENGINE_PRESETS[k]);
      const { v, s } = simStates(sim);
      const i0 = sim.th.findIndex((t) => t >= sim.params.theta0);
      for (let i = 0; i < i0; i++) expect(Math.abs(s[i])).toBeLessThan(1e-3);
      near(s[s.length - 1], sEvo, 1);
      near(v[0], sim.V[0] / sim.mass, 1e-15);
    });
  }
});

describe('Pembakaran (Scene 3)', () => {
  it('flameTemperature(0,5; 300 K) ≈ 1530 K', () => near(flameTemperature(0.5, 300), 1530, 1));
  it('flameTemperature(1,0; 300 K) ≈ 2226 K', () => near(flameTemperature(1.0, 300), 2226, 1));
  it('qinPerKgAir: gas φ 0,5 → 1403,5 kJ/kg; diesel φ 0,5 → 1458,5 kJ/kg', () => {
    near(qinPerKgAir(0.5, 'gas') / 1e3, 1403.5, 0.1);
    near(qinPerKgAir(0.5, 'diesel') / 1e3, 1458.5, 0.1);
  });
  it('qinPerKgAir = Efuel/massa cylinderSim (preset diesel & gas)', () => {
    for (const k of ['diesel', 'gas']) {
      const sim = cylinderSim({ ...ENGINE_PRESETS[k], nox: false });
      near(qinPerKgAir(sim.params.phi, sim.params.fuel), sim.Efuel / sim.mass, 1e-6);
    }
  });
  it('φ keseluruhan turbin (braytonReal default, T3 1500 K) ≈ 0,34; invers konsisten', () => {
    const b = braytonReal({});
    near(phiFromQinPerKgAir(b.qin, 'gas', b.params.combEff), 0.341, 0.003);
    near(phiFromQinPerKgAir(qinPerKgAir(0.73, 'diesel', 0.98), 'diesel', 0.98), 0.73, 1e-12);
  });
});

describe('selfTest', () => {
  it('selfTest().failed = 0', () => {
    const r = selfTest();
    expect(r.failed, JSON.stringify(r.results.filter((x) => !x.ok))).toBe(0);
    expect(r.passed).toBe(14);
  });
});
