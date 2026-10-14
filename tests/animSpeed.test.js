// Animation speed (M8a): satu kontrol bersama 0,1×–2× di semua scene beranimasi; 1× = 20 rpm visual.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ANIM_SPEED, RPM_VISUAL } from '../src/model/presets.js';
import { animSpeedPatch, animInitialState, resetPatch, defaultState, tickPatch } from '../src/state/store.js';
import { STR } from '../src/ui/strings.js';

const ROOT = new URL('..', import.meta.url).pathname;
const src = (p) => readFileSync(`${ROOT}${p}`, 'utf8');
const ANIMATED = ['piston', 'cycles', 'combustion', 'nox', 'turbine', 'partload', 'compressor', 'emissions'];

describe('Animation speed', () => {
  it('rentang 0,1×–2×, default 1× = 20 rpm visual', () => {
    expect([ANIM_SPEED.min, ANIM_SPEED.max, ANIM_SPEED.default]).toEqual([0.1, 2, 1]);
    expect(RPM_VISUAL.default).toBe(20);
    expect(animInitialState()).toEqual({ animSpeed: 1 });
  });
  it('patch di-clamp dan dibulatkan ke step 0,1; input tak valid diabaikan', () => {
    expect(animSpeedPatch(5)).toEqual({ animSpeed: 2 });
    expect(animSpeedPatch(0)).toEqual({ animSpeed: 0.1 });
    expect(animSpeedPatch(0.34)).toEqual({ animSpeed: 0.3 });
    expect(animSpeedPatch('x')).toEqual({});
  });
  it('label konsisten: "Animation speed" dan nilai ×0,5', () => {
    expect(STR.common.animSpeed).toBe('Animation speed');
    expect(STR.common.animSpeedValue(0.5)).toBe('×0,5');
    expect(STR.common.animSpeedValue(2)).toBe('×2,0');
  });
  it('R (resetPatch) mengembalikan Animation speed ke 1×', () => {
    expect(resetPatch({ ...defaultState('diesel'), animSpeed: 0.3 }).animSpeed).toBe(1);
  });
  it('θ maju sebanding dengan dt yang sudah dikali Animation speed (loop utama)', () => {
    const s = { ...defaultState('diesel'), theta: 0 };
    const a = tickPatch(s, 0.1 * 0.5).theta, b = tickPatch(s, 0.1 * 2).theta;
    expect(b / a).toBeCloseTo(4, 9);
    expect(src('src/main.js')).toMatch(/update\(dt \* \(store\.get\(\)\.animSpeed \?\? 1\), dt\)/);
  });
  for (const f of ANIMATED) {
    it(`Scene ${f}: memakai kontrol bersama animSpeedSlider (tanpa slider rpm visual sendiri)`, () => {
      const s = src(`src/scenes/${f}.js`);
      expect(s).toMatch(/animSpeedSlider\(store\)/);
      expect(s).not.toMatch(/RPM_VISUAL/);
      expect(s).not.toMatch(/rpmVisual: v/);
    });
  }
});

describe('derive: Slow-motion memakai rpm visual efektif', async () => {
  const { derive } = await import('../src/state/derive.js');
  const { cylinderSim } = await import('../src/model/thermo.js');
  const { ENGINES } = await import('../src/model/presets.js');
  const sim = cylinderSim(ENGINES.diesel.params);
  it('rpmVisual & slowMo = 20 × animSpeed', () => {
    const f = derive({ ...defaultState('diesel'), animSpeed: 0.5 }, sim);
    expect(f.rpmVisual).toBeCloseTo(10, 9);
    expect(f.slowMo).toBeCloseTo(10 / f.N, 12);
  });
});

describe('panel Calibration di-dock (tidak menutupi 3D)', () => {
  const css = src('src/styles.css');
  it('panel menjadi kolom flex di samping .dock-main, bukan overlay absolute', () => {
    const rule = css.match(/\n\.cal-panel \{([^}]*)\}/)[1];
    expect(rule).not.toMatch(/position:\s*absolute/);
    expect(rule).toMatch(/flex:/);
    expect(css).toMatch(/\.has-dock \{ display: flex; \}/);
    expect(css).toMatch(/\.cal-panel\.is-collapsed \{[^}]*flex-basis: 44px/);
  });
  it('calibrationPanel membungkus isi tampilan ke .dock-main dan punya Collapse', () => {
    const s = src('src/ui/calibrationPanel.js');
    expect(s).toMatch(/dock-main/);
    expect(s).toMatch(/data-collapse/);
    expect(s).toMatch(/setCollapsed/);
  });
});
