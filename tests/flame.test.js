// Scene 3: pembakaran — warna nyala, titik operasi di kurva, T_in model, intensitas, perfGuard, combustorRig.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { flameTemperature, flameColor, cylinderSim, sampleSim, braytonReal, qinPerKgAir, ENGINE_PRESETS } from '../src/model/thermo.js';
import { FLAME_MODES, FLAME_RANGES } from '../src/model/presets.js';
import { flameDefaults, flameInitialState, tickWindowPatch, bloomCyclePatch } from '../src/state/store.js';
import { deriveFlame, flameSimParams, phiGrid, focusWindow } from '../src/state/deriveFlame.js';
import { cycleCurve } from '../src/state/derive.js';
import { createPerfGuard } from '../src/gfx/perfGuard.js';
import { createCanCombustor, createChamberCloseup } from '../src/gfx/combustorRig.js';
import { STR } from '../src/ui/strings.js';

const base = { ...flameInitialState(), theta: 0, rpmVisual: 20, playing: true, frozen: false };
const st = (mode, extra = {}) => ({ ...base, ...flameDefaults(mode), ...extra });
const near = (got, want, tol) => expect(Math.abs(got - want), `got ${got}, want ${want}`).toBeLessThanOrEqual(tol);

/** Interpolasi polyline kurva pada φ. */
function curveAt(c, phi) {
  for (let i = 0; i < c.phi.length - 1; i++) {
    if (phi >= c.phi[i] && phi <= c.phi[i + 1]) {
      const u = (phi - c.phi[i]) / (c.phi[i + 1] - c.phi[i]);
      return c.T[i] + u * (c.T[i + 1] - c.T[i]);
    }
  }
  return NaN;
}

describe('Scene 3: warna nyala = flameColor(φ)', () => {
  it('gas & turbin: warna = inti = flameColor(φ)', () => {
    for (const mode of ['gas', 'turbine']) for (const phi of [0.3, 0.55, 0.8, 1.0, 1.2]) {
      const f = deriveFlame(st(mode, { fPhi: phi }));
      expect(f.color).toEqual(flameColor(phi));
      expect(f.coreColor).toEqual(flameColor(phi));
    }
  });
  it('diesel: selubung = flameColor(φ global), inti zona nyala = flameColor(φ lokal)', () => {
    const f = deriveFlame(st('diesel', { fPhi: 0.45, fPhiLocal: 1.05 }));
    expect(f.outerColor).toEqual(flameColor(0.45));
    expect(f.coreColor).toEqual(flameColor(1.05));
  });
});

describe('Scene 3: titik operasi selalu di kurva T_ad(φ)', () => {
  it('grid kurva memuat semua titik patah model dalam rentang slider', () => {
    const g = phiGrid();
    for (const b of [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.05, 1.1, 1.2]) expect(g).toContain(b);
  });
  it('sapuan φ (termasuk nilai di antara grid) × T_in × mode: titik tepat di polyline', () => {
    const phis = [0.3, 0.337, 0.5, 0.613, 0.799, 0.8, 0.85, 0.951, 1.0, 1.025, 1.07, 1.2];
    for (const mode of ['diesel', 'gas', 'turbine']) for (const Tin of [300, 512.5, 700, 928, 1000]) for (const phi of phis) {
      const f = deriveFlame(st(mode, { fPhi: phi, fPhiLocal: phi, fTin: Tin }));
      for (const p of f.points) {
        near(p.T, flameTemperature(p.phi, Tin, FLAME_MODES[mode].fuel), 1e-9);
        near(curveAt(f.curve, p.phi), p.T, 1e-9);
      }
    }
  });
  it('kurva 300 K = flameTemperature(φ, 300)', () => {
    const f = deriveFlame(st('gas'));
    f.curve300.phi.forEach((phi, i) => near(f.curve300.T[i], flameTemperature(phi, 300, 'gas'), 1e-12));
  });
});

