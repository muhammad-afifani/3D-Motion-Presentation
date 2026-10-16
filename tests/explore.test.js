// M9 Step 06: mode Explore / Present, router hash, navigasi.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseHash, sceneHash, pageHash, PAGES, SCENE9_TAB_SLUGS } from '../src/state/route.js';
import { readMode, saveMode, otherMode, modeStorage, readNavCollapsed, saveNavCollapsed, arrowsChangeScene, MODE_KEY, NAV_COLLAPSE_BELOW } from '../src/state/mode.js';
import { POLICY } from '../src/model/presets.js';
import { GLOBAL_KEYS } from '../src/ui/keys.js';
import { STR } from '../src/ui/strings.js';

const ROOT = new URL('..', import.meta.url).pathname;
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };

describe('router hash', () => {
  it('scene 1–11, tab Scene 9 lewat slug; scene di luar daftar → null', () => {
    expect(parseHash('#/scene/6')).toEqual({ type: 'scene', n: 6, tab: null });
    expect(parseHash('#/scene/9/levers')).toEqual({ type: 'scene', n: 9, tab: 'levers' });
    expect(parseHash('#/scene/9/load-window')).toEqual({ type: 'scene', n: 9, tab: 'C' });
    expect(parseHash('#/scene/9/ghg')).toEqual({ type: 'scene', n: 9, tab: 'B' });
    expect(parseHash('#/scene/9/unknown')).toEqual({ type: 'scene', n: 9, tab: null });
    expect(parseHash('#/scene/6/levers')).toEqual({ type: 'scene', n: 6, tab: null }); // tab hanya Scene 9
    expect(parseHash('#/scene/12')).toBeNull(); expect(parseHash('#/scene/0')).toBeNull();
    expect(parseHash('#/scene/3/')).toEqual({ type: 'scene', n: 3, tab: null });
  });
  it('slug tab = semua tab Scene 9; sceneHash ↔ parseHash bolak-balik', () => {
    expect(Object.values(SCENE9_TAB_SLUGS).sort()).toEqual([...POLICY.tabs].sort());
    for (const t of POLICY.tabs) expect(parseHash(sceneHash(9, t))).toEqual({ type: 'scene', n: 9, tab: t });
    expect(sceneHash(9, 'C')).toBe('#/scene/9/load-window');
    expect(sceneHash(4, 'levers')).toBe('#/scene/4');
  });
  it('halaman penuh; References dengan id; alamat lain → null', () => {
    expect(PAGES).toEqual(['regulations', 'formation', 'references', 'glossary', 'assumptions']);
    for (const p of PAGES) expect(parseHash(pageHash(p))).toEqual({ type: 'page', page: p, id: null });
    expect(parseHash('#/references/heywood')).toEqual({ type: 'page', page: 'references', id: 'heywood' });
    expect(parseHash('#/glossary/x')).toBeNull();
    for (const h of ['', '#', '#/', '#/nope', 'scene/3', '#scene/3', null, undefined]) expect(parseHash(h), String(h)).toBeNull();
  });
});

describe('mode Explore / Present', () => {
  it('default Explore; simpan dan baca; storage kosong / diblokir / rusak → default tanpa galat', () => {
    const st = mem();
    expect(readMode(st)).toBe('explore');
    expect(saveMode(st, 'present')).toBe(true);
    expect(readMode(st)).toBe('present');
    expect(st.m.get(MODE_KEY)).toBe('present');
    st.setItem(MODE_KEY, 'weird');
    expect(readMode(st)).toBe('explore');
    expect(readMode(null)).toBe('explore'); expect(readMode(throwing)).toBe('explore');
    expect(saveMode(throwing, 'present')).toBe(false); expect(saveMode(st, 'x')).toBe(false);
    expect(modeStorage(() => { throw new Error('denied'); })).toBeNull();
    expect(modeStorage(() => throwing)).toBeNull();
    expect(otherMode('explore')).toBe('present'); expect(otherMode('present')).toBe('explore');
  });
  it('navigasi dilipat: pilihan tersimpan diutamakan; tanpa pilihan → dilipat di jendela sempit', () => {
    const st = mem();
    expect(readNavCollapsed(st, 1366)).toBe(true); expect(readNavCollapsed(st, 1920)).toBe(false);
    expect(NAV_COLLAPSE_BELOW).toBe(1600);
    saveNavCollapsed(st, false); expect(readNavCollapsed(st, 1366)).toBe(false);
    saveNavCollapsed(st, true); expect(readNavCollapsed(st, 1920)).toBe(true);
    expect(readNavCollapsed(throwing, 1366)).toBe(true);
  });
  it('panah: Present selalu ganti scene; Explore hanya bila fokus di navigasi', () => {
    expect(arrowsChangeScene('present', false)).toBe(true);
    expect(arrowsChangeScene('explore', false)).toBe(false);
    expect(arrowsChangeScene('explore', true)).toBe(true);
  });
  it('main.js: M ganti mode, P tetap jendela presenter, panah lewat aturan mode; petunjuk "M: Explore" saat masuk Present', () => {
    const src = strip(readFileSync(`${ROOT}src/main.js`, 'utf8'));
    expect(src).toMatch(/case 'm': setMode\(otherMode\(mode\)\)/);
    expect(src).toMatch(/case 'p': presenter\.toggle\(\)/);
    expect(src).toMatch(/arrowsChangeScene\(mode, inNav\)/);
    expect(GLOBAL_KEYS).toContain('m');
    expect(STR.nav.hintPresent).toBe('M: Explore');
    expect(src).toMatch(/hintEl\.textContent = STR\.nav\.hintPresent/);
    // halaman penuh menghentikan loop render; scene tetap ter-mount
    expect(src).toMatch(/paused = page != null;\s*if \(!paused\) \{\s*current\?\.update/);
    // sinkron alamat memakai replaceState (tidak memicu hashchange → tidak mengganggu sinkron jendela presenter)
    expect(src).toMatch(/history\.replaceState\(null, '', h\)/);
  });
  it('navigasi: judul singkat English untuk 11 scene dan semua halaman', () => {
    for (let n = 1; n <= 11; n++) expect(STR.nav.scenes[n], String(n)).toMatch(/^[A-Z]/);
    for (const p of PAGES) { expect(STR.nav.pages[p]).toBeTruthy(); expect(STR.nav.pagesShort[p]).toBeTruthy(); }
  });
});
