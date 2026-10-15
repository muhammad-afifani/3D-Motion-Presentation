// Scene 4: NOx — angka frame = cylinderSim/retardSweep, zona terbakar dari TbTrace, Arrhenius dari zeldovichRate,
// rig 3D hanya membaca frame, istilah & basis O₂/volume di UI.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { cylinderSim, retardSweep, tempToRGB, noxRateRatio, zeldovichRate, ENGINE_PRESETS, ENGINE_NOX_CALIB, emissionAtBasis, calibrateEngineNOx, calibrateDLN, flameTemperature, MW } from '../src/model/thermo.js';
import { NOX_TIMING, NOX_ARRHENIUS, NOX_CALIB_DEFAULTS } from '../src/model/presets.js';
import { noxDefaults, noxInitialState, basisInitialState, calibInitialState, basisPatch, basisResetPatch, calibEnginePatch, calibResetPatch, createStore } from '../src/state/store.js';
import { deriveNox, noxSimParams, noxSweepParams, noxKeyNumbers, noxSimKey, noxSweepKey, NOX_TEMP_SCALE } from '../src/state/deriveNox.js';
import { createEngineCalibrator, dlnCalibration } from '../src/state/calibration.js';
import { deriveAssumptions, CHART_LEVELS } from '../src/state/deriveAssumptions.js';
import { CHART_TITLES } from '../src/ui/assumptions.js';
import { hudItems } from '../src/scenes/nox.js';
import { createSimClient } from '../src/state/simClient.js';
import { createNoxRig } from '../src/gfx/noxRig.js';
import { STR } from '../src/ui/strings.js';

const near = (got, want, tol) => expect(Math.abs(got - want), `got ${got}, want ${want}`).toBeLessThanOrEqual(tol);
const st = (engine, extra = {}) => ({ ...noxDefaults(engine), ...basisInitialState(), ...calibInitialState(), theta: 10, rpmVisual: 20, playing: true, frozen: false, ...extra });
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
    expect(d.NOx.refO2).toBe(15); expect(d.NOx.TrefC).toBe(0); expect(d.NOx.basisDefault).toBe(true);
    near(d.NOx.ppm, SIMS.diesel.NOx_ppmvd_ref, 1e-9); near(d.NOx.mgNm3, SIMS.diesel.NOx_mgNm3_ref, 1e-9);
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
    expect(cap).toMatch(/2,200–3,000 K/);
    expect(cap).toMatch(/1,500–2,000 K/);
    expect(cap).toMatch(/see Scenes 6 and 9/);
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
    for (const k of ['noxG', 'noxPpm', 'noxMg']) expect(H[k].label).toMatch(/indicative/);
    expect(STR.scene4.tradeoff.yLabel).toMatch(/indicative/);
    expect(H.noxPpm.unit).toBe('ppmvd');
    expect(H.noxMg.unit).toBe('mg/Nm³');
    expect(STR.common.basis.full(15, 0)).toBe('as NO₂, dry (ppmvd), @ 15 % O₂, 0 °C');
    expect(STR.common.basis.full(3.5, 25)).toBe('as NO₂, dry (ppmvd), @ 3.5 % O₂, 25 °C');
    expect(H.calib.value(0.17)).toBe('×0.17');
  });
  it('Scene 5: label model pada angka derating', () => {
    expect(STR.scene5.hud.derateModel).toEqual({ generator: 'Generator model', compressorDrive: 'Compressor-drive model' });
    expect(readFileSync(new URL('../src/scenes/turbine.js', import.meta.url), 'utf8')).toMatch(/model: H\.derateModel\[cfg\]/);
  });
});

// ───────────────────────────── M4b ─────────────────────────────
const hudVal = (f, id) => hudItems(f).find((x) => x.id === id);

