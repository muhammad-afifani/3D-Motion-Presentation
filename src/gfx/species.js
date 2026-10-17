/**
 * species.js — kode warna spesies emisi, konsisten di semua scene (CLAUDE.md → Konvensi):
 * NOx oranye, CO merah-magenta, CO₂ abu-biru, CH₄ hijau, PM abu gelap.
 *
 * Satu sumber, dua palet (bagian B). Hue sama di kedua tema; palet terang sedikit lebih gelap agar garis ≥ 3:1
 * terhadap latar grafik terang. `ink` = varian untuk teks berwarna spesies di tema terang (≥ 4,5:1).
 * Variabel CSS --sp-* (dan --sp-*-ink) di styles.css harus sama dengan palet ini (dijaga tests/theme.test.js).
 */
export const SPECIES_PALETTES = Object.freeze({
  dark: Object.freeze({ NOx: '#ff9a3c', CO: '#e0407a', CO2: '#8fa3bf', CH4: '#4cc38a', PM: '#4a4f57' }),
  light: Object.freeze({ NOx: '#d26500', CO: '#e0407a', CO2: '#6b86ab', CH4: '#329566', PM: '#4a4f57' }),
  lightInk: Object.freeze({ NOx: '#984900', CO: '#b61e55', CO2: '#4a6182', CH4: '#246b49', PM: '#4a4f57' }),
});

/** Warna spesies untuk visual 3D: viewport selalu berlatar arang, jadi selalu palet gelap. */
export const SPECIES_COLORS = SPECIES_PALETTES.dark;

/** Nama variabel CSS per spesies. */
export const SPECIES_CSS_VAR = Object.freeze({ NOx: '--sp-nox', CO: '--sp-co', CO2: '--sp-co2', CH4: '--sp-ch4', PM: '--sp-pm' });

/**
 * Warna spesies untuk DOM (swatch) dan grafik: rujukan `var(--sp-…)` yang mengikuti tema aktif. Grafik canvas
 * menerjemahkannya lewat chartBase (`col`).
 */
export const SPECIES_VAR = Object.freeze(Object.fromEntries(Object.entries(SPECIES_CSS_VAR).map(([k, v]) => [k, `var(${v})`])));
