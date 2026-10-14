/**
 * legend.js — legenda skala suhu (K) untuk warna gas `tempToRGB`, dengan penanda T saat ini.
 * Rentang diambil dari frame.tempScale (sama dengan yang dipakai rig 3D).
 */
import { tempToRGB } from '../model/thermo.js';
import { fmt } from '../ui/format.js';
import { STR } from '../ui/strings.js';

const rgb = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;

/** @param {HTMLElement} container */
export function createTempLegend(container, { title = STR.common.tempLegend, tickStep = 500 } = {}) {
  const root = document.createElement('div');
  root.className = 'temp-legend';
  root.innerHTML = '<div class="temp-legend__title"></div><div class="temp-legend__body"><canvas></canvas><div class="temp-legend__ticks num"></div><div class="temp-legend__marker num"></div></div>';
  root.querySelector('.temp-legend__title').textContent = title;
  container.appendChild(root);
  const canvas = root.querySelector('canvas');
  const ticks = root.querySelector('.temp-legend__ticks');
  const marker = root.querySelector('.temp-legend__marker');
  let scaleKey = '';

  function drawScale(min, max) {
    const h = 200, w = 14;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    for (let y = 0; y < h; y++) {
      ctx.fillStyle = rgb(tempToRGB(max - ((max - min) * y) / (h - 1), min, max));
      ctx.fillRect(0, y, w, 1);
    }
    ticks.innerHTML = '';
    for (let T = Math.ceil(min / tickStep) * tickStep; T <= max; T += tickStep) {
      const el = document.createElement('span');
      el.style.top = `${(1 - (T - min) / (max - min)) * 100}%`;
      el.textContent = T === max ? `${fmt(T, 0)}+` : fmt(T, 0);
      ticks.appendChild(el);
    }
  }

  return {
    update(f) {
      const { min, max } = f.tempScale;
      const k = `${min}|${max}`;
      if (k !== scaleKey) { scaleKey = k; drawScale(min, max); }
      const u = Math.min(1, Math.max(0, (f.T - min) / (max - min)));
      marker.style.top = `${(1 - u) * 100}%`;
      marker.textContent = `◀ ${fmt(f.T, 0)}`;
    },
    dispose() { root.remove(); },
  };
}
