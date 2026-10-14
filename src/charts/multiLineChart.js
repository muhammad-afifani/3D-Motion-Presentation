/**
 * multiLineChart.js — beberapa seri x–y pada satu sumbu (linier atau log-y), pita rentang x, garis horizontal
 * (mis. batas presenter), dan titik dinamis. Domain x boleh terbalik (mis. beban 100 → 40 %).
 * Data sudah dalam satuan tampilan; chart tidak menghitung model. Dipakai Scene 6.
 */
import { createChartBase, makeScale, niceTicks, logTicks, drawAxes, CHART_FONT, CHART_COLORS } from './chartBase.js';

/**
 * @typedef {{x:ArrayLike<number>, y:ArrayLike<number>, color:string, dash?:number[], width?:number}} Series
 * @typedef {Object} MultiData
 * @property {Series[]} series
 * @property {[number, number]} xDomain   urutan = arah sumbu (boleh terbalik)
 * @property {[number, number]} yDomain
 * @property {number[]} [yTicks]
 * @property {(v:number)=>string} [xFmt]
 * @property {(v:number)=>string} [yFmt]
 * @property {{x0:number,x1:number,color:string,label?:string}[]} [bands]
 * @property {{y:number,color:string,label?:string,dash?:number[],align?:'left'|'right'}[]} [hlines]
 */

/** @param {HTMLElement} container */
export function createMultiLineChart(container, { title, modelLevel, xLabel, yLabel, logY = false, indicative = true, pad = { l: 60, r: 18, t: 74, b: 40 } }) {
  const base = createChartBase(container, { title, modelLevel, pad, indicative });
  /** @type {MultiData|null} */
  let data = null;
  let sx = null, sy = null, yl = yLabel, logNow = logY;

  function drawStatic() {
    const ctx = base.beginStatic();
    const { box } = base;
    const x0 = box.pad.l, x1 = box.w - box.pad.r, y0 = box.h - box.pad.b, y1 = box.pad.t;
    sx = makeScale(data.xDomain[0], data.xDomain[1], x0, x1);
    sy = makeScale(data.yDomain[0], data.yDomain[1], y0, y1, logNow);
    const [xa, xb] = [Math.min(...data.xDomain), Math.max(...data.xDomain)];

    ctx.save();
    ctx.font = CHART_FONT;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    for (const b of data.bands ?? []) {
      const a = sx(b.x0), z = sx(b.x1), l = Math.min(a, z), w = Math.abs(z - a);
      ctx.fillStyle = b.color;
      ctx.fillRect(l, y1, Math.max(2, w), y0 - y1);
      if (b.label) { ctx.fillStyle = CHART_COLORS.title; ctx.fillText(b.label, l + w / 2, y1 + 3); }
    }
    ctx.restore();

    drawAxes(ctx, box, sx, sy, {
      xTicks: niceTicks(xa, xb, 6),
      yTicks: data.yTicks ?? (logNow ? logTicks(...data.yDomain) : niceTicks(...data.yDomain, 4)),
      xLabel, yLabel: yl, xFmt: data.xFmt, yFmt: data.yFmt,
    });

    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y1, x1 - x0, y0 - y1);
    ctx.clip();
    for (const h of data.hlines ?? []) {
      const Y = sy(h.y);
      ctx.strokeStyle = h.color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash(h.dash ?? [6, 4]);
      ctx.beginPath(); ctx.moveTo(x0, Y); ctx.lineTo(x1, Y); ctx.stroke();
      ctx.setLineDash([]);
      if (h.label) { const left = h.align === 'left'; ctx.fillStyle = h.color; ctx.font = CHART_FONT; ctx.textAlign = left ? 'left' : 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(h.label, left ? x0 + 4 : x1 - 4, Y - 3); }
    }
    for (const s of data.series) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width ?? 2;
      ctx.setLineDash(s.dash ?? []);
      ctx.beginPath();
      let pen = false;
      for (let i = 0; i < s.x.length; i++) {
        const v = s.y[i];
        if (!Number.isFinite(v) || (logNow && v <= 0)) { pen = false; continue; }
        const X = sx(s.x[i]), Y = sy(logNow ? Math.max(v, data.yDomain[0] * 0.5) : v);
        if (pen) ctx.lineTo(X, Y); else { ctx.moveTo(X, Y); pen = true; }
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  return {
    /** @param {MultiData} d */
    setData(d) { data = d; drawStatic(); },
    setYLabel(t) { yl = t; },
    setLog(on) { logNow = !!on; },
    setTitle: base.setTitle,
    /** @param {{x:number,y:number,fill:string,ring?:string,guide?:boolean}[]} pts  guide=false → tanpa garis vertikal */
    setPoints(pts) {
      if (!data) return;
      if (base.dirty) drawStatic();
      const ctx = base.beginDynamic();
      const { box } = base;
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      const xs = new Set(pts.filter((p) => p.guide !== false).map((p) => p.x));
      for (const x of xs) { const X = sx(x); ctx.beginPath(); ctx.moveTo(X, box.pad.t); ctx.lineTo(X, box.h - box.pad.b); ctx.stroke(); }
      ctx.setLineDash([]);
      for (const p of pts) {
        if (!Number.isFinite(p.y) || (logNow && p.y <= 0)) continue;
        const X = sx(p.x), Y = sy(logNow ? Math.max(p.y, data.yDomain[0] * 0.5) : p.y);
        ctx.fillStyle = p.fill;
        ctx.strokeStyle = p.ring ?? '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(X, Y, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    },
    setCaption: base.setCaption,
    dispose() { base.dispose(); },
  };
}
