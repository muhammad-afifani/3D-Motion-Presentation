/**
 * viewportTone.js — tone latar viewport 3D ('dark' | 'light'), dibaca dari variabel CSS --vp-tone (styles.css; Dark =
 * arang, Light = varian A abu-krem). Murni grafis: memilih blending nyala/halo, kekuatan bloom, dan palet partikel
 * spesies agar tetap terbaca di latar terang. Dibaca saat rig/renderer dibuat; main.js memasang ulang scene bila tone
 * berubah karena ganti tema.
 */
import * as THREE from 'three';
import { SPECIES_PALETTES } from './species.js';

/** Parameter per tone. Bloom aditif di atas latar terang mencuci warna → jauh lebih lemah. */
export const TONE_PARAMS = Object.freeze({
  dark: Object.freeze({ bloomStrength: 0.7, glowBlending: 'additive', species: 'dark' }),
  light: Object.freeze({ bloomStrength: 0.22, glowBlending: 'normal', species: 'lightInk' }),
});

/** @param {Document} [doc] @returns {'dark'|'light'} */
export function viewportTone(doc = globalThis.document) {
  try {
    const v = doc ? getComputedStyle(doc.documentElement).getPropertyValue('--vp-tone').trim() : '';
    return v === 'light' ? 'light' : 'dark';
  } catch { return 'dark'; }
}

/** Blending untuk nyala, percikan, dan halo: aditif di latar gelap, normal (alpha) di latar terang. */
export const glowBlending = (tone) => (TONE_PARAMS[tone]?.glowBlending === 'normal' ? THREE.NormalBlending : THREE.AdditiveBlending);

/** Warna partikel spesies 3D untuk tone viewport (latar terang: varian ink, ≥ 3:1 terhadap latar). */
export const speciesColors3D = (tone) => SPECIES_PALETTES[TONE_PARAMS[tone]?.species ?? 'dark'];

/** Kekuatan bloom untuk tone viewport. */
export const bloomStrength = (tone) => TONE_PARAMS[tone]?.bloomStrength ?? TONE_PARAMS.dark.bloomStrength;
