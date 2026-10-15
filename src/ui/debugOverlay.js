/**
 * debugOverlay.js — overlay debug performa (Shift+D): fps, ms/frame, draw calls, triangles, geometries, textures,
 * programs (renderer.info), pixel ratio, bloom, kualitas, JS heap. Hanya membaca statistik; tidak menghitung model.
 * Bila GPU terdeteksi sebagai rendering software (SwiftShader / llvmpipe), overlay menandainya: fps bukan fps GPU.
 */
import { STR } from './strings.js';
import { fmt } from './format.js';

const T = STR.debug;

/** Baris overlay (diekspor untuk tes). @param {{fps:number|null, ms:number|null, stats:any, quality?:any, heapMB?:number|null}} d */
export function debugRows(d) {
  const s = d.stats ?? {};
  const rows = [
    [T.fps, d.fps == null ? '–' : fmt(d.fps, 0)],
    [T.frameMs, d.ms == null ? '–' : fmt(d.ms, 1)],
    [T.calls, fmt(s.calls ?? 0, 0)],
    [T.triangles, fmt(s.triangles ?? 0, 0)],
    [T.geometries, fmt(s.geometries ?? 0, 0)],
    [T.textures, fmt(s.textures ?? 0, 0)],
    [T.programs, fmt(s.programs ?? 0, 0)],
    [T.pixelRatio, s.pixelRatio == null ? '–' : fmt(s.pixelRatio, 2)],
    [T.bloom, s.bloom ? T.on : T.off],
  ];
  if (d.quality) rows.push([T.quality, T.qualityValue(d.quality.mode, d.quality.tier, d.quality.particles)]);
  if (d.heapMB != null) rows.push([T.heap, fmt(d.heapMB, 0)]);
  if (!s.count) rows.push([T.renderer, T.no3d]);
  return rows;
}

/** @param {HTMLElement} parent @param {() => any} read */
export function createDebugOverlay(parent, read) {
  const el = document.createElement('div');
  el.className = 'debug-overlay num';
  el.hidden = true;
  el.setAttribute('aria-live', 'off');
  parent.appendChild(el);
  let t = 0;
  return {
    get open() { return !el.hidden; },
    toggle() { el.hidden = !el.hidden; },
    /** Perbarui ±4×/detik bila terbuka. */
    update(dt) {
      if (el.hidden) return;
      t += dt;
      if (t < 0.25) return;
      t = 0;
      const d = read();
      const soft = d.stats?.software;
      el.innerHTML = `<div class="debug-overlay__title">${T.title}</div>`
        + (soft ? `<div class="debug-overlay__warn">${T.software}</div>` : '')
        + debugRows(d).map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')
        + (d.stats?.gpu ? `<div class="debug-overlay__gpu">${T.gpu(d.stats.gpu.replace(/[<>&]/g, ''))}</div>` : '');
    },
    dispose() { el.remove(); },
  };
}
