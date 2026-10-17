/**
 * barChart.js — bar horizontal sederhana (label, nilai, warna per bar). Data sudah dalam satuan tampilan.
 */
import { createChartBase, makeScale, niceTicks, drawAxes, CHART_FONT, CHART_FONT_NUM, CV } from './chartBase.js';
import { fmt } from '../ui/format.js';

const rgbOf = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;

/** @param {HTMLElement} container */
export function createBarChart(container, { title, modelLevel = 'semiEmpirical', basis = null, unit = '', xLabel = '', digits = 0, labelWidth = 190, indicative = false, padTop = 54 } = {}) {
  const base = createChartBase(container, { title, modelLevel, basis, pad: { l: labelWidth, r: 70, t: padTop, b: 40 }, indicative });
  const { col } = base;
  /** warna bar: token tema `var(--…)`, warna CSS, atau RGB 0–1 dari model (suhu) */
  const rgb = (c) => (typeof c === 'string' ? col(c) : rgbOf(c));
  let key = '';
  return {
    /**
     * @param {{label:string, value:number, color:number[]|string, active?:boolean, sub?:string, stack?:{value:number,color:string}[]}[]} rows
     *   stack (opsional) = segmen bertumpuk; jumlahnya = value (mis. CO₂ + kontribusi CH₄ = CO₂e)
     * @param {{min?:number, max?:number, caption?:string}} [o]
     */
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
        ctx.globalAlpha = r.active ? 1 : 0.55;
        if (r.stack) {
          let x0 = vmin;
          for (const seg of r.stack) { ctx.fillStyle = rgb(seg.color); ctx.fillRect(sx(x0), yc - bh / 2, sx(x0 + seg.value) - sx(x0), bh); x0 += seg.value; }
        } else {
          ctx.fillStyle = rgb(r.color);
          ctx.fillRect(sx(vmin), yc - bh / 2, sx(r.value) - sx(vmin), bh);
        }
        ctx.globalAlpha = 1;
        if (r.active) { ctx.strokeStyle = col(CV.ring); ctx.lineWidth = 2; ctx.strokeRect(sx(vmin), yc - bh / 2, sx(r.value) - sx(vmin), bh); }
        ctx.fillStyle = col(CV.title); ctx.font = `${r.active ? '700 ' : ''}${CHART_FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(r.label, box.pad.l - 10, yc - (r.sub ? 7 : 0));
        if (r.sub) { ctx.fillStyle = col(CV.text); ctx.font = CHART_FONT; ctx.fillText(r.sub, box.pad.l - 10, yc + 9); }
        ctx.fillStyle = col(CV.title); ctx.font = `600 ${CHART_FONT_NUM}`; ctx.textAlign = 'left';
        ctx.fillText(`${fmt(r.value, digits)}${unit ? ` ${unit}` : ''}`, sx(r.value) + 6, yc);
      });
    },
    dispose() { base.dispose(); },
  };
}
