// Transisi antar scene (M8b): fade-through ±350 ms, instan bila prefers-reduced-motion, tidak menyentuh data.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fadeSwap, FADE, prefersReducedMotion } from '../src/ui/transition.js';

const ROOT = new URL('..', import.meta.url).pathname;
const fakeEl = () => { const set = new Set(), log = []; return { log, classList: { add: (c) => { set.add(c); log.push(`+${c}`); }, remove: (c) => { set.delete(c); log.push(`-${c}`); }, contains: (c) => set.has(c) } }; };

describe('transisi fade-through', () => {
  it('durasi total 300–500 ms', () => {
    expect(FADE.outMs + FADE.inMs).toBeGreaterThanOrEqual(300);
    expect(FADE.outMs + FADE.inMs).toBeLessThanOrEqual(500);
  });
  it('urutan: fade out → tunggu → ganti scene → fade in', async () => {
    const el = fakeEl(), waits = [];
    const r = await fadeSwap(el, () => el.log.push('swap'), { reduced: false, wait: async (ms) => { waits.push(ms); el.log.push('wait'); } });
    expect(r).toBe('fade');
    expect(el.log).toEqual(['+is-fading', 'wait', 'swap', '-is-fading']);
    expect(waits).toEqual([FADE.outMs]);
  });
  it('prefers-reduced-motion: instan, tanpa kelas fade dan tanpa menunggu', async () => {
    const el = fakeEl();
    const r = await fadeSwap(el, () => el.log.push('swap'), { reduced: true, wait: async () => { throw new Error('tidak boleh menunggu'); } });
    expect(r).toBe('instant');
    expect(el.log).toEqual(['swap']);
    expect(prefersReducedMotion()).toBe(false); // node: tanpa matchMedia → false, tanpa throw
  });
  it('scene pertama tanpa fade out; kelas fade selalu dilepas walau swap gagal', async () => {
    const el = fakeEl();
    await fadeSwap(el, () => {}, { reduced: false, skipOut: true, wait: async () => { throw new Error('x'); } });
    expect(el.log).toEqual(['-is-fading']);
    const el2 = fakeEl();
    await expect(fadeSwap(el2, () => { throw new Error('mount'); }, { reduced: false, wait: async () => {} })).rejects.toThrow('mount');
    expect(el2.classList.contains('is-fading')).toBe(false);
  });
  it('hanya opacity CSS: modul transisi tidak mengimpor store/derive; CSS menghormati reduced-motion', () => {
    const t = readFileSync(`${ROOT}src/ui/transition.js`, 'utf8');
    expect(t).not.toMatch(/import /);
    const css = readFileSync(`${ROOT}src/styles.css`, 'utf8');
    expect(css).toMatch(/#app\.is-fading \{ opacity: 0;/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ #app, #app\.is-fading \{ transition: none; \} \}/);
  });
});
