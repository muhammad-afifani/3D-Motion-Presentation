// Bagian A: tombol "Explore (M)" di mode Present dan panel rumus yang dapat dilipat (default terlipat, pilihan global).
// Perilaku DOM diuji di smoke (scripts/e2e/smoke.mjs); di sini: persistensi, wiring, teks, token CSS tema.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { readSaved, writeSaved, persistDefaults, PERSIST_FIELDS, PERSIST_KEY } from '../src/state/persist.js';
import { displayInitialState } from '../src/state/store.js';
import { GLOBAL_KEYS } from '../src/ui/keys.js';
import { STR } from '../src/ui/strings.js';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(`${ROOT}${p}`, 'utf8');
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };

describe('panel rumus: state dan persistensi', () => {
  it('default terlipat; disimpan di etel:v1; nilai selain boolean atau storage yang melempar → terlipat', () => {
    expect(displayInitialState().formulaOpen).toBe(false);
    expect(persistDefaults().formulaOpen).toBe(false);
    expect(PERSIST_FIELDS).toContain('formulaOpen');
    const st = mem();
    expect(writeSaved(st, { ...displayInitialState(), formulaOpen: true }, 3)).toBe(true);
    expect(readSaved(st, [1, 2, 3]).patch.formulaOpen).toBe(true);
    st.setItem(PERSIST_KEY, JSON.stringify({ v: 1, data: { formulaOpen: 'yes' }, scene: 1 }));
    expect('formulaOpen' in readSaved(st, [1]).patch).toBe(false);
    expect(readSaved(throwing, [1]).patch).toEqual({});
    expect(readSaved(null, [1]).patch).toEqual({});
  });
});

describe('wiring dan teks', () => {
  const main = read('src/main.js'), comp = read('src/ui/formulaToggle.js');
  it('main.js: chip dipasang setelah scene dipasang dan dilepas sebelum scene dibuang; tombol Explore hanya di Present', () => {
    expect(main).toMatch(/current\.mount\(\);\s*formulaToggles = attachFormulaToggles\(app, store\)/);
    expect(main).toMatch(/formulaToggles\?\.dispose\(\); formulaToggles = null;\s*current\?\.dispose\(\)/);
    expect(main).toMatch(/exitPresent\.el\.hidden = mode !== 'present'/);
    expect(main).toMatch(/onClick: \(\) => setMode\('explore'\)/);
    expect(main).toMatch(/exitPresent\.el\.dataset\.snapSkip = ''/);
  });
  it('chip: aria-expanded + aria-controls, tidak ikut ekspor PNG, satu pilihan global di store', () => {
    expect(comp).toMatch(/setAttribute\('aria-expanded', String\(open\)\)/);
    expect(comp).toMatch(/setAttribute\('aria-controls', panel\.id\)/);
    expect(comp).toMatch(/btn\.dataset\.snapSkip = ''/);
    expect(comp).toMatch(/store\.set\(\{ formulaOpen: !store\.get\(\)\.formulaOpen \}\)/);
  });
  it('Scene 7: bingkai kamera mengukur panel rumus seperti saat terbuka (tidak berubah saat dilipat)', () => {
    expect(read('src/scenes/compressor.js')).toMatch(/openPanelRect\(q\('\.overlay--aff'\)\)/);
    expect(comp).toMatch(/export function openPanelRect/);
  });
  it('tidak ada tombol cepat baru; teks dari strings.js', () => {
    expect(GLOBAL_KEYS).toEqual(['f', 'r', '1', '2', '3', '4', 'h', '?', 'g', 'm', 'p', 's', 'q', 'b', 'k']);
    expect(STR.nav.exitPresent).toBe('Explore');
    expect(STR.nav.modeKey).toBe('M');
    expect(STR.formula.label).toBe('Formula');
    expect(STR.formula.show).toMatch(/applies to every scene/);
  });
});

describe('CSS: warna chip dan tombol lewat token tema (bagian B cukup menimpa token)', () => {
  const css = read('src/styles.css');
  const block = css.slice(css.indexOf('/* ── Bagian A:'));
  it('token didefinisikan di :root', () => {
    for (const t of ['--float-bg', '--float-bg-hover', '--float-fg', '--float-muted', '--float-border', '--float-accent', '--focus-ring']) expect(css, t).toMatch(new RegExp(`${t}:`));
  });
  it('aturan bagian A tidak memakai warna tetap (hex / rgb)', () => {
    expect(block.length).toBeGreaterThan(100);
    expect(block).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });
  it('fokus terlihat; chip tetap ada di Present (samar, jelas saat difokus)', () => {
    expect(block).toMatch(/\.f-toggle:focus-visible \{ outline: 2px solid var\(--focus-ring\)/);
    expect(block).toMatch(/\.mode-present \.f-toggle \{[^}]*opacity: 0\.6/);
    expect(block).toMatch(/\.mode-present \.f-toggle:focus-visible/);
  });
});