describe('Scene 3: suhu masuk dari model dan label', () => {
  it('piston: T_in = T gas saat θ0 (cylinderSim preset); turbin: T₂ braytonReal', () => {
    for (const mode of ['diesel', 'gas']) {
      const sim = cylinderSim({ ...ENGINE_PRESETS[mode], nox: false });
      const f = deriveFlame(st(mode));
      near(f.Tin, sampleSim(sim, sim.params.theta0).T, 1e-9);
      expect(f.TinManual).toBe(false);
    }
    near(deriveFlame(st('turbine')).Tin, braytonReal({}).T2, 1e-9);
  });
  it('T_in manual menggantikan model dan ditandai', () => {
    const f = deriveFlame(st('gas', { fTin: 600 }));
    expect(f.Tin).toBe(600);
    expect(f.TinManual).toBe(true);
    near(f.Tflame, flameTemperature(f.phi, 600, 'gas'), 1e-12);
  });
  it('diesel: T nyala zona = φ lokal, ΔT > 0; label & tooltip menegaskan "saat terbakar" (bukan suhu puncak Scene 4)', () => {
    const f = deriveFlame(st('diesel'));
    near(f.Tflame, flameTemperature(FLAME_MODES.diesel.phiLocal, f.Tin, 'diesel'), 1e-12);
    expect(f.dTlocal).toBeGreaterThan(300);
    expect(STR.scene3.hud.tflame.label).toBe('Adiabatic flame temperature');
    expect(STR.scene3.hud.tflame.tip(true)).toMatch(/SAAT campuran terbakar, BUKAN "Peak burned-zone temperature" di Scene 4/);
    expect(STR.scene3.overlay.tflameLabel).toBe('Suhu nyala adiabatik saat terbakar:');
  });
  it('turbin: titik berlabel φ zona premix; φ keseluruhan ≈ 0,34 dari model', () => {
    const f = deriveFlame(st('turbine'));
    expect(f.points[0].labelKey).toBe('phiPremix');
    expect(STR.scene3.points.phiPremix).toBe('Premix-zone φ');
    expect(STR.scene3.phiLabel.turbine).toBe('Premix-zone φ');
    expect(STR.scene3.notes.premix(1500, f.phiOverall)).toMatch(/bukan φ keseluruhan \(T₃ 1\.500 K ≈ 0,34\)/);
    near(f.phiOverall, 0.34, 0.005);
    near(f.T3, 1500, 1e-9);
  });
  it('bar perbandingan pada default: diesel (φ lokal) > gas lean-burn > turbin premix', () => {
    const b = deriveFlame(st('gas')).bars;
    expect(b.map((x) => x.mode)).toEqual(['diesel', 'gas', 'turbine']);
    expect(b[0].T).toBeGreaterThan(b[1].T);
    expect(b[1].T).toBeGreaterThan(b[2].T);
    expect(b.find((x) => x.active).mode).toBe('gas');
  });
});

describe('Scene 3: ukuran/kecerahan nyala ∝ laju pelepasan panas', () => {
  it('piston: intensitas = Qtot·dxb / (Qtot,ref·dxb_max,ref), naik dengan φ pada θ tetap', () => {
    const ref = cylinderSim({ ...ENGINE_PRESETS.diesel, phi: FLAME_RANGES.phi.max, nox: false });
    let prev = -1;
    for (const phi of [0.3, 0.5, 0.8, 1.2]) {
      const s = st('diesel', { fPhi: phi, theta: 10 });
      const sim = cylinderSim(flameSimParams(s));
      const f = deriveFlame(s, { sim });
      const dxb = sampleSim(sim, 10.5).xb - sampleSim(sim, 9.5).xb;
      near(f.intensity, (sim.Qtot * dxb) / (ref.Qtot * cycleCurve(ref).dxbMax), 1e-12);
      expect(f.intensity).toBeGreaterThan(prev);
      expect(f.intensity).toBeLessThanOrEqual(1);
      prev = f.intensity;
    }
  });
  it('piston: di luar jendela pembakaran intensitas 0', () => {
    expect(deriveFlame(st('gas', { theta: -200 })).intensity).toBe(0);
  });
  it('turbin: intensitas = qinPerKgAir(φ) / qinPerKgAir(φ maks); q_in per kg udara zona premix', () => {
    for (const phi of [0.3, 0.5, 0.9]) {
      const f = deriveFlame(st('turbine', { fPhi: phi }));
      near(f.intensity, qinPerKgAir(phi, 'gas') / qinPerKgAir(FLAME_RANGES.phi.max, 'gas'), 1e-12);
      near(f.qin, qinPerKgAir(phi, 'gas'), 1e-9);
    }
  });
  it('rig piston: posisi piston dari frame (pistonPos & hc)', () => {
    const sim = cylinderSim(flameSimParams(st('diesel')));
    const f = deriveFlame(st('diesel', { theta: 12 }), { sim });
    near(f.rig.pistonPos, sim.geo.pistonPos(12), 1e-15);
    near(f.rig.geom.hc, sim.geo.Vc / sim.geo.A, 1e-15);
  });
});

describe('Scene 3: jendela fokus & bloom (state)', () => {
  it('tickWindowPatch berputar di [θ0−15, akhir+15); hormati jeda/beku', () => {
    const w = focusWindow('diesel');
    const p = ENGINE_PRESETS.diesel;
    expect(w).toEqual({ lo: p.theta0 - 15, hi: p.theta0 + p.dur + 15 });
    const s = st('diesel', { theta: w.hi - 0.5, rpmVisual: 10 });
    const n = tickWindowPatch(s, 0.1, w.lo, w.hi).theta; // +6° → lewat batas → kembali ke awal
    expect(n).toBeGreaterThanOrEqual(w.lo); expect(n).toBeLessThan(w.lo + 6);
    expect(tickWindowPatch({ ...s, theta: -300 }, 0.01, w.lo, w.hi).theta).toBe(w.lo);
    expect(tickWindowPatch({ ...s, playing: false }, 0.1, w.lo, w.hi)).toEqual({});
    expect(tickWindowPatch({ ...s, frozen: true }, 0.1, w.lo, w.hi)).toEqual({});
    expect(focusWindow('turbine')).toBeNull();
  });
  it('tombol B: Auto → Nyala → Mati → Auto', () => {
    let s = { bloomMode: 'auto' };
    const seq = [];
    for (let i = 0; i < 3; i++) { s = { ...s, ...bloomCyclePatch(s) }; seq.push(s.bloomMode); }
    expect(seq).toEqual(['on', 'off', 'auto']);
  });
});

