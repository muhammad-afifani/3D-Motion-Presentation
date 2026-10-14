/**
 * combustorRig.js — rig ruang bakar prosedural yang dapat dipakai ulang.
 *   createCanCombustor({ radius, length, swirler, vanes, flameLength }) → combustor turbin (can, cutaway),
 *       dipakai Scene 3 dan dapat dipakai ulang di Scene 5.
 *   createChamberCloseup({ bore, depth })  → ruang bakar piston (close-up) dengan semburan diesel /
 *       muka nyala gas.
 * Semua rig hanya menerima nilai dari frame (warna flameColor, intensitas, posisi piston); tanpa model.
 * Satuan: meter. Bilah swirler dan lubang dilusi memakai InstancedMesh.
 */
import * as THREE from 'three';
import { createMaterials } from './materials.js';
import { createFlameMaterial, setFlame } from './flame.js';

const CUT_START = 90 * (Math.PI / 180);
const CUT_LEN = 210 * (Math.PI / 180);
const CUT_EPS = 0.004; // geser bidang potongan keluar dari sisi padat (hindari z-fighting)
/** Sudut bidang potongan untuk tepi awal/akhir cutaway. */
const CUT_FACES = [CUT_START - CUT_EPS, CUT_START + CUT_LEN + CUT_EPS];

/** Sektor cincin setinggi h sepanjang +Y (θ ala three: dari +Z ke +X). */
function annularSector(rIn, rOut, h, thStart = CUT_START, thLen = CUT_LEN, segs = 48) {
  const shape = new THREE.Shape();
  const p0 = thStart - Math.PI / 2, p1 = thStart + thLen - Math.PI / 2;
  shape.absarc(0, 0, rOut, p0, p1, false);
  if (rIn > 0) shape.absarc(0, 0, rIn, p1, p0, true); else shape.lineTo(0, 0);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: segs });
  g.rotateX(-Math.PI / 2);
  return g;
}

/** Pelacak geometri & material agar dispose lengkap. */
function tracker() {
  const geoms = [], mats = [];
  return {
    G: (g) => { geoms.push(g); return g; },
    M: (m) => { mats.push(m); return m; },
    dispose() { for (const g of geoms.splice(0)) g.dispose(); for (const m of mats.splice(0)) m.dispose(); },
  };
}

/**
 * Combustor can (turbin) — sumbu aliran +X, cutaway menghadap kamera (+Z).
 * @param {{radius?: number, length?: number, swirler?: 'axial'|'radial', vanes?: number, flameLength?: number}} [o]
 */
