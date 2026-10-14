/**
 * chartBase.js — fondasi grafik canvas 2D (tanpa library).
 * Dua lapis canvas: statis (kurva, sumbu; digambar ulang hanya bila data/ukuran berubah)
 * dan dinamis (titik berjalan; tiap frame). Label tingkat model di pojok.
 */
import { fmt } from '../ui/format.js';
import { STR } from '../ui/strings.js';

export const CHART_FONT = '12px Inter, system-ui, sans-serif';
export const CHART_FONT_NUM = '11px "JetBrains Mono", ui-monospace, monospace';
export const CHART_COLORS = {
  grid: 'rgba(139,151,173,0.14)',
  axis: 'rgba(139,151,173,0.55)',
  text: '#a9b4c7',
  title: '#e6ebf3',
};

/**
 * @param {HTMLElement} container
 * @param {{title:string, modelLevel:'ideal'|'real'|'semiEmpirical'|'siteData', pad?:{l:number,r:number,t:number,b:number}}} opts
 *   modelLevel = kunci; teks label diambil dari STR.common.level.
 */
export function createChartBase(container, { title, modelLevel, pad = { l: 56, r: 16, t: 58, b: 40 } }) {
  const root = document.createElement('div');
  root.className = 'chart';
  root.innerHTML = `
    <div class="chart__title"></div>
    <div class="chart__level"></div>
    <canvas class="chart__layer"></canvas>
    <canvas class="chart__layer"></canvas>
    <div class="chart__caption num"></div>`;
  container.appendChild(root);
  const [cs, cd] = root.querySelectorAll('canvas');
  const caption = root.querySelector('.chart__caption');
  const titleEl = root.querySelector('.chart__title');
  const levelEl = root.querySelector('.chart__level');
  titleEl.textContent = title;
  levelEl.title = STR.common.levelTip;
  levelEl.textContent = STR.common.level[modelLevel];
  const ctxS = cs.getContext('2d');
  const ctxD = cd.getContext('2d');

  const box = { w: 0, h: 0, dpr: 1, pad, plotW: 0, plotH: 0 };
  let dirty = true;

  function resize() {
    const r = root.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(50, Math.floor(r.width)), h = Math.max(50, Math.floor(r.height));
    if (w === box.w && h === box.h && dpr === box.dpr) return;
    Object.assign(box, { w, h, dpr, plotW: w - pad.l - pad.r, plotH: h - pad.t - pad.b });
    for (const c of [cs, cd]) { c.width = w * dpr; c.height = h * dpr; c.style.width = `${w}px`; c.style.height = `${h}px`; }
    dirty = true;
  }
  const ro = new ResizeObserver(resize);
  ro.observe(root);
  resize();

  return {
    root, box, ctxS, ctxD, caption,
    get dirty() { return dirty; },
    markDirty() { dirty = true; },
    /** Mulai menggambar lapis statis (reset transform + clear). */
    beginStatic() { ctxS.setTransform(box.dpr, 0, 0, box.dpr, 0, 0); ctxS.clearRect(0, 0, box.w, box.h); dirty = false; return ctxS; },
    beginDynamic() { ctxD.setTransform(box.dpr, 0, 0, box.dpr, 0, 0); ctxD.clearRect(0, 0, box.w, box.h); return ctxD; },
    setCaption(html) { if (caption.innerHTML !== html) caption.innerHTML = html; },
    setTitle(text) { if (titleEl.textContent !== text) titleEl.textContent = text; },
    /** @param {'ideal'|'real'|'semiEmpirical'|'siteData'} key */
    setLevel(key) { const t = STR.common.level[key]; if (levelEl.textContent !== t) levelEl.textContent = t; },
    dispose() { ro.disconnect(); root.remove(); },
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
  ctx.fillStyle = CHART_COLORS.text;
  ctx.strokeStyle = CHART_COLORS.grid;
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
  ctx.strokeStyle = CHART_COLORS.axis;
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
