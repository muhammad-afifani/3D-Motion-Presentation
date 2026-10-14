/**
 * calibration.js — aksi kalibrasi NOx (panel Calibration Scene 4). Perhitungan di thermo.js:
 *   engine → calibrateEngineNOx (iteratif, di Web Worker), DLN → calibrateDLN (cepat, sinkron).
 * Hasil disimpan di store global (calEngine / calDln) agar scene lain (Scene 6) memakai kalibrasi yang sama.
 */
import { calibrateDLN } from '../model/thermo.js';
import { createSimClient } from './simClient.js';
import { calibEnginePatch, calibDlnPatch } from './store.js';

/** Hitung faktor DLN untuk target ppmvd @ refO2 (basis aktif) di titik desain → patch store + hasil. */
export function dlnCalibration(targetPpm, refO2) {
  const t = Number(targetPpm);
  if (!(t > 0)) return null;
  const result = calibrateDLN({ targetPpm: t, refO2 });
  return { patch: calibDlnPatch(result.calib), result };
}

/**
 * Kalibrator engine lewat Worker. Target g/kWh pada timing preset.
 * @param {{get:()=>any, set:(p:any)=>void}} store
 * @param {(kind:string, result:any) => void} [onDone]
 */
export function createEngineCalibrator(store, onDone) {
  let nonce = 0;
  const client = createSimClient((r, key) => {
    const kind = key.split('|')[0];
    store.set(calibEnginePatch(store.get(), kind, r.calib));
    onDone?.(kind, r);
  }, { job: 'calibrateEngineNOx', debounceMs: 0, paramsOf: (q) => q, keyOf: (q) => `${q.kind}|${q.target}|${q.nonce}` });
  return {
    /** @returns {boolean} false bila target tidak valid */
    apply(kind, target) {
      const t = Number(target);
      if (!(t > 0)) return false;
      client.request({ kind, target: t, over: {}, calib0: store.get().calEngine[kind], nonce: ++nonce });
      return true;
    },
    dispose() { client.dispose(); },
  };
}
