/**
 * cycleChart.js — diagram siklus (P-v atau T-s) dari frame Scene 2.
 * Kurva = frame.procs (polyline per proses), pembanding tipis = frame.ghost, titik state berlabel
 * (hover → T, P, v, s), titik berjalan = frame.point (di polyline yang sama).
 * Konversi satuan hanya di sini: P → bar, s → kJ/(kg·K).
 */
import { createChartBase, makeScale, niceTicks, drawAxes, CHART_FONT } from './chartBase.js';
import { STR } from '../ui/strings.js';

const S = STR.charts.cycle;

const AXES = {
  pv: { x: 'v', y: 'P', ...S.pv },
  ts: { x: 's', y: 'T', ...S.ts },
};
const conv = { v: (x) => x, P: (x) => x / 1e5, T: (x) => x, s: (x) => x / 1e3 };

/** Warna per peran proses (kompresi dingin → pemanasan panas → ekspansi → buang); peran dari derive. */
const ROLE_COLOR = {
  closing: 'rgba(120,170,230,0.6)', real: '#ffb15c', compression: '#7cc4ff', rejection: '#5fd0c7', heat: '#ff7a3c', expansion: '#ffcc66',
};

/** Teks tooltip state (catatan titik acuan real dari STR.scene2.refNotes). */
export const stateInfo = (st) => S.stateInfo(st.label, st.noteKey ? STR.scene2.refNotes[st.noteKey] : '', st.T, st.P, st.v, st.s);

/**
 * @param {HTMLElement} container
 * @param {'pv'|'ts'} which
 * @param {{onHover?: (idx:number|null) => void}} [opts]
 */
export function createCycleChart(container, which, { onHover } = {}) {
  const ax = AXES[which];
  const base = createChartBase(container, { title: ax.title, modelLevel: 'ideal', pad: { l: 58, r: 18, t: 58, b: 40 } });
  const tip = document.createElement('div');
  tip.className = 'chart__tip num';
  tip.hidden = true;
  base.root.appendChild(tip);

  let data = null, sx = null, sy = null, hover = null, lastKey = null;
  const X = (pr, i) => sx(conv[ax.x](pr[ax.x][i]));
  const Y = (pr, i) => sy(conv[ax.y](pr[ax.y][i]));

  function extent(procsList) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const procs of procsList) for (const pr of procs ?? []) {
      for (let i = 0; i < pr.v.length; i++) {
        const x = conv[ax.x](pr[ax.x][i]), y = conv[ax.y](pr[ax.y][i]);
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    return { x0, x1, y0, y1 };
  }

  function drawStatic() {
    const ctx = base.beginStatic();
    const { box } = base;
    const e = extent([data.procs, data.ghost]);
    const xl = which === 'pv' ? 0 : e.x0 - 0.06 * (e.x1 - e.x0);
    const xr = e.x1 + 0.06 * (e.x1 - e.x0);
    const yb = which === 'pv' ? 0 : Math.max(0, e.y0 - 0.08 * (e.y1 - e.y0));
    const yt = e.y1 * 1.08;
    sx = makeScale(xl, xr, box.pad.l, box.w - box.pad.r);
    sy = makeScale(yb, yt, box.h - box.pad.b, box.pad.t);
    drawAxes(ctx, box, sx, sy, { xTicks: niceTicks(xl, xr, 6), yTicks: niceTicks(yb, yt, 5), xLabel: ax.xLabel, yLabel: ax.yLabel });

    const stroke = (pr, color, width, dash = []) => {
      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < pr.v.length; i++) (i ? ctx.lineTo(X(pr, i), Y(pr, i)) : ctx.moveTo(X(pr, i), Y(pr, i)));
      ctx.stroke();
      ctx.restore();
    };
    for (const pr of data.ghost ?? []) stroke(pr, 'rgba(230,235,243,0.35)', 1.5, [5, 4]);
    data.procs.forEach((pr) => stroke(pr, ROLE_COLOR[pr.role], pr.role === 'closing' ? 1.5 : 2.5, pr.role === 'closing' ? [4, 4] : []));

    // titik state berlabel
    ctx.font = `600 ${CHART_FONT}`;
    data.states.forEach((st, i) => {
      const x = sx(conv[ax.x](st[ax.x])), y = sy(conv[ax.y](st[ax.y]));
      ctx.fillStyle = i === hover ? '#ffffff' : '#0b0f16';
      ctx.strokeStyle = '#e6ebf3';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, i === hover ? 7 : 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e6ebf3';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(st.label, x + 7, y - 4);
    });

    const legend = [];
    if (data.ghost) legend.push(`<span class="sw sw--line" style="background:rgba(230,235,243,0.5)"></span>${S.ghost}`);
    if (data.procs.some((p) => p.role === 'closing')) legend.push(`<span class="sw sw--line" style="background:rgba(120,170,230,0.8)"></span>${S.closing}`);
    base.setCaption(legend.join(' · ') || S.hoverHint);
  }

  function showTip(i) {
    if (i == null || !data) { tip.hidden = true; return; }
    const st = data.states[i];
    tip.textContent = stateInfo(st);
    tip.hidden = false;
    const x = sx(conv[ax.x](st[ax.x])), y = sy(conv[ax.y](st[ax.y]));
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = `${Math.min(base.box.w - w - 8, x + 12)}px`;
    tip.style.top = `${Math.max(30, y - h - 10)}px`;
  }

  function setHover(i, notify = true) {
    if (i === hover) return;
    hover = i;
    if (data) drawStatic();
    showTip(i);
    if (notify) onHover?.(i);
  }

  const onMove = (ev) => {
    if (!data || !sx) return;
    const r = base.root.getBoundingClientRect();
    const mx = ev.clientX - r.left, my = ev.clientY - r.top;
    let best = null, bd = 14 * 14;
    data.states.forEach((st, i) => {
      const dx = sx(conv[ax.x](st[ax.x])) - mx, dy = sy(conv[ax.y](st[ax.y])) - my, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    });
    setHover(best);
  };
  const onLeave = () => setHover(null);
  base.root.addEventListener('mousemove', onMove);
  base.root.addEventListener('mouseleave', onLeave);

  return {
    /** @param {any} f frame Scene 2 */
    update(f) {
      const key = f.procs;
      if (key !== lastKey || f.ghost !== data?.ghost || base.dirty) {
        lastKey = key;
        data = { procs: f.procs, ghost: f.ghost, states: f.states };
        base.setLevel(f.modelLevel);
        if (hover != null && hover >= f.states.length) hover = null;
        drawStatic();
        showTip(hover);
      }
      const ctx = base.beginDynamic();
      if (!f.point.visible) return;
      const x = sx(conv[ax.x](f.point[ax.x])), y = sy(conv[ax.y](f.point[ax.y]));
      ctx.fillStyle = `rgb(${(f.pointRGB ?? f.rig?.gasRGB ?? f.schematic?.gasRGB ?? [1, 1, 1]).map((c) => Math.round(c * 255)).join(',')})`;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    },
    /** Sorot state dari chart lain (sinkron P-v ↔ T-s). */
    highlight(i) { setHover(i, false); },
    dispose() {
      base.root.removeEventListener('mousemove', onMove);
      base.root.removeEventListener('mouseleave', onLeave);
      base.dispose();
    },
  };
}
