/**
 * braytonSchematic.js — skema 2D sederhana Brayton (kompresor → combustor → turbin) sebagai
 * penanda state 1–4 dan posisi titik berjalan. BUKAN rig turbin (rig 3D di Scene 5 / M5).
 * Warna stasiun & titik = frame.schematic (tempToRGB dihitung di derive). Skema tampil di atas viewport 3D arang
 * (`.vp-scope`), jadi token warnanya tetap bernilai gelap di kedua tema.
 */
import { createChartBase, CHART_FONT, CV } from './chartBase.js';
import { fmt } from '../ui/format.js';
import { STR } from '../ui/strings.js';

const S = STR.charts.brayton;

const rgb = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;

/** @param {HTMLElement} container */
export function createBraytonSchematic(container, { basis = null } = {}) {
  const base = createChartBase(container, { title: S.title, modelLevel: 'ideal', basis, pad: { l: 20, r: 20, t: 50, b: 30 } });
  const { col } = base;
  base.setCaption(S.note);

  /** Lintasan aliran: 4 ruas (1→2 kompresor, 2→3 combustor, 3→4 turbin, 4→1 lingkungan). */
  function layout() {
    const { w, h } = base.box;
    const cy = h * 0.55, L = 36, R = w - 128, span = R - L; // kanan: ruang legenda suhu
    const xc0 = L + span * 0.05, xc1 = L + span * 0.33, xb0 = L + span * 0.40, xb1 = L + span * 0.60, xt0 = L + span * 0.67, xt1 = L + span * 0.95;
    const hBig = Math.min(h * 0.42, 150), hSmall = hBig * 0.42, yRet = Math.min(h - 40, cy + hBig * 0.5 + 46);
    const P = { 1: [xc0, cy], 2: [xc1, cy], 3: [xt0, cy], 4: [xt1, cy] };
    const segs = [
      [[xc0, cy], [xc1, cy]],
      [[xc1, cy], [xb0, cy], [xb1, cy], [xt0, cy]],
      [[xt0, cy], [xt1, cy]],
      [[xt1, cy], [xt1 + span * 0.03, cy], [xt1 + span * 0.03, yRet], [xc0 - span * 0.03, yRet], [xc0 - span * 0.03, cy], [xc0, cy]],
    ];
    return { cy, xc0, xc1, xb0, xb1, xt0, xt1, hBig, hSmall, yRet, P, segs };
  }

  /** Titik pada polyline pada fraksi t panjang. */
  function along(pts, t) {
    let total = 0;
    const d = [];
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); d.push(l); total += l; }
    let rem = t * total;
    for (let i = 0; i < d.length; i++) {
      if (rem <= d[i] || i === d.length - 1) { const u = d[i] ? Math.min(1, rem / d[i]) : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u]; }
      rem -= d[i];
    }
    return pts[pts.length - 1];
  }

  return {
    /** @param {any} f frame Scene 2 (Brayton) */
    update(f) {
      const sc = f.schematic;
      if (!sc) return;
      base.setLevel(f.modelLevel, f.basis);
      base.beginStatic();
      const ctx = base.beginDynamic();
      const g = layout();
      const st = sc.stations;
      // poros
      ctx.strokeStyle = col(CV.pipe);
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(g.xc0 - 10, g.cy); ctx.lineTo(g.xt1 + 10, g.cy); ctx.stroke();
      // kompresor (menyempit) & turbin (melebar), isi gradasi suhu stasiun
      const trap = (x0, x1, h0, h1, c0, c1, label) => {
        const grad = ctx.createLinearGradient(x0, 0, x1, 0);
        grad.addColorStop(0, rgb(c0)); grad.addColorStop(1, rgb(c1));
        ctx.fillStyle = grad;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(x0, g.cy - h0 / 2); ctx.lineTo(x1, g.cy - h1 / 2); ctx.lineTo(x1, g.cy + h1 / 2); ctx.lineTo(x0, g.cy + h0 / 2); ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = col(CV.title); ctx.lineWidth = 1.2; ctx.stroke();
        ctx.fillStyle = col(CV.title); ctx.font = `600 ${CHART_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(label, (x0 + x1) / 2, g.cy - Math.max(h0, h1) / 2 - 6);
      };
      trap(g.xc0, g.xc1, g.hBig, g.hSmall, st[0].rgb, st[1].rgb, S.compressor);
      trap(g.xt0, g.xt1, g.hSmall, g.hBig, st[2].rgb, st[3].rgb, S.turbine);
      // combustor
      const grad = ctx.createLinearGradient(g.xb0, 0, g.xb1, 0);
      grad.addColorStop(0, rgb(st[1].rgb)); grad.addColorStop(1, rgb(st[2].rgb));
      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.roundRect(g.xb0, g.cy - g.hSmall * 0.75, g.xb1 - g.xb0, g.hSmall * 1.5, 10); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = col(CV.title); ctx.stroke();
      ctx.fillStyle = col(CV.title); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(S.combustor, (g.xb0 + g.xb1) / 2, g.cy - g.hSmall * 0.75 - 6);
      // lintasan aliran (ruas aktif disorot)
      g.segs.forEach((seg, i) => {
        ctx.save();
        ctx.strokeStyle = i === sc.proc ? col(CV.ring) : col(CV.path);
        ctx.lineWidth = i === sc.proc ? 2.5 : 1.5;
        if (i === 3) ctx.setLineDash([5, 5]);
        ctx.beginPath(); seg.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
        ctx.restore();
      });
      ctx.fillStyle = col(CV.text); ctx.font = CHART_FONT; ctx.textBaseline = 'top';
      ctx.fillText(S.returnPath, (g.xc0 + g.xt1) / 2, g.yRet + 6);
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText(S.note, 12, base.box.h - 8);
      ctx.textAlign = 'center';
      // penanda state 1–4
      for (let i = 0; i < 4; i++) {
        const [x, y] = g.P[i + 1];
        ctx.fillStyle = col(CV.hollow); ctx.strokeStyle = col(CV.title); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = col(CV.title); ctx.font = `700 ${CHART_FONT}`; ctx.textBaseline = 'middle';
        ctx.fillText(st[i].label, x, y + 0.5);
        ctx.font = CHART_FONT; ctx.fillStyle = col(CV.text); ctx.textBaseline = 'top';
        ctx.fillText(`${fmt(st[i].T, 0)} K`, x, y + g.hBig * 0.5 + 6);
      }
      // titik berjalan
      const [px, py] = along(g.segs[sc.proc], sc.t);
      ctx.fillStyle = rgb(sc.gasRGB); ctx.strokeStyle = col(CV.ring); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    },
    dispose() { base.dispose(); },
  };
}
