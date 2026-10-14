// Verifikasi rig 3D piston terhadap model (three.js berjalan di Node tanpa WebGL).
// Acuan dihitung langsung dari thermo.js (engineGeometry, valveLift, tempToRGB), bukan dari rig.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { engineGeometry, valveLift, tempToRGB } from '../src/model/thermo.js';
import { defaultState } from '../src/state/store.js';
import { derive, runSim, TEMP_SCALE } from '../src/state/derive.js';
import { createPistonRig, HP, VALVE_MAX, CRANK, crankWebShape } from '../src/gfx/pistonRig.js';

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

// ── Geometri poros engkol: journal hanya di luar web, clearance rod ↔ journal/counterweight ──
const FLOOR_Y = -0.2; // lantai scene (piston.js) = batas crankcase (rig tidak punya mesh crankcase)

/** Titik-titik dunia dari semua vertex mesh. */
function worldVerts(obj) {
  const out = [];
  obj.updateMatrixWorld(true);
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) out.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld));
  });
  return out;
}
/** Jarak titik (lokal) ke silinder pejal koaksial sumbu z, jari-jari r, z ∈ [z0, z1]. */
function distCylZ(p, r, z0, z1) {
  const dr = Math.max(0, Math.hypot(p.x, p.y) - r), dz = Math.max(0, z0 - p.z, p.z - z1);
  return Math.hypot(dr, dz);
}
/** Jarak titik 2D ke poligon pejal (0 bila di dalam). */
function distPoly(x, y, poly) {
  let inside = false, d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    const ex = b.x - a.x, ey = b.y - a.y, t = Math.max(0, Math.min(1, ((x - a.x) * ex + (y - a.y) * ey) / (ex * ex + ey * ey)));
    d = Math.min(d, Math.hypot(x - a.x - t * ex, y - a.y - t * ey));
  }
  return inside ? 0 : d;
}
const zRange = (mesh) => { const b = new THREE.Box3().setFromObject(mesh); return [b.min.z, b.max.z]; };

/** Hasil pemeriksaan clearance (dipakai tes & laporan). */
export function crankClearance(engine) {
  const state = defaultState(engine), sim = runSim(state);
  const geo = engineGeometry(sim.params);
  const rig = createPistonRig();
  const poly = crankWebShape(geo.a).getPoints(48);
  const K = CRANK, zOut = K.webGap / 2 + K.webT;
  const inv = new THREE.Matrix4(), lp = new THREE.Vector3();
  const res = { rodJournal: Infinity, rodWeb: Infinity, webToLiner: Infinity, webToPiston: Infinity, webToFloor: Infinity, pinOK: true };
  for (let k = 0; k <= 144; k++) {
    const th = (k * 5) % 720 - 360; // θ = 0…720° dipetakan ke −360…+360
    const f = derive({ ...state, theta: th }, sim);
    rig.update(f);
    rig.group.updateMatrixWorld(true);
    const { crank, rod, piston, dims } = rig.parts;
    // posisi rod = crank-slider thermo.js (engineGeometry): crankpin di (a·sinθ, a·cosθ), pin piston di l + a − x(θ)
    const pin = crank.getObjectByName('crankpin').getWorldPosition(new THREE.Vector3());
    if (Math.hypot(pin.x - geo.a * Math.sin((th * Math.PI) / 180), pin.y - geo.a * Math.cos((th * Math.PI) / 180)) > UM) res.pinOK = false;
    if (Math.abs(piston.position.y - (geo.conrod + geo.a - geo.pistonPos(th))) > UM) res.pinOK = false;
    const rodPts = worldVerts(rod.getObjectByName('shank')).concat(worldVerts(rod.getObjectByName('bigEnd')));
    inv.copy(crank.matrixWorld).invert();
    for (const p of rodPts) {
      lp.copy(p).applyMatrix4(inv);
      res.rodJournal = Math.min(res.rodJournal,
        distCylZ(lp, K.journalR, -(zOut + K.journalLenL), -zOut), distCylZ(lp, K.journalR, zOut, zOut + K.journalLenR));
      for (const side of [-1, 1]) {
        const z0 = side < 0 ? -zOut : K.webGap / 2, z1 = side < 0 ? -K.webGap / 2 : zOut;
        const dz = Math.max(0, z0 - lp.z, lp.z - z1);
        const dp = Math.max(0, distPoly(lp.x, lp.y, poly) - K.webBevel); // bevel melebarkan garis luar
        res.rodWeb = Math.min(res.rodWeb, Math.hypot(dp, dz));
      }
    }
    // web + counterweight vs dinding silinder (liner mulai di linerBottom), skirt piston, lantai
    const webPts = worldVerts(crank.getObjectByName('webL')).concat(worldVerts(crank.getObjectByName('webR')));
    const yMax = Math.max(...webPts.map((p) => p.y)), yMin = Math.min(...webPts.map((p) => p.y));
    const linerBottom = dims.l - dims.a + HP - 0.17;
    const skirt = new THREE.Box3().setFromObject(piston).min.y;
    res.webToLiner = Math.min(res.webToLiner, linerBottom - yMax);
    res.webToPiston = Math.min(res.webToPiston, skirt - yMax);
    res.webToFloor = Math.min(res.webToFloor, yMin - FLOOR_Y);
  }
  res.rig = rig;
  return res;
}

