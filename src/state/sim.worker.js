/**
 * sim.worker.js — menjalankan perhitungan berat thermo.js di luar thread UI.
 * Job: 'cylinderSim' (geo berisi fungsi → dibuang, dibangun ulang via hydrateSim), 'lossWaterfall', 'retardSweep', 'leverSweep', 'calibrateEngineNOx'.
 */
import { cylinderSim, lossWaterfall, retardSweep, leverSweep, calibrateEngineNOx } from '../model/thermo.js';

self.onmessage = (e) => {
  const { id, job = 'cylinderSim', params } = e.data;
  try {
    if (job === 'lossWaterfall') {
      self.postMessage({ id, result: lossWaterfall(params.kind, params.over, params.opts) });
      return;
    }
    if (job === 'calibrateEngineNOx') {
      self.postMessage({ id, result: calibrateEngineNOx(params.kind, params.target, params.over, { calib0: params.calib0 }) });
      return;
    }
    if (job === 'leverSweep') {
      // ms = waktu hitung sapuan di Worker (dilaporkan; tampil di overlay debug Shift+D)
      const t0 = performance.now();
      const rows = leverSweep(params.kind, params.param, params.values, params.over);
      self.postMessage({ id, result: { rows, ms: performance.now() - t0 } });
      return;
    }
    if (job === 'retardSweep') {
      self.postMessage({ id, result: retardSweep(params.kind, params.thetas, params.over) });
      return;
    }
    const { geo, ...packed } = cylinderSim(params);
    const transfer = [packed.th, packed.V, packed.P, packed.T, packed.xb, packed.TbTrace, packed.noTrace].filter(Boolean).map((a) => a.buffer);
    self.postMessage({ id, result: packed }, transfer);
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
