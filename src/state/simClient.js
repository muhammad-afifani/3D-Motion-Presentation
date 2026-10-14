/**
 * simClient.js — meminta perhitungan berat (cylinderSim / lossWaterfall) ke Web Worker dengan
 * debounce (80 ms) saat slider digeser. Jatuh ke jalur sinkron bila Worker tidak tersedia/gagal.
 * Hasil lama (stale) dibuang.
 */
import { cylinderSim, lossWaterfall } from '../model/thermo.js';
import { simParams, simKey, hydrateSim } from './derive.js';

/** Jalur sinkron + pemulihan hasil Worker per job. */
const JOBS = {
  cylinderSim: { run: (p) => cylinderSim(p), hydrate: hydrateSim },
  lossWaterfall: { run: (p) => lossWaterfall(p.kind, p.over, p.opts), hydrate: (r) => r },
};

/**
 * @param {(result: any, key: string) => void} onResult
 * @param {{debounceMs?: number, job?: 'cylinderSim'|'lossWaterfall',
 *   paramsOf?: (state:any) => any, keyOf?: (state:any) => string}} [opts]
 */
export function createSimClient(onResult, { debounceMs = 80, job = 'cylinderSim', paramsOf = simParams, keyOf = simKey } = {}) {
  const J = JOBS[job];
  let worker = null;
  let seq = 0;
  let timer = 0;
  let lastKey = null;
  let lastState = null;
  const pending = new Map(); // id → key
  const runSync = (state) => onResult(J.run(paramsOf(state)), keyOf(state));

  try {
    worker = new Worker(new URL('./sim.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const { id, result, error } = e.data;
      const key = pending.get(id);
      pending.delete(id);
      if (id !== seq) return; // ada permintaan yang lebih baru
      if (error) { console.warn('[sim.worker]', error); return; }
      onResult(J.hydrate(result), key);
    };
    worker.onerror = (e) => {
      console.warn('[sim.worker] gagal, pakai jalur sinkron', e.message);
      worker?.terminate();
      worker = null;
      if (pending.size && lastState) { pending.clear(); runSync(lastState); }
    };
  } catch {
    worker = null;
  }

  function dispatch(state) {
    const key = keyOf(state);
    if (key === lastKey) return;
    lastKey = key;
    lastState = state;
    const id = ++seq;
    if (worker) {
      pending.set(id, key);
      worker.postMessage({ id, job, params: paramsOf(state) });
    } else {
      runSync(state);
    }
  }

  return {
    /** Hitung segera di thread utama (dipakai untuk frame pertama). */
    runNow(state) {
      lastKey = keyOf(state);
      ++seq;
      const result = J.run(paramsOf(state));
      onResult(result, lastKey);
      return result;
    },
    /** Minta hitung ulang dengan debounce (diabaikan bila kunci tidak berubah). */
    request(state) {
      clearTimeout(timer);
      timer = setTimeout(() => dispatch(state), debounceMs);
    },
    dispose() {
      clearTimeout(timer);
      worker?.terminate();
      worker = null;
      pending.clear();
    },
  };
}
