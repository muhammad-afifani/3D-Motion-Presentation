/**
 * chartGuideButton.js — tombol ⓘ "How to read this chart" (M11 Step 03). Dipasang oleh chartBase di tiap grafik (baris
 * judul, di kiri tag Basis), oleh panel Limits Scene 9, dan di samping tag Basis skematik Brayton. Klik: mencocokkan judul
 * yang sedang tampil dengan learn.charts (state/chartGuide.js), mengingat alamat scene asal untuk "← Back to the chart",
 * lalu membuka #/learn/charts/<id>. Judul tanpa panduan membuka indeks. Tersembunyi di Present (CSS) dan tidak ikut PNG
 * (data-snap-skip). Label dua bahasa lewat tr() dan langStore.
 */
import { STR } from './strings.js';
import { tr } from '../state/lang.js';
import { langStore } from '../state/langStore.js';
import { learnReady } from '../state/learnStore.js';
import { learnHash } from '../state/route.js';
import { guideIdForTitle, setChartOrigin, clearChartOrigin } from '../state/chartGuide.js';

const G = STR.bi.chartGuide;

/** Buka panduan untuk judul grafik yang tampil. @param {string} title @param {Window} [win] */
export async function openChartGuide(title, win = window) {
  const r = await learnReady();
  const id = guideIdForTitle(title, r?.data?.charts ?? []);
  if (id) setChartOrigin(win.location.hash, id); else clearChartOrigin();
  win.location.hash = learnHash('charts', id);
}

/**
 * @param {{getTitle:() => string}} o getTitle dibaca saat klik (judul grafik bisa berganti menurut mode)
 * @returns {{el:HTMLButtonElement, dispose:() => void}}
 */
export function createGuideButton({ getTitle }) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'chart__guide';
  el.dataset.snapSkip = '';
  const paint = (lang) => {
    el.textContent = tr(G.icon, lang);
    el.dataset.tip = tr(G.tip, lang);
    el.setAttribute('aria-label', tr(G.tip, lang));
  };
  paint(langStore.lang);
  el.addEventListener('click', () => { openChartGuide(getTitle()); });
  const unsub = langStore.subscribe(paint);
  return { el, dispose: () => { unsub?.(); el.remove(); } };
}
