/**
 * legend.js — legenda skala suhu (K) untuk warna gas `tempToRGB`, dengan penanda T saat ini.
 * Rentang diambil dari frame.tempScale (sama dengan yang dipakai rig 3D).
 */
import { tempToRGB } from '../model/thermo.js';
import { fmt } from '../ui/format.js';
import { STR } from '../ui/strings.js';

const rgb = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;

/**
 * Tata letak label tick (murni, dapat dites): tick disembunyikan bila terlalu dekat dengan penanda T atau dengan
 * tick tampil di atasnya, sehingga label tidak bertumpuk. @param {{frac:number}[]} ticks frac 0 (atas) … 1 (bawah)
 * @returns {boolean[]} tampil / sembunyi per tick
 */
export function legendTickLayout(ticks, markerFrac, heightPx, { markerGapPx = 16, minGapPx = 14 } = {}) {
  const order = ticks.map((_, i) => i).sort((a, b) => ticks[a].frac - ticks[b].frac); // dari atas ke bawah
  const show = new Array(ticks.length).fill(false);
  let last = null;
  for (const i of order) {
    const f = ticks[i].frac;
    const nearMarker = Math.abs(f - markerFrac) * heightPx < markerGapPx;
    const nearPrev = last != null && (f - last) * heightPx < minGapPx;
    if (!nearMarker && !nearPrev) { show[i] = true; last = f; }
  }
  return show;
}

/** @param {HTMLElement} container */
/** marker = false: tanpa penanda nilai (legenda skala saja, mis. hero landing tanpa angka model). */
export function createTempLegend(container, { title = STR.common.tempLegend, tickStep = 500, marker: withMarker = true, compact = false } = {}) {
  const root = document.createElement('div');
  root.className = compact ? 'temp-legend temp-legend--compact' : 'temp-legend';
  root.innerHTML = '<div class="temp-legend__title"></div><div class="temp-legend__body"><canvas></canvas><div class="temp-legend__ticks num"></div><div class="temp-legend__marker num"></div></div>';
  root.querySelector('.temp-legend__title').textContent = title;
  container.appendChild(root);
  const canvas = root.querySelector('canvas');
  const ticks = root.querySelector('.temp-legend__ticks');
  const marker = root.querySelector('.temp-legend__marker');
  let scaleKey = '';
  /** @type {{el:HTMLElement, frac:number}[]} */
  let tickEls = [];

  function drawScale(min, max) {
    const h = 200, w = 14;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    for (let y = 0; y < h; y++) {
      ctx.fillStyle = rgb(tempToRGB(max - ((max - min) * y) / (h - 1), min, max));
      ctx.fillRect(0, y, w, 1);
    }
    ticks.innerHTML = '';
    tickEls = [];
    for (let T = Math.ceil(min / tickStep) * tickStep; T <= max; T += tickStep) {
      const el = document.createElement('span');
      const frac = 1 - (T - min) / (max - min);
      el.style.top = `${frac * 100}%`;
      el.textContent = T === max ? `${fmt(T, 0)}+` : fmt(T, 0);
      ticks.appendChild(el);
      tickEls.push({ el, frac });
    }
  }

  return {
    update(f) {
      const { min, max } = f.tempScale;
      const k = `${min}|${max}`;
      if (k !== scaleKey) { scaleKey = k; drawScale(min, max); }
      if (!withMarker) { marker.hidden = true; return; }
      const u = Math.min(1, Math.max(0, (f.T - min) / (max - min)));
      marker.style.top = `${(1 - u) * 100}%`;
      // label tick yang menimpa penanda (atau tick lain) disembunyikan
      const show = legendTickLayout(tickEls, 1 - u, ticks.clientHeight || 200);
      tickEls.forEach((t, i) => { t.el.style.visibility = show[i] ? '' : 'hidden'; });
      marker.textContent = `◀ ${fmt(f.T, 0)}`;
    },
    dispose() { root.remove(); },
  };
}
