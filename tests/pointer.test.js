// Laser pointer & spotlight (M8b, opsional): toggle K / Shift+K / Esc; tidak menghalangi klik; tidak ikut snapshot.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { nextPointerMode, POINTER_MODES } from '../src/ui/pointer.js';
import { STR } from '../src/ui/strings.js';

const ROOT = new URL('..', import.meta.url).pathname;
describe('laser pointer & spotlight', () => {
  it('K ↔ laser, Shift+K ↔ spotlight, Esc mematikan; pindah langsung antar mode', () => {
    expect(nextPointerMode('off')).toBe('laser');
    expect(nextPointerMode('laser')).toBe('off');
    expect(nextPointerMode('off', { shift: true })).toBe('spotlight');
    expect(nextPointerMode('laser', { shift: true })).toBe('spotlight');
    expect(nextPointerMode('spotlight', { shift: true })).toBe('off');
    expect(nextPointerMode('spotlight', { escape: true })).toBe('off');
    for (const m of POINTER_MODES) expect(STR.app.toast.pointer[m]).toBeTruthy();
  });
  it('overlay pointer-events none dan dikecualikan dari snapshot ([data-snap-skip])', () => {
    const css = readFileSync(`${ROOT}src/styles.css`, 'utf8');
    expect(css).toMatch(/\.ptr \{ position: fixed; inset: 0; z-index: 70; pointer-events: none;/);
    expect(readFileSync(`${ROOT}src/ui/pointer.js`, 'utf8')).toMatch(/dataset\.snapSkip/);
    expect(readFileSync(`${ROOT}src/gfx/snapshotPaint.js`, 'utf8')).toMatch(/\[data-snap-skip\]/);
  });
});
