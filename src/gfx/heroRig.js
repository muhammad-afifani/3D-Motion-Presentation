/**
 * heroRig.js — rig hero landing (M11): turbin gas generator yang sudah ada (turbineRig.js) + partikel aliran hias
 * sepanjang jalur gas. Murni grafis: warna tahap dan nyala dari frame deriveTurbine (dihitung sekali di landing),
 * putaran rotor dan aliran partikel berbasis waktu (animasi hias, bukan state model). Jumlah partikel mengikuti
 * kualitas adaptif (particleScale: Low = dikurangi). Warna partikel = warna tahap terdekat dari frame (skala suhu).
 */
import * as THREE from 'three';
import { createGasTurbineRig } from './turbineRig.js';
import { particleScale } from './quality.js';

export const HERO_PARTICLES = 240;
const X0 = -1.3, X1 = 1.7; // sepanjang casing (lihat tata letak X di turbineRig.js)

/**
 * @param {{frame:any, stages?:{compressor:number, turbine:number}, random?:() => number}} o
 */
export function createHeroRig({ frame, stages = { compressor: 10, turbine: 3 }, random = Math.random }) {
  const group = new THREE.Group();
  const rig = createGasTurbineRig({ config: 'single', compressorStages: stages.compressor, turbineStages: stages.turbine });
  group.add(rig.group);

  // warna sepanjang sumbu: tahap kompresor → nyala combustor → tahap turbin (rgb sRGB 0…1 dari frame)
  const comp = frame.stages?.comp ?? [], turb = frame.stages?.turb ?? [];
  const flame = frame.flame?.color ?? [1, 0.6, 0.2];
  const colorAt = (x) => {
    if (x < 0) return comp[Math.min(comp.length - 1, Math.max(0, Math.floor(((x - X0) / (0 - X0)) * comp.length)))]?.rgb ?? flame;
    if (x < 0.8) return flame;
    return turb[Math.min(turb.length - 1, Math.max(0, Math.floor(((x - 0.8) / 0.55) * turb.length)))]?.rgb ?? turb.at(-1)?.rgb ?? flame;
  };

  const geo = new THREE.SphereGeometry(0.011, 6, 4);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });
  const pts = new THREE.InstancedMesh(geo, mat, HERO_PARTICLES);
  pts.frustumCulled = false;
  group.add(pts);
  const P = Array.from({ length: HERO_PARTICLES }, () => ({ u: random(), r: 0.24 + 0.18 * random(), a: random() * Math.PI * 2, v: 0.08 + 0.05 * random() }));
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  let shown = 0;

  // batas rig (tanpa partikel) untuk membingkai kamera hero: pusat, jari-jari horizontal (bidang XZ, kamera mengorbit
  // sumbu Y) dan setengah tinggi, sehingga rig tidak terpotong di sudut putar mana pun
  const box = new THREE.Box3().setFromObject(rig.group);
  const center = box.getCenter(new THREE.Vector3());
  const bounds = { center, rXZ: Math.hypot((box.max.x - box.min.x) / 2, (box.max.z - box.min.z) / 2), halfY: (box.max.y - box.min.y) / 2 };

  return {
    group,
    bounds,
    get particles() { return shown; },
    /** @param {number} t waktu (s) @param {number} dt langkah (s; 0 = diam) */
    update(t, dt) {
      rig.update({ ...frame, rotor: { angleGG: t * 2.4, anglePT: t * 2.4 }, time: t });
      shown = Math.round(HERO_PARTICLES * particleScale());
      pts.count = shown;
      for (let i = 0; i < shown; i++) {
        const p = P[i];
        p.u = (p.u + p.v * dt) % 1;
        p.a += dt * 1.6;
        const x = X0 + (X1 - X0) * p.u;
        m4.makeTranslation(x, Math.cos(p.a) * p.r, Math.sin(p.a) * p.r);
        pts.setMatrixAt(i, m4);
        const c = colorAt(x);
        col.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
        pts.setColorAt(i, col);
      }
      pts.instanceMatrix.needsUpdate = true;
      if (pts.instanceColor) pts.instanceColor.needsUpdate = true;
    },
    dispose() { group.remove(rig.group, pts); rig.dispose(); geo.dispose(); mat.dispose(); pts.dispose(); },
  };
}
