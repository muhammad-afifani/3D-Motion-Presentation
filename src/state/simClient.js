/**
 * simClient.js — meminta cylinderSim ke Web Worker dengan debounce (80 ms) saat slider digeser.
 * Jatuh ke jalur sinkron bila Worker tidak tersedia/gagal. Hasil lama (stale) dibuang.
 */
import { simParams, simKey, runSim, hydrateSim } from './derive.js';

/**
 * @param {(sim: any, key: string) => void} onResult
 * @param {{debounceMs?: number}} [opts]
 */
export function createSimClient(onResult, { debounceMs = 80 } = {}) {
  let worker = null;
  let seq = 0;
  let timer = 0;
  let lastKey = null;
  let lastState = null;
  const pending = new Map(); // id → key

  try {
    worker = new Worker(new URL('./sim.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const { id, sim, error } = e.data;
      const key = pending.get(id);
      pending.delete(id);
      if (id !== seq) return; // ada permintaan yang lebih baru
      if (error) { console.warn('[sim.worker]', error); return; }
      onResult(hydrateSim(sim), key);
    };
    worker.onerror = (e) => {
      console.warn('[sim.worker] gagal, pakai jalur sinkron', e.message);
      worker?.terminate();
      worker = null;
      if (pending.size && lastState) { pending.clear(); onResult(runSim(lastState), simKey(lastState)); }
    };
  } catch {
    worker = null;
  }

  function dispatch(state) {
    const key = simKey(state);
    if (key === lastKey) return;
    lastKey = key;
    lastState = state;
    const id = ++seq;
    if (worker) {
      pending.set(id, key);
      worker.postMessage({ id, params: simParams(state) });
    } else {
      onResult(runSim(state), key);
    }
  }

  return {
    /** Hitung segera di thread utama (dipakai untuk frame pertama). */
    runNow(state) {
      lastKey = simKey(state);
      ++seq;
      const sim = runSim(state);
      onResult(sim, lastKey);
      return sim;
    },
    /** Minta hitung ulang dengan debounce. */
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
