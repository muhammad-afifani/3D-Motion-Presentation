// Scene 4: NOx — angka frame = cylinderSim/retardSweep, zona terbakar dari TbTrace, Arrhenius dari zeldovichRate,
// rig 3D hanya membaca frame, istilah & basis O₂/volume di UI.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { cylinderSim, retardSweep, tempToRGB, noxRateRatio, zeldovichRate, ENGINE_PRESETS, ENGINE_NOX_CALIB } from '../src/model/thermo.js';
import { NOX_TIMING, NOX_ARRHENIUS } from '../src/model/presets.js';
import { noxDefaults, noxInitialState } from '../src/state/store.js';
import { deriveNox, noxSimParams, noxSweepParams, noxKeyNumbers, NOX_TEMP_SCALE } from '../src/state/deriveNox.js';
import { createSimClient } from '../src/state/simClient.js';
import { createNoxRig } from '../src/gfx/noxRig.js';
import { STR } from '../src/ui/strings.js';

const near = (got, want, tol) => expect(Math.abs(got - want), `got ${got}, want ${want}`).toBeLessThanOrEqual(tol);
const st = (engine, extra = {}) => ({ ...noxDefaults(engine), theta: 10, rpmVisual: 20, playing: true, frozen: false, ...extra });
const run = (s) => cylinderSim(noxSimParams(s));
const sweepOf = (s) => { const p = noxSweepParams(s); return retardSweep(p.kind, p.thetas, p.over); };

const SIMS = {}, SWEEPS = {};
for (const e of ['diesel', 'gas']) { SIMS[e] = run(st(e)); SWEEPS[e] = sweepOf(st(e)); }

describe('Scene 4: angka dari model', () => {
  it('state awal: diesel, timing = preset thermo.js', () => {
    expect(noxInitialState()).toEqual({ nEngine: 'diesel', nTheta0: ENGINE_PRESETS.diesel.theta0 });
    expect(noxDefaults('gas').nTheta0).toBe(ENGINE_PRESETS.gas.theta0);
  });
  it('slider default: diesel NOx 10,7 g/kWh, η 0,441; gas 2,6 g/kWh, η 0,423 (golden), calib 0,17', () => {
    const d = deriveNox(st('diesel'), SIMS.diesel, SWEEPS.diesel);
    const g = deriveNox(st('gas'), SIMS.gas, SWEEPS.gas);
    near(d.NOx.gkWh, 10.7, 0.5); near(d.eta.brake, 0.441, 0.005);
    near(g.NOx.gkWh, 2.6, 0.2); near(g.eta.brake, 0.423, 0.005);
    expect(d.calib).toBe(ENGINE_NOX_CALIB);
    expect(d.NOx.refO2).toBe(15); expect(d.NOx.Tref).toBe(273.15);
    expect(d.NOx.ppm).toBe(SIMS.diesel.NOx_ppmvd_ref); expect(d.NOx.mgNm3).toBe(SIMS.diesel.NOx_mgNm3_ref);
    expect(d.TbPeak).toBe(SIMS.diesel.TburnedMax);
    expect(d.modelLevel).toBe('semiEmpirical');
  });
  it('sapuan memakai semua langkah slider; titik operasi = salah satu titik kurva (fungsi & preset sama)', () => {
    for (const e of ['diesel', 'gas']) {
      const T = NOX_TIMING[e];
      for (const th of [T.min, ENGINE_PRESETS[e].theta0, T.max]) {
        const s = st(e, { nTheta0: th });
        const f = deriveNox(s, run(s), SWEEPS[e]);
        const i = f.tradeoff.theta0.indexOf(th);
        expect(i).toBeGreaterThanOrEqual(0);
        expect(f.tradeoff.nox[i]).toBe(f.current.nox);
        expect(f.tradeoff.eta[i]).toBe(f.current.eta);
      }
    }
  });
  it('retard dari preset → NOx turun, η turun, CO₂ naik (vsPreset); diesel −4° → 0°: NOx −31%, CO₂ +3,0%', () => {
    const s = st('diesel', { nTheta0: 0 });
    const f = deriveNox(s, run(s), SWEEPS.diesel);
    near(f.vsPreset.nox * 100, -31, 1);
    near(f.vsPreset.co2 * 100, 3.0, 0.2);
    expect(f.vsPreset.eta).toBeLessThan(0);
  });
  it('hasil sapuan basi (engine lain) diabaikan', () => {
    const f = deriveNox(st('gas'), SIMS.gas, SWEEPS.diesel);
    expect(f.tradeoff).toBeNull();
    expect(f.vsPreset).toBeNull();
    expect(deriveNox(st('gas'), SIMS.gas, null).tradeoff).toBeNull();
  });
});

