// Kualitas adaptif & bloom global (M8b): histeresis, bloom efektif, persistensi, dan frame/HUD identik di semua tier.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { createQualityController, effectiveBloom, QUALITY_TIERS, TIER_MAX, QUALITY_TUNING } from '../src/gfx/quality.js';
import * as store from '../src/state/store.js';
import { readSaved, PERSIST_KEY } from '../src/state/persist.js';
import { cylinderSim } from '../src/model/thermo.js';
import { ENGINES } from '../src/model/presets.js';
import { derive } from '../src/state/derive.js';
import { deriveFlame } from '../src/state/deriveFlame.js';
import { deriveCycles } from '../src/state/deriveCycles.js';
import { deriveNox } from '../src/state/deriveNox.js';
import { deriveTurbine } from '../src/state/deriveTurbine.js';
import { deriveLoad } from '../src/state/deriveLoad.js';
import { deriveComp } from '../src/state/deriveComp.js';
import { deriveEmis } from '../src/state/deriveEmis.js';
import { derivePolicy } from '../src/state/derivePolicy.js';
import { deriveAssumptions } from '../src/state/deriveAssumptions.js';
import { hudItems as emisHud } from '../src/scenes/emissions.js';
import { STR } from '../src/ui/strings.js';

const ROOT = new URL('..', import.meta.url).pathname;
/** Jalankan pengontrol pada fps tetap selama `sec` detik. */
const run = (qc, fps, sec, mode = 'auto') => { let r; for (let i = 0; i < Math.round(fps * sec); i++) r = qc.sample(1 / fps, mode); return r.tier; };

describe('pengontrol kualitas (histeresis)', () => {
  it('High = tier 0 tetap, Low = tier terendah tetap, apa pun fps-nya', () => {
    const qc = createQualityController();
    expect(run(qc, 5, 20, 'high')).toBe(0);
    expect(run(qc, 120, 20, 'low')).toBe(TIER_MAX);
    expect(TIER_MAX).toBe(3);
  });
  it('Auto: turun bertahap saat fps rendah, dengan jeda antar langkah', () => {
    const qc = createQualityController();
    expect(run(qc, 20, QUALITY_TUNING.warmupSec + QUALITY_TUNING.downSec + 0.6)).toBe(1);
    expect(run(qc, 20, QUALITY_TUNING.cooldownSec - 1)).toBe(1);            // masih dalam jeda: tidak turun lagi
    expect(run(qc, 20, 1 + QUALITY_TUNING.downSec + 0.6)).toBe(2);
    expect(run(qc, 20, 30)).toBe(3);                                           // berhenti di tier terendah
  });
  it('Auto: naik lagi bila fps pulih (lebih lambat daripada turun)', () => {
    const qc = createQualityController();
    run(qc, 15, 30);
    expect(qc.tier).toBe(3);
    expect(run(qc, 60, QUALITY_TUNING.upSec - 1)).toBe(3);                    // belum cukup lama
    expect(run(qc, 60, QUALITY_TUNING.upSec + 2)).toBeLessThan(3);
    expect(run(qc, 60, 60)).toBe(0);
  });
  it('fps di antara ambang (pita histeresis) atau berganti-ganti tidak membuat berkedip', () => {
    const qc = createQualityController();
    run(qc, 20, QUALITY_TUNING.warmupSec + QUALITY_TUNING.downSec + 0.6);
    const changes = [];
    let prev = qc.tier;
    for (let k = 0; k < 40; k++) { const t = run(qc, k % 2 ? 40 : 45, 1); if (t !== prev) changes.push(t); prev = t; }
    expect(changes).toEqual([]);
    for (let k = 0; k < 20; k++) { const t = run(qc, k % 2 ? 25 : 55, 1); if (t !== prev) changes.push(t); prev = t; }
    expect(changes.length).toBeLessThanOrEqual(1);
  });
});

