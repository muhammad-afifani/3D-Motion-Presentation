// Golden test: tabel docs/PROMPT_simulasi_3D.md bagian 12 (toleransi sesuai tabel).
import { describe, it, expect } from 'vitest';
import {
  otto, diesel, dual, braytonIdeal, braytonReal, braytonDerated, co2Specific,
  cylinderSim, ENGINE_PRESETS, noxThermal, twinShaft, gasCompressor, selfTest,
  lossWaterfall, simStates, flameTemperature, qinPerKgAir, phiFromQinPerKgAir,
  compressorStages, turbineStages, twinShaftCycle,
  zeldovichRate, noxRateRatio, zeldovichCurve, calibrateDLN, calibrateEngineNOx, ENGINE_NOX_CALIB,
  retardSweep, noxCoTradeoff, emissionAtBasis, ZELDOVICH, MW,
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

describe('Turbin gas (Scene 5)', () => {
  it('braytonReal({}) η 0,378 / T2 675 K / T4 843 K; braytonDerated @35 °C = 0,865 (0,68 %/°C)', () => {
    const b = braytonReal({});
    near(b.eta, 0.378, 0.005); near(b.T2, 675, 2); near(b.T4, 843, 3);
    const d = braytonDerated({}, { TambC: 35 });
    near(d.derate, 0.865, 0.005); near(d.perDegC * 100, 0.68, 0.01);
  });
  it('twinShaft() desain η 0,405 / T2 742 / T45 1049 / T5 760 K', () => {
    const t = twinShaft({});
    near(t.eta, 0.405, 0.005); near(t.T2, 742, 3); near(t.T45, 1049, 5); near(t.T5, 760, 5);
  });
  it('compressorStages/turbineStages: tahap terakhir = T2/T4 braytonReal dan T45/T5 twinShaft; monoton', () => {
    const b = braytonReal({});
    const c = compressorStages(b.params.T1, b.rp, b.params.etaC, 10), t = turbineStages(b.T3, b.rpt, b.params.etaT, 3);
    near(c[9].T, b.T2, 1e-9); near(t[2].T, b.T4, 1e-9);
    for (let i = 1; i < c.length; i++) expect(c[i].T).toBeGreaterThan(c[i - 1].T);
    for (let i = 1; i < t.length; i++) expect(t[i].T).toBeLessThan(t[i - 1].T);
    const w = twinShaftCycle({});
    near(turbineStages(w.T3, w.epsGG, 0.89, 2)[1].T, w.T45, 1e-9);
    near(turbineStages(w.T45, w.rpt, 0.90, 2)[1].T, w.T5, 1e-9);
  });
  it('twinShaftCycle: di ISO identik dengan twinShaft(); state 1,2,3,4.5,5; P45 = rpt·P1; derating @35 °C', () => {
    const t = twinShaft({}), c = twinShaftCycle({});
    for (const k of ['eta', 'T2', 'T45', 'T5', 'power']) expect(c[k]).toBe(t[k]);
    expect(c.states.length).toBe(5);
    expect(c.states.map((x) => x.T)).toEqual([288.15, t.T2, t.T3, t.T45, t.T5]);
    near(c.P45, t.rpt * 101325, 1e-6);
    near(c.wnet, t.wpt, 1e-9);
    expect(c.derate).toBe(1);
    const h = twinShaftCycle({}, { TambC: 35 });
    near(h.derate, 0.844, 0.005); near(h.perDegC * 100, 0.78, 0.01);
  });
});

describe('NOx (Scene 4)', () => {
  const sd = cylinderSim(ENGINE_PRESETS.diesel);
  const sg = cylinderSim(ENGINE_PRESETS.gas);

  it('jejak TbTrace/noTrace tidak mengubah golden lama (10,7 / 2,6 g/kWh; 116 / 109 bar; η 0,441 / 0,423)', () => {
    near(sd.NOx_gkWh, 10.7, 0.5); near(sg.NOx_gkWh, 2.6, 0.2);
    near(sd.Pmax / 1e5, 116, 3); near(sg.Pmax / 1e5, 109, 3);
    near(sd.etaBrake, 0.441, 0.005); near(sg.etaBrake, 0.423, 0.005);
  });
  it('max(TbTrace) = TburnedMax; noTrace monoton, ujungnya = nNOkmol', () => {
    for (const s of [sd, sg]) {
      expect(s.TbTrace.length).toBe(s.th.length);
      near(Math.max(...s.TbTrace), s.TburnedMax, 1e-9);
      near(s.noTrace[s.noTrace.length - 1] / s.nNOkmol, 1, 1e-12);
      for (let i = 1; i < s.noTrace.length; i++) expect(s.noTrace[i]).toBeGreaterThanOrEqual(s.noTrace[i - 1] - 1e-30);
      expect(s.noTrace[0]).toBe(0);
    }
  });
  it('TbTrace = 0 sebelum pembakaran mulai (θ < θ0)', () => {
    const i = sd.th.findIndex((t) => t >= ENGINE_PRESETS.diesel.theta0 - 1);
    expect(sd.TbTrace[i - 1]).toBe(0);
  });
  it('zeldovichRate & noxRateRatio: 1900/1800 K = 7,1 (= rasio k0 noxThermal)', () => {
    near(noxRateRatio(1800), 7.1, 0.2);
    near(noxRateRatio(1800), noxThermal({ T: 1900, P: 15e5, phi: 0.5 }).k0 / noxThermal({ T: 1800, P: 15e5, phi: 0.5 }).k0, 1e-9);
    // rasio hanya bergantung pada T (P dan φ saling menghapus)
    near(noxRateRatio(1800, 100, { P: 120e5, phi: 0.95, fuel: 'diesel' }), noxRateRatio(1800), 1e-9);
    expect(noxRateRatio(2700)).toBeLessThan(noxRateRatio(1800));
    expect(zeldovichRate({ T: 2000 })).toBeGreaterThan(zeldovichRate({ T: 1900 }));
  });
  it('zeldovichCurve: rel = 1 pada Tref, naik monoton', () => {
    const c = zeldovichCurve({ Tmin: 1600, Tmax: 3000, n: 14, Tref: 1800 });
    near(c[2].rel, 1, 1e-12);
    for (let i = 1; i < c.length; i++) expect(c[i].rel).toBeGreaterThan(c[i - 1].rel);
  });
  it('calibrateDLN: 15 ppm di desain (T flame 1830 K); 1800 K ≈ 8,5 ppm, 1900 K ≈ 52 ppm', () => {
    const k = calibrateDLN();
    near(k.NOx_ppm, 15, 0.01);
    near(k.Tflame, 1830, 1);
    near(k.calib, 14.33, 0.05);
    const [a, b] = noxCoTradeoff({ T2: k.T2, P3: k.P3, calib: k.calib, Tmin: 1800, Tmax: 1900, n: 1 });
    near(a.NOx_ppm, 8.5, 0.1);
    near(b.NOx_ppm, 52.2, 0.5);
  });
  it('calibrateEngineNOx: target = NOx preset → ENGINE_NOX_CALIB; target lain tercapai', () => {
    near(calibrateEngineNOx('diesel', sd.NOx_gkWh).calib, ENGINE_NOX_CALIB, 0.002);
    near(calibrateEngineNOx('gas', sg.NOx_gkWh).calib, ENGINE_NOX_CALIB, 0.002);
    const r = calibrateEngineNOx('diesel', 5);
    expect(r.converged).toBe(true);
    near(r.NOx_gkWh, 5, 0.01);
    expect(r.calib).toBeLessThan(ENGINE_NOX_CALIB);
  });
  it('retardSweep diesel −4° → 0°: NOx −31%, CO₂ +3,0%; gas −14° → −6°: NOx 2,57 → 0,74', () => {
    const [a, b] = retardSweep('diesel', [-4, 0]);
    near((b.NOx_gkWh / a.NOx_gkWh - 1) * 100, -31, 1);
    near((b.co2_gkWh / a.co2_gkWh - 1) * 100, 3.0, 0.2);
    const [g0, g1] = retardSweep('gas', [-14, -6]);
    near(g0.NOx_gkWh, 2.57, 0.05);
    near(g1.NOx_gkWh, 0.74, 0.05);
  });
});

describe('Basis emisi (M4b)', () => {
  it('25 ppm @15% O₂ → 51,3 mg/Nm³ (0 °C, 2,05/ppm) dan 47,0 (25 °C, 1,88/ppm) sebagai NO₂', () => {
    const a = emissionAtBasis({ ppm: 25 });
    near(a.ppm, 25, 1e-12);
    near(a.mgNm3, 51.3, 0.1);
    near(a.mgNm3 / 25, 2.05, 0.005);
    const b = emissionAtBasis({ ppm: 25, TrefK: 298.15 });
    near(b.mgNm3, 47.0, 0.1);
    near(b.mgNm3 / 25, 1.88, 0.005);
  });
  it('koreksi O₂: 15% → 3% = ×(20,9−3)/(20,9−15); 15% → 20% = ×0,9/5,9; bolak-balik kembali', () => {
    near(emissionAtBasis({ ppm: 100, refO2: 3 }).ppm, 100 * 17.9 / 5.9, 1e-9);
    near(emissionAtBasis({ ppm: 100, refO2: 20 }).ppm, 100 * 0.9 / 5.9, 1e-9);
    const x = emissionAtBasis({ ppm: 100, refO2: 5 }).ppm;
    near(emissionAtBasis({ ppm: x, refFrom: 5, refO2: 15 }).ppm, 100, 1e-9);
  });
  it('sama dengan cylinderSim({refO2}) (toDryRef pada O₂ acuan lain)', () => {
    const s15 = cylinderSim(ENGINE_PRESETS.diesel), s5 = cylinderSim({ ...ENGINE_PRESETS.diesel, refO2: 5 });
    near(emissionAtBasis({ ppm: s15.NOx_ppmvd_ref, refO2: 5 }).ppm / s5.NOx_ppmvd_ref, 1, 1e-9);
    near(emissionAtBasis({ ppm: s15.NOx_ppmvd_ref }).mgNm3, s15.NOx_mgNm3_ref, 1e-9);
    expect(MW.NO2).toBe(46.005);
  });
  it('konstanta Zeldovich yang diekspor = yang dipakai (rasio 1900/1800 tetap 7,1)', () => {
    expect(ZELDOVICH).toEqual({ A: 6e16, Ea: 69090 });
    near(noxRateRatio(1800), 7.1, 0.2);
  });
});

describe('selfTest', () => {
  it('selfTest().failed = 0', () => {
    const r = selfTest();
    expect(r.failed, JSON.stringify(r.results.filter((x) => !x.ok))).toBe(0);
    expect(r.passed).toBe(14);
  });
});