describe('Scene 4: zona terbakar & NO per θ (jejak cylinderSim)', () => {
  it('sebelum θ0: tidak ada zona terbakar dan NO = 0; setelah: Tb = TbTrace, warna = tempToRGB (skala Scene 4)', () => {
    const s0 = st('diesel', { theta: -30 });
    const f0 = deriveNox(s0, SIMS.diesel, SWEEPS.diesel);
    expect(f0.burned.visible).toBe(false);
    expect(f0.no.frac).toBe(0);
    expect(f0.no.spawn).toBe(0);
    const sim = SIMS.diesel, i = sim.th.indexOf(10);
    const f1 = deriveNox(st('diesel', { theta: 10 }), sim, SWEEPS.diesel);
    expect(f1.burned.visible).toBe(true);
    near(f1.burned.T, sim.TbTrace[i], 1e-9);
    expect(f1.burned.rgb).toEqual(tempToRGB(f1.burned.T, NOX_TEMP_SCALE.min, NOX_TEMP_SCALE.max));
    expect(f1.gasRGB).toEqual(tempToRGB(f1.T, NOX_TEMP_SCALE.min, NOX_TEMP_SCALE.max));
    expect(f1.tempScale).toBe(NOX_TEMP_SCALE);
    near(f1.no.frac, sim.noTrace[i] / sim.nNOkmol, 1e-12);
    expect(f1.no.rate).toBeGreaterThan(0);
    expect(f1.no.spawn).toBeGreaterThan(0);
    expect(f1.no.spawn).toBeLessThanOrEqual(1);
  });
  it('NO kumulatif naik monoton dan mencapai 100% di EVO', () => {
    let prev = -1;
    for (let th = -60; th <= 150; th += 5) {
      const f = deriveNox(st('gas', { theta: th }), SIMS.gas, SWEEPS.gas);
      expect(f.no.frac).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = f.no.frac;
    }
    near(prev, 1, 1e-9);
  });
  it('tidak ada NaN di seluruh rentang timing kedua engine', () => {
    for (const e of ['diesel', 'gas']) {
      for (const th of NOX_TIMING[e].sweep.filter((_, i) => i % 3 === 0)) {
        const s = st(e, { nTheta0: th, theta: th + 15 });
        const f = deriveNox(s, run(s), SWEEPS[e]);
        for (const v of [f.NOx.gkWh, f.NOx.ppm, f.NOx.mgNm3, f.TbPeak, f.burned.T, f.no.frac, f.no.spawn, f.arrhenius.ratioPeak]) expect(Number.isFinite(v)).toBe(true);
      }
    }
  });
});

describe('Scene 4: Arrhenius (zeldovichRate)', () => {
  const f = deriveNox(st('diesel', { theta: 12 }), SIMS.diesel, SWEEPS.diesel);
  const A = f.arrhenius;
  it('kurva = laju relatif terhadap 1800 K; titik puncak & titik berjalan berada di kurva', () => {
    const Tref = NOX_ARRHENIUS.Tref;
    const i = A.curve.T.findIndex((T) => Math.abs(T - Tref) < 1e-9);
    if (i >= 0) near(A.curve.rel[i], 1, 1e-12);
    for (const p of [A.peak, A.live]) near(p.rel, zeldovichRate({ T: p.T }) / zeldovichRate({ T: Tref }), 1e-9 * p.rel);
    expect(A.live.T).toBe(f.burned.T);
  });
  it('"+100 K ≈ ×N" dihitung model: 1800 K → 7,1; di T puncak engine lebih kecil', () => {
    near(A.ratioRef, 7.1, 0.2);
    near(A.ratioPeak, noxRateRatio(f.TbPeak), 1e-12);
    expect(A.ratioPeak).toBeLessThan(A.ratioRef);
    near(noxKeyNumbers().ratio100, 7.1, 0.2);
  });
  it('pita rentang: engine 2200–3000 K vs DLN 1500–2000 K, dan catatan di grafik', () => {
    expect(A.engineBand).toEqual([2200, 3000]);
    expect(A.dlnBand).toEqual([1500, 2000]);
    const cap = STR.scene4.arrhenius.caption(7.1, 1800, 3, 2750);
    expect(cap).toMatch(/2200–3000 K/);
    expect(cap).toMatch(/1500–2000 K/);
    expect(cap).toMatch(/noxCoTradeoff/);
  });
});

