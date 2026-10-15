/**
 * flameChart.js — suhu nyala adiabatik vs φ (flameTemperature). Kurva pada T_in saat ini (tegas) dan
 * 300 K (putus-putus), titik operasi dari frame (diesel: φ global & φ lokal dengan panah ΔT).
 * Kurva disampel di titik patah tabel model sehingga polyline = fungsi model; titik tepat di kurva.
 */
import { createChartBase, makeScale, niceTicks, drawAxes, CHART_FONT } from './chartBase.js';
import { STR } from '../ui/strings.js';

const S = STR.charts.flame;

const rgb = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;

/** @param {HTMLElement} container */
export function createFlameChart(container, { basis = null } = {}) {
  const base = createChartBase(container, { title: S.title, modelLevel: 'semiEmpirical', basis, pad: { l: 60, r: 18, t: 58, b: 42 } });
  let sx, sy, key = '';

  function drawStatic(f) {
    const ctx = base.beginStatic();
    const { box } = base;
    sx = makeScale(f.curve.phi[0], f.curve.phi[f.curve.phi.length - 1], box.pad.l, box.w - box.pad.r);
    const tmax = Math.max(...f.curve.T, ...f.curve300.T);
    sy = makeScale(800, Math.ceil((tmax + 150) / 250) * 250, box.h - box.pad.b, box.pad.t);
    drawAxes(ctx, box, sx, sy, { xTicks: niceTicks(...sx.domain, 9), yTicks: niceTicks(...sy.domain, 5), xLabel: S.xLabel, yLabel: S.yLabel });
    // garis stoikiometrik
    ctx.save();
    ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(169,180,199,0.35)';
    ctx.beginPath(); ctx.moveTo(sx(1), sy.domain ? sy(sy.domain[0]) : 0); ctx.lineTo(sx(1), box.pad.t); ctx.stroke();
    ctx.fillStyle = '#a9b4c7'; ctx.font = CHART_FONT; ctx.textAlign = 'center'; ctx.fillText(S.stoich, sx(1), box.pad.t - 6);
    ctx.fillText(S.lean, sx(0.55), box.pad.t - 6);
    ctx.fillText(S.rich, sx(1.12), box.pad.t - 6);
    ctx.restore();
    const line = (c, style, width, dash) => {
      ctx.save(); ctx.strokeStyle = style; ctx.lineWidth = width; ctx.setLineDash(dash);
      ctx.beginPath();
      for (let i = 0; i < c.phi.length; i++) (i ? ctx.lineTo(sx(c.phi[i]), sy(c.T[i])) : ctx.moveTo(sx(c.phi[i]), sy(c.T[i])));
      ctx.stroke(); ctx.restore();
    };
    line(f.curve300, 'rgba(230,235,243,0.45)', 1.5, [5, 4]);
    line(f.curve, '#ffb15c', 2.5, []);
    base.setCaption(`<span class="sw sw--line" style="background:#ffb15c"></span>${S.caption(f.Tin, f.TinManual, f.fuel)}`);
  }

  return {
    update(f) {
      const k = `${f.Tin}|${f.fuel}|${f.TinManual}|${base.dirty}`;
      if (k !== key || base.dirty) { key = k; drawStatic(f); }
      const ctx = base.beginDynamic();
      const pts = f.points.map((p) => ({ ...p, x: sx(p.phi), y: sy(p.T) }));
      if (pts.length === 2) {
        // panah ΔT diesel: φ global → φ lokal
        const [a, b] = pts;
        ctx.save();
        ctx.strokeStyle = '#ff8fb8'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.setLineDash([]);
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        ctx.beginPath(); ctx.moveTo(b.x - 10 * Math.cos(ang - 0.4), b.y - 10 * Math.sin(ang - 0.4)); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x - 10 * Math.cos(ang + 0.4), b.y - 10 * Math.sin(ang + 0.4)); ctx.stroke();
        ctx.fillStyle = '#ff8fb8'; ctx.font = `600 ${CHART_FONT}`; ctx.textAlign = 'left';
        ctx.fillText(S.dT(b.T - a.T), (a.x + b.x) / 2 + 8, (a.y + b.y) / 2 + 16);
        ctx.restore();
      }
      for (const p of pts) {
        ctx.fillStyle = rgb(p.local ? f.coreColor : f.color);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.local ? 8 : 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e6ebf3'; ctx.font = `600 ${CHART_FONT}`;
        ctx.textAlign = p.x > base.box.w * 0.7 ? 'right' : 'left';
        const dx = ctx.textAlign === 'right' ? -12 : 12;
        ctx.fillText(S.point(STR.scene3.points[p.labelKey], p.phi, p.T), p.x + dx, p.y - 12);
      }
    },
    dispose() { base.dispose(); },
  };
}
