/**
 * quality.js — kualitas tampilan adaptif (M8b). HANYA visual: pixel ratio, bloom, jumlah partikel.
 * Angka HUD dan grafik tidak terpengaruh (derive* tidak membaca pengaturan ini; dijaga tests/quality.test.js).
 *
 * Tier: 0 = penuh · 1 = bloom mati · 2 = pixel ratio 1,0 + partikel ×0,6 · 3 = pixel ratio 0,75 + partikel ×0,3.
 * Mode Quality: 'auto' (pengontrol berhisteresis) · 'high' (tier 0 tetap) · 'low' (tier 3 tetap).
 * Mode Bloom: 'on' / 'off' dipatuhi; 'auto' = menyala bila tier mengizinkan (fallback perfGuard saat Quality High).
 */
import { setRendererDisplay } from './renderer.js';

export const QUALITY_MODES = Object.freeze(['auto', 'high', 'low']);
export const BLOOM_MODES = Object.freeze(['auto', 'on', 'off']);
export const QUALITY_TIERS = Object.freeze([
  Object.freeze({ pixelRatio: null, bloom: true, particles: 1 }),   // null = min(devicePixelRatio, 1,5)
  Object.freeze({ pixelRatio: null, bloom: false, particles: 1 }),
  Object.freeze({ pixelRatio: 1, bloom: false, particles: 0.6 }),
  Object.freeze({ pixelRatio: 0.75, bloom: false, particles: 0.3 }),
]);
export const TIER_MAX = QUALITY_TIERS.length - 1;

/** Ambang histeresis (fps dari dt mentah). */
export const QUALITY_TUNING = Object.freeze({ downFps: 30, upFps: 50, downSec: 2, upSec: 6, cooldownSec: 4, warmupSec: 1.5 });

/**
 * Pengontrol tier (logika murni). Turun satu tier bila rata-rata fps < downFps selama downSec; naik satu tier bila
 * fps > upFps selama upSec; jeda cooldownSec setelah setiap perubahan (tidak berkedip). Mode high/low = tier tetap.
 */
export function createQualityController(tuning = QUALITY_TUNING) {
  const T = { ...QUALITY_TUNING, ...tuning };
  let tier = 0, acc = 0, frames = 0, low = 0, high = 0, cool = 0, elapsed = 0, lastMode = null;
  return {
    get tier() { return tier; },
    /** @param {number} dt detik (mentah) @param {'auto'|'high'|'low'} mode @returns {{tier:number, changed:boolean}} */
    sample(dt, mode = 'auto') {
      const before = tier;
      if (mode !== lastMode) { lastMode = mode; acc = 0; frames = 0; low = 0; high = 0; cool = 0; if (mode === 'auto') tier = 0; }
      if (mode === 'high') tier = 0;
      else if (mode === 'low') tier = TIER_MAX;
      else if (dt > 0) {
        elapsed += dt;
        if (cool > 0) cool -= dt;
        acc += dt; frames++;
        if (acc >= 0.5) {                       // keputusan per blok 0,5 s
          const fps = frames / acc;
          if (elapsed > T.warmupSec && cool <= 0) {
            if (fps < T.downFps) { low += acc; high = 0; } else if (fps > T.upFps) { high += acc; low = 0; } else { low = 0; high = 0; }
            if (low >= T.downSec && tier < TIER_MAX) { tier++; low = 0; cool = T.cooldownSec; }
            else if (high >= T.upSec && tier > 0) { tier--; high = 0; cool = T.cooldownSec; }
          }
          acc = 0; frames = 0;
        }
      }
      return { tier, changed: tier !== before };
    },
    reset() { tier = 0; acc = 0; frames = 0; low = 0; high = 0; cool = 0; elapsed = 0; lastMode = null; },
  };
}

/**
 * Bloom efektif dari pengaturan global. @param {'auto'|'on'|'off'} bloomMode @param {number} tier
 * @param {'auto'|'high'|'low'} quality @param {boolean} guardTripped perfGuard (fallback saat Quality bukan Auto)
 */
export function effectiveBloom(bloomMode, tier, quality, guardTripped) {
  if (bloomMode === 'on') return true;
  if (bloomMode === 'off') return false;
  if (!QUALITY_TIERS[tier].bloom) return false;
  return quality === 'auto' ? true : !guardTripped;
}

let current = { tier: 0, bloom: false, particles: 1 };

/** Terapkan tier + bloom ke semua renderer aktif (dan renderer berikutnya). */
export function applyDisplay({ tier, bloom }) {
  const t = QUALITY_TIERS[Math.max(0, Math.min(TIER_MAX, tier))];
  current = { tier, bloom: !!bloom, particles: t.particles };
  setRendererDisplay({ pixelRatioCap: t.pixelRatio, bloom: !!bloom });
}

/** Status tampilan saat ini (baca-saja). */
export const displayState = () => ({ ...current });
/** Pengali jumlah partikel untuk rig (NO, emisi, gas kompresor). */
export const particleScale = () => current.particles;
