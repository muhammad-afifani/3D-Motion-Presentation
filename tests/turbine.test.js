// Scene 5: turbin gas — angka dari frame, warna tahap, titik di kurva, rig 3D (hanya membaca frame).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { braytonReal, braytonDerated, twinShaft, twinShaftCycle, tempToRGB } from '../src/model/thermo.js';
import { GAS_TURBINES, GT_STAGES } from '../src/model/presets.js';
import { gtDefaults, gtInitialState } from '../src/state/store.js';
import { deriveTurbine, gtKeyNumbers, gtParams } from '../src/state/deriveTurbine.js';
import { TEMP_SCALE } from '../src/state/derive.js';
import { createGasTurbineRig } from '../src/gfx/turbineRig.js';

const st = (cfg, extra = {}) => ({ ...gtInitialState(), ...gtDefaults(cfg), theta: 0, rpmVisual: 20, ...extra });
const near = (got, want, tol) => expect(Math.abs(got - want), `got ${got}, want ${want}`).toBeLessThanOrEqual(tol);

describe('Scene 5: angka golden terbaca dari frame', () => {
  it('preset = default fungsi thermo.js (titik desain sama dengan tes golden)', () => {
    const g = braytonReal(gtParams(st('generator'))), b = braytonReal({ mdot: 20 });
    expect(g.eta).toBe(b.eta); expect(g.T4).toBe(b.T4);
    const t = twinShaft(gtParams(st('compressorDrive'))), w = twinShaft({ mdotDesign: 20 });
    expect(t.eta).toBe(w.eta); expect(t.T5).toBe(w.T5);
  });
  it('Generator (braytonReal): η 0,378 / T2 675 / T4 843 K; heat rate, back-work ratio, power ṁ·w_net', () => {
    const f = deriveTurbine(st('generator'));
    const b = braytonReal({});
    near(f.eta, 0.378, 0.005); near(f.T2, 675, 2); near(f.Texh, 843, 3);
    near(f.heatRate, 3600 / b.eta, 1e-9);
    near(f.bwr, b.backWorkRatio, 1e-12);
    near(f.power, GAS_TURBINES.generator.mdot * b.wnet, 1e-6);
    expect(f.N.rpm).toBe(GAS_TURBINES.generator.Nrpm);
  });
  it('Generator @35 °C: derate 0,865 (braytonDerated); %/°C = perDegC', () => {
    const f = deriveTurbine(st('generator', { gTamb: 35 }));
    near(f.derate, 0.865, 0.005);
    near(f.perDegC, braytonDerated({}, { TambC: 35 }).perDegC, 1e-12);
    expect(f.perDegRef).toBe(false);
    expect(f.ghost).not.toBeNull(); // pembanding ISO
  });
  it('Compressor drive (twinShaft): η 0,405 / T2 742 / T45 1049 / T5 760 K, sama dengan twinShaft() desain', () => {
    const f = deriveTurbine(st('compressorDrive'));
    const t = twinShaft({});
    near(f.eta, 0.405, 0.005); near(f.T2, 742, 3); near(f.T45, 1049, 5); near(f.Texh, 760, 5);
    expect(f.eta).toBe(t.eta); expect(f.T45).toBe(t.T45); expect(f.Texh).toBe(t.T5);
    near(f.power, GAS_TURBINES.compressorDrive.mdot * t.wpt, 1e-6);
    expect(f.states.map((x) => x.label)).toEqual(['1', '2', '3', '4.5', '5']);
  });
  it('derating di 15 °C tidak NaN: memakai acuan 35 °C (ditandai)', () => {
    for (const cfg of ['generator', 'compressorDrive']) {
      const f = deriveTurbine(st(cfg));
      expect(Number.isFinite(f.perDegC)).toBe(true);
      expect(f.perDegRef).toBe(true);
      const ref = cfg === 'generator' ? braytonDerated({ ...gtParams(st(cfg)) }, { TambC: 35 }).perDegC : twinShaftCycle(gtParams(st(cfg)), { TambC: 35 }).perDegC;
      near(f.perDegC, ref, 1e-12);
    }
  });
  it('pesan kunci dari model: back-work ratio ±52%, derating ±0,68 %/°C', () => {
    const k = gtKeyNumbers();
    near(k.bwr, 0.52, 0.01); near(k.perDegC * 100, 0.68, 0.01);
  });
});

