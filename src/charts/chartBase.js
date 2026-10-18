/**
 * chartBase.js — fondasi grafik canvas 2D (tanpa library).
 * Dua lapis canvas: statis (kurva, sumbu; digambar ulang hanya bila data/ukuran berubah)
 * dan dinamis (titik berjalan; tiap frame). Label tingkat model di pojok.
 */
import { fmt } from '../ui/format.js';
import { STR } from '../ui/strings.js';
import { createGuideButton } from '../ui/chartGuideButton.js';

export const CHART_FONT = '12px Inter, system-ui, sans-serif';
export const CHART_FONT_NUM = '11px "JetBrains Mono", ui-monospace, monospace';
/**
 * Token warna grafik (bagian B). Nilai warna tinggal di styles.css (variabel --c-*, --sp-*), dua tema; grafik hanya
 * memegang rujukan `var(--…)` dan menerjemahkannya per grafik lewat `base.col` dari gaya terhitung elemen grafik.
 * Jadi grafik mengikuti tema aktif, dan grafik di dalam `.vp-scope` (skema di atas viewport 3D arang) tetap memakai
 * nilai gelap. Teks berwarna memakai `base.ink`: varian `--…-ink` bila tema mendefinisikannya (kontras teks ≥ 4,5:1).
 */
export const CHART_TOKENS = Object.freeze([
  'grid', 'axis', 'text', 'title', 'fg', 'ring', 'hollow', 'guide', 'ghost', 'ref', 'dash',
  'main', 'hot', 'cold', 'loss', 'ok', 'note', 'closing', 'gasx', 'pv-fill', 'compression', 'rejection', 'heat', 'expansion',
  'pipe', 'path', 'diesel', 'band-intake', 'band-neutral', 'band-comb', 'band-comb-sw', 'band-exhaust', 'band-dln', 'band-engine',
  'win-single', 'win-twin', 'co-band-single', 'co-band-twin',
]);
const camel = (k) => k.replace(/-(\w)/g, (_, c) => c.toUpperCase());
/** Rujukan token grafik, mis. CV.text = 'var(--c-text)', CV.pvFill = 'var(--c-pv-fill)'. */
export const CV = Object.freeze(Object.fromEntries(CHART_TOKENS.map((k) => [camel(k), `var(--c-${k})`])));
const VAR_RE = /^var\((--[\w-]+)\)$/;
const FALLBACK = '#888888';
const INK = 'ink'; // akhiran varian teks: --c-main → --c-main-ink

/** Ganti tema: semua grafik aktif membaca ulang token dan menggambar ulang lapis statis pada frame berikutnya. */
export function refreshChartTheme() {
  for (const b of BASES) b.retheme?.();
}

/**
 * Pengaman redraw: ukuran grafik diukur ulang bila container berubah ukuran (ResizeObserver) DAN pada saat
 * container tampil kembali (IntersectionObserver / tab dibuka / jendela kembali terlihat), sehingga grafik tidak
 * tertinggal berukuran 0 atau kosong setelah container sempat disembunyikan.
 */
const syncAll = () => { for (const b of BASES) b.resize(); };
if (typeof window !== 'undefined') {
  window.addEventListener('resize', syncAll);
  window.addEventListener('pageshow', syncAll);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncAll(); });
}

/** Grafik aktif + skala ekspor (snapshot PNG 2×). null = devicePixelRatio normal (maks 2). */
const BASES = new Set();
let exportScale = null;
/** Snapshot: gambar ulang semua grafik aktif pada skala `k` (null = kembali normal). */
export function setChartExportScale(k = null) {
  exportScale = k;
  for (const b of BASES) b.resize();
}

/**
 * @param {HTMLElement} container
 * @param {{title:string, modelLevel:'ideal'|'real'|'semiEmpirical'|'siteData', basis?:string|string[], pad?:{l:number,r:number,t:number,b:number}, indicative?:boolean, guideHost?:HTMLElement|null}} opts
 *   modelLevel = kunci; kata level diambil dari STR.common.level. indicative = tambahkan "· indicative".
 *   basis = id kelompok (BASIS_GROUPS) atau daftar kunci BASIS: tag "Basis · <level>" di pojok membuka kartu Basis.
 *   guideHost = elemen tujuan tombol ⓘ bila bukan baris judul grafik ini.
 */
