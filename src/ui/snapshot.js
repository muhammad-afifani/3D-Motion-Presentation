/**
 * snapshot.js — snapshot PNG tampilan scene saat ini (tombol S): canvas 3D + grafik + teks DOM (HUD, judul, pesan
 * kunci, caption, basis, label tingkat model), resolusi 2×, tema gelap. Tanpa dependensi: renderer & grafik
 * digambar ulang sementara pada skala 2, lalu pohon DOM dilukis ke satu canvas (latar, border, canvas, teks).
 *
 * Bila melukis teks DOM gagal → PNG berisi canvas saja (3D + grafik) dan toast yang menjelaskannya (tidak diam-diam).
 * Panel H, panel presenter, dan toast tidak ikut. Tidak menghitung model: hanya menyalin apa yang tampil.
 */
import { STR } from './strings.js';
import { dateTime } from './format.js';
import { setRendererExportScale } from '../gfx/renderer.js';
import { setChartExportScale } from '../charts/chartBase.js';
import { paintDom, paintCanvases, paintFooter, pageBackground, savePng } from '../gfx/snapshotPaint.js';

const T = STR.snapshot;
export const SNAPSHOT_SCALE = 2;
const FOOTER_H = 30;

/** Nama berkas: etel-scene-06-20261014-0830.png (diekspor untuk tes). */
export function snapshotFileName(sceneNumber, d = new Date()) {
  const two = (x) => String(x).padStart(2, '0');
  return `etel-scene-${two(sceneNumber)}-${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}.png`;
}

/**
 * Orkestrasi (logika murni; langkah di-inject agar jalur gagal bisa dites).
 * @param {{prepare:()=>Promise<void>|void, restore:()=>void, createCanvas:()=>any, drawBackground:(c:any)=>void,
 *   drawDom:(c:any)=>void, drawCanvases:(c:any)=>void, drawFooter:(c:any, canvasOnly:boolean)=>void, save:(c:any)=>Promise<void>|void}} s
 * @param {{toast:(m:string)=>void, fileName:string}} o
 * @returns {Promise<{ok:boolean, mode:'full'|'canvasOnly'|'failed'}>}
 */
export async function runSnapshot(s, { toast, fileName }) {
  let canvas, mode = 'full';
  try {
    await s.prepare();
    canvas = s.createCanvas();
    s.drawBackground(canvas);
    try {
      s.drawDom(canvas);                 // latar, border, canvas 3D/grafik, dan teks dalam urutan DOM
    } catch (err) {
      console.warn('[snapshot] canvasOnly', err);
      mode = 'canvasOnly';
      canvas = s.createCanvas();
      s.drawBackground(canvas);
      s.drawCanvases(canvas);
    }
    try { s.drawFooter(canvas, mode === 'canvasOnly'); } catch { /* footer opsional */ }
  } catch (err) {
    console.warn('[snapshot] failed', err);
    s.restore();
    toast(T.failed);
    return { ok: false, mode: 'failed' };
  }
  s.restore();
  try {
    await s.save(canvas);
  } catch (err) {
    console.warn('[snapshot] save failed', err);
    toast(T.failed);
    return { ok: false, mode: 'failed' };
  }
  toast(mode === 'full' ? T.saved(fileName) : T.canvasOnly(fileName));
  return { ok: true, mode };
}

const nextFrame = () => new Promise((res) => requestAnimationFrame(() => res()));

/**
 * Snapshot tampilan saat ini. @param {{sceneNumber:number, sceneTag:string, toast:(m:string)=>void}} o
 */
export function takeSnapshot({ sceneNumber, sceneTag, toast }) {
  const k = SNAPSHOT_SCALE, root = document.body;
  const W = window.innerWidth, H = window.innerHeight;
  const fileName = snapshotFileName(sceneNumber);
  const ctxOf = (c) => c.getContext('2d');
  return runSnapshot({
    async prepare() {
      setRendererExportScale(k);
      setChartExportScale(k);
      await nextFrame(); await nextFrame(); // scene.update menggambar ulang 3D & grafik pada skala 2×
    },
    restore() { setRendererExportScale(null); setChartExportScale(null); },
    createCanvas() {
      const c = document.createElement('canvas');
      c.width = W * k; c.height = (H + FOOTER_H) * k;
      return c;
    },
    drawBackground(c) {
      const ctx = ctxOf(c);
      ctx.fillStyle = pageBackground();
      ctx.fillRect(0, 0, c.width, c.height);
    },
    drawDom(c) { paintDom(ctxOf(c), root, k); },
    drawCanvases(c) { paintCanvases(ctxOf(c), root, k); },
    drawFooter(c, canvasOnly) {
      paintFooter(ctxOf(c), T.footer(sceneTag, dateTime(new Date()), canvasOnly), { x: 16 * k, y: (H + FOOTER_H / 2) * k, maxWidth: (W - 32) * k, k });
    },
    save: (c) => savePng(c, fileName),
  }, { toast, fileName });
}
