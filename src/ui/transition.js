/**
 * transition.js — transisi antar scene: fade-through singkat (keluar 150 ms + masuk 200 ms ≈ 350 ms) lewat
 * opacity CSS pada kontainer scene. Tidak menyentuh store, frame, atau angka HUD. prefers-reduced-motion → instan.
 */
export const FADE = Object.freeze({ outMs: 150, inMs: 200 });

export const prefersReducedMotion = () => {
  try { return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/**
 * Ganti isi dengan fade-through. @param {{classList: DOMTokenList}} el kontainer
 * @param {() => Promise<void>|void} swap mengganti scene (dispose lama, mount baru)
 * @param {{reduced?: boolean, wait?: (ms:number)=>Promise<void>, skipOut?: boolean}} [o]
 */
export async function fadeSwap(el, swap, { reduced = prefersReducedMotion(), wait = (ms) => new Promise((r) => setTimeout(r, ms)), skipOut = false } = {}) {
  if (reduced) { await swap(); return 'instant'; }
  if (!skipOut) { el.classList.add('is-fading'); await wait(FADE.outMs); }
  try {
    await swap();
  } finally {
    el.classList.remove('is-fading');   // transisi CSS opacity masuk (FADE.inMs)
  }
  return 'fade';
}