for (const engine of ['diesel', 'gas']) {
  describe(`poros engkol: ${engine}`, () => {
    const C = crankClearance(engine);
    const { crank } = C.rig.parts;
    const K = CRANK;

    it('konstanta: lebar big end + 2·clearance ≤ celah web', () => {
      expect(K.bigEndW + 2 * K.clearance).toBeLessThanOrEqual(K.webGap);
    });
    it('main journal hanya di luar web: rentang z tidak overlap dengan celah dan web; di celah hanya crankpin', () => {
      const [l0, l1] = zRange(crank.getObjectByName('journalL'));
      const [r0, r1] = zRange(crank.getObjectByName('journalR'));
      const zOut = K.webGap / 2 + K.webT;
      expect(l1).toBeLessThanOrEqual(-zOut + 1e-9);
      expect(r0).toBeGreaterThanOrEqual(zOut - 1e-9);
      for (const o of crank.children) {
        if (!o.isMesh || o.name === 'crankpin') continue;
        const [z0, z1] = zRange(o);
        expect(z1 <= -K.webGap / 2 + 1e-9 || z0 >= K.webGap / 2 - 1e-9, `${o.name} menembus celah web`).toBe(true);
      }
    });
    it('posisi rod dari crank-slider thermo.js pada θ = 0…720° (langkah 5°)', () => expect(C.pinOK).toBe(true));
    it('jarak minimum rod (shank + big end) ke journal dan ke web/counterweight > clearance', () => {
      expect(C.rodJournal).toBeGreaterThan(K.clearance);
      expect(C.rodWeb).toBeGreaterThan(K.clearance);
    });
    it('web/counterweight tidak menembus dinding silinder, skirt piston, atau lantai (batas crankcase)', () => {
      expect(C.webToLiner).toBeGreaterThan(K.clearance);
      expect(C.webToPiston).toBeGreaterThan(K.clearance);
      expect(C.webToFloor).toBeGreaterThan(K.clearance);
    });
    it('counterweight berputar bersama crankpin (berlawanan 180°)', () => {
      const pin = crank.getObjectByName('crankpin').getWorldPosition(new THREE.Vector3());
      const web = crank.getObjectByName('webL');
      const pts = worldVerts(web);
      // titik web terjauh dari crankpin = tepi counterweight; arahnya berlawanan dengan crankpin
      const far = pts.reduce((b, p) => (p.distanceTo(pin) > b.distanceTo(pin) ? p : b));
      expect(far.x * pin.x + far.y * pin.y).toBeLessThan(0);
    });
    it('draw call poros engkol rendah (5 mesh) dan dispose membebaskan semua geometri', () => {
      expect(crank.children.filter((o) => o.isMesh).length).toBe(5);
      const geoms = new Set();
      C.rig.group.traverse((o) => { if (o.isMesh) geoms.add(o.geometry); });
      let disposed = 0;
      for (const g of geoms) g.addEventListener('dispose', () => { disposed++; });
      C.rig.dispose();
      expect(disposed).toBe(geoms.size);
    });
  });
}

describe('arsitektur', () => {
  it('pistonRig.js tidak mengimpor thermo.js (hanya membaca frame)', () => {
    const src = readFileSync(new URL('../src/gfx/pistonRig.js', import.meta.url), 'utf8');
    expect(src).not.toMatch(/model\/thermo/);
  });
});
