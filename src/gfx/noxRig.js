/**
 * noxRig.js — rig Scene 4: rig piston (dipakai ulang) + "gelembung" zona terbakar + partikel NO.
 * Hanya membaca frame:
 *   - gelembung: ukuran ∝ ∛xb, warna = frame.burned.rgb (tempToRGB suhu zona terbakar, legenda K);
 *   - partikel NO (oranye, InstancedMesh): dipancarkan dari permukaan gelembung, laju ∝ frame.no.spawn
 *     (logNorm laju pembentukan NO dari noTrace cylinderSim).
 * Gerak partikel murni visual (tidak ada perhitungan model di sini).
 */
import * as THREE from 'three';
import { createPistonRig, HP } from './pistonRig.js';
import { SPECIES_COLORS } from './species.js';

export const NO_CAPACITY = 360;
const SPAWN_PER_DEG = 2.2;    // partikel per derajat engkol pada spawn = 1 (tak bergantung slow-motion)
const LIFE = 1.8;             // detik

export function createNoxRig({ capacity = NO_CAPACITY, random = Math.random } = {}) {
  const piston = createPistonRig();
  const group = new THREE.Group();
  group.add(piston.group);

  const bubbleGeo = new THREE.SphereGeometry(1, 40, 24);
  const bubbleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.62, depthWrite: false });
  const bubble = new THREE.Mesh(bubbleGeo, bubbleMat);
  bubble.name = 'burnedZone';
  bubble.renderOrder = 2;
  bubble.visible = false;
  group.add(bubble);
  const haloMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending });
  const halo = new THREE.Mesh(bubbleGeo, haloMat);
  halo.renderOrder = 3;
  bubble.add(halo);
  halo.scale.setScalar(1.12);

  const pGeo = new THREE.IcosahedronGeometry(1, 0);
  const pMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(SPECIES_COLORS.NOx), transparent: true, opacity: 0.95, depthWrite: false });
  const particles = new THREE.InstancedMesh(pGeo, pMat, capacity);
  particles.name = 'noParticles';
  particles.frustumCulled = false;
  particles.renderOrder = 4;
  particles.count = 0;
  group.add(particles);

  const anchors = { ...piston.anchors, burned: new THREE.Object3D(), no: new THREE.Object3D() };
  group.add(anchors.burned, anchors.no);

  // kolam partikel: posisi relatif ruang bakar (x, z dalam m; u = fraksi tinggi crown→deck)
  const P = Array.from({ length: capacity }, () => ({ alive: false, x: 0, u: 0, z: 0, vx: 0, vu: 0, vz: 0, age: 0 }));
  let alive = 0, carry = 0;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3();
  const tmp = new THREE.Color();

  function spawn(n, R, rad, uC) {
    for (let k = 0; k < n; k++) {
      const p = P.find((x) => !x.alive);
      if (!p) return;
      const a = random() * Math.PI * 2, c = random() * 2 - 1, sn = Math.sqrt(1 - c * c);
      const dx = sn * Math.cos(a), dy = c, dz = sn * Math.sin(a);
      Object.assign(p, { alive: true, age: 0, x: dx * rad, z: dz * rad, u: uC + dy * 0.3, vx: dx * R * 0.35, vz: dz * R * 0.35, vu: dy * 0.25 });
      alive++;
    }
  }

  return {
    group,
    anchors,
    /** Untuk verifikasi (tes); hanya dibaca. */
    get parts() { return { piston: piston.parts, bubble, particles, alive, bubbleColor: bubbleMat.color }; },
    /**
     * @param {any} f frame deriveNox
     * @param {number} dt detik animasi (0 saat jeda/beku → partikel diam)
     * @param {number} dTheta derajat engkol yang dilalui sejak frame lalu (≥ 0)
     */
    update(f, dt = 0, dTheta = 0) {
      // nyala rig piston diganti gelembung zona terbakar (xb/dxb hanya untuk tampilan nyala)
      piston.update({ ...f, dxbNorm: 0, xb: 0 });
      const { R, a, l, deck } = piston.parts.dims;
      const crown = l + a - f.pistonPos + HP;
      const h = Math.max(1e-4, deck - crown);

      // gelembung
      const b = f.burned;
      bubble.visible = b.visible;
      const rad = Math.max(0.004, R * 0.9 * b.radius);
      const uC = 0.5;
      if (b.visible) {
        tmp.setRGB(b.rgb[0], b.rgb[1], b.rgb[2], THREE.SRGBColorSpace);
        bubbleMat.color.copy(tmp);
        haloMat.color.copy(tmp);
        bubble.position.set(0, crown + h * uC, 0);
        bubble.scale.set(rad, Math.max(0.003, Math.min(rad, h * 0.48)), rad);
      }
      // label di luar dinding silinder agar tidak menutupi ruang bakar (teks label tumbuh ke kanan)
      anchors.burned.position.set(R * 1.3, crown + h * 0.5, 0);
      anchors.no.position.set(-R * 2.5, crown + h * 0.5, 0);

      // partikel NO
      if (dt > 0) {
        carry += f.no.spawn * SPAWN_PER_DEG * Math.max(0, dTheta);
        const n = Math.floor(carry);
        carry -= n;
        if (n > 0 && b.visible) spawn(n, R, rad, uC);
        for (const p of P) {
          if (!p.alive) continue;
          p.age += dt;
          if (p.age > LIFE) { p.alive = false; alive--; continue; }
          p.x += p.vx * dt; p.z += p.vz * dt; p.u += p.vu * dt;
          const r = Math.hypot(p.x, p.z), rMax = R * 0.92;
          if (r > rMax) { p.x *= rMax / r; p.z *= rMax / r; p.vx *= -0.4; p.vz *= -0.4; }
          if (p.u < 0.04 || p.u > 0.96) { p.u = Math.min(0.96, Math.max(0.04, p.u)); p.vu *= -0.5; }
        }
      }
      let i = 0;
      for (const p of P) {
        if (!p.alive) continue;
        const sc = 0.0042 * (1 - 0.6 * (p.age / LIFE));
        p3.set(p.x, crown + h * p.u, p.z);
        s3.setScalar(sc);
        m4.compose(p3, q, s3);
        particles.setMatrixAt(i++, m4);
      }
      particles.count = i;
      particles.instanceMatrix.needsUpdate = true;
    },
    /** Kosongkan partikel (mis. ganti engine). */
    clearParticles() { for (const p of P) p.alive = false; alive = 0; carry = 0; particles.count = 0; },
    dispose() {
      piston.dispose();
      bubbleGeo.dispose(); bubbleMat.dispose(); haloMat.dispose();
      pGeo.dispose(); pMat.dispose(); particles.dispose();
      group.clear();
    },
  };
}
