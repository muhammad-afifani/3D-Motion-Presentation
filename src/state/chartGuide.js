/**
 * chartGuide.js — Chart guide (M11 Step 03), fungsi murni tanpa teks UI: pencocokan judul grafik → id panduan
 * (satu-satunya tempat pencocokan), pengelompokan indeks per scene, tingkat model per panduan, dan asal klik ⓘ
 * (alamat scene yang dibuka lagi oleh tombol "Back to the chart"). Data panduan = learn.charts di content/learn.json.
 */
import { parseHash } from './route.js';
import { STR_SOURCE } from '../ui/strings.js';
import { isPair } from './i18n.js';

/** @param {string} t */
const norm = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();

/** Pasangan { en, id } berisi string (bukan fungsi) di pohon sumber teks → peta teks ID → teks EN (judul grafik dua bahasa). */
let idToEn = null;
/** Judul grafik yang dibentuk fungsi (mengandung angka): [jalur, argumen contoh] → awalan ID dan EN yang sama panjang rumusnya. */
const TITLE_FUNCTIONS = [
  ['scene2.waterfall.title', [['diesel', 3.1], ['gas', 3.1]], [['diesel', 7.7], ['gas', 7.7]]],
];
/** @type {{id:string, en:string}[]} awalan judul ID → awalan judul EN */
let idPrefixes = [];
const commonPrefix = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return a.slice(0, i); };
function buildAliases() {
  idToEn = new Map(); idPrefixes = [];
  const walk = (o) => {
    if (isPair(o)) { if (typeof o.en === 'string' && typeof o.id === 'string' && o.en !== o.id) idToEn.set(norm(o.id), norm(o.en)); return; }
    if (o && typeof o === 'object') for (const v of Object.values(o)) walk(v);
  };
  walk(STR_SOURCE);
  for (const [path, argsA, argsB] of TITLE_FUNCTIONS) {
    const pair = path.split('.').reduce((o, k) => o?.[k], STR_SOURCE);
    if (!isPair(pair) || typeof pair.en !== 'function') continue;
    argsA.forEach((a, i) => {
      const enA = norm(pair.en(...a)), enB = norm(pair.en(...argsB[i]));
      const idA = norm(pair.id(...a)), idB = norm(pair.id(...argsB[i]));
      // awalan = bagian yang sama pada dua pemanggilan dengan angka berbeda, tanpa "(…" yang menggantung di ujung
      const prefix = (a, b) => commonPrefix(a, b).replace(/\s*\([^)]*$/, '').trimEnd();
      idPrefixes.push({ id: prefix(idA, idB), en: prefix(enA, enB) });
    });
  }
}

/**
 * Id panduan untuk judul grafik yang tampil. Judul di learn.charts[].titles dicocokkan persis; judul yang diakhiri "…"
 * adalah awalan (judul waterfall dibentuk fungsi dan memuat angka). Judul bahasa Indonesia dikembalikan dulu ke teks
 * English-nya lewat pasangan { en, id } di strings.js (Paket D3). null bila tidak ada panduan.
 * @param {string} title @param {{id:string, titles:string[]}[]} charts
 * @returns {string|null}
 */
export function guideIdForTitle(title, charts) {
  const direct = (t) => {
    if (!t) return null;
    for (const c of charts ?? []) if ((c.titles ?? []).some((x) => norm(x) === t)) return c.id;
    for (const c of charts ?? []) {
      if ((c.titles ?? []).some((x) => { const n = norm(x); return n.endsWith('…') && t.startsWith(n.slice(0, -1).trimEnd()); })) return c.id;
    }
    return null;
  };
  const t = norm(title);
  const hit = direct(t);
  if (hit || !t) return hit;
  if (!idToEn) buildAliases();
  const en = idToEn.get(t);
  if (en) return direct(en);
  const p = idPrefixes.find((x) => x.id && t.startsWith(x.id));
  return p ? direct(`${p.en} (`) : null;
}

/**
 * Indeks: panduan dikelompokkan per scene, urutan scene naik, urutan di dalam scene = urutan di learn.json.
 * @param {{id:string, scene:number}[]} charts @returns {{scene:number, charts:any[]}[]}
 */
export function groupChartsByScene(charts) {
  const by = new Map();
  for (const c of charts ?? []) { if (!by.has(c.scene)) by.set(c.scene, []); by.get(c.scene).push(c); }
  return [...by.keys()].sort((a, b) => a - b).map((scene) => ({ scene, charts: by.get(scene) }));
}

/**
 * Tingkat model (kunci STR.common.level) yang bisa tampil di tag Basis tiap grafik. Beberapa grafik berganti tingkat
 * menurut mode (waterfall, P-V / T-s, kurva beban). Kunci id panduan; dijaga tests/chartGuide.test.js.
 */
export const GUIDE_LEVELS = Object.freeze({
  pv: ['semiEmpirical'],
  ptheta: ['semiEmpirical'],
  'pv-ts': ['ideal', 'real'],
  waterfall: ['ideal', 'real', 'semiEmpirical'],
  'brayton-schematic': ['ideal'],
  flame: ['semiEmpirical'],
  'nox-eta': ['semiEmpirical'],
  arrhenius: ['semiEmpirical'],
  partload: ['semiEmpirical'],
  compressor: ['real', 'ideal'],
  combined: ['semiEmpirical'],
  limits: [],
  levers: ['semiEmpirical'],
  'load-window': ['semiEmpirical'],
  ghg: ['semiEmpirical'],
});

// ── asal klik ⓘ: alamat scene yang dibuka lagi oleh "Back to the chart" ──
let origin = null;
/** @param {string} hash alamat saat ⓘ ditekan (hanya alamat scene yang diingat) @param {string} id panduan yang dibuka */
export function setChartOrigin(hash, id) {
  const r = parseHash(hash);
  origin = r?.type === 'scene' ? { hash, id } : null;
}
/** @returns {{hash:string, id:string}|null} */
export const chartOrigin = () => origin;
export const clearChartOrigin = () => { origin = null; };
/** Tombol "Back to the chart" hanya untuk panduan yang dibuka dari ⓘ. */
export const backToChartHash = (id) => (origin && origin.id === id ? origin.hash : null);
