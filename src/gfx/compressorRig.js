/**
 * compressorRig.js — rig prosedural kompresor sentrifugal (Scene 7). Sumbu poros = +X.
 *   impeller : hub (Lathe) + bilah backswept (InstancedMesh), berputar dengan frame.rotor.angle (speed dibutuhkan)
 *   casing   : shroud cutaway (Lathe sebagian) + volute (torus sebagian) + bidang potong berwarna
 *   aliran   : partikel gas (InstancedMesh) inlet → impeller → volute → discharge; warna dari frame.gasRGB
 *   kopling  : poros + flange ke power turbine (tanpa rig turbin; label saja)
 * Hanya membaca frame; gerak partikel murni visual (tanpa thermo.js).
 */
import * as THREE from 'three';
import { createMaterials } from './materials.js';

const CUT0 = 0.55 * Math.PI, CUT_LEN = 1.45 * Math.PI;  // jendela cutaway menghadap kamera (+Z)
export const N_BLADES = 14;
export const N_PARTICLES = 220;

/** Titik lintasan partikel u ∈ [0,1): inlet (aksial) → impeller (radial) → volute (keliling) → discharge (+Y). */
function pathPoint(u, jitter, out) {
  const [jr, ja, jz] = jitter;
  if (u < 0.3) {                       // pipa inlet, sumbu −X
    const t = u / 0.3, r = 0.16 * jr;
    out.set(-1.25 + 1.05 * t, r * Math.cos(ja * 6.283), r * Math.sin(ja * 6.283));
  } else if (u < 0.45) {               // impeller: belok radial
    const t = (u - 0.3) / 0.15, r = 0.12 + 0.36 * t, a = ja * 6.283 + t * 1.2;
    out.set(-0.2 + 0.2 * t, r * Math.cos(a), r * Math.sin(a));
  } else if (u < 0.8) {                // volute: mengelilingi
    const t = (u - 0.45) / 0.35, a = ja * 6.283 + 1.2 + t * 5.2, r = 0.6 + 0.04 * jz;
    out.set(0.02 + 0.06 * (jz - 0.5), r * Math.cos(a), r * Math.sin(a));
  } else {                             // discharge: ke atas (+Y) dari volute
    const t = (u - 0.8) / 0.2;
    out.set(0.02 + 0.08 * (jz - 0.5), 0.62 + 0.9 * t, 0.62 + 0.08 * (jr - 0.5));
  }
  return out;
}

