/**
 * perfGuard.js — fallback performa bloom (logika murni, dapat dites).
 * Mode 'auto': bila fps rata-rata < ambang selama `windowSec`, bloom dimatikan SEKALI dan tidak
 * dinyalakan lagi otomatis (hindari kedip bolak-balik). Mode 'on'/'off' = keputusan manual.
 */

/**
 * @param {{minFps?: number, windowSec?: number, warmupSec?: number}} [opts]
 */
export function createPerfGuard({ minFps = 30, windowSec = 2, warmupSec = 1 } = {}) {
  let elapsed = 0, acc = 0, frames = 0, tripped = false;
  return {
    /**
     * Catat satu frame. @param {number} dt detik @param {'auto'|'on'|'off'} mode
     * @returns {{bloom: boolean, tripped: boolean, justTripped: boolean, fps: number|null}}
     */
    sample(dt, mode) {
      elapsed += dt;
      let justTripped = false, fps = null;
      if (elapsed > warmupSec && dt > 0) {
        acc += dt; frames++;
        if (acc >= windowSec) {
          fps = frames / acc;
          if (mode === 'auto' && !tripped && fps < minFps) { tripped = true; justTripped = true; }
          acc = 0; frames = 0;
        }
      }
      const bloom = mode === 'on' ? true : mode === 'off' ? false : !tripped;
      return { bloom, tripped, justTripped, fps };
    },
    /** Lupakan keputusan auto (mis. setelah pengguna memilih Auto lagi). */
    reset() { elapsed = 0; acc = 0; frames = 0; tripped = false; },
    get tripped() { return tripped; },
  };
}
