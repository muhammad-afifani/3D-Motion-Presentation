// Daftar putih "Tetap Inggris" (docs/tetap_inggris.json): dibaca tes, bukan kode aplikasi.
import { readFileSync } from 'node:fs';

const ROOT = new URL('../../', import.meta.url).pathname;
export const KEEP = JSON.parse(readFileSync(`${ROOT}docs/tetap_inggris.json`, 'utf8'));
export const KEEP_TEXTS = new Set(KEEP.groups.flatMap((g) => g.texts ?? []));
export const KEEP_PATHS = new Set(KEEP.groups.flatMap((g) => g.paths ?? []));

/** Sisi id sengaja sama dengan en? Teks utuh ada di daftar, atau (fungsi) jalurnya ada di daftar. */
export const keptIdentical = (path, enText) => KEEP_TEXTS.has(enText) || KEEP_PATHS.has(path);