describe('M4b: basis O₂ & volume (global, panel H)', () => {
  it('default 15 % O₂, 0 °C; patch: O₂ di-clamp 3–20 %, volume hanya 0/25 °C, input tak valid diabaikan', () => {
    expect(basisInitialState()).toEqual({ emRefO2: 15, emTrefC: 0 });
    expect(basisPatch({ refO2: 2 })).toEqual({ emRefO2: 3 });
    expect(basisPatch({ refO2: 25 })).toEqual({ emRefO2: 20 });
    expect(basisPatch({ refO2: '7.5' })).toEqual({ emRefO2: 7.5 });
    expect(basisPatch({ refO2: 'abc' })).toEqual({});
    expect(basisPatch({ TrefC: 25 })).toEqual({ emTrefC: 25 });
    expect(basisPatch({ TrefC: 10 })).toEqual({});
    expect(basisResetPatch()).toEqual(basisInitialState());
  });
  for (const [refO2, TrefC] of [[3, 0], [20, 25], [5, 25]]) {
    it(`basis ${refO2} % O₂ · ${TrefC} °C: ppm & mg/Nm³ = emissionAtBasis(thermo.js); tidak mengubah g/kWh; HUD menandai non-default`, () => {
      const s = st('diesel', { emRefO2: refO2, emTrefC: TrefC });
      const f = deriveNox(s, SIMS.diesel, SWEEPS.diesel);
      const want = emissionAtBasis({ ppm: SIMS.diesel.NOx_ppmvd_ref, refFrom: 15, refO2, TrefK: 273.15 + TrefC, MWspecies: MW.NO2 });
      near(f.NOx.ppm, want.ppm, 1e-9);
      near(f.NOx.mgNm3, want.mgNm3, 1e-9);
      expect(f.NOx.gkWh).toBe(SIMS.diesel.NOx_gkWh);
      expect(f.NOx.basisDefault).toBe(false);
      for (const id of ['noxppm', 'noxmg']) {
        const it2 = hudVal(f, id);
        expect(it2.sub).toBe(STR.common.basis.full(refO2, TrefC));
        expect(it2.flag).toBe(STR.common.basis.flag);
      }
      if (refO2 === 3) expect(f.NOx.ppm / SIMS.diesel.NOx_ppmvd_ref).toBeCloseTo(17.9 / 5.9, 9);
      if (refO2 === 20) expect(f.NOx.ppm / SIMS.diesel.NOx_ppmvd_ref).toBeCloseTo(0.9 / 5.9, 9);
    });
  }
  it('basis default: tanpa penanda; ppm tile tetap memuat basis lengkap', () => {
    const f = deriveNox(st('gas'), SIMS.gas, SWEEPS.gas);
    expect(hudVal(f, 'noxppm').flag).toBeUndefined();
    expect(hudVal(f, 'noxppm').sub).toBe('as NO₂, dry (ppmvd), @ 15 % O₂, 0 °C');
  });
  it('basis tidak memicu cylinderSim ulang (kunci sim tidak berubah)', () => {
    expect(noxSimKey(st('diesel', { emRefO2: 3 }))).toBe(noxSimKey(st('diesel')));
  });
});

