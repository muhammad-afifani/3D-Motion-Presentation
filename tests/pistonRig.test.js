// Verifikasi rig 3D piston terhadap model (three.js berjalan di Node tanpa WebGL).
// Acuan dihitung langsung dari thermo.js (engineGeometry, valveLift, tempToRGB), bukan dari rig.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { engineGeometry, valveLift, tempToRGB } from '../src/model/thermo.js';
import { defaultState } from '../src/state/store.js';
import { derive, runSim, TEMP_SCALE } from '../src/state/derive.js';
import { createPistonRig, HP, VALVE_MAX } from '../src/gfx/pistonRig.js';

const UM = 1e-6; // 1 µm
const v = new THREE.Vector3(), w = new THREE.Vector3();
const thetas = Array.from({ length: 144 }, (_, i) => -360 + 5 * i); // −360 … +355, langkah 5°

for (const engine of ['diesel', 'gas']) {
  describe(`rig piston: ${engine}`, () => {
    const state = defaultState(engine);
    const sim = runSim(state);
    const q = sim.params;
    const geo = engineGeometry(q); // acuan independen dari rig
    const rig = createPistonRig();
    const frameAt = (th) => {
      const f = derive({ ...state, theta: th }, sim);
      rig.update(f);
      rig.group.updateMatrixWorld(true);
      return f;
    };

    it('pin piston = l + a − pistonPos(θ)', () => {
      for (const th of thetas) {
        frameAt(th);
        const { piston } = rig.parts;
        expect(Math.abs(piston.position.y - (geo.conrod + geo.a - geo.pistonPos(th)))).toBeLessThan(UM);
        expect(piston.position.x).toBe(0);
      }
    });

    it('jarak crankpin → pin piston = panjang batang torak (< 1 µm); ujung kecil batang tepat di pin', () => {
      for (const th of thetas) {
        frameAt(th);
        const { crank, rod, piston } = rig.parts;
        crank.getObjectByName('crankpin').getWorldPosition(v);
        piston.getWorldPosition(w);
        expect(Math.abs(v.distanceTo(w) - geo.conrod)).toBeLessThan(UM);
        rod.getObjectByName('smallEnd').getWorldPosition(v);
        expect(v.distanceTo(w)).toBeLessThan(UM);
      }
    });

    it('TDC (θ = 0 dan ±360): crankpin di atas, piston di titik tertinggi', () => {
      let maxY = -Infinity;
      for (const th of thetas) { frameAt(th); maxY = Math.max(maxY, rig.parts.piston.position.y); }
      for (const th of [-360, 0]) {
        frameAt(th);
        rig.parts.crank.getObjectByName('crankpin').getWorldPosition(v);
        expect(Math.abs(v.x)).toBeLessThan(UM);
        expect(Math.abs(v.y - geo.a)).toBeLessThan(UM);
        expect(Math.abs(rig.parts.piston.position.y - maxY)).toBeLessThan(UM);
        expect(Math.abs(rig.parts.piston.position.y - (geo.conrod + geo.a))).toBeLessThan(UM);
      }
      frameAt(180);
      rig.parts.crank.getObjectByName('crankpin').getWorldPosition(v);
      expect(Math.abs(v.y + geo.a)).toBeLessThan(UM); // BDC: crankpin di bawah
    });

    it('turun katup = valveLift × angkat maksimum (masuk: −360…IVC, buang: EVO…360)', () => {
      for (const th of thetas) {
        frameAt(th);
        const { valves, dims } = rig.parts;
        expect(Math.abs(dims.deck - valves.in.position.y - VALVE_MAX * valveLift(th, -360, q.ivc))).toBeLessThan(UM);
        expect(Math.abs(dims.deck - valves.ex.position.y - VALVE_MAX * valveLift(th, q.evo, 360))).toBeLessThan(UM);
      }
      frameAt(-255); // tengah langkah isap: katup masuk terbuka, buang tertutup
      expect(rig.parts.dims.deck - rig.parts.valves.in.position.y).toBeGreaterThan(VALVE_MAX * 0.9);
      expect(rig.parts.valves.ex.position.y).toBe(rig.parts.dims.deck);
    });

    it('warna gas = tempToRGB(T) dengan skala legenda', () => {
      const c = new THREE.Color();
      // toleransi 1e-4: pembulatan konversi sRGB↔linear three.js (~4e-6), jauh di bawah 1 langkah 8-bit (1/255)
      const TOL = 1e-4;
      for (const th of thetas) {
        const f = frameAt(th);
        const want = tempToRGB(f.T, TEMP_SCALE.min, TEMP_SCALE.max);
        rig.materials.gas.color.getRGB(c, THREE.SRGBColorSpace);
        expect(Math.abs(c.r - want[0])).toBeLessThan(TOL);
        expect(Math.abs(c.g - want[1])).toBeLessThan(TOL);
        expect(Math.abs(c.b - want[2])).toBeLessThan(TOL);
      }
    });

    it('kolom gas: tinggi = hc + pistonPos(θ), dari crown sampai bidang kepala silinder', () => {
      const hc = geo.Vc / geo.A;
      for (const th of thetas) {
        frameAt(th);
        const { gas, piston, dims } = rig.parts;
        const h = gas.scale.y; // geometri gas setinggi 1 m
        expect(Math.abs(h - (hc + geo.pistonPos(th)))).toBeLessThan(UM);
        expect(Math.abs(gas.position.y - h / 2 - (piston.position.y + HP))).toBeLessThan(UM);
        expect(Math.abs(gas.position.y + h / 2 - dims.deck)).toBeLessThan(UM);
        // volume kolom = V(θ) model
        expect(Math.abs(geo.A * h - geo.V(th)) / geo.V(th)).toBeLessThan(1e-9);
      }
    });

    it('dispose membersihkan grup', () => {
      const r2 = createPistonRig();
      r2.update(derive(state, sim));
      r2.dispose();
      expect(r2.group.children.length).toBe(0);
    });
  });
}

describe('arsitektur', () => {
  it('pistonRig.js tidak mengimpor thermo.js (hanya membaca frame)', () => {
    const src = readFileSync(new URL('../src/gfx/pistonRig.js', import.meta.url), 'utf8');
    expect(src).not.toMatch(/model\/thermo/);
  });
});