export function createChartBase(container, { title, modelLevel, basis = null, pad = { l: 56, r: 16, t: 58, b: 40 }, indicative = false, guideHost = null }) {
  const root = document.createElement('div');
  root.className = 'chart';
  root.innerHTML = `
    <div class="chart__head"><div class="chart__title"></div><div class="chart__tools"><button type="button" class="chart__level"></button></div></div>
    <canvas class="chart__layer"></canvas>
    <canvas class="chart__layer"></canvas>
    <div class="chart__caption num"></div>`;
  container.appendChild(root);
  const [cs, cd] = root.querySelectorAll('canvas');
  const caption = root.querySelector('.chart__caption');
  const titleEl = root.querySelector('.chart__title');
  const levelEl = root.querySelector('.chart__level');
  // ⓘ "How to read this chart": di kiri tag Basis (atau di guideHost bila tag dipindah ke panel lain, mis. skematik Brayton)
  const guide = createGuideButton({ getTitle: () => titleEl.textContent });
  (guideHost ?? root.querySelector('.chart__tools')).prepend(guide.el);
  titleEl.textContent = title;
  levelEl.dataset.tip = STR.basis.tagTip;
  const levelText = (k) => `${STR.basis.tag} · ${STR.common.level[k]}${indicative ? ` · ${STR.common.indicative}` : ''}`;
  const setBasisAttr = (b) => { if (b) levelEl.dataset.basis = Array.isArray(b) ? b.join(',') : b; else delete levelEl.dataset.basis; };
  levelEl.textContent = levelText(modelLevel);
  setBasisAttr(basis);
  const ctxS = cs.getContext('2d');
  const ctxD = cd.getContext('2d');

  // warna token per grafik (cache dibersihkan saat tema berganti); elemen yang belum terpasang → tanpa cache
  const cache = new Map();
  /** @param {any} v warna CSS atau rujukan `var(--…)` @returns {any} */
  function col(v) {
    if (typeof v !== 'string') return v;
    const m = VAR_RE.exec(v);
    if (!m) return v;
    let r = cache.get(m[1]);
    if (r === undefined) {
      r = (root.isConnected && getComputedStyle(root).getPropertyValue(m[1]).trim()) || '';
      if (root.isConnected) cache.set(m[1], r);
    }
    return r || FALLBACK;
  }
  /** Warna untuk teks: varian `-ink` bila didefinisikan tema aktif, selain itu warna yang sama. */
  function ink(v) {
    const m = typeof v === 'string' ? VAR_RE.exec(v) : null;
    if (!m) return col(v);
    const k = `${m[1]}-${INK}`;
    let r = cache.get(k);
    if (r === undefined) { r = (root.isConnected && getComputedStyle(root).getPropertyValue(k).trim()) || ''; if (root.isConnected) cache.set(k, r); }
    return r || col(v);
  }

  const box = { w: 0, h: 0, dpr: 1, pad, plotW: 0, plotH: 0, col, ink };
  let dirty = true, wasHidden = false;

  function resize() {
    const r = root.getBoundingClientRect();
    // container sedang disembunyikan (display: none → 0×0): pertahankan ukuran terakhir, gambar ulang saat tampil lagi
    if ((!r.width || !r.height) && box.w) { wasHidden = true; return; }
    const dpr = exportScale ?? Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(50, Math.floor(r.width)), h = Math.max(50, Math.floor(r.height));
    if (w === box.w && h === box.h && dpr === box.dpr) { if (wasHidden) { dirty = true; wasHidden = false; } return; }
    wasHidden = false;
    Object.assign(box, { w, h, dpr, plotW: w - pad.l - pad.r, plotH: h - pad.t - pad.b });
    for (const c of [cs, cd]) { c.width = w * dpr; c.height = h * dpr; c.style.width = `${w}px`; c.style.height = `${h}px`; }
    dirty = true;
  }
  const ro = new ResizeObserver(resize);
  ro.observe(root);
  // tab/panel yang tadinya tersembunyi lalu ditampilkan: ukur ulang dan tandai gambar ulang
  const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { resize(); dirty = true; } }) : null;
  io?.observe(root);
  resize();
  const entry = { resize, retheme() { cache.clear(); dirty = true; } };
  BASES.add(entry);

  return {
    root, box, ctxS, ctxD, caption, col, ink,
    /** Baris alat di kanan atas (ⓘ, tombol grafik, tag Basis); tombol tambahan di-prepend ke sini. */
    tools: root.querySelector('.chart__tools'),
    get dirty() { return dirty; },
    markDirty() { dirty = true; },
    /** Ukur ulang sekarang dan gambar ulang lapis statis (dipanggil saat tab dibuka). */
    sync() { resize(); dirty = true; },
    /** Mulai menggambar lapis statis (reset transform + clear). */
    beginStatic() { ctxS.setTransform(box.dpr, 0, 0, box.dpr, 0, 0); ctxS.clearRect(0, 0, box.w, box.h); dirty = false; return ctxS; },
    beginDynamic() { ctxD.setTransform(box.dpr, 0, 0, box.dpr, 0, 0); ctxD.clearRect(0, 0, box.w, box.h); return ctxD; },
    setCaption(html) { if (caption.innerHTML !== html) caption.innerHTML = html; },
    setTitle(text) { if (titleEl.textContent !== text) titleEl.textContent = text; },
    /** @param {'ideal'|'real'|'semiEmpirical'|'siteData'} key @param {string|string[]} [b] kelompok Basis baru (bila berubah per mode) */
    setLevel(key, b) {
      const t = levelText(key);
      if (levelEl.textContent !== t) levelEl.textContent = t;
      if (b) setBasisAttr(b);
    },
    dispose() { BASES.delete(entry); ro.disconnect(); io?.disconnect(); guide.dispose(); root.remove(); },
  };
}