describe('M4b: kalibrasi NOx (panel Calibration, store global)', () => {
  it('default: engine 0,17 (diesel & gas), DLN single 14,33 / twin 4,38 (calibrateDLN → 15 ppmvd @15% O₂ per konfigurasi)', () => {
    const c = calibInitialState();
    expect(c.calEngine).toEqual({ diesel: ENGINE_NOX_CALIB, gas: ENGINE_NOX_CALIB });
    near(c.calDln.single, 14.33, 0.005);
    near(c.calDln.twin, 4.38, 0.005);
    expect(NOX_CALIB_DEFAULTS.literature).toEqual({ engine: { diesel: 11, gas: 2.5 }, dlnPpm: 15, dlnRefO2: 15 });
  });
  it('faktor engine tersimpan per engine → sim & sapuan ulang, HUD "NOx calib" berubah; target tak valid ditolak', () => {
    const store = createStore(st('diesel'));
    const cal = createEngineCalibrator(store);
    expect(cal.apply('diesel', 'x')).toBe(false);
    expect(cal.apply('diesel', -1)).toBe(false);
    cal.dispose();
    const want = calibrateEngineNOx('diesel', 5, {}, { calib0: ENGINE_NOX_CALIB });
    store.set(calibEnginePatch(store.get(), 'diesel', want.calib));
    const s = store.get();
    expect(s.calEngine.gas).toBe(ENGINE_NOX_CALIB); // engine lain tidak ikut
    expect(noxSimKey(s)).not.toBe(noxSimKey(st('diesel')));
    expect(noxSweepKey(s)).not.toBe(noxSweepKey(st('diesel')));
    const sim = run(s);
    const f = deriveNox(s, sim, sweepOf(s));
    near(f.NOx.gkWh, 5, 0.01);
    expect(hudVal(f, 'calib').value(f)).toBe(STR.scene4.hud.calib.value(want.calib));
    expect(hudVal(f, 'calib').sub).toBe(STR.scene4.hud.calib.sub(false));
    expect(f.tradeoff.nox[f.tradeoff.theta0.indexOf(ENGINE_PRESETS.diesel.theta0)]).toBe(f.current.nox);
  });
  it('createEngineCalibrator: hasil Worker/sinkron disimpan ke store dan memanggil onDone', async () => {
    const store = createStore(st('gas'));
    const cal = await new Promise((resolve) => {
      const c = createEngineCalibrator(store, (k, r) => resolve({ k, r }));
      c.apply('gas', 1.5);
    });
    expect(cal.k).toBe('gas');
    expect(cal.r.converged).toBe(true);
    near(cal.r.NOx_gkWh, 1.5, 0.01);
    expect(store.get().calEngine.gas).toBe(cal.r.calib);
    expect(store.get().calEngine.diesel).toBe(ENGINE_NOX_CALIB);
  });
  it('Apply DLN per konfigurasi: target ppmvd @ basis O₂ aktif → calibrateDLN; Reset mengembalikan 0,17, 14,33 dan 4,38', () => {
    const s0 = st('diesel');
    const r20 = dlnCalibration(s0, 'single', 20, 15);
    near(r20.result.NOx_ppm, 20, 0.01);
    expect(r20.patch.calDln.single).toBeGreaterThan(NOX_CALIB_DEFAULTS.dln.single);
    expect(r20.patch.calDln.twin).toBe(NOX_CALIB_DEFAULTS.dln.twin); // konfigurasi lain tidak ikut
    near(dlnCalibration(s0, 'single', 15, 15).patch.calDln.single, NOX_CALIB_DEFAULTS.dln.single, 1e-6);
    near(dlnCalibration(s0, 'twin', 15, 15).patch.calDln.twin, NOX_CALIB_DEFAULTS.dln.twin, 1e-6);
    // target pada basis 3 % O₂: sama dengan calibrateDLN({refO2: 3})
    near(dlnCalibration(s0, 'single', 15, 3).patch.calDln.single, calibrateDLN({ targetPpm: 15, refO2: 3 }).calib, 1e-9);
    expect(dlnCalibration(s0, 'twin', 0, 15)).toBeNull();
    const store = createStore(st('diesel'));
    store.set({ ...r20.patch, ...calibEnginePatch(store.get(), 'diesel', 0.3) });
    const f1 = deriveNox(store.get(), run(store.get()), null);
    expect(f1.calDln).toEqual(r20.patch.calDln);
    store.set(calibResetPatch());
    const s = store.get();
    expect(s.calEngine).toEqual({ diesel: 0.17, gas: 0.17 });
    near(s.calDln.single, 14.33, 0.005);
    near(s.calDln.twin, 4.38, 0.005);
    const f2 = deriveNox(s, run(s), SWEEPS.diesel);
    expect(hudVal(f2, 'calib').value(f2)).toBe('×0.17');
    expect(hudVal(f2, 'calib').sub).toBe(STR.scene4.hud.calib.sub(true));
    expect(STR.scene4.hud.note(0.17, { single: 14.33, twin: 4.38 })).toMatch(/×0\.17 · DLN single ×14\.33 \/ twin ×4\.38/);
    expect(STR.scene4.calib.note).toMatch(/typical literature values, not to unit or vendor data/);
  });
});

describe('M4b: panel asumsi (data dari store / thermo.js)', () => {
  it('nilai langsung dari store: basis, kalibrasi, contoh konversi (25 ppm @15% → 51,3 mg/Nm³ pada 0 °C)', () => {
    const d = deriveAssumptions(st('diesel'));
    expect(d.basis).toMatchObject({ refO2: 15, TrefC: 0, isDefault: true });
    near(d.example.mgNm3, 51.3, 0.1);
    const d2 = deriveAssumptions(st('diesel', { emRefO2: 3, emTrefC: 25, calDln: { single: 20, twin: 5 } }));
    expect(d2.basis.isDefault).toBe(false);
    near(d2.example.ppm, 25 * 17.9 / 5.9, 1e-9);
    expect(d2.calib.dln).toEqual({ single: 20, twin: 5 });
    expect(d2.zeldovich).toEqual({ A: 6e16, Ea: 69090 });
  });
  it('tabel flame T = flameTemperature (T_in 300 K); setiap grafik punya judul & tingkat model', () => {
    const d = deriveAssumptions(st('gas'));
    for (const r of d.flame.rows) { expect(r.gas).toBe(flameTemperature(r.phi, 300, 'gas')); expect(r.diesel).toBe(flameTemperature(r.phi, 300, 'diesel')); }
    for (const x of CHART_LEVELS) {
      expect(typeof CHART_TITLES[x.chart]()).toBe('string');
      for (const k of x.levels) expect(STR.common.level[k]).toBeTruthy();
    }
  });
  it('isi teks: Zeldovich, air-standard/Wiebe, fixed premix fuel split, bukan data unit/vendor, ±100 K', () => {
    const A = STR.assumptions;
    const all = JSON.stringify(A) + A.zeldovich.formula('6×10¹⁶', '69,090');
    for (const re of [/air-standard/, /Wiebe/, /Fixed premix fuel split/, /not unit or vendor data/i, /±100 K/, /exp\(−69,090\/T\)/]) expect(all).toMatch(re);
  });
});
