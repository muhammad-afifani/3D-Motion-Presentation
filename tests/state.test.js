// Tes store + derive: alur satu arah dan konsistensi state di frame.
import { describe, it, expect, vi } from 'vitest';
import { createStore, defaultState } from '../src/state/store.js';
import { derive, runSim, simKey, hydrateSim } from '../src/state/derive.js';
import { ENGINE_PRESETS } from '../src/model/thermo.js';

describe('store', () => {
  it('set memanggil subscriber hanya bila ada perubahan', () => {
    const s = createStore({ a: 1, b: 2 });
    const fn = vi.fn();
    s.subscribe(fn);
    s.set({ a: 1 });
    expect(fn).not.toHaveBeenCalled();
    s.set({ a: 3 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][2]).toEqual(['a']);
    expect(s.get()).toEqual({ a: 3, b: 2 });
  });
  it('reset kembali ke nilai awal; unsubscribe berfungsi', () => {
    const s = createStore({ a: 1 });
    const fn = vi.fn();
    const off = s.subscribe(fn);
    s.set({ a: 5 });
    s.reset();
    expect(s.get().a).toBe(1);
    off();
    s.set({ a: 9 });
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it('defaultState membaca preset thermo.js', () => {
    const d = defaultState('gas');
    expect(d.r).toBe(ENGINE_PRESETS.gas.r);
    expect(d.theta0).toBe(ENGINE_PRESETS.gas.theta0);
  });
});

describe('derive', () => {
  const state = defaultState('diesel');
  const sim = runSim(state);

  it('perubahan θ tidak mengubah kunci simulasi', () => {
    expect(simKey({ ...state, theta: 42 })).toBe(simKey(state));
    expect(simKey({ ...state, r: 17 })).not.toBe(simKey(state));
  });

  it('frame memuat field minimal spesifikasi', () => {
    const f = derive({ ...state, theta: 10 }, sim);
    for (const k of ['theta', 'V', 'P', 'T', 's', 'xb', 'phase', 'pistonPos', 'Tflame', 'phi', 'NOx', 'CO', 'CO2', 'PM', 'eta', 'power', 'load', 'N']) {
      expect(f).toHaveProperty(k);
    }
  });

  it('posisi piston dan V di frame berasal dari geometri yang sama pada tiap θ', () => {
    for (let th = -360; th < 360; th += 7.3) {
      const f = derive({ ...state, theta: th }, sim);
      expect(f.pistonPos).toBeCloseTo(sim.geo.pistonPos(th), 12);
      expect(f.V).toBeCloseTo(sim.geo.V(th), 12);
      expect(f.V).toBeCloseTo(f.geom.Vc + f.geom.A * f.pistonPos, 12);
    }
  });

  it('P di fase tertutup sama dengan array simulasi', () => {
    const i = 300; // indeks sembarang di fase tertutup
    const f = derive({ ...state, theta: sim.th[i] }, sim);
    expect(f.P).toBeCloseTo(sim.P[i], 6);
    expect(f.T).toBeCloseTo(sim.T[i], 9);
  });

  it('ringkasan frame sama dengan hasil cylinderSim', () => {
    const f = derive(state, sim);
    expect(f.summary.Pmax).toBe(sim.Pmax);
    expect(f.eta.brake).toBe(sim.etaBrake);
    expect(f.summary.bsfc).toBe(sim.bsfc);
  });

  it('hydrateSim memulihkan geo setelah serialisasi (jalur Web Worker)', () => {
    const { geo, ...packed } = sim;
    const clone = hydrateSim(structuredClone(packed));
    const a = derive({ ...state, theta: 12.25 }, sim);
    const b = derive({ ...state, theta: 12.25 }, clone);
    expect(b.P).toBe(a.P);
    expect(b.pistonPos).toBe(a.pistonPos);
  });
});

describe('Scene 1: sinkronisasi kurva P-V/P-θ dengan titik berjalan', () => {
  for (const engine of ['diesel', 'gas']) {
    const state = defaultState(engine);
    const sim = runSim(state);

    it(`${engine}: titik frame berada di kurva siklus pada setiap sampel θ`, () => {
      const c = derive(state, sim).curve;
      expect(c.n).toBe(1440);
      for (let i = 0; i < c.n; i += 7) {
        const f = derive({ ...state, theta: c.theta[i] }, sim);
        expect(f.V).toBe(c.V[i]);
        expect(f.P).toBe(c.P[i]);
        expect(f.curve).toBe(c); // cache: objek kurva sama selama sim sama
      }
    });

    it(`${engine}: luas poligon fase tertutup = W kotor cylinderSim`, () => {
      const c = derive(state, sim).curve;
      let A = 0;
      for (let i = c.iClosed0; i < c.iClosed1; i++) A += 0.5 * (c.P[i] + c.P[i + 1]) * (c.V[i + 1] - c.V[i]);
      expect(Math.abs(A - sim.Wgross) / sim.Wgross).toBeLessThan(1e-9);
    });

    it(`${engine}: nilai visual dalam rentang`, () => {
      for (let th = -360; th < 360; th += 3.7) {
        const f = derive({ ...state, theta: th }, sim);
        expect(f.dxbNorm).toBeGreaterThanOrEqual(0);
        expect(f.dxbNorm).toBeLessThanOrEqual(1);
        expect(f.valveIn).toBeGreaterThanOrEqual(0);
        expect(f.valveEx).toBeGreaterThanOrEqual(0);
        expect(f.valveIn * f.valveEx).toBe(0); // tidak terbuka bersamaan (tanpa overlap di model)
        for (const v of f.gasRGB) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
      }
    });
  }

  it('parameter dari slider masuk ke simulasi (r lebih tinggi → Pmax & η naik)', () => {
    const s = defaultState('diesel');
    const a = derive(s, runSim(s)), b = derive({ ...s, r: 20 }, runSim({ ...s, r: 20 }));
    expect(b.summary.Pmax).toBeGreaterThan(a.summary.Pmax);
    expect(b.eta.ind).toBeGreaterThan(a.eta.ind);
    expect(b.geom.Vc).toBeLessThan(a.geom.Vc);
  });
});

describe('jeda (Spasi) vs beku (F)', () => {
  it('jeda menghentikan waktu tetapi θ masih bisa digeser', async () => {
    const { togglePlayPatch, tickPatch, scrubPatch } = await import('../src/state/store.js');
    const s = { ...defaultState('diesel'), theta: 10 };
    const paused = { ...s, ...togglePlayPatch(s) };
    expect(paused.playing).toBe(false);
    expect(tickPatch(paused, 1)).toEqual({});
    expect(scrubPatch(paused, 42)).toEqual({ theta: 42, playing: false });
  });
  it('beku mengunci θ: waktu, slider θ, dan Spasi diabaikan; lepas beku kembali berputar', async () => {
    const { toggleFreezePatch, togglePlayPatch, tickPatch, scrubPatch, resetPatch } = await import('../src/state/store.js');
    const s = { ...defaultState('diesel'), theta: 10 };
    const frozen = { ...s, ...toggleFreezePatch(s) };
    expect(frozen.frozen).toBe(true);
    expect(tickPatch(frozen, 1)).toEqual({});
    expect(scrubPatch(frozen, 42)).toEqual({});
    expect(togglePlayPatch(frozen)).toEqual({});
    expect(resetPatch(frozen)).not.toHaveProperty('frozen'); // reset parameter tidak melepas beku
    const thawed = { ...frozen, ...toggleFreezePatch(frozen) };
    expect(thawed.playing).toBe(true);
    expect(tickPatch(thawed, 0.5).theta).toBeCloseTo(10 + 6 * s.rpmVisual * 0.5, 9);
  });
  it('tickPatch membungkus θ ke [−360, 360)', async () => {
    const { tickPatch } = await import('../src/state/store.js');
    const s = { ...defaultState('diesel'), theta: 359, rpmVisual: 10 };
    expect(tickPatch(s, 0.1).theta).toBeCloseTo(-355, 9);
  });
});
