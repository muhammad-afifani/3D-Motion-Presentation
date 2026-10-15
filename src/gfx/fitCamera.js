/**
 * fitCamera.js — membingkai seluruh rakitan 3D di dalam tampilan (murni geometri kamera, tanpa WebGL).
 * Jarak kamera dicari agar semua sudut Box3 terproyeksi di dalam area bebas (viewport dikurangi inset overlay,
 * ditambah margin); pusat proyeksi digeser dengan setViewOffset agar rakitan berada di tengah area bebas.
 * Arah pandang kamera dipertahankan (orbit pengguna tidak hilang saat ukuran berubah).
 */
import * as THREE from 'three';

const CORNERS = (b) => {
  const out = [];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) out.push(new THREE.Vector3(x, y, z));
  return out;
};

/** Batas proyeksi NDC dari semua sudut box (tanpa view offset). */
export function projectedBounds(camera, box) {
  const r = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
  for (const c of CORNERS(box)) {
    c.project(camera);
    r.x0 = Math.min(r.x0, c.x); r.x1 = Math.max(r.x1, c.x);
    r.y0 = Math.min(r.y0, c.y); r.y1 = Math.max(r.y1, c.y);
  }
  return r;
}

/**
 * Area bebas dalam NDC. insets = fraksi 0…1 dari tinggi/lebar tampilan yang tertutup overlay.
 * @returns {{x0:number,x1:number,y0:number,y1:number}}
 */
export function freeRect({ margin = 0.06, insets = {} } = {}) {
  const { top = 0, bottom = 0, left = 0, right = 0 } = insets;
  return { x0: -1 + 2 * (left + margin), x1: 1 - 2 * (right + margin), y0: -1 + 2 * (bottom + margin), y1: 1 - 2 * (top + margin) };
}

/**
 * Letakkan kamera: target = pusat box, arah pandang = arah kamera sekarang, jarak minimum sehingga box muat di area bebas.
 * @param {THREE.PerspectiveCamera} camera  (aspect sudah benar)
 * @param {THREE.Box3} box
 * @param {{width:number, height:number, margin?:number, insets?:object, direction?:THREE.Vector3, target?:THREE.Vector3}} o
 * @returns {{distance:number, target:THREE.Vector3}}
 */
export function fitCameraToBox(camera, box, { width, height, margin = 0.06, insets = {}, direction = null, target = null } = {}) {
  const center = target ? target.clone() : box.getCenter(new THREE.Vector3());
  const dir = (direction ?? camera.position.clone().sub(center)).clone().normalize();
  const free = freeRect({ margin, insets });
  const fw = free.x1 - free.x0, fh = free.y1 - free.y0;
  camera.clearViewOffset();
  const place = (d) => { camera.position.copy(center).addScaledVector(dir, d); camera.lookAt(center); camera.updateMatrixWorld(true); };
  const fits = (d) => { place(d); const b = projectedBounds(camera, box); return (b.x1 - b.x0) <= fw && (b.y1 - b.y0) <= fh; };
  const diag = box.getSize(new THREE.Vector3()).length();
  let lo = Math.max(camera.near * 2, diag * 0.05), hi = diag * 40;
  if (!fits(hi)) { place(hi); return { distance: hi, target: center }; }
  for (let i = 0; i < 48; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
  place(hi);
  // geser pusat proyeksi ke pusat area bebas
  const b = projectedBounds(camera, box);
  const dx = (free.x0 + free.x1) / 2 - (b.x0 + b.x1) / 2, dy = (free.y0 + free.y1) / 2 - (b.y0 + b.y1) / 2;
  if (width > 0 && height > 0 && (Math.abs(dx) > 1e-9 || Math.abs(dy) > 1e-9)) camera.setViewOffset(width, height, -dx * width / 2, dy * height / 2, width, height);
  return { distance: hi, target: center };
}

/** true bila semua sudut box terproyeksi (termasuk view offset) di dalam area bebas (toleransi eps). */
export function boxInsideFree(camera, box, o = {}, eps = 1e-6) {
  const free = freeRect(o);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  const b = projectedBounds(camera, box);
  return b.x0 >= free.x0 - eps && b.x1 <= free.x1 + eps && b.y0 >= free.y0 - eps && b.y1 <= free.y1 + eps;
}
