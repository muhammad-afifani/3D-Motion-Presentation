// M8b: pengukur fps, overlay debug, deteksi rendering software, perbaikan dispose (logika murni / sumber).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createFpsMeter } from '../src/state/fpsMeter.js';
import { debugRows } from '../src/ui/debugOverlay.js';
import { isSoftwareGpu } from '../src/gfx/renderer.js';
import { createStore } from '../src/state/store.js';
import { STR } from '../src/ui/strings.js';

const ROOT = new URL('..', import.meta.url).pathname;
const src = (p) => readFileSync(`${ROOT}${p}`, 'utf8');

describe('fpsMeter (dt mentah)', () => {
  it('rata-rata per jendela 1 s; dt ≤ 0 diabaikan', () => {
    const m = createFpsMeter(1);
    for (let i = 0; i < 30; i++) m.sample(1 / 30);
    m.sample(1 / 30 + 1e-9);
    expect(m.fps).toBeCloseTo(30, 0);
    expect(m.ms).toBeCloseTo(33.3, 0);
    expect(m.sample(0)).toBe(m.fps);
  });
  it('frame lambat (software rendering) terukur apa adanya, tanpa batas dt animasi', () => {
    const m = createFpsMeter(1);
    for (let i = 0; i < 5; i++) m.sample(0.25);
    expect(m.fps).toBeCloseTo(4, 6);
  });
});

describe('overlay debug', () => {
  it('baris berlabel Inggris dari strings.js; tanda tanpa 3D', () => {
    const rows = debugRows({ fps: 58.6, ms: 17.1, stats: { count: 1, calls: 42, triangles: 123456, geometries: 30, textures: 4, programs: 9, pixelRatio: 1.5, bloom: true } });
    expect(rows.map((r) => r[0])).toEqual([STR.debug.fps, STR.debug.frameMs, STR.debug.calls, STR.debug.triangles, STR.debug.geometries, STR.debug.textures, STR.debug.programs, STR.debug.pixelRatio, STR.debug.bloom]);
    expect(rows[3][1]).toBe('123,456');
    expect(debugRows({ fps: null, ms: null, stats: { count: 0 } }).at(-1)).toEqual([STR.debug.renderer, STR.debug.no3d]);
  });
  it('rendering software dikenali (fps bukan fps GPU)', () => {
    expect(isSoftwareGpu('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)')).toBe(true);
    expect(isSoftwareGpu('llvmpipe (LLVM 15.0.7, 256 bits)')).toBe(true);
    expect(isSoftwareGpu('ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0)')).toBe(false);
    expect(isSoftwareGpu(null)).toBeNull();
    expect(STR.debug.software).toMatch(/not real GPU fps/);
  });
});

describe('dispose antar-scene (perbaikan yang diverifikasi scripts/e2e/dispose.mjs)', () => {
  const r = src('src/gfx/renderer.js');
  it('renderer melepas env RT, ruangan PMREM, bayangan, dan konteks WebGL; mencatat sisa sumber daya', () => {
    expect(r).toMatch(/envRT\.dispose\(\)/);
    expect(r).toMatch(/room\.dispose/);
    expect(r).toMatch(/forceContextLoss\(\)/);
    expect(r).toMatch(/DISPOSE_LOG\.push/);
    expect(r).toMatch(/webglOk != null/);          // probe WebGL sekali (tanpa konteks tambahan per scene)
  });
  it('composer melepas semua pass (render target bloom)', () => {
    expect(src('src/gfx/composer.js')).toMatch(/for \(const p of composer\.passes\) p\.dispose/);
  });
  it('store melaporkan jumlah subscriber (dibandingkan ke baseline di e2e)', () => {
    const s = createStore({ a: 1 });
    const un = s.subscribe(() => {});
    expect(s.subscriberCount()).toBe(1);
    un();
    expect(s.subscriberCount()).toBe(0);
  });
  it('skrip e2e tersedia lewat npm run e2e / e2e:perf (bukan dependensi, bukan CI)', () => {
    const pkg = JSON.parse(src('package.json'));
    expect(pkg.scripts.e2e).toMatch(/scripts\/e2e\/dispose\.mjs/);
    expect(pkg.scripts['e2e:perf']).toMatch(/scripts\/e2e\/perf\.mjs/);
    expect(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })).not.toContain('playwright');
    expect(src('.github/workflows/deploy.yml')).not.toMatch(/e2e/);
  });
});
