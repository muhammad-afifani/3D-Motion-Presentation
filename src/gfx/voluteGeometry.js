/**
 * voluteGeometry.js — satu-satunya sumber koordinat nozzle discharge volute kompresor (Scene 7).
 * Volute dan pipa discharge sama-sama membaca hasil fungsi ini, jadi pipa selalu menyambung ke volute
 * (tanpa angka posisi tetap di rig). Murni geometri: tanpa three.js, tanpa termodinamika.
 *
 * Koordinat rig: sumbu poros = +X; lingkaran volute berada di bidang YZ (pusat di sumbu poros), jari-jari
 * garis tengah `radius`, jari-jari tabung `tube`. Titik di lingkaran pada sudut θ (dari +Y ke +Z):
 *   (x, y, z) = (xCenter, radius·cosθ, radius·sinθ).
 * Aliran di volute berputar ke arah θ menurun; nozzle keluar tangensial pada θ = outletAngle.
 */
export const VOLUTE = Object.freeze({
  radius: 0.62,            // jari-jari garis tengah volute
  tube: 0.12,              // jari-jari tabung volute
  xCenter: 0.02,           // posisi bidang volute di sumbu poros
  outletAngle: Math.PI / 2, // θ nozzle: sisi depan (+Z), arah keluar +Y (ke atas)
  pipeLength: 0.9,         // panjang pipa discharge dari titik nozzle
});

/**
 * @param {Partial<typeof VOLUTE>} [p]
 * @returns {{ nozzleCenter:[number,number,number], nozzleDir:[number,number,number], nozzleRadius:number,
 *   pipeLength:number, pipeEnd:[number,number,number], pointAt:(theta:number)=>[number,number,number] }}
 */
export function voluteNozzle(p = {}) {
  const { radius, tube, xCenter, outletAngle, pipeLength } = { ...VOLUTE, ...p };
  const pointAt = (theta) => [xCenter, radius * Math.cos(theta), radius * Math.sin(theta)];
  const nozzleCenter = pointAt(outletAngle);
  // tangen untuk θ menurun: d/dθ(−) = (0, sinθ, −cosθ)
  const nozzleDir = [0, Math.sin(outletAngle), -Math.cos(outletAngle)];
  const pipeEnd = nozzleCenter.map((v, i) => v + nozzleDir[i] * pipeLength);
  return { nozzleCenter, nozzleDir, nozzleRadius: tube, pipeLength, pipeEnd, pointAt };
}

/** Titik pada garis tengah pipa discharge, t ∈ [0,1] dari nozzle ke ujung pipa. */
export function pipePoint(n, t) {
  return n.nozzleCenter.map((v, i) => v + n.nozzleDir[i] * n.pipeLength * t);
}
