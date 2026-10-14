/**
 * turbineRig.js — rig 3D prosedural turbin gas, dapat dipakai ulang (Scene 5, Scene 6).
 *
 *   createGasTurbineRig({ config: 'single' | 'twin', compressorStages, turbineStages, ptStages, scale })
 *     single : kompresor aksial + turbin pada satu poros, generator di ujung dingin (N tetap).
 *     twin   : gas generator (kompresor + turbin GG) + free power turbine pada poros terpisah yang
 *              memutar beban (blok kompresor gas sederhana; rig sentrifugal menyusul M5b).
 *
 * Hanya membaca frame: warna tahap (rgb per tahap), sudut rotor (rad), intensitas & warna nyala.
 * Bilah per jenis = satu InstancedMesh (warna per instance) → draw call rendah. Tanpa thermo.js.
 * Sumbu aliran = +X; satuan scene ≈ meter (rig ±4 m panjang).
 */
import * as THREE from 'three';
import { createMaterials } from './materials.js';
import { createCanCombustor } from './combustorRig.js';

const CUT_START = 0.6 * Math.PI;  // cutaway casing menghadap kamera (+Z)
const CUT_LEN = 1.4 * Math.PI;

/**
 * @typedef {{rgb:number[]}} StageColor
 * @typedef {{stages:{comp:StageColor[], turb:StageColor[], pt?:StageColor[]}, rotor:{angleGG:number, anglePT:number},
 *   flame:{intensity:number, color:number[]}}} TurbineFrame
 */

/**
 * @param {{config?: 'single'|'twin', compressorStages?: number, turbineStages?: number, ptStages?: number,
 *   bladesPerRow?: number, scale?: number}} [o]
 */
