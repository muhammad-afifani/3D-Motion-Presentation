/**
 * emissionRig.js — Scene 8: tiga unit (diesel engine, gas engine, gas turbine) dengan cerobong yang memancarkan
 * partikel per spesies (warna konvensi SPECIES_COLORS). Laju partikel per unit/spesies = frame.particles[unit][spesies]
 * (0…1, sudah dipetakan logNorm di deriveEmis; PM = tingkat kualitatif tetap). Satu InstancedMesh, warna per instance.
 * Gerak partikel murni visual; tanpa thermo.js.
 */
import * as THREE from 'three';
import { createMaterials } from './materials.js';
import { SPECIES_COLORS } from './species.js';
import { particleScale } from './quality.js';

export const UNIT_X = Object.freeze({ diesel: -2.3, gas: 0, turbine: 2.3 });
export const SPECIES = Object.freeze(['NOx', 'CO2', 'CH4', 'PM']);
const RATE = 26;          // partikel/detik per spesies pada laju 1
const LIFE = 3.2;         // detik
const STACK_TOP = 1.75;

export function createEmissionRig({ capacity = 1400, random = Math.random } = {}) {
  const mat = createMaterials();
  const geoms = [], mats = [];
  const G = (g) => { geoms.push(g); return g; };
  const M = (m) => { mats.push(m); return m; };
  const root = new THREE.Group();
  const anchors = {};
  const anchor = (k, x, y, z) => { const a = new THREE.Object3D(); a.position.set(x, y, z); root.add(a); anchors[k] = a; };

  const stackGeo = G(new THREE.CylinderGeometry(0.12, 0.16, 1.2, 24));
  const unitMat = {
    diesel: M(new THREE.MeshStandardMaterial({ color: 0x55606f, metalness: 0.6, roughness: 0.5 })),
    gas: M(new THREE.MeshStandardMaterial({ color: 0x4d6b82, metalness: 0.6, roughness: 0.5 })),
    turbine: M(new THREE.MeshStandardMaterial({ color: 0x6a6f7a, metalness: 0.7, roughness: 0.4 })),
  };
  for (const [id, x] of Object.entries(UNIT_X)) {
    const body = id === 'turbine'
      ? new THREE.Mesh(G(new THREE.CylinderGeometry(0.34, 0.42, 1.5, 32)), unitMat[id])
      : new THREE.Mesh(G(new THREE.BoxGeometry(1.3, 0.75, 0.8)), unitMat[id]);
    if (id === 'turbine') { body.rotation.z = Math.PI / 2; body.position.set(x, 0.42, 0); } else body.position.set(x, 0.375, 0);
    const stack = new THREE.Mesh(stackGeo, mat.steelDark);
    stack.position.set(x + (id === 'turbine' ? 0.55 : 0.35), STACK_TOP - 0.6, 0);
    root.add(body, stack);
    anchor(id, x - 0.6, 1.0, 0.45);
    anchor(`${id}Top`, x + (id === 'turbine' ? 0.55 : 0.35), STACK_TOP, 0);
  }
  const floor = new THREE.Mesh(G(new THREE.PlaneGeometry(8, 3)), M(new THREE.MeshStandardMaterial({ color: 0x141b27, roughness: 0.9 })));
  floor.rotation.x = -Math.PI / 2;
  root.add(floor);

  const pGeo = G(new THREE.SphereGeometry(1, 8, 6));
  const pts = new THREE.InstancedMesh(pGeo, M(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false })), capacity);
  pts.name = 'emissionParticles';
  pts.frustumCulled = false;
  pts.count = 0;
  root.add(pts);
  const colors = Object.fromEntries(SPECIES.map((k) => [k, new THREE.Color(SPECIES_COLORS[k])]));
  const size = { NOx: 0.024, CO2: 0.03, CH4: 0.027, PM: 0.022 };
  const drift = { NOx: -0.12, CO2: 0.0, CH4: 0.14, PM: 0.05 };
  const P = Array.from({ length: capacity }, () => ({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, sp: 'NOx', unit: 'diesel' }));
  const carry = {};
  let alive = 0;
  const m4 = new THREE.Matrix4();

  function spawn(unit, sp) {
    const p = P.find((x) => !x.alive);
    if (!p) return;
    const top = anchors[`${unit}Top`].position;
    const a = random() * Math.PI * 2, r = 0.08 * random();
    Object.assign(p, { alive: true, age: 0, sp, unit, x: top.x + r * Math.cos(a), y: top.y, z: r * Math.sin(a), vx: drift[sp] + (random() - 0.5) * 0.1, vy: 0.55 + random() * 0.25, vz: (random() - 0.5) * 0.12 });
    alive++;
  }

  return {
    group: root,
    anchors,
    get parts() { return { particles: pts, alive, P }; },
    /**
     * @param {any} f frame deriveEmis (f.particles[unit][spesies] 0…1)
     * @param {number} dt detik animasi (0 saat jeda/beku)
     */
    update(f, dt = 0) {
      if (dt > 0) {
        const k = particleScale(); // kualitas: hanya jumlah partikel visual
        for (const unit of Object.keys(UNIT_X)) {
          for (const sp of SPECIES) {
            const id = `${unit}|${sp}`;
            carry[id] = (carry[id] ?? 0) + (f.particles[unit]?.[sp] ?? 0) * RATE * dt * k;
            while (carry[id] >= 1) { carry[id] -= 1; spawn(unit, sp); }
          }
        }
        for (const p of P) {
          if (!p.alive) continue;
          p.age += dt;
          if (p.age > LIFE) { p.alive = false; alive--; continue; }
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        }
      }
      let i = 0;
      for (const p of P) {
        if (!p.alive) continue;
        const s = size[p.sp] * (1 + 0.8 * (p.age / LIFE));
        m4.makeScale(s, s, s).setPosition(p.x, p.y, p.z);
        pts.setMatrixAt(i, m4);
        pts.setColorAt(i, colors[p.sp]);
        i++;
      }
      pts.count = i;
      pts.instanceMatrix.needsUpdate = true;
      if (pts.instanceColor) pts.instanceColor.needsUpdate = true;
    },
    /** Jumlah partikel hidup per unit & spesies (untuk tes). */
    countBy(unit, sp) { return P.filter((p) => p.alive && p.unit === unit && p.sp === sp).length; },
    clear() { for (const p of P) p.alive = false; alive = 0; for (const k of Object.keys(carry)) carry[k] = 0; pts.count = 0; },
    drawCalls() { let n = 0; root.traverse((o) => { if (o.isMesh && o.visible) n++; }); return n; },
    dispose() {
      for (const g of geoms.splice(0)) g.dispose();
      for (const m of mats.splice(0)) m.dispose();
      pts.dispose(); mat.dispose();
      root.clear();
    },
  };
}
