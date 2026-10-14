/**
 * xyChart.js — grafik x–y generik (linier atau log-y): satu polyline, pita rentang, label titik,
 * penanda statis, dan titik dinamis. Data sudah dalam satuan tampilan; chart tidak menghitung model.
 * Dipakai Scene 4: NOx vs η (retardSweep) dan Arrhenius (zeldovichCurve).
 */
import { createChartBase, makeScale, niceTicks, logTicks, drawAxes, CHART_FONT, CHART_COLORS } from './chartBase.js';

/**
 * @typedef {Object} XYData
 * @property {ArrayLike<number>} x
 * @property {ArrayLike<number>} y
 * @property {[number, number]} xDomain
 * @property {[number, number]} yDomain
 * @property {(v:number)=>string} [xFmt]
 * @property {(v:number)=>string} [yFmt]
 * @property {number[]} [yTicks]  tick y khusus (mis. hanya dekade untuk log)
 * @property {{x0:number,x1:number,label:string,color:string,labelPos?:'top'|'bottom'}[]} [bands]
 * @property {{i:number,label:string}[]} [pointLabels]  label kecil di titik data ke-i
 * @property {{x:number,y:number,label:string}[]} [markers] penanda cincin statis
 */

/** @param {HTMLElement} container */
export function createXYChart(container, { title, modelLevel, xLabel, yLabel, logY = false, color = '#ff9a3c', pad = { l: 60, r: 18, t: 58, b: 40 } }) {
  const base = createChartBase(container, { title, modelLevel, pad });
  /** @type {XYData|null} */
  let data = null;
  let sx = null, sy = null;
  let yLabelNow = yLabel;

  function drawStatic() {
    const ctx = base.beginStatic();
    const { box } = base;
    const x0 = box.pad.l, x1 = box.w - box.pad.r, y0 = box.h - box.pad.b, y1 = box.pad.t;
    sx = makeScale(data.xDomain[0], data.xDomain[1], x0, x1);
    sy = makeScale(data.yDomain[0], data.yDomain[1], y0, y1, logY);

    ctx.save();
    ctx.font = CHART_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const b of data.bands ?? []) {
      const a = sx(Math.max(b.x0, data.xDomain[0])), z = sx(Math.min(b.x1, data.xDomain[1]));
      if (z <= a) continue;
      ctx.fillStyle = b.color;
      ctx.fillRect(a, y1, z - a, y0 - y1);
      if (b.label) {
        ctx.fillStyle = CHART_COLORS.text;
        const bottom = b.labelPos === 'bottom';
        ctx.textBaseline = bottom ? 'bottom' : 'top';
        ctx.fillText(b.label, (a + z) / 2, bottom ? y0 - 4 : y1 + 4);
      }
    }
    ctx.restore();

    drawAxes(ctx, box, sx, sy, {
      xTicks: niceTicks(...data.xDomain, 6),
      yTicks: data.yTicks ?? (logY ? logTicks(...data.yDomain) : niceTicks(...data.yDomain, 4)),
      xLabel, yLabel: yLabelNow, xFmt: data.xFmt, yFmt: data.yFmt,
    });

    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y1, x1 - x0, y0 - y1);
    ctx.clip();
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.beginPath();
    for (let i = 0; i < data.x.length; i++) {
      const X = sx(data.x[i]), Y = sy(data.y[i]);
      if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
    }
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = CHART_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'right';
    for (const p of data.pointLabels ?? []) {
      const X = sx(data.x[p.i]), Y = sy(data.y[p.i]);
      ctx.beginPath(); ctx.arc(X, Y, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = CHART_COLORS.text;
      ctx.fillText(p.label, X - 5, Y - 5);   // kiri-atas titik (di luar kurva yang naik ke kanan)
      ctx.fillStyle = color;
    }
    ctx.restore();

    ctx.save();
    ctx.font = CHART_FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (const m of data.markers ?? []) {
      const X = sx(m.x), Y = sy(m.y);
      ctx.strokeStyle = CHART_COLORS.title;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(X, Y, 8, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = CHART_COLORS.title;
      if (m.label) ctx.fillText(m.label, X + 12, Y + 12);
    }
    ctx.restore();
  }

  return {
    /** @param {XYData} d */
    setData(d) { data = d; drawStatic(); },
    setYLabel(t) { if (t !== yLabelNow) { yLabelNow = t; if (data) drawStatic(); } },
    /**
     * Titik dinamis (tiap frame).
     * @param {{x:number,y:number,fill?:string,label?:string,guide?:boolean}[]} pts
     */
    setPoints(pts) {
      if (!data) return;
      if (base.dirty) drawStatic();
      const ctx = base.beginDynamic();
      const { box } = base;
      for (const p of pts) {
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
        const X = sx(p.x), Y = sy(p.y);
        if (p.guide) {
          ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.moveTo(X, box.h - box.pad.b); ctx.lineTo(X, Y); ctx.lineTo(box.pad.l, Y); ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.fillStyle = p.fill ?? '#fff';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(X, Y, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        if (p.label) {
          ctx.font = CHART_FONT;
          ctx.fillStyle = CHART_COLORS.title;
          const right = X > box.w - 170;
          ctx.textAlign = right ? 'right' : 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(p.label, X + (right ? -12 : 12), Y + 30);   // di bawah label penanda statis
        }
      }
    },
    setCaption: base.setCaption,
    dispose() { base.dispose(); },
  };
}

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
/** Tick dekade 10ⁿ untuk sumbu log yang lebar. */
export const decadeTicks = (min, max) => {
  const out = [];
  for (let e = Math.ceil(Math.log10(min) - 1e-9); e <= Math.floor(Math.log10(max) + 1e-9); e++) out.push(10 ** e);
  return out;
};
export const decadeFmt = (v) => {
  const e = Math.round(Math.log10(v));
  if (e === 0) return '1';
  if (e === 1) return '10';
  return `10${String(e).split('').map((c) => SUP[c]).join('')}`;
};
