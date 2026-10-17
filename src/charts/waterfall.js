/**
 * waterfall.js — bar efisiensi kumulatif dari lossWaterfall (atau ideal → real Brayton).
 * Bar pertama penuh dari 0, bar tengah "melayang" sebesar rugi (delta), bar terakhir penuh.
 * Animasi: bar muncul/turun satu per satu (replay()).
 */
import { createChartBase, makeScale, niceTicks, drawAxes, CHART_FONT, CHART_FONT_NUM, CV } from './chartBase.js';
import { fmt } from '../ui/format.js';
import { STR } from '../ui/strings.js';

const STEP_MS = 650;
const DROP_MS = 420;
const C_FULL = CV.main, C_LOSS = CV.loss, C_LAST = CV.ok;

/** Pecah label menjadi ≤ 2 baris yang muat lebar w. */
function wrap(ctx, text, w) {
  const words = text.split(' ');
  const lines = [''];
  for (const wd of words) {
    const t = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${wd}` : wd;
    if (ctx.measureText(t).width <= w || !lines[lines.length - 1]) lines[lines.length - 1] = t;
    else if (lines.length < 2) lines.push(wd);
    else { lines[1] = `${lines[1]}…`; break; }
  }
  return lines;
}

/** @param {HTMLElement} container */
export function createWaterfall(container, { title = STR.charts.waterfall.title, basis = null } = {}) {
  const base = createChartBase(container, { title, modelLevel: 'semiEmpirical', basis, pad: { l: 52, r: 16, t: 50, b: 46 } });
  const { col, ink } = base;
  let steps = null, t0 = performance.now(), lastSteps = null;

  function draw(now) {
    const ctx = base.beginDynamic();
    base.beginStatic(); // lapis statis tidak dipakai (animasi menggambar semuanya)
    if (!steps?.length) return;
    const { box } = base;
    const sx = makeScale(0, steps.length, box.pad.l, box.w - box.pad.r);
    const yMax = Math.min(1, Math.ceil((steps[0].eta * 100 + 8) / 10) / 10);
    const sy = makeScale(0, yMax * 100, box.h - box.pad.b, box.pad.t);
    drawAxes(ctx, box, sx, sy, { xTicks: [], yTicks: niceTicks(0, yMax * 100, 4), xLabel: '', yLabel: STR.charts.waterfall.yLabel });
    const bw = (sx(1) - sx(0)) * 0.62;
    steps.forEach((st, i) => {
      const age = now - t0 - i * STEP_MS;
      if (age < 0) return;
      const k = Math.min(1, age / DROP_MS), ease = 1 - (1 - k) ** 3;
      const xc = sx(i + 0.5), x = xc - bw / 2;
      const prev = i ? steps[i - 1].eta : st.eta;
      const last = i === steps.length - 1 && i > 0;
      ctx.save();
      if (i === 0 || last) {
        const top = sy(st.eta * 100 * ease);
        ctx.fillStyle = col(last ? C_LAST : C_FULL);
        ctx.fillRect(x, top, bw, sy(0) - top);
      } else {
        // bar rugi: dari level sebelumnya turun ke level baru
        const yPrev = sy(prev * 100), yNow = sy((prev + (st.eta - prev) * ease) * 100);
        ctx.fillStyle = col(C_LOSS);
        ctx.globalAlpha = 0.85;
        ctx.fillRect(x, yPrev, bw, yNow - yPrev);
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = col(C_FULL);
        ctx.fillRect(x, yNow, bw, sy(0) - yNow);
      }
      // garis penghubung level
      if (i < steps.length - 1 && k >= 1) {
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = col(CV.text);
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(x + bw, sy(st.eta * 100)); ctx.lineTo(sx(i + 1.5) - bw / 2, sy(st.eta * 100)); ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = Math.min(1, k * 1.5);
      ctx.fillStyle = col(CV.title);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.font = `600 ${CHART_FONT_NUM}`;
      ctx.fillText(`${fmt(st.eta * 100, 1)}%`, xc, sy(Math.max(st.eta, prev) * 100) - 4);
      if (i > 0) {
        ctx.fillStyle = ink(CV.note);
        ctx.textBaseline = 'top';
        ctx.fillText(`${st.delta < 0 ? '−' : '+'}${fmt(Math.abs(st.delta) * 100, 1)}`, xc, Math.min(sy(st.eta * 100), sy(0) - 14) + 3);
      }
      ctx.fillStyle = col(CV.text);
      ctx.font = CHART_FONT;
      ctx.textBaseline = 'top';
      wrap(ctx, st.label, sx(1) - sx(0) - 4).forEach((ln, j) => ctx.fillText(ln, xc, sy(0) + 5 + j * 14));
      ctx.globalAlpha = 1;
    });
  }

  return {
    /** @param {{label:string, eta:number, delta:number}[]|null} s @param {{title?:string, level?:'ideal'|'real'|'semiEmpirical'|'siteData', basis?:string, caption?:string}} [o] */
    setData(s, o = {}) {
      if (o.title) base.setTitle(o.title);
      if (o.level) base.setLevel(o.level, o.basis);
      if (o.caption != null) base.setCaption(o.caption);
      if (s === lastSteps) return;
      const changedShape = !steps || !s || s.length !== steps.length || s[0]?.label !== steps[0]?.label;
      lastSteps = s;
      steps = s;
      if (changedShape) t0 = performance.now(); // set data baru (jenis berubah) → animasi ulang
      else t0 = Math.min(t0, performance.now() - s.length * STEP_MS); // nilai berubah (slider) → langsung tampil
    },
    replay() { t0 = performance.now(); },
    update() { draw(performance.now()); },
    dispose() { base.dispose(); },
  };
}