describe('Scene 5: warna tahap & kurva', () => {
  for (const cfg of ['generator', 'compressorDrive']) {
    it(`${cfg}: suhu tahap kompresor naik monoton, turbin turun monoton; tahap akhir = state model; warna = tempToRGB`, () => {
      const f = deriveTurbine(st(cfg));
      const c = f.stages.comp, t = [...f.stages.turb, ...f.stages.pt];
      expect(c.length).toBe(GT_STAGES.compressor);
      for (let i = 1; i < c.length; i++) expect(c[i].T).toBeGreaterThan(c[i - 1].T);
      for (let i = 1; i < t.length; i++) expect(t[i].T).toBeLessThan(t[i - 1].T);
      near(c[c.length - 1].T, f.T2, 1e-9);
      near(t[t.length - 1].T, f.Texh, 1e-9);
      if (f.twin) near(f.stages.turb[f.stages.turb.length - 1].T, f.T45, 1e-9);
      for (const x of [...c, ...t]) expect(x.rgb).toEqual(tempToRGB(x.T, TEMP_SCALE.min, TEMP_SCALE.max));
    });
    it(`${cfg}: titik berjalan di polyline T-s & P-v pada setiap θ`, () => {
      for (let th = -360; th < 360; th += 7.5) {
        const f = deriveTurbine(st(cfg, { theta: th }));
        const pr = f.procs[f.point.proc];
        const j = f.point.j, u = f.point.u;
        for (const k of ['v', 'P', 'T', 's']) near(f.point[k], pr[k][j] + (pr[k][Math.min(j + 1, pr[k].length - 1)] - pr[k][j]) * u, 1e-9);
      }
    });
  }
  it('kecepatan: generator N tetap; compressor drive N_GG & N_PT 100% di desain; sudut rotor dari θ', () => {
    const g = deriveTurbine(st('generator', { theta: 90 }));
    near(g.rotor.angleGG, Math.PI / 2, 1e-12);
    const t = deriveTurbine(st('compressorDrive', { theta: 45 }));
    expect([t.N.gg, t.N.pt]).toEqual([1, 1]);
    near(t.rotor.anglePT, Math.PI / 4, 1e-12);
  });
});

describe('turbineRig (dapat dipakai ulang, hanya membaca frame)', () => {
  const srgb = (mesh, k) => { const c = new THREE.Color(); mesh.getColorAt(k, c); const o = new THREE.Color(); c.getRGB(o, THREE.SRGBColorSpace); return [o.r, o.g, o.b]; };
  it('tidak mengimpor thermo.js', () => {
    expect(readFileSync(new URL('../src/gfx/turbineRig.js', import.meta.url), 'utf8')).not.toMatch(/model\/thermo/);
  });
  for (const [cfg, config] of [['generator', 'single'], ['compressorDrive', 'twin']]) {
    it(`${config}: warna instance per tahap = rgb frame (urutan tahap), bilah = InstancedMesh, draw call rendah`, () => {
      const f = deriveTurbine(st(cfg));
      const rig = createGasTurbineRig({ config, compressorStages: GT_STAGES.compressor, turbineStages: f.twin ? GT_STAGES.ggTurbine : GT_STAGES.turbine, ptStages: GT_STAGES.powerTurbine });
      rig.update(f);
      const { comp, turb, pt } = rig.parts;
      expect(comp.mesh).toBeInstanceOf(THREE.InstancedMesh);
      comp.rows.forEach((row, i) => srgb(comp.mesh, row.start).forEach((v, k) => near(v, f.stages.comp[i].rgb[k], 1e-4)));
      turb.rows.forEach((row, i) => srgb(turb.mesh, row.start + row.count - 1).forEach((v, k) => near(v, f.stages.turb[i].rgb[k], 1e-4)));
      if (pt) pt.rows.forEach((row, i) => srgb(pt.mesh, row.start).forEach((v, k) => near(v, f.stages.pt[i].rgb[k], 1e-4)));
      expect(rig.drawCalls()).toBeLessThanOrEqual(30);
      rig.dispose();
      expect(rig.group.children.length).toBe(0);
    });
  }
  it('frame berbeda → warna & sudut berbeda; twin: dua rotor independen', () => {
    const rig = createGasTurbineRig({ config: 'twin', turbineStages: GT_STAGES.ggTurbine, ptStages: GT_STAGES.powerTurbine });
    const a = deriveTurbine(st('compressorDrive', { theta: 30 }));
    rig.update(a);
    const c0 = srgb(rig.parts.comp.mesh, rig.parts.comp.rows[9].start);
    const b = deriveTurbine(st('compressorDrive', { theta: 30, gRp: 28 }));
    rig.update({ ...b, rotor: { angleGG: 1.1, anglePT: 0.4 } });
    const c1 = srgb(rig.parts.comp.mesh, rig.parts.comp.rows[9].start);
    expect(c1).not.toEqual(c0); // T2 lebih tinggi → warna tahap akhir berubah
    expect(rig.parts.rotorGG.rotation.x).toBe(1.1);
    expect(rig.parts.rotorPT.rotation.x).toBe(0.4);
    expect(rig.parts.rotorPT).not.toBe(rig.parts.rotorGG);
    rig.dispose();
  });
  it('single: satu rotor (kompresor & turbin satu poros)', () => {
    const rig = createGasTurbineRig({ config: 'single' });
    expect(rig.parts.rotorPT).toBe(rig.parts.rotorGG);
    expect(rig.parts.pt).toBeNull();
    rig.dispose();
  });
});
