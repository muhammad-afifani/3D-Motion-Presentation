/**
 * fpsMeter.js — pengukur fps dari dt mentah (logika murni, dapat dites). Rata-rata per jendela `windowSec`.
 * Dipakai overlay debug dan pengontrol kualitas. Bukan bagian model.
 */
export function createFpsMeter(windowSec = 1) {
  let acc = 0, frames = 0, fps = null, ms = null, worst = 0;
  return {
    /** @param {number} dt detik (dt mentah, tanpa Animation speed) @returns {number|null} fps jendela terakhir */
    sample(dt) {
      if (!(dt > 0)) return fps;
      acc += dt; frames++; worst = Math.max(worst, dt);
      if (acc >= windowSec) { fps = frames / acc; ms = (acc / frames) * 1000; acc = 0; frames = 0; this.worstMs = worst * 1000; worst = 0; }
      return fps;
    },
    get fps() { return fps; },
    get ms() { return ms; },
    worstMs: null,
    reset() { acc = 0; frames = 0; fps = null; ms = null; worst = 0; },
  };
}
