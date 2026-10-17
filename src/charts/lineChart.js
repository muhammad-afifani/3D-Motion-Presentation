/**
 * lineChart.js — grafik garis generik (mis. P-θ) dengan pita fase, garis vertikal, penanda,
 * dan kursor berjalan. Data sudah dalam satuan tampilan; chart tidak menghitung model.
 */
import { createChartBase, makeScale, niceTicks, drawAxes, CHART_FONT, CV } from './chartBase.js';

/**
 * @typedef {Object} LineData
 * @property {ArrayLike<number>} x
 * @property {ArrayLike<number>} y
 * @property {[number, number]} xDomain
 * @property {number} yMax
 * @property {number[]} [xTicks]
 * @property {(v:number)=>string} [xFmt]
 * @property {{x0:number,x1:number,label:string,color:string}[]} [bands]
 * @property {{x:number,label:string}[]} [vlines]
 * @property {{x:number,y:number,label:string}[]} [markers]
 */

/** @param {HTMLElement} container */
export function createLineChart(container, { title, modelLevel, basis = null, xLabel, yLabel, color = CV.main }) {
  const base = createChartBase(container, { title, modelLevel, basis, pad: { l: 56, r: 16, t: 58, b: 40 } });
  const { col } = base;
  /** @type {LineData|null} */
  let data = null;
  let sx = null, sy = null;

  function drawStatic() {
    const ctx = base.beginStatic();
    const { box } = base;
    const x0 = box.pad.l, x1 = box.w - box.pad.r, y0 = box.h - box.pad.b, y1 = box.pad.t;
    sx = makeScale(data.xDomain[0], data.xDomain[1], x0, x1);
    sy = makeScale(0, data.yMax, y0, y1);

    ctx.save();
    ctx.font = CHART_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    for (const b of data.bands ?? []) {
      const a = sx(Math.max(b.x0, data.xDomain[0])), z = sx(Math.min(b.x1, data.xDomain[1]));
      ctx.fillStyle = col(b.color);
      ctx.fillRect(a, y1, z - a, y0 - y1);
      if (b.label && z - a > 30) { ctx.fillStyle = col(CV.text); ctx.fillText(b.label, (a + z) / 2, y0 - 6); }
    }
    ctx.restore();

    drawAxes(ctx, box, sx, sy, {
      xTicks: data.xTicks ?? niceTicks(...data.xDomain, 8), yTicks: niceTicks(0, data.yMax, 4),
      xLabel, yLabel, xFmt: data.xFmt,
    });

    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = col(CV.dash);
    ctx.fillStyle = col(CV.text);
    ctx.font = CHART_FONT;
    ctx.textAlign = 'center';
    for (const v of data.vlines ?? []) {
      const x = sx(v.x);
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
      if (v.label) ctx.fillText(v.label, x, y1 - 6);
    }
    ctx.restore();

    ctx.lineWidth = 2;
    ctx.strokeStyle = col(color);
    ctx.beginPath();
    for (let i = 0; i < data.x.length; i++) {
      const X = sx(data.x[i]), Y = sy(data.y[i]);
      if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
    }
    ctx.stroke();

    ctx.font = CHART_FONT;
    ctx.fillStyle = col(CV.title);
    ctx.textAlign = 'left';
    for (const m of data.markers ?? []) {
      const X = sx(m.x), Y = sy(m.y);
      ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X + 14, Y - 10); ctx.strokeStyle = col(CV.title); ctx.lineWidth = 1; ctx.stroke();
      ctx.fillText(m.label, X + 17, Y - 12);
    }
  }

  return {
    /** @param {LineData} d */
    setData(d) { data = d; drawStatic(); },
    /** Kursor vertikal + titik (x,y) dalam satuan tampilan. */
    setCursor(x, y, fill = CV.ring) {
      if (!data) return;
      if (base.dirty) drawStatic();
      const ctx = base.beginDynamic();
      const { box } = base;
      const X = sx(x), Y = sy(y);
      ctx.strokeStyle = col(CV.guide);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X, box.pad.t); ctx.lineTo(X, box.h - box.pad.b); ctx.stroke();
      ctx.fillStyle = col(fill);
      ctx.strokeStyle = col(CV.ring);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(X, Y, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    },
    setCaption: base.setCaption,
    dispose() { base.dispose(); },
  };
}
