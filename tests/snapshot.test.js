// Snapshot PNG (M8a): jalur normal, jalur gagal teks DOM → PNG canvas saja + toast jelas, gagal total → toast.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { runSnapshot, snapshotFileName, SNAPSHOT_SCALE } from '../src/ui/snapshot.js';
import { STR } from '../src/ui/strings.js';

const ROOT = new URL('..', import.meta.url).pathname;

function steps(over = {}) {
  const log = [];
  let n = 0;
  const s = {
    prepare: async () => { log.push('prepare'); },
    restore: () => log.push('restore'),
    createCanvas: () => ({ id: ++n }),
    drawBackground: (c) => log.push(`bg${c.id}`),
    drawDom: (c) => log.push(`dom${c.id}`),
    drawCanvases: (c) => log.push(`canvas${c.id}`),
    drawFooter: (c, canvasOnly) => log.push(`footer${c.id}:${canvasOnly}`),
    save: async (c) => log.push(`save${c.id}`),
    ...over,
  };
  return { s, log };
}

describe('snapshot PNG', () => {
  it('skala 2×; nama berkas memuat nomor scene dan waktu', () => {
    expect(SNAPSHOT_SCALE).toBe(2);
    expect(snapshotFileName(6, new Date(2026, 9, 14, 8, 5))).toBe('etel-scene-06-20261014-0805.png');
  });
  it('jalur normal: DOM (teks + canvas) dilukis, skala dikembalikan, toast berhasil', async () => {
    const { s, log } = steps();
    const toasts = [];
    const r = await runSnapshot(s, { toast: (m) => toasts.push(m), fileName: 'a.png' });
    expect(r).toEqual({ ok: true, mode: 'full' });
    expect(log).toEqual(['prepare', 'bg1', 'dom1', 'footer1:false', 'restore', 'save1']);
    expect(toasts).toEqual([STR.snapshot.saved('a.png')]);
  });
  it('teks DOM gagal digabung → PNG canvas saja (canvas baru) + toast yang menjelaskan, tidak diam-diam', async () => {
    const { s, log } = steps({ drawDom: () => { throw new Error('SecurityError'); } });
    const toasts = [];
    const r = await runSnapshot(s, { toast: (m) => toasts.push(m), fileName: 'b.png' });
    expect(r).toEqual({ ok: true, mode: 'canvasOnly' });
    expect(log).toEqual(['prepare', 'bg1', 'bg2', 'canvas2', 'footer2:true', 'restore', 'save2']);
    expect(toasts).toEqual([STR.snapshot.canvasOnly('b.png')]);
    expect(toasts[0]).toMatch(/canvas/);
  });
  it('gagal total (ekspor ditolak) → toast gagal; skala tetap dikembalikan', async () => {
    const toasts = [];
    const a = steps({ save: async () => { throw new Error('toBlob null'); } });
    expect(await runSnapshot(a.s, { toast: (m) => toasts.push(m), fileName: 'c.png' })).toEqual({ ok: false, mode: 'failed' });
    expect(a.log).toContain('restore');
    const b = steps({ prepare: async () => { throw new Error('x'); } });
    expect(await runSnapshot(b.s, { toast: (m) => toasts.push(m), fileName: 'c.png' })).toEqual({ ok: false, mode: 'failed' });
    expect(b.log).toEqual(['restore']);
    expect(toasts).toEqual([STR.snapshot.failed, STR.snapshot.failed]);
  });
  it('footer gagal tidak menggagalkan snapshot', async () => {
    const { s } = steps({ drawFooter: () => { throw new Error('font'); } });
    expect((await runSnapshot(s, { toast: () => {}, fileName: 'd.png' })).ok).toBe(true);
  });
  it('panel H, panel presenter, dan toast tidak ikut; renderer & grafik punya skala ekspor', () => {
    expect(readFileSync(`${ROOT}src/gfx/snapshotPaint.js`, 'utf8')).toMatch(/SNAP_SKIP = '\.asm, \.pres-host, \.toast/);
    expect(readFileSync(`${ROOT}src/gfx/renderer.js`, 'utf8')).toMatch(/export function setRendererExportScale/);
    expect(readFileSync(`${ROOT}src/charts/chartBase.js`, 'utf8')).toMatch(/export function setChartExportScale/);
    expect(readFileSync(`${ROOT}src/main.js`, 'utf8')).toMatch(/case 's': snapshot\(\)/);
  });
});