/** Sumbu linier atau log10 → piksel. */
export function makeScale(d0, d1, r0, r1, log = false) {
  if (log) {
    const l0 = Math.log10(d0), l1 = Math.log10(d1);
    const f = (v) => r0 + ((Math.log10(Math.max(v, 1e-12)) - l0) / (l1 - l0)) * (r1 - r0);
    f.domain = [d0, d1]; f.log = true;
    return f;
  }
  const f = (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
  f.domain = [d0, d1]; f.log = false;
  return f;
}

/** Tick "rapi" (1-2-5) untuk rentang linier. */
export function niceTicks(min, max, count = 5) {
  const span = max - min;
  if (!(span > 0)) return [min];
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return out;
}

/** Tick log 1-2-5 per dekade. */
export function logTicks(min, max) {
  const out = [];
  for (let e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e++) {
    for (const m of [1, 2, 5]) { const v = m * 10 ** e; if (v >= min * 0.999 && v <= max * 1.001) out.push(v); }
  }
  return out;
}

/** Batas atas sumbu yang rapi (1-2-2,5-5 ×10ⁿ, kelipatan sederhana). */
export function niceCeil(v) {
  if (!(v > 0)) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * mag >= v) return m * mag;
  return 10 * mag;
}

/** Digit desimal yang pantas untuk label tick. */
export const tickDigits = (v) => (Math.abs(v) >= 10 || v === 0 ? 0 : Math.abs(v) >= 1 ? (Number.isInteger(v) ? 0 : 1) : 2);

/**
 * Gambar grid + sumbu + label.
 * @param {CanvasRenderingContext2D} ctx
 */
export function drawAxes(ctx, box, sx, sy, { xTicks, yTicks, xLabel, yLabel, xFmt, yFmt }) {
  const { pad, w, h } = box;
  const x0 = pad.l, x1 = w - pad.r, y0 = h - pad.b, y1 = pad.t;
  ctx.save();
  ctx.lineWidth = 1;
  ctx.font = CHART_FONT_NUM;
  const col = box.col ?? ((v) => v);
  ctx.fillStyle = col(CV.text);
  ctx.strokeStyle = col(CV.grid);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const t of xTicks) {
    const x = Math.round(sx(t)) + 0.5;
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
    ctx.fillText(xFmt ? xFmt(t) : fmt(t, tickDigits(t)), x, y0 + 5);
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const t of yTicks) {
    const y = Math.round(sy(t)) + 0.5;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    ctx.fillText(yFmt ? yFmt(t) : fmt(t, tickDigits(t)), x0 - 6, y);
  }
  ctx.strokeStyle = col(CV.axis);
  ctx.beginPath(); ctx.moveTo(x0 + 0.5, y1); ctx.lineTo(x0 + 0.5, y0 + 0.5); ctx.lineTo(x1, y0 + 0.5); ctx.stroke();
  ctx.font = CHART_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(xLabel, (x0 + x1) / 2, h - 4);
  ctx.save();
  ctx.translate(13, (y0 + y1) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textBaseline = 'middle';
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();
  ctx.restore();
}