export function createCanCombustor({ radius = 0.12, length = 0.6, swirler = 'axial', vanes = 12, flameLength = 0.38 } = {}) {
  const t = tracker();
  const mat = createMaterials();
  const group = new THREE.Group();
  const axial = new THREE.Group(); // dibangun sepanjang +Y lalu diputar ke +X
  axial.rotation.z = -Math.PI / 2;
  group.add(axial);

  // casing luar & liner (cutaway) + potongan berwarna
  const casing = new THREE.Mesh(t.G(annularSector(radius * 1.32, radius * 1.42, length * 1.1)), mat.block);
  casing.position.y = -length * 0.05;
  const liner = new THREE.Mesh(t.G(annularSector(radius, radius * 1.05, length)), mat.steelDark);
  axial.add(casing, liner);
  for (const th of CUT_FACES) {
    const f = new THREE.Mesh(t.G(new THREE.PlaneGeometry(radius * 0.05, length)), mat.cut);
    f.geometry.translate(radius * 1.025, length / 2, 0);
    f.rotation.y = th - Math.PI / 2;
    axial.add(f);
  }
  // lubang dilusi (2 cincin) — InstancedMesh
  const holeGeo = t.G(new THREE.CylinderGeometry(radius * 0.06, radius * 0.06, radius * 0.08, 12));
  holeGeo.rotateZ(Math.PI / 2);
  const nPer = 10, rings = [0.55, 0.75];
  const holes = new THREE.InstancedMesh(holeGeo, t.M(new THREE.MeshStandardMaterial({ color: 0x0b0f16, roughness: 1 })), nPer * rings.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(1, 1, 1);
  let k = 0;
  for (const fr of rings) for (let i = 0; i < nPer; i++) {
    const a = CUT_START + ((i + 0.5) / nPer) * CUT_LEN;
    e.set(0, a - Math.PI / 2, 0); q.setFromEuler(e);
    m4.compose(new THREE.Vector3(Math.sin(a) * radius * 1.025, length * fr, Math.cos(a) * radius * 1.025), q, sc);
    holes.setMatrixAt(k++, m4);
  }
  axial.add(holes);

  // swirler + nozzle bahan bakar di pangkal (y = 0)
  const hub = new THREE.Mesh(t.G(new THREE.CylinderGeometry(radius * 0.22, radius * 0.22, radius * 0.25, 24)), mat.steel);
  hub.position.y = -radius * 0.05;
  const nozzle = new THREE.Mesh(t.G(new THREE.CylinderGeometry(radius * 0.06, radius * 0.09, radius * 0.5, 16)), mat.steel);
  nozzle.position.y = -radius * 0.3;
  axial.add(hub, nozzle);
  const vaneGeo = swirler === 'radial'
    ? t.G(new THREE.BoxGeometry(radius * 0.32, radius * 0.18, radius * 0.02))
    : t.G(new THREE.BoxGeometry(radius * 0.55, radius * 0.16, radius * 0.02));
  const vaneMesh = new THREE.InstancedMesh(vaneGeo, mat.alu, vanes);
  for (let i = 0; i < vanes; i++) {
    const a = (i / vanes) * Math.PI * 2;
    if (swirler === 'radial') {
      // bilah radial di cincin depan, dimiringkan tangensial
      e.set(0, a + 0.6, 0); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(Math.cos(a) * radius * 0.62, -radius * 0.12, Math.sin(a) * radius * 0.62), q, sc);
    } else {
      // bilah aksial di sekeliling hub, sudut pusar 40°
      e.set(0.7, -a, 0, 'YXZ'); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(Math.cos(a) * radius * 0.52, 0, -Math.sin(a) * radius * 0.52), q, sc);
    }
    vaneMesh.setMatrixAt(i, m4);
  }
  axial.add(vaneMesh);

  // transition piece (keluar ke turbin)
  const tp = new THREE.Mesh(t.G(new THREE.CylinderGeometry(radius * 0.7, radius * 1.05, length * 0.18, 32, 1, true, CUT_START, CUT_LEN)), mat.steelDark);
  tp.material = mat.steelDark;
  tp.position.y = length * 1.09;
  axial.add(tp);

  // nyala premix: selubung + inti (pangkal di swirler, mengembang ke hilir)
  const flameGeo = t.G(new THREE.CylinderGeometry(radius * 0.82, radius * 0.24, 1, 40, 12, true));
  flameGeo.translate(0, 0.5, 0);
  const coreGeo = t.G(new THREE.CylinderGeometry(radius * 0.45, radius * 0.12, 1, 32, 12, true));
  coreGeo.translate(0, 0.5, 0);
  const flameMat = t.M(createFlameMaterial({ alongPow: 1.1 }));
  const coreMat = t.M(createFlameMaterial({ alongPow: 1.8 }));
  const flame = new THREE.Mesh(flameGeo, flameMat);
  const core = new THREE.Mesh(coreGeo, coreMat);
  flame.position.y = radius * 0.08; core.position.y = radius * 0.08;
  flame.renderOrder = 3; core.renderOrder = 4;
  axial.add(flame, core);
  const light = new THREE.PointLight(0xffaa66, 0, radius * 8, 2);
  light.position.y = length * 0.3;
  axial.add(light);

  return {
    group,
    parts: { flame, core, vanes: vaneMesh, holes, light, flameMat, coreMat },
    /** @param {{intensity:number, color:number[], core?:number[], time?:number}} p */
    update({ intensity, color, core: coreColor = color, time = 0 }) {
      const L = flameLength * (0.25 + 0.75 * intensity);
      flame.scale.set(0.6 + 0.4 * intensity, L, 0.6 + 0.4 * intensity);
      core.scale.set(1, L * 0.7, 1);
      setFlame(flameMat, { time, intensity, color, core: coreColor });
      setFlame(coreMat, { time: time * 1.3, intensity: Math.min(1, intensity * 1.2), color: coreColor, core: [1, 1, 1] });
      flame.visible = core.visible = intensity > 0.005;
      light.color.setRGB(color[0], color[1], color[2], THREE.SRGBColorSpace);
      light.intensity = 1.2 * intensity;
    },
    dispose() { t.dispose(); mat.dispose(); vaneMesh.dispose(); holes.dispose(); group.clear(); },
  };
}