export function createGasTurbineRig({ config = 'single', compressorStages = 10, turbineStages = 3, ptStages = 2, bladesPerRow = 22, scale = 1 } = {}) {
  const twin = config === 'twin';
  const mat = createMaterials();
  const geoms = [], mats = [];
  const G = (g) => { geoms.push(g); return g; };
  const M = (m) => { mats.push(m); return m; };
  const root = new THREE.Group();
  root.scale.setScalar(scale);
  const anchors = {};
  const anchor = (key, x, y, z) => { const a = new THREE.Object3D(); a.position.set(x, y, z); root.add(a); anchors[key] = a; };

  // ── tata letak sepanjang X ──
  const X = {
    comp0: -1.25, comp1: 0.0, comb0: 0.12, comb1: 0.72,
    turb0: 0.82, turb1: twin ? 1.08 : 1.32, pt0: 1.3, pt1: 1.62,
  };
  const compHub = (u) => 0.2 + 0.07 * u, compTip = (u) => 0.5 - 0.15 * u;        // u = 0…1 sepanjang kompresor
  const turbHub = () => 0.27, turbTip = (u) => 0.38 + 0.1 * u;
  const ptHub = () => 0.3, ptTip = (u) => 0.5 + 0.08 * u;

  // ── casing cutaway (Lathe: profil r(x) diputar), sumbu Lathe = Y → diputar ke X ──
  const prof = [];
  const add = (x, r) => prof.push(new THREE.Vector2(r, x));
  add(X.comp0 - 0.25, 0.62); add(X.comp0, 0.54);
  for (let i = 0; i <= 6; i++) { const u = i / 6; add(X.comp0 + (X.comp1 - X.comp0) * u, compTip(u) + 0.04); }
  add(X.comb0, 0.46); add((X.comb0 + X.comb1) / 2, 0.62); add(X.comb1, 0.46);
  add(X.turb0, turbTip(0) + 0.04); add(X.turb1, turbTip(1) + 0.05);
  if (twin) { add(X.pt0 - 0.05, ptTip(0) + 0.04); add(X.pt1, ptTip(1) + 0.05); add(X.pt1 + 0.35, 0.72); } else add(X.turb1 + 0.45, 0.66);
  const casingGeo = G(new THREE.LatheGeometry(prof, 64, CUT_START, CUT_LEN));
  casingGeo.rotateZ(-Math.PI / 2); // sumbu lathe (Y) → X
  const casing = new THREE.Mesh(casingGeo, M(new THREE.MeshStandardMaterial({ color: 0x4a5566, metalness: 0.55, roughness: 0.5, side: THREE.DoubleSide, transparent: true, opacity: 0.55, depthWrite: false })));
  casing.renderOrder = 5;
  root.add(casing);

  // ── rotor: drum hub (Lathe penuh) + poros ──
  const rotorGG = new THREE.Group();
  const rotorPT = twin ? new THREE.Group() : rotorGG;
  root.add(rotorGG);
  if (twin) root.add(rotorPT);
  const hubProf = [];
  const hadd = (x, r) => hubProf.push(new THREE.Vector2(r, x));
  hadd(X.comp0 - 0.1, 0.0); hadd(X.comp0 - 0.1, compHub(0));
  for (let i = 0; i <= 4; i++) { const u = i / 4; hadd(X.comp0 + (X.comp1 - X.comp0) * u, compHub(u)); }
  hadd(X.comp1 + 0.05, 0.14); hadd(X.turb0 - 0.05, 0.14); hadd(X.turb0, turbHub()); hadd(X.turb1, turbHub()); hadd(X.turb1 + 0.02, 0.0);
  const hubGeo = G(new THREE.LatheGeometry(hubProf, 40));
  hubGeo.rotateZ(-Math.PI / 2);
  rotorGG.add(new THREE.Mesh(hubGeo, mat.steelDark));
  // poros depan (ke generator pada single) & poros PT (twin)
  const shaftGeo = G(new THREE.CylinderGeometry(0.07, 0.07, 1, 20));
  shaftGeo.rotateZ(Math.PI / 2);
  const shaftFront = new THREE.Mesh(shaftGeo, mat.steel);
  if (!twin) { shaftFront.scale.x = 1.05; shaftFront.position.x = X.comp0 - 0.62; rotorGG.add(shaftFront); }
  if (twin) {
    const ptHubGeo = G(new THREE.CylinderGeometry(ptHub(), ptHub(), X.pt1 - X.pt0 + 0.06, 32));
    ptHubGeo.rotateZ(Math.PI / 2);
    const ptHubM = new THREE.Mesh(ptHubGeo, mat.steelDark);
    ptHubM.position.x = (X.pt0 + X.pt1) / 2;
    const ptShaft = new THREE.Mesh(shaftGeo, mat.steel);
    ptShaft.scale.x = 1.2; ptShaft.position.x = X.pt1 + 0.6;
    rotorPT.add(ptHubM, ptShaft);
  }

  // ── bilah: satu InstancedMesh per jenis (kompresor / turbin / PT), warna per tahap ──
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'XYZ'), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  /** Bangun baris bilah; return {mesh, rows:[{start, count}]} */
  function bladeRows(nRows, x0, x1, hub, tip, chord, stagger, material, parent) {
    const geo = G(new THREE.BoxGeometry(chord, 1, 0.008));
    const mesh = new THREE.InstancedMesh(geo, material, nRows * bladesPerRow);
    const rows = [];
    let k = 0;
    for (let r = 0; r < nRows; r++) {
      const u = nRows > 1 ? r / (nRows - 1) : 0;
      const x = x0 + (x1 - x0) * u, rh = hub(u), rt = tip(u), span = rt - rh;
      rows.push({ start: k, count: bladesPerRow, x });
      for (let b = 0; b < bladesPerRow; b++) {
        const a = (b / bladesPerRow) * Math.PI * 2 + r * 0.13;
        e.set(a, stagger, 0);
        q.setFromEuler(e);
        pos.set(x, 0, 0).add(new THREE.Vector3(0, (rh + span / 2) * Math.cos(a), (rh + span / 2) * Math.sin(a)));
        scl.set(1, span, 1);
        m4.compose(pos, q, scl);
        mesh.setMatrixAt(k, m4);
        mesh.setColorAt(k, new THREE.Color(1, 1, 1));
        k++;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    parent.add(mesh);
    return { mesh, rows };
  }
  const bladeMat = M(new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.45, roughness: 0.45 }));
  const comp = bladeRows(compressorStages, X.comp0 + 0.06, X.comp1 - 0.06, compHub, compTip, 0.07, 0.6, bladeMat, rotorGG);
  const turb = bladeRows(turbineStages, X.turb0 + 0.05, X.turb1 - 0.05, turbHub, turbTip, 0.08, -0.7, bladeMat, rotorGG);
  const pt = twin ? bladeRows(ptStages, X.pt0 + 0.05, X.pt1 - 0.05, ptHub, ptTip, 0.09, -0.7, bladeMat, rotorPT) : null;

  // ── combustor: pakai ulang can dari M3b, di atas poros ──
  const can = createCanCombustor({ radius: 0.13, length: X.comb1 - X.comb0, swirler: 'axial', vanes: 10 });
  can.group.position.set(X.comb0, 0.5, 0);
  root.add(can.group);

  // ── beban: generator (single) atau kompresor gas (twin) ──
  const load = new THREE.Group();
  if (!twin) {
    const body = new THREE.Mesh(G(new THREE.CylinderGeometry(0.55, 0.55, 1.0, 40)), M(new THREE.MeshStandardMaterial({ color: 0x2f6f5e, metalness: 0.4, roughness: 0.5 })));
    body.rotation.z = Math.PI / 2;
    const fins = new THREE.Mesh(G(new THREE.CylinderGeometry(0.58, 0.58, 0.7, 40, 1, true)), mat.steelDark);
    fins.rotation.z = Math.PI / 2;
    load.add(body, fins);
    load.position.x = X.comp0 - 1.55;
    anchor('load', X.comp0 - 1.55, 0.75, 0);
  } else {
    const box = new THREE.Mesh(G(new THREE.BoxGeometry(0.9, 0.8, 0.8)), M(new THREE.MeshStandardMaterial({ color: 0x8a5a2b, metalness: 0.35, roughness: 0.6 })));
    const nozzleGeo = G(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 20));
    const nIn = new THREE.Mesh(nozzleGeo, mat.steel); nIn.position.set(-0.15, 0.6, 0);
    const nOut = new THREE.Mesh(nozzleGeo, mat.steel); nOut.position.set(0.2, -0.6, 0);
    const coupling = new THREE.Mesh(G(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 20)), mat.alu);
    coupling.rotation.z = Math.PI / 2; coupling.position.x = -0.55;
    load.add(box, nIn, nOut, coupling);
    load.position.x = X.pt1 + 1.45;
    anchor('load', X.pt1 + 1.45, 0.75, 0);
  }
  root.add(load);
  anchor('compressor', (X.comp0 + X.comp1) / 2, 0.62, 0.2);
  anchor('combustor', (X.comb0 + X.comb1) / 2, 0.75, 0);
  anchor('turbine', (X.turb0 + X.turb1) / 2, 0.55, 0.2);
  if (twin) anchor('powerTurbine', (X.pt0 + X.pt1) / 2, 0.7, 0.2);

  const tmp = new THREE.Color();
  const lastRgb = new WeakMap();
  /** Set warna setiap baris dari daftar tahap (rgb sRGB 0…1). */
  function paint(set, stages) {
    if (!set || !stages) return;
    let changed = false;
    set.rows.forEach((row, i) => {
      const c = stages[i]?.rgb;
      if (!c) return;
      const prev = lastRgb.get(row);
      if (prev && prev[0] === c[0] && prev[1] === c[1] && prev[2] === c[2]) return;
      lastRgb.set(row, c);
      tmp.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
      for (let k = row.start; k < row.start + row.count; k++) set.mesh.setColorAt(k, tmp);
      changed = true;
    });
    if (changed) set.mesh.instanceColor.needsUpdate = true;
  }

  return {
    group: root,
    anchors,
    config,
    parts: { rotorGG, rotorPT, comp, turb, pt, can, casing, load },
    /** @param {TurbineFrame & {time?: number}} f */
    update(f) {
      paint(comp, f.stages.comp);
      paint(turb, f.stages.turb);
      paint(pt, f.stages.pt);
      rotorGG.rotation.x = f.rotor.angleGG;
      if (twin) rotorPT.rotation.x = f.rotor.anglePT;
      can.update({ intensity: f.flame.intensity, color: f.flame.color, core: f.flame.color, time: f.time ?? 0 });
    },
    /** Jumlah objek Mesh yang dirender (perkiraan draw call). */
    drawCalls() { let n = 0; root.traverse((o) => { if (o.isMesh && o.visible) n++; }); return n; },
    dispose() {
      can.dispose();
      for (const g of geoms.splice(0)) g.dispose();
      for (const m of mats.splice(0)) m.dispose();
      comp.mesh.dispose(); turb.mesh.dispose(); pt?.mesh.dispose();
      mat.dispose();
      root.clear();
    },
  };
}
