// Tombol cepat global (H, ?, G, …): G tidak bentrok dengan tombol lain, dan semua tombol cepat mati saat fokus
// ada di kolom isian (input, select, textarea, contenteditable). Slider (range) tetap mengizinkan tombol cepat.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { isTypingTarget, GLOBAL_KEYS } from '../src/ui/keys.js';
import { STR } from '../src/ui/strings.js';
import { isRegulationsHash, REGULATIONS_HASH } from '../src/ui/regulationsPage.js';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('isTypingTarget', () => {
  it('kolom isian → true (tombol cepat diabaikan)', () => {
    for (const t of [{ tagName: 'INPUT', type: 'text' }, { tagName: 'INPUT', type: 'number' }, { tagName: 'INPUT' }, { tagName: 'SELECT' }, { tagName: 'TEXTAREA' }, { tagName: 'DIV', isContentEditable: true }]) {
      expect(isTypingTarget(t), JSON.stringify(t)).toBe(true);
    }
  });
  it('slider, tombol, elemen biasa, null → false (tombol cepat aktif)', () => {
    for (const t of [{ tagName: 'INPUT', type: 'range' }, { tagName: 'BUTTON' }, { tagName: 'DIV' }, { tagName: 'BODY' }, null, undefined, window_like()]) {
      expect(isTypingTarget(t), JSON.stringify(t)).toBe(false);
    }
  });
  function window_like() { return { document: {} }; }
});

describe('main.js: penjaga dan daftar tombol', () => {
  const src = strip(read('src/main.js'));
  const handler = src.slice(src.indexOf("window.addEventListener('keydown', (e) => {\n  if (e.ctrlKey"));
  it('penjaga isTypingTarget berjalan sebelum semua tombol cepat (scene onKey, Shift+D, K, switch)', () => {
    const guard = handler.indexOf('isTypingTarget(e.target)');
    expect(guard).toBeGreaterThan(0);
    for (const marker of ["persist.resetStartScene()", 'current?.onKey?.(e)', 'debugOverlay.toggle()', "key === 'k'", 'switch (key)']) {
      expect(handler.indexOf(marker), marker).toBeGreaterThan(guard);
    }
    expect(src).not.toMatch(/instanceof HTMLInputElement/); // penjaga lama (hanya input) diganti
  });
  it('setiap case satu karakter unik; daftar sama dengan GLOBAL_KEYS; G membuka Regulations', () => {
    const cases = [...handler.matchAll(/case '(.)':/g)].map((m) => m[1]).filter((k) => k !== ' ');
    expect(new Set(cases).size).toBe(cases.length);
    const all = [...cases, 'k'].sort();
    expect(all).toEqual([...GLOBAL_KEYS].sort());
    expect(handler).toMatch(/case 'g': regulations\.toggle\(\)/);
    expect(STR.regulation.page.key).toBe('G');
  });
  it('tidak ada scene yang memakai G atau ? sebagai tombolnya sendiri', () => {
    for (const f of readdirSync(join(ROOT, 'src/scenes')).filter((x) => x.endsWith('.js'))) {
      const s = strip(read(`src/scenes/${f}`));
      const used = [...s.matchAll(/(?:\bk|e\.key(?:\.toLowerCase\(\))?)\s*===\s*'(.)'/g)].map((m) => m[1].toLowerCase());
      expect(used.filter((k) => k === 'g' || k === '?'), f).toEqual([]);
    }
  });
  it('jendela presenter juga mengabaikan tombol saat mengetik', () => {
    expect(strip(read('src/presenter.js'))).toMatch(/isTypingTarget\(e\.target\)/);
  });
  it('alamat #/regulations', () => {
    expect(REGULATIONS_HASH).toBe('#/regulations');
    expect(isRegulationsHash('#/regulations')).toBe(true);
    expect(isRegulationsHash('#/references')).toBe(false);
    expect(isRegulationsHash('')).toBe(false);
  });
});
