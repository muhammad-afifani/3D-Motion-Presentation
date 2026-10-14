/**
 * pvChart.js — diagram P-V live. Kurva = frame.curve (sampleSim satu siklus penuh);
 * titik = (frame.V, frame.P) dari sampleSim yang sama → titik selalu di kurva.
 * Area fase tertutup (IVC→EVO) diarsir = kerja kotor per siklus.
 */
import { createChartBase, makeScale, niceTicks, logTicks, niceCeil, drawAxes, CHART_FONT } from './chartBase.js';
import { toBar, toLiter } from '../ui/format.js';
import { STR } from '../ui/strings.js';

const S = STR.charts.pv;

const C_LOOP = '#ffb15c';
const C_GASX = 'rgba(120,170,230,0.75)';
const C_FILL = 'rgba(255,154,60,0.16)';

/** @param {HTMLElement} container */
export function createPVChart(container, { modelLevel = 'semiEmpirical' } = {}) {
  const base = createChartBase(container, { title: S.title, modelLevel });
  let log = false;
  let curve = null, engine = null, yMax = 0;
  let sx = null, sy = null;

  const btn = document.createElement('button');
  btn.className = 'chart__toggle';
  btn.type = 'button';
  btn.textContent = S.scaleLinear;
  btn.dataset.tip = S.scaleTip;
  btn.addEventListener('click', () => { log = !log; btn.textContent = log ? S.scaleLog : S.scaleLinear; base.markDirty(); });
  base.root.appendChild(btn);

  function drawStatic(f) {
    const ctx = base.beginStatic();
    const { box } = base, g = f.geom;
    const c = f.curve;
    const Vmax = toLiter(g.Vc + g.Vd);
    const PmaxBar = toBar(f.summary.Pmax);
    if (f.engine !== engine) { engine = f.engine; yMax = 0; }
    // sumbu "lengket": hanya membesar, mengecil bila Pmax turun drastis → perubahan slider terlihat
    if (PmaxBar * 1.08 > yMax || PmaxBar * 1.08 < yMax * 0.5) yMax = niceCeil(PmaxBar * 1.08);

    const x0 = box.pad.l, x1 = box.w - box.pad.r, y0 = box.h - box.pad.b, y1 = box.pad.t;
    if (log) {
      const Pmin = Math.max(0.5, toBar(c.Pmin) * 0.8);
      sx = makeScale(toLiter(g.Vc) * 0.85, Vmax * 1.15, x0, x1, true);
      sy = makeScale(Pmin, yMax * 1.3, y0, y1, true);
      drawAxes(ctx, box, sx, sy, { xTicks: logTicks(...sx.domain), yTicks: logTicks(...sy.domain), xLabel: S.xLabel, yLabel: S.yLabel });
    } else {
      sx = makeScale(0, niceCeil(Vmax * 1.04), x0, x1);
      sy = makeScale(0, yMax, y0, y1);
      drawAxes(ctx, box, sx, sy, { xTicks: niceTicks(...sx.domain, 6), yTicks: niceTicks(0, yMax, 5), xLabel: S.xLabel, yLabel: S.yLabel });
    }

    // garis TDC / BDC
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(169,180,199,0.35)';
    ctx.font = CHART_FONT;
    ctx.fillStyle = '#a9b4c7';
    ctx.textAlign = 'center';
    for (const [V, lbl] of [[g.Vc, S.tdc], [g.Vc + g.Vd, S.bdc]]) {
      const x = sx(toLiter(V));
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
      ctx.fillText(lbl, x, y1 - 6);
    }
    ctx.restore();

    const px = (i) => sx(toLiter(c.V[i])), py = (i) => sy(toBar(c.P[i]));

    // arsir kerja: poligon fase tertutup (V IVC = V EVO sehingga luas poligon = ∫P dV)
    ctx.beginPath();
    ctx.moveTo(px(c.iClosed0), py(c.iClosed0));
    for (let i = c.iClosed0 + 1; i <= c.iClosed1; i++) ctx.lineTo(px(i), py(i));
    ctx.closePath();
    ctx.fillStyle = C_FILL;
    ctx.fill();

    // pertukaran gas (intake/exhaust)
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = C_GASX;
    ctx.beginPath();
    ctx.moveTo(px(c.iClosed1), py(c.iClosed1));
    for (let i = c.iClosed1 + 1; i < c.n; i++) ctx.lineTo(px(i), py(i));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px(0), py(0));
    for (let i = 1; i <= c.iClosed0; i++) ctx.lineTo(px(i), py(i));
    ctx.stroke();

    // fase tertutup (kompresi–pembakaran–ekspansi)
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = C_LOOP;
    ctx.beginPath();
    ctx.moveTo(px(c.iClosed0), py(c.iClosed0));
    for (let i = c.iClosed0 + 1; i <= c.iClosed1; i++) ctx.lineTo(px(i), py(i));
    ctx.stroke();

    base.setCaption(
      `<span class="sw" style="background:${C_FILL};border-color:${C_LOOP}"></span>${S.caption(f.summary.Wgross / 1e3, toBar(f.summary.imepG), toLiter(g.Vd))}` +
      ` · <span class="sw sw--line" style="background:${C_GASX}"></span>${S.captionGasx}`);
  }

  return {
    /** @param {any} f frame */
    update(f) {
      if (f.curve !== curve || base.dirty) { curve = f.curve; drawStatic(f); }
      const ctx = base.beginDynamic();
      const c = f.curve;
      // jejak 40° terakhir
      const iNow = Math.min(c.n - 1, Math.max(0, Math.round((f.theta + 360) / c.step)));
      const iFrom = Math.max(0, iNow - Math.round(40 / c.step));
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.moveTo(sx(toLiter(c.V[iFrom])), sy(toBar(c.P[iFrom])));
      for (let i = iFrom + 1; i <= iNow; i++) ctx.lineTo(sx(toLiter(c.V[i])), sy(toBar(c.P[i])));
      ctx.lineTo(sx(toLiter(f.V)), sy(toBar(f.P)));
      ctx.stroke();
      // titik state saat ini
      const x = sx(toLiter(f.V)), y = sy(toBar(f.P));
      ctx.fillStyle = `rgb(${f.gasRGB.map((v) => Math.round(v * 255)).join(',')})`;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    },
    dispose() { base.dispose(); },
  };
}
