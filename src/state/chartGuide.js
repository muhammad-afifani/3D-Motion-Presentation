/**
 * chartGuide.js — Chart guide (M11 Step 03), fungsi murni tanpa teks UI: pencocokan judul grafik → id panduan
 * (satu-satunya tempat pencocokan), pengelompokan indeks per scene, tingkat model per panduan, dan asal klik ⓘ
 * (alamat scene yang dibuka lagi oleh tombol "Back to the chart"). Data panduan = learn.charts di content/learn.json.
 */
import { parseHash } from './route.js';

/** @param {string} t */
const norm = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();

/**
 * Id panduan untuk judul grafik yang tampil. Judul di learn.charts[].titles dicocokkan persis; judul yang diakhiri "…"
 * adalah awalan (judul waterfall dibentuk fungsi dan memuat angka). null bila tidak ada panduan.
 * @param {string} title @param {{id:string, titles:string[]}[]} charts
 * @returns {string|null}
 */
export function guideIdForTitle(title, charts) {
  const t = norm(title);
  if (!t) return null;
  for (const c of charts ?? []) if ((c.titles ?? []).some((x) => norm(x) === t)) return c.id;
  for (const c of charts ?? []) {
    if ((c.titles ?? []).some((x) => { const n = norm(x); return n.endsWith('…') && t.startsWith(n.slice(0, -1).trimEnd()); })) return c.id;
  }
  return null;
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