describe('bloom global', () => {
  it('On / Off dipatuhi; Auto mengikuti tier (Quality Auto) atau perfGuard (Quality High)', () => {
    expect(effectiveBloom('on', 3, 'low', true)).toBe(true);
    expect(effectiveBloom('off', 0, 'high', false)).toBe(false);
    expect(effectiveBloom('auto', 0, 'auto', true)).toBe(true);    // Auto quality: perfGuard tidak dipakai
    expect(effectiveBloom('auto', 1, 'auto', false)).toBe(false);  // tier 1 mematikan bloom
    expect(effectiveBloom('auto', 0, 'high', false)).toBe(true);
    expect(effectiveBloom('auto', 0, 'high', true)).toBe(false);   // fallback perfGuard
    expect(QUALITY_TIERS.map((t) => t.bloom)).toEqual([true, false, false, false]);
  });
  it('composer lazy di semua renderer; bloom tidak menghapus alpha latar (gradasi CSS tetap terlihat)', () => {
    const r = readFileSync(`${ROOT}src/gfx/renderer.js`, 'utf8'), c = readFileSync(`${ROOT}src/gfx/composer.js`, 'utf8');
    expect(r).toMatch(/if \(!composer\) \{\s*composer = createComposer/);
    expect(c).toMatch(/blendSrcAlpha: THREE\.ZeroFactor, blendDstAlpha: THREE\.OneFactor/);
  });
  it('tombol B dan Q memutar pengaturan global; Scene 3 tidak lagi punya fBloom', () => {
    expect(store.bloomCyclePatch({ bloomMode: 'off' })).toEqual({ bloomMode: 'auto' });
    expect(store.qualityCyclePatch({ quality: 'auto' })).toEqual({ quality: 'high' });
    expect(store.flameInitialState()).not.toHaveProperty('fBloom');
    expect(store.displayPatch({ quality: 'ultra', bloomMode: 'on' })).toEqual({ bloomMode: 'on' });
    const scenes = readdirSync(`${ROOT}src/scenes`).map((f) => readFileSync(`${ROOT}src/scenes/${f}`, 'utf8')).join('\n');
    expect(scenes).not.toMatch(/fBloom|createPerfGuard|bloom: (true|false)/);
  });
  it('Quality dan Bloom tersimpan lewat persistensi (nilai tak dikenal diabaikan)', () => {
    const fake = (data) => ({ getItem: (k) => (k === PERSIST_KEY ? JSON.stringify({ v: 1, data }) : null) });
    expect(readSaved(fake({ quality: 'low', bloomMode: 'off' })).patch).toMatchObject({ quality: 'low', bloomMode: 'off' });
    const bad = readSaved(fake({ quality: 'max', bloomMode: 1 })).patch;
    expect(bad).not.toHaveProperty('quality');
    expect(bad).not.toHaveProperty('bloomMode');
  });
});

describe('kualitas hanya visual: frame & HUD identik di semua tier', () => {
  const base = {
    ...store.defaultState('diesel'), ...store.cycleInitialState(), ...store.flameInitialState(), ...store.noxInitialState(), ...store.gtInitialState(),
    ...store.basisInitialState(), ...store.calibInitialState(), ...store.limitsInitialState(), ...store.loadInitialState(), ...store.compInitialState(),
    ...store.emisInitialState(), ...store.policyInitialState(), ...store.ctrlInitialState(), ...store.closingInitialState(), ...store.animInitialState(),
  };
  const variants = [0, 1, 2, 3].map((t) => ({ ...base, quality: ['high', 'auto', 'auto', 'low'][t], bloomMode: ['on', 'auto', 'off', 'off'][t], qTier: t }));
  const sim = cylinderSim(ENGINES.diesel.params);
  const derives = {
    derive: (s) => derive(s, sim), deriveFlame: (s) => deriveFlame(s, { sim }), deriveCycles: (s) => deriveCycles(s),
    deriveNox: (s) => deriveNox(s, sim, null), deriveTurbine, deriveLoad, deriveComp, deriveEmis, derivePolicy: (s) => derivePolicy(s, null), deriveAssumptions,
  };
  const json = (x) => JSON.stringify(x, (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : v));
  for (const [name, fn] of Object.entries(derives)) {
    it(`${name}: frame sama persis untuk tier 0–3`, () => {
      const ref = json(fn(variants[0]));
      for (const v of variants.slice(1)) expect(json(fn(v))).toBe(ref);
    });
  }
  it('HUD (Scene 8) sama persis untuk tier 0–3', () => {
    const vals = variants.map((v) => { const f = deriveEmis(v); return emisHud().map((h) => h.value(f)).join('|'); });
    expect(new Set(vals).size).toBe(1);
  });
  it('derive* tidak membaca pengaturan kualitas; pengaturan visual dijelaskan di panel H', () => {
    for (const f of readdirSync(`${ROOT}src/state`).filter((x) => x.startsWith('derive'))) {
      expect(readFileSync(`${ROOT}src/state/${f}`, 'utf8'), f).not.toMatch(/quality|bloomMode|qTier|particleScale/);
    }
    expect(STR.assumptions.display.visualOnly).toMatch(/hanya memengaruhi visual \(pixel ratio, bloom, jumlah partikel\), tidak memengaruhi angka HUD atau grafik/);
  });
});
