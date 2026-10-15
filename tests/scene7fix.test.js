// Step 01 (M9 pack): perbaikan Scene 7 — nozzle volute, bingkai kamera, legenda, layout teks.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { VOLUTE, voluteNozzle, pipePoint } from '../src/gfx/voluteGeometry.js';
import { createCompressorRig } from '../src/gfx/compressorRig.js';
import { fitCameraToBox, boxInsideFree, projectedBounds } from '../src/gfx/fitCamera.js';
import { legendTickLayout } from '../src/charts/legend.js';

const ROOT = new URL('..', import.meta.url).pathname;
const near = (a, b, tol = 1e-6) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

describe('nozzle discharge volute', () => {
  const n = voluteNozzle();
  it('titik awal pipa discharge = titik keluar nozzle (1e-6)', () => {
    const start = pipePoint(n, 0);
    n.nozzleCenter.forEach((v, i) => near(start[i], v));
  });
  it('radius pipa = radius nozzle = jari-jari tabung volute', () => {
    expect(n.nozzleRadius).toBe(VOLUTE.tube);
    const rig = createCompressorRig();
    const { disch } = rig.parts;
    near(disch.geometry.parameters.radiusTop, n.nozzleRadius);
    near(disch.geometry.parameters.radiusBottom, n.nozzleRadius);
  });
  it('mesh pipa berawal tepat di nozzle: ujung dekat = nozzleCenter, ujung jauh = pipeEnd (tanpa celah)', () => {
    const rig = createCompressorRig();
    const { disch } = rig.parts;
    disch.updateMatrixWorld(true);
    const h = disch.geometry.parameters.height / 2;
    const a = new THREE.Vector3(0, -h, 0).applyMatrix4(disch.matrixWorld), b = new THREE.Vector3(0, h, 0).applyMatrix4(disch.matrixWorld);
    a.toArray().forEach((v, i) => near(v, n.nozzleCenter[i]));
    b.toArray().forEach((v, i) => near(v, n.pipeEnd[i]));
  });
  it('nozzle ada di garis tengah volute dan arah keluar tangensial (tegak lurus jari-jari)', () => {
    const [x, y, z] = n.nozzleCenter;
    near(x, VOLUTE.xCenter);
    near(Math.hypot(y, z), VOLUTE.radius);
    near(y * n.nozzleDir[1] + z * n.nozzleDir[2], 0);
    near(Math.hypot(...n.nozzleDir), 1);
  });
  it('sudut keluar lain tetap tangensial dan tersambung (sumber koordinat tunggal)', () => {
    for (const a of [0.3, 1.2, 2.5, 4]) {
      const m = voluteNozzle({ outletAngle: a });
      near(m.nozzleCenter[1] * m.nozzleDir[1] + m.nozzleCenter[2] * m.nozzleDir[2], 0);
      pipePoint(m, 0).forEach((v, i) => near(v, m.pointAt(a)[i]));
    }
  });
  it('rig tidak punya koordinat pipa discharge tertulis tetap (posisi dari voluteNozzle)', () => {
    const src = readFileSync(`${ROOT}src/gfx/compressorRig.js`, 'utf8');
    expect(src).not.toMatch(/disch\.position\.set\(0\.02, 1\.07/);
    expect(src).toMatch(/voluteNozzle\(\)/);
    expect(src).not.toMatch(/clippingPlanes|localClippingEnabled/); // tidak ada clipping plane yang bisa memotong pipa/flens
  });
});

describe('bingkai kamera dari Box3 seluruh rakitan', () => {
  const rig = createCompressorRig();
  const box = rig.bounds();
  it('Box3 mencakup impeller, volute, pipa suction dan pipa discharge (+flens)', () => {
    const n = voluteNozzle();
    expect(box.max.y).toBeGreaterThanOrEqual(n.pipeEnd[1]);
    expect(box.min.x).toBeLessThanOrEqual(-1.25);          // pipa suction
    expect(box.max.z).toBeGreaterThanOrEqual(VOLUTE.radius + VOLUTE.tube);
  });
  for (const [w, h] of [[452, 360], [760, 610], [560, 420], [900, 300]]) {
    it(`semua sudut Box3 masuk area bebas pada tampilan ${w}×${h} (margin + inset overlay)`, () => {
      const cam = new THREE.PerspectiveCamera(35, w / h, 0.01, 50);
      cam.position.set(1.6, 0.9, 3.4);
      const o = { margin: 0.05, insets: { top: 0.2 } };
      const { distance } = fitCameraToBox(cam, box, { width: w, height: h, ...o });
      expect(distance).toBeGreaterThan(0);
      expect(boxInsideFree(cam, box, o)).toBe(true);
      const b = projectedBounds(cam, box); // dengan view offset: tidak melewati layar
      expect(Math.max(Math.abs(b.x0), Math.abs(b.x1), Math.abs(b.y0), Math.abs(b.y1))).toBeLessThan(1);
    });
  }
  it('arah pandang dipertahankan; jarak fit lebih besar dari batas default renderer (6) bila perlu dinaikkan', () => {
    const cam = new THREE.PerspectiveCamera(35, 1.2, 0.01, 50);
    cam.position.set(1.6, 0.9, 3.4);
    const dir0 = cam.position.clone().sub(box.getCenter(new THREE.Vector3())).normalize();
    fitCameraToBox(cam, box, { width: 600, height: 500, margin: 0.05 });
    const dir1 = cam.position.clone().sub(box.getCenter(new THREE.Vector3())).normalize();
    near(dir0.dot(dir1), 1, 1e-9);
    const src = readFileSync(`${ROOT}src/scenes/compressor.js`, 'utf8');
    expect(src).toMatch(/controls\.maxDistance = distance \* 2\.5/);
  });
});

describe('legenda suhu: label tidak bertumpuk', () => {
  const ticks = [300, 350, 400, 450, 500].map((T) => ({ frac: 1 - (T - 300) / 200 }));
  it('tick di dekat penanda disembunyikan (412 K vs tick 400 dan 450)', () => {
    const show = legendTickLayout(ticks, 1 - (412 - 300) / 200, 120);
    expect(show).toEqual([true, true, false, true, true]);    // hanya 400 (7 px dari penanda) yang menimpa
  });
  it('jarak vertikal minimum antar label yang tampil terpenuhi untuk setiap posisi penanda dan tinggi', () => {
    for (const h of [120, 200]) {
      for (let T = 300; T <= 500; T += 3) {
        const m = 1 - (T - 300) / 200;
        const show = legendTickLayout(ticks, m, h);
        const shown = ticks.filter((_, i) => show[i]).map((t) => t.frac * h).sort((a, b) => a - b);
        for (let i = 1; i < shown.length; i++) expect(shown[i] - shown[i - 1]).toBeGreaterThanOrEqual(14 - 1e-9);
        for (const y of shown) expect(Math.abs(y - m * h)).toBeGreaterThanOrEqual(16 - 1e-9);
      }
    }
  });
  it('tick rapat (tinggi kecil) dijarangkan', () => {
    const t = [0, 0.1, 0.2, 0.3, 0.4].map((frac) => ({ frac }));
    const show = legendTickLayout(t, 0.9, 60);
    const gaps = t.filter((_, i) => show[i]).map((x) => x.frac * 60).sort((a, b) => a - b);
    for (let i = 1; i < gaps.length; i++) expect(gaps[i] - gaps[i - 1]).toBeGreaterThanOrEqual(14);
  });
});

describe('layout teks Scene 7', () => {
  const css = readFileSync(`${ROOT}src/styles.css`, 'utf8');
  it('kartu Affinity laws membungkus teks (tidak nowrap) dan dibatasi lebar panel', () => {
    expect(css).toMatch(/\.scene--comp \.overlay--aff \.f-line \{ white-space: normal; overflow-wrap: anywhere; \}/);
    expect(css).toMatch(/\.scene--comp \.overlay--aff \{[^}]*max-width: calc\(100% - 24px\)/);
  });
  it('pesan kunci di bilah atas membungkus dan mengecil di layar sempit', () => {
    expect(css).toMatch(/\.key-message \{[^}]*overflow-wrap: anywhere/);
    expect(css).toMatch(/@media \(max-width: 1500px\) \{ \.key-message \{ font-size: clamp\(14px, 1\.3vw, 20px\); \} \}/);
  });
});