describe('perfGuard (fallback bloom)', () => {
  const run = (g, fps, sec, mode) => { let r; for (let t = 0; t < sec; t += 1 / fps) r = g.sample(1 / fps, mode); return r; };
  it('auto: fps rendah (20) selama > 2 s setelah warmup → bloom dimatikan sekali dan tetap mati', () => {
    const g = createPerfGuard();
    let tripped = 0, r;
    for (let t = 0; t < 6; t += 1 / 20) { r = g.sample(1 / 20, 'auto'); if (r.justTripped) tripped++; }
    expect(tripped).toBe(1);
    expect(r.bloom).toBe(false);
    expect(run(g, 60, 5, 'auto').bloom).toBe(false); // tidak menyala lagi otomatis
  });
  it('auto: fps normal (60) → bloom tetap nyala', () => {
    const r = run(createPerfGuard(), 60, 6, 'auto');
    expect(r.bloom).toBe(true);
    expect(r.tripped).toBe(false);
  });
  it('manual Nyala/Mati mengabaikan keputusan auto; reset mengizinkan auto lagi', () => {
    const g = createPerfGuard();
    run(g, 15, 6, 'auto');
    expect(g.tripped).toBe(true);
    expect(g.sample(1 / 15, 'on').bloom).toBe(true);
    expect(g.sample(1 / 60, 'off').bloom).toBe(false);
    g.reset();
    expect(g.sample(1 / 60, 'auto').bloom).toBe(true);
  });
});

describe('combustorRig (dapat dipakai ulang)', () => {
  const srgb = (c) => { const o = new THREE.Color(); c.getRGB(o, THREE.SRGBColorSpace); return [o.r, o.g, o.b]; };
  it('can combustor: parameter ukuran & swirler; bilah dan lubang dilusi = InstancedMesh', () => {
    for (const [swirler, vanes] of [['axial', 12], ['radial', 8]]) {
      const rig = createCanCombustor({ radius: 0.1, length: 0.5, swirler, vanes });
      expect(rig.parts.vanes).toBeInstanceOf(THREE.InstancedMesh);
      expect(rig.parts.vanes.count).toBe(vanes);
      expect(rig.parts.holes.count).toBe(20);
      rig.dispose();
      expect(rig.group.children.length).toBe(0);
    }
  });
  it('can combustor: panjang nyala naik dengan intensitas; warna uniform = input', () => {
    const rig = createCanCombustor();
    let prev = 0;
    for (const k of [0.1, 0.4, 0.8, 1]) {
      const color = flameColor(0.3 + k * 0.6);
      rig.update({ intensity: k, color, core: color, time: 1 });
      expect(rig.parts.flame.scale.y).toBeGreaterThan(prev);
      prev = rig.parts.flame.scale.y;
      srgb(rig.parts.flameMat.uniforms.uColor.value).forEach((v, i) => near(v, color[i], 1e-4));
      near(rig.parts.flameMat.uniforms.uIntensity.value, k, 1e-12);
    }
    rig.update({ intensity: 0, color: [1, 1, 1] });
    expect(rig.parts.flame.visible).toBe(false);
    rig.dispose();
  });
  it('close-up piston: crown di −(hc + pistonPos); diesel = plume, gas = muka nyala', () => {
    const rig = createChamberCloseup({ bore: 0.2 });
    rig.update({ fuel: 'diesel', pistonPos: 0.01, hc: 0.017, intensity: 0.5, color: flameColor(0.5), core: flameColor(0.95), outer: flameColor(0.5) });
    near(rig.parts.piston.position.y, -0.027, 1e-12);
    expect(rig.parts.plumes.visible).toBe(true);
    expect(rig.parts.kernel.visible).toBe(false);
    srgb(rig.parts.coreMat.uniforms.uColor.value).forEach((v, i) => near(v, flameColor(0.95)[i], 1e-4));
    rig.update({ fuel: 'gas', pistonPos: 0.002, hc: 0.026, intensity: 0.3, color: flameColor(0.62), xb: 0.3, spark: false });
    expect(rig.parts.plumes.visible).toBe(false);
    expect(rig.parts.kernel.visible).toBe(true);
    rig.dispose();
    expect(rig.group.children.length).toBe(0);
  });
  it('gfx tidak mengimpor thermo.js', async () => {
    const { readFileSync } = await import('node:fs');
    for (const f of ['combustorRig.js', 'flame.js', 'perfGuard.js']) {
      expect(readFileSync(new URL(`../src/gfx/${f}`, import.meta.url), 'utf8')).not.toMatch(/model\/thermo/);
    }
  });
});
