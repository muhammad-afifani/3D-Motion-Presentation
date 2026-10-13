/**
 * sim.worker.js — menjalankan cylinderSim di luar thread UI.
 * `geo` (berisi fungsi) dibuang sebelum dikirim; dibangun ulang via hydrateSim di thread utama.
 */
import { cylinderSim } from '../model/thermo.js';

self.onmessage = (e) => {
  const { id, params } = e.data;
  try {
    const { geo, ...packed } = cylinderSim(params);
    const transfer = [packed.th, packed.V, packed.P, packed.T, packed.xb].map((a) => a.buffer);
    self.postMessage({ id, sim: packed }, transfer);
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
