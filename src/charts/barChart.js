/**
 * barChart.js — bar horizontal sederhana (label, nilai, warna per bar). Data sudah dalam satuan tampilan.
 */
import { createChartBase, makeScale, niceTicks, drawAxes, CHART_FONT, CHART_FONT_NUM } from './chartBase.js';
import { fmt } from '../ui/format.js';

const rgb = (c) => (typeof c === 'string' ? c : `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`);

/** @param {HTMLElement} container */
export function createBarChart(container, { title, modelLevel = 'Semi-empiris', unit = '', xLabel = '', digits = 0, labelWidth = 190 } = {}) {
  const base = createChartBase(container, { title, modelLevel, pad: { l: labelWidth, r: 70, t: 54, b: 40 } });
  let key = '';
  return {
    /** @param {{label:string, value:number, color:number[]|string, active?:boolean, sub?:string}[]} rows @param {{min?:number, max?:number, caption?:string}} [o] */
    update(rows, o = {}) {
      const k = JSON.stringify(rows) + base.box.w + base.box.h;
      if (o.caption != null) base.setCaption(o.caption);
      if (k === key && !base.dirty) return;
      key = k;
      const ctx = base.beginStatic();
      base.beginDynamic();
      const { box } = base;
      const vmax = o.max ?? Math.max(...rows.map((r) => r.value)) * 1.1;
      const vmin = o.min ?? 0;
      const sx = makeScale(vmin, vmax, box.pad.l, box.w - box.pad.r);
      const sy = makeScale(0, rows.length, box.pad.t, box.h - box.pad.b);
      drawAxes(ctx, box, sx, (v) => v, { xTicks: niceTicks(vmin, vmax, 5), yTicks: [], xLabel, yLabel: '' });
      const bh = (sy(1) - sy(0)) * 0.56;
      rows.forEach((r, i) => {
        const yc = sy(i + 0.5);
        ctx.fillStyle = rgb(r.color);
        ctx.globalAlpha = r.active ? 1 : 0.55;
        ctx.fillRect(sx(vmin), yc - bh / 2, sx(r.value) - sx(vmin), bh);
        ctx.globalAlpha = 1;
        if (r.active) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(sx(vmin), yc - bh / 2, sx(r.value) - sx(vmin), bh); }
        ctx.fillStyle = '#e6ebf3'; ctx.font = `${r.active ? '700 ' : ''}${CHART_FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(r.label, box.pad.l - 10, yc - (r.sub ? 7 : 0));
        if (r.sub) { ctx.fillStyle = '#a9b4c7'; ctx.font = CHART_FONT; ctx.fillText(r.sub, box.pad.l - 10, yc + 9); }
        ctx.fillStyle = '#e6ebf3'; ctx.font = `600 ${CHART_FONT_NUM}`; ctx.textAlign = 'left';
        ctx.fillText(`${fmt(r.value, digits)}${unit ? ` ${unit}` : ''}`, sx(r.value) + 6, yc);
      });
    },
    dispose() { base.dispose(); },
  };
}