/**
 * Ruang bakar piston (close-up). Kepala silinder di y = 0, piston turun ke −y.
 * @param {{bore?: number, depth?: number}} [o]
 */
export function createChamberCloseup({ bore = 0.2, depth = 0.14 } = {}) {
  const t = tracker();
  const mat = createMaterials();
  const group = new THREE.Group();
  const R = bore / 2;

  const head = new THREE.Mesh(t.G(annularSector(0, R * 1.25, 0.05)), mat.block);
  const wall = new THREE.Mesh(t.G(annularSector(R, R * 1.18, depth)), mat.block);
  wall.position.y = -depth;
  group.add(head, wall);
  for (const th of CUT_FACES) {
    for (const [r0, r1, y0, h] of [[R, R * 1.18, -depth, depth], [0, R * 1.25, 0, 0.05]]) {
      const f = new THREE.Mesh(t.G(new THREE.PlaneGeometry(r1 - r0, h)), mat.cut);
      f.geometry.translate((r0 + r1) / 2, y0 + h / 2, 0);
      f.rotation.y = th - Math.PI / 2;
      group.add(f);
    }
  }
  // piston crown (titik asal = permukaan crown)
  const piston = new THREE.Group();
  // crown agak gelap & kasar agar nyala (additive) tetap terbaca di atasnya
  const crown = new THREE.Mesh(t.G(new THREE.CylinderGeometry(R * 0.985, R * 0.985, 0.08, 48)), t.M(new THREE.MeshStandardMaterial({ color: 0x5d6673, metalness: 0.5, roughness: 0.6 })));
  crown.position.y = -0.04;
  const bowl = new THREE.Mesh(t.G(new THREE.CircleGeometry(R * 0.5, 40)), t.M(new THREE.MeshStandardMaterial({ color: 0x3a4250, metalness: 0.6, roughness: 0.5 })));
  bowl.rotation.x = -Math.PI / 2; // tanda bowl (cekungan) di crown
  bowl.position.y = 0.0006;
  piston.add(crown, bowl);
  group.add(piston);

  // injektor (diesel) / busi (gas)
  const injector = new THREE.Mesh(t.G(new THREE.CylinderGeometry(0.008, 0.005, 0.07, 16)), mat.steel);
  injector.position.y = 0.03;
  const plug = new THREE.Group();
  const ins = new THREE.Mesh(t.G(new THREE.CylinderGeometry(0.01, 0.01, 0.05, 16)), mat.ceramic);
  ins.position.y = 0.04;
  const elec = new THREE.Mesh(t.G(new THREE.CylinderGeometry(0.0018, 0.0018, 0.01, 6)), mat.steelDark);
  elec.position.y = -0.004;
  plug.add(ins, elec);
  group.add(injector, plug);

  // semburan diesel: 6 plume, masing-masing inti (φ lokal) + selubung (φ global)
  const plumeCore = t.G(new THREE.CylinderGeometry(0.009, 0.0015, 1, 20, 8, true));
  plumeCore.translate(0, 0.5, 0);
  const plumeOuter = t.G(new THREE.CylinderGeometry(0.02, 0.003, 1, 20, 8, true));
  plumeOuter.translate(0, 0.5, 0);
  const coreMat = t.M(createFlameMaterial({ alongPow: 1.4 }));
  const outerMat = t.M(createFlameMaterial({ alongPow: 0.9 }));
  const plumes = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group();
    g.rotation.order = 'YXZ';
    g.rotation.y = (i / 6) * Math.PI * 2;
    g.rotation.x = Math.PI / 2 + 0.12; // hampir horizontal: semburan menyebar di celah ruang bakar
    const c = new THREE.Mesh(plumeCore, coreMat), o = new THREE.Mesh(plumeOuter, outerMat);
    c.renderOrder = 4; o.renderOrder = 3;
    g.add(o, c);
    plumes.add(g);
  }
  plumes.position.y = -0.004;
  group.add(plumes);

  // muka nyala gas: cincin (dinding silinder terbuka) yang membesar di celah ruang bakar + percikan busi
  const kernelMat = t.M(createFlameMaterial({ alongPow: 0.25 }));
  const kernelGeo = t.G(new THREE.CylinderGeometry(1, 1, 1, 64, 4, true));
  const kernel = new THREE.Mesh(kernelGeo, kernelMat);
  kernel.renderOrder = 3;
  const spark = new THREE.Mesh(t.G(new THREE.SphereGeometry(0.006, 12, 8)), mat.spark);
  spark.position.y = -0.008;
  group.add(kernel, spark);
  const light = new THREE.PointLight(0xffaa66, 0, 0.6, 2);
  light.position.y = -0.03;
  group.add(light);

  return {
    group,
    parts: { piston, plumes, kernel, spark, injector, plug, light, coreMat, outerMat, kernelMat },
    /**
     * @param {{fuel:'diesel'|'gas', pistonPos:number, hc:number, intensity:number, color:number[],
     *   core?:number[], outer?:number[], xb?:number, spark?:boolean, time?:number}} p
     */
    update({ fuel, pistonPos, hc, intensity, color, core = color, outer = color, xb = 0, spark: sparkOn = false, time = 0 }) {
      const gap = hc + pistonPos;          // jarak kepala → crown (tinggi kolom gas setara)
      piston.position.y = -gap;
      const diesel = fuel === 'diesel';
      injector.visible = diesel; plug.visible = !diesel;
      plumes.visible = diesel && intensity > 0.005;
      if (diesel) {
        const len = Math.min(R * 0.95, 0.02 + R * 1.6 * intensity);
        for (const g of plumes.children) g.scale.set(0.7 + 1.2 * intensity, len, 0.7 + 1.2 * intensity);
        setFlame(coreMat, { time, intensity: Math.min(1, intensity * 1.3), color: core, core: core });
        setFlame(outerMat, { time: time * 0.8, intensity: intensity * 0.55, color: outer, core: outer });
      }
      const burning = !diesel && xb > 0.002 && xb < 0.995;
      kernel.visible = burning;
      if (burning) {
        const rad = Math.max(0.006, R * Math.cbrt(xb));
        kernel.scale.set(rad, Math.max(0.002, gap - 0.002), rad);
        kernel.position.y = -gap / 2;
        setFlame(kernelMat, { time, intensity: Math.min(1, 0.15 + intensity * 0.9), color, core: color });
      }
      mat.spark.opacity = sparkOn ? 1 : 0;
      light.color.setRGB((diesel ? core : color)[0], (diesel ? core : color)[1], (diesel ? core : color)[2], THREE.SRGBColorSpace);
      light.intensity = 0.35 * intensity;
    },
    dispose() { t.dispose(); mat.dispose(); group.clear(); },
  };
}