export function createCompressorRig({ particles = N_PARTICLES, random = Math.random } = {}) {
  const mat = createMaterials();
  const geoms = [], mats = [];
  const G = (g) => { geoms.push(g); return g; };
  const M = (m) => { mats.push(m); return m; };
  const root = new THREE.Group();
  const anchors = {};
  const anchor = (k, x, y, z) => { const a = new THREE.Object3D(); a.position.set(x, y, z); root.add(a); anchors[k] = a; };

  // ── impeller (berputar) ──
  const rotor = new THREE.Group();
  root.add(rotor);
  const hubProf = [[0, -0.32], [0.09, -0.32], [0.12, -0.18], [0.2, -0.06], [0.42, 0.0], [0.5, 0.03], [0, 0.03]].map(([r, x]) => new THREE.Vector2(r, x));
  const hubGeo = G(new THREE.LatheGeometry(hubProf, 48));
  hubGeo.rotateZ(-Math.PI / 2);
  rotor.add(new THREE.Mesh(hubGeo, mat.alu));
  const bladeGeo = G(new THREE.BoxGeometry(0.28, 0.006, 0.16));
  const blades = new THREE.InstancedMesh(bladeGeo, M(new THREE.MeshStandardMaterial({ color: 0xc9d1dc, metalness: 0.75, roughness: 0.3 })), N_BLADES);
  blades.name = 'impellerBlades';
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
  for (let b = 0; b < N_BLADES; b++) {
    const a = (b / N_BLADES) * Math.PI * 2;
    e.set(a, 0, 0.35, 'XYZ');                       // backswept: sedikit miring
    q.setFromEuler(e);
    p.set(-0.08, 0.3 * Math.cos(a), 0.3 * Math.sin(a));
    m4.compose(p, q, sc);
    blades.setMatrixAt(b, m4);
  }
  rotor.add(blades);
  const shaftGeo = G(new THREE.CylinderGeometry(0.06, 0.06, 1, 20));
  shaftGeo.rotateZ(Math.PI / 2);
  const shaft = new THREE.Mesh(shaftGeo, mat.steel);
  shaft.scale.x = 1.5; shaft.position.x = 0.8;
  rotor.add(shaft);
  const flange = new THREE.Mesh(G(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 28)), mat.steelDark);
  flange.rotation.z = Math.PI / 2; flange.position.x = 1.45;
  rotor.add(flange);

  // ── casing statis: shroud cutaway + volute + pipa ──
  const casingMat = M(new THREE.MeshStandardMaterial({ color: 0x5a6576, metalness: 0.55, roughness: 0.5, side: THREE.DoubleSide, transparent: true, opacity: 0.5, depthWrite: false }));
  const shroudProf = [[0.2, -1.3], [0.2, -0.3], [0.26, -0.15], [0.48, -0.02], [0.56, 0.04]].map(([r, x]) => new THREE.Vector2(r, x));
  const shroudGeo = G(new THREE.LatheGeometry(shroudProf, 48, CUT0, CUT_LEN));
  shroudGeo.rotateZ(-Math.PI / 2);
  const shroud = new THREE.Mesh(shroudGeo, casingMat);
  shroud.renderOrder = 5;
  const voluteGeo = G(new THREE.TorusGeometry(0.62, 0.12, 16, 64, CUT_LEN));
  voluteGeo.rotateY(Math.PI / 2);
  const volute = new THREE.Mesh(voluteGeo, casingMat);
  volute.rotation.x = CUT0 - Math.PI / 2;
  volute.position.x = 0.02;
  volute.renderOrder = 5;
  const disch = new THREE.Mesh(G(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 24, 1, true)), casingMat);
  disch.position.set(0.02, 1.07, 0.62);
  disch.renderOrder = 5;
  // bidang potong (cut plane) berwarna di kedua ujung busur volute (koordinat lokal volute setelah rotateY)
  const cutGeo = G(new THREE.CircleGeometry(0.12, 24));
  const zAxis = new THREE.Vector3(0, 0, 1);
  for (const phi of [0.004, CUT_LEN - 0.004]) {
    const c = new THREE.Mesh(cutGeo, mat.cut);
    c.position.set(0, 0.62 * Math.sin(phi), -0.62 * Math.cos(phi));
    c.quaternion.setFromUnitVectors(zAxis, new THREE.Vector3(0, Math.cos(phi), Math.sin(phi)).normalize());
    volute.add(c);
  }
  root.add(shroud, volute, disch);

  // ── partikel gas ──
  const pGeo = G(new THREE.SphereGeometry(1, 8, 6));
  const pts = new THREE.InstancedMesh(pGeo, M(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false })), particles);
  pts.name = 'gasParticles';
  pts.frustumCulled = false;
  pts.renderOrder = 6;
  root.add(pts);
  const P = Array.from({ length: particles }, (_, i) => ({ u: i / particles, j: [random(), random(), random()] }));
  const tmpC = new THREE.Color(), cA = new THREE.Color(), cB = new THREE.Color();
  const v = new THREE.Vector3();

  anchor('impeller', -0.1, 0.62, 0.3);
  anchor('volute', 0.1, -0.4, 0.7);
  anchor('inlet', -1.1, 0.3, 0.2);
  anchor('discharge', 0.02, 1.55, 0.62);
  anchor('coupling', 1.25, 0.25, 0);

  /** Warna pada posisi lintasan (kenaikan suhu terjadi di impeller → volute). */
  function colorAt(rgbList, u) {
    const t = Math.min(1, Math.max(0, (u - 0.3) / 0.35)) * (rgbList.length - 1);
    const i = Math.min(rgbList.length - 2, Math.floor(t)), f = t - i;
    cA.setRGB(...rgbList[i], THREE.SRGBColorSpace); cB.setRGB(...rgbList[i + 1], THREE.SRGBColorSpace);
    return tmpC.copy(cA).lerp(cB, f);
  }

  return {
    group: root,
    anchors,
    get parts() { return { rotor, blades, particles: pts, P }; },
    /**
     * @param {any} f frame deriveComp
     * @param {number} dt detik animasi (0 saat jeda/beku)
     */
    update(f, dt = 0) {
      rotor.rotation.x = f.rotor.angle;
      const speed = 0.12 * f.flowVis * dt;
      for (let i = 0; i < P.length; i++) {
        const it = P[i];
        it.u = (it.u + speed) % 1;
        pathPoint(it.u, it.j, v);
        m4.makeScale(0.016, 0.016, 0.016).setPosition(v);
        pts.setMatrixAt(i, m4);
        pts.setColorAt(i, colorAt(f.gasRGB, it.u));
      }
      pts.instanceMatrix.needsUpdate = true;
      if (pts.instanceColor) pts.instanceColor.needsUpdate = true;
    },
    drawCalls() { let n = 0; root.traverse((o) => { if (o.isMesh && o.visible) n++; }); return n; },
    dispose() {
      for (const g of geoms.splice(0)) g.dispose();
      for (const m of mats.splice(0)) m.dispose();
      blades.dispose(); pts.dispose();
      mat.dispose();
      root.clear();
    },
  };
}