describe('Scene 4: Worker job retardSweep (jalur sinkron di Node)', () => {
  it('createSimClient job retardSweep = retardSweep(params)', () => {
    let got = null;
    const c = createSimClient((r) => { got = r; }, { job: 'retardSweep', paramsOf: noxSweepParams, keyOf: (s) => s.nEngine });
    c.runNow(st('gas'));
    expect(got).toEqual(SWEEPS.gas);
    c.dispose();
  });
  it('sim.worker mengirim TbTrace/noTrace (transfer) dan menangani retardSweep', () => {
    const src = readFileSync(new URL('../src/state/sim.worker.js', import.meta.url), 'utf8');
    expect(src).toMatch(/TbTrace/);
    expect(src).toMatch(/job === 'retardSweep'/);
  });
});

describe('Scene 4: rig 3D hanya membaca frame', () => {
  it('scene, rig, dan chart tidak mengimpor thermo.js', () => {
    for (const p of ['../src/scenes/nox.js', '../src/gfx/noxRig.js', '../src/charts/xyChart.js']) {
      expect(readFileSync(new URL(p, import.meta.url), 'utf8')).not.toMatch(/model\/thermo/);
    }
  });
  it('warna gelembung = frame.burned.rgb; tersembunyi saat belum terbakar', () => {
    const rig = createNoxRig();
    const f1 = deriveNox(st('diesel', { theta: 10 }), SIMS.diesel, SWEEPS.diesel);
    rig.update(f1, 0, 0);
    const want = new THREE.Color().setRGB(...f1.burned.rgb, THREE.SRGBColorSpace);
    expect(rig.parts.bubble.visible).toBe(true);
    near(rig.parts.bubbleColor.r, want.r, 1e-6); near(rig.parts.bubbleColor.g, want.g, 1e-6); near(rig.parts.bubbleColor.b, want.b, 1e-6);
    rig.update(deriveNox(st('diesel', { theta: -40 }), SIMS.diesel, SWEEPS.diesel), 0, 0);
    expect(rig.parts.bubble.visible).toBe(false);
    rig.dispose();
  });
  it('partikel NO: InstancedMesh, muncul ∝ spawn × Δθ, diam saat jeda (Δθ = 0), dibatasi kapasitas', () => {
    let seed = 1;
    const rig = createNoxRig({ capacity: 50, random: () => ((seed = (seed * 16807) % 2147483647) / 2147483647) });
    expect(rig.parts.particles.isInstancedMesh).toBe(true);
    const f = deriveNox(st('diesel', { theta: 8 }), SIMS.diesel, SWEEPS.diesel);
    rig.update(f, 0.016, 0);
    expect(rig.parts.alive).toBe(0);
    rig.update(f, 0.016, 2);
    const n1 = rig.parts.alive;
    expect(n1).toBe(Math.floor(f.no.spawn * 2.2 * 2));
    for (let k = 0; k < 40; k++) rig.update(f, 0.01, 5);
    expect(rig.parts.alive).toBeLessThanOrEqual(50);
    expect(rig.parts.particles.count).toBe(rig.parts.alive);
    rig.clearParticles();
    expect(rig.parts.alive).toBe(0);
    rig.dispose();
  });
});

describe('Scene 4: istilah, label indikatif, basis O₂ & volume', () => {
  const H = STR.scene4.hud;
  it('Scene 4 "Peak burned-zone temperature" vs Scene 3 "Adiabatic flame temperature", tooltip menjelaskan bedanya', () => {
    expect(H.tbPeak.label).toBe('Peak burned-zone temperature');
    expect(STR.scene3.hud.tflame.label).toBe('Adiabatic flame temperature');
    expect(H.tbPeak.tip).toMatch(/Adiabatic flame temperature/);
    expect(STR.scene3.hud.tflame.tip(true)).toMatch(/Peak burned-zone temperature/);
  });
  it('semua label NOx berlabel indikatif; ppm & mg/Nm³ menampilkan basis O₂ dan volume', () => {
    for (const k of ['noxG', 'noxPpm', 'noxMg']) expect(H[k].label).toMatch(/indikatif/);
    expect(STR.scene4.tradeoff.yLabel).toMatch(/indikatif/);
    expect(H.noxPpm.unit(15, 0)).toBe('ppmvd @15% O₂ · 0 °C');
    expect(H.noxMg.unit(15, 0)).toBe('mg/Nm³ @15% O₂ · 0 °C');
    expect(H.calib.value(0.17)).toBe('×0,17');
  });
  it('Scene 5: label model pada angka derating', () => {
    expect(STR.scene5.hud.derateModel).toEqual({ generator: 'Generator · braytonDerated', compressorDrive: 'Compressor drive · twinShaft' });
    expect(readFileSync(new URL('../src/scenes/turbine.js', import.meta.url), 'utf8')).toMatch(/model: H\.derateModel\[cfg\]/);
  });
});
