// Scene 2: siklus ideal vs real — angka acuan di layar, titik berjalan di kurva, state hover, mode Real.
import { describe, it, expect } from 'vitest';
import { cylinderSim, otto, engineGeometry, lossWaterfall } from '../src/model/thermo.js';
import { ENGINES } from '../src/model/presets.js';
import { cycleDefaults, cycleInitialState, cycleKindPatch, cycleModePatch } from '../src/state/store.js';
import { deriveCycles, realSimParams, rEngine, idealPistonPoint, SAMPLE_N, waterfallParams } from '../src/state/deriveCycles.js';

const base = { ...cycleInitialState(), theta: -360, rpmVisual: 20 };
const st = (kind, extra = {}) => ({ ...base, ...cycleDefaults(kind), ...extra });
const near = (got, want, tol) => expect(Math.abs(got - want), `got ${got}, want ${want}`).toBeLessThanOrEqual(tol);

/** Jarak titik ke polyline proses (di ruang ternormalisasi x/y). */
function onPolyline(procs, p, xk, yk) {
  let best = Infinity;
  for (const pr of procs) for (let i = 0; i < pr.v.length - 1; i++) {
    const ax = pr[xk][i], ay = pr[yk][i], bx = pr[xk][i + 1], by = pr[yk][i + 1];
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((p[xk] - ax) * dx + (p[yk] - ay) * dy) / L)) : 0;
    const ex = (ax + t * dx - p[xk]) / (Math.abs(ax) + 1), ey = (ay + t * dy - p[yk]) / (Math.abs(ay) + 1);
    best = Math.min(best, Math.hypot(ex, ey));
  }
  return best;
}

describe('Scene 2: angka golden tampil di frame (mode Ideal, default)', () => {
  it('Otto r=10 → 0,602; Otto r=18 → 0,685', () => {
    near(deriveCycles(st('otto')).eta.ideal, 0.602, 0.001);
    near(deriveCycles(st('otto', { cR: 18 })).eta.ideal, 0.685, 0.001);
  });
  it('Diesel r=18 rc=2 → 0,632 (dan η Otto pada r sama ≥ Diesel)', () => {
    const f = deriveCycles(st('diesel'));
    near(f.eta.ideal, 0.632, 0.001);
    expect(f.eta.ottoSameR).toBeGreaterThan(f.eta.ideal);
  });
  it('Dual r=16 rp=1,5 rc=1,4 → 0,655', () => near(deriveCycles(st('dual')).eta.ideal, 0.655, 0.001));
  it('Brayton ideal 0,539 → real 0,378 (celah ditampilkan)', () => {
    const f = deriveCycles(st('brayton', { cMode: 'real' }));
    near(f.eta.ideal, 0.539, 0.001);
    near(f.eta.real, 0.378, 0.005);
    near(f.eta.gap, f.eta.ideal - f.eta.real, 1e-12);
    expect(f.modelLevel).toBe('Real (efisiensi komponen)');
    expect(f.waterfall.map((x) => x.eta)).toEqual([f.eta.ideal, f.eta.real]);
  });
});

describe('Scene 2: titik berjalan selalu di kurva yang digambar', () => {
  for (const kind of ['otto', 'diesel', 'dual', 'brayton']) {
    it(`${kind} ideal: P-v dan T-s, θ langkah 5°`, () => {
      for (let th = -360; th < 360; th += 5) {
        const f = deriveCycles(st(kind, { theta: th }));
        if (!f.point.visible) continue;
        expect(onPolyline(f.procs, f.point, 'v', 'P')).toBeLessThan(1e-9);
        expect(onPolyline(f.procs, f.point, 's', 'T')).toBeLessThan(1e-9);
      }
    });
  }
  for (const kind of ['otto', 'diesel']) {
    it(`${kind} real: titik di polyline cylinderSim dan P/T sama dengan rig (sampleSim)`, () => {
      const s = { ...st(kind), ...cycleModePatch(st(kind), 'real') };
      const sim = cylinderSim(realSimParams(s));
      for (let th = -360; th < 360; th += 5) {
        const f = deriveCycles({ ...s, theta: th }, { sim });
        if (!f.point.visible) { expect(th < sim.params.ivc || th > sim.params.evo).toBe(true); continue; }
        expect(onPolyline(f.procs, f.point, 'v', 'P')).toBeLessThan(1e-9);
        expect(onPolyline(f.procs, f.point, 's', 'T')).toBeLessThan(1e-9);
        near(f.point.P, f.rig.P, 1e-6);
        near(f.point.T, f.rig.T, 1e-9);
      }
    });
  }
});

describe('Scene 2: titik state (hover)', () => {
  it('ideal: state = cycle.states (T, P, v, s)', () => {
    for (const kind of ['otto', 'diesel', 'dual', 'brayton']) {
      const f = deriveCycles(st(kind));
      expect(f.states.length).toBe(kind === 'dual' ? 5 : 4);
      f.states.forEach((x, i) => {
        expect(x.label).toBe(String(i + 1));
        for (const k of ['T', 'P', 'v', 's']) expect(Number.isFinite(x[k])).toBe(true);
      });
    }
    const o = otto({ r: 10 });
    deriveCycles(st('otto')).states.forEach((x, i) => { expect(x.T).toBe(o.states[i].T); expect(x.P).toBe(o.states[i].P); });
  });
  it('real piston: titik acuan IVC, θ₀, Pmax, EVO', () => {
    const s = { ...st('diesel'), ...cycleModePatch(st('diesel'), 'real') };
    const sim = cylinderSim(realSimParams(s));
    const f = deriveCycles(s, { sim });
    expect(f.states.map((x) => x.note)).toEqual(['IVC', 'awal pembakaran θ₀', 'Pmax', 'EVO']);
    expect(f.states[2].P).toBe(sim.Pmax);
    expect(f.states[0].theta).toBe(sim.params.ivc);
    expect(f.states[3].theta).toBe(sim.params.evo);
  });
});

describe('Scene 2: pemetaan θ → state ideal (sinkron dengan piston)', () => {
  const geo = engineGeometry({ ...ENGINES.gas.params, r: 10 });
  const f = deriveCycles(st('otto'));
  const at = (th) => idealPistonPoint(f.procs, f.states, th, geo);
  it('BDC −180 = state 1, menjelang TDC ≈ state 2, TDC = state 3, BDC +180 = state 4', () => {
    near(at(-180).P, f.states[0].P, 1e-6);
    near(at(-1e-9).v, f.states[1].v, 1e-9);
    near(at(0).P, f.states[2].P, 1e-6);
    near(at(180).P, f.states[3].P, 1e-6);
  });
  it('volume titik ideal = v1·V(θ)/V(BDC) sepanjang kompresi & ekspansi; monoton per langkah', () => {
    let prev = Infinity;
    for (let th = -180; th < 0; th += 2) { const p = at(th); near(p.v, f.states[0].v * geo.V(th) / geo.V(180), 1e-12); expect(p.v).toBeLessThan(prev + 1e-15); prev = p.v; }
    prev = -Infinity;
    for (let th = 0; th <= 180; th += 2) { const p = at(th); near(p.v, f.states[0].v * geo.V(th) / geo.V(180), 1e-9); expect(p.v).toBeGreaterThan(prev - 1e-15); prev = p.v; }
  });
  it('langkah buang/isap: titik di state 1 (air-standard tanpa pertukaran gas)', () => {
    for (const th of [-300, 200, 300]) expect(at(th).P).toBe(f.states[0].P);
  });
  it('rig ideal: posisi piston dari geometri yang sama, warna gas dari T titik', () => {
    const g = deriveCycles(st('otto', { theta: 37 }));
    near(g.rig.pistonPos, geo.pistonPos(37), 1e-15);
    near(g.rig.T, g.point.T, 1e-12);
  });
  it(`kurva ideal memakai cycle.sample(${SAMPLE_N})`, () => expect(f.procs[0].v.length).toBe(SAMPLE_N + 1));
});

describe('Scene 2: mode Real dan pembanding ideal', () => {
  it('pembanding ideal (garis tipis) memakai q_in = Qtot/massa dan state awal = IVC real', () => {
    for (const kind of ['otto', 'diesel']) {
      const s = { ...st(kind), ...cycleModePatch(st(kind), 'real') };
      const sim = cylinderSim(realSimParams(s));
      const f = deriveCycles(s, { sim });
      const g = f.ghost;
      expect(g).not.toBeNull();
      near(g[0].T[0], sim.params.Tivc, 1e-9);
      near(g[0].P[0], sim.params.Pivc, 1e-6);
      near(f.eta.qin, sim.Qtot / sim.mass, 1e-9);
      // panas masuk pembanding: Otto cv·ΔT, Diesel cp·ΔT pada proses pemanasan
      const heat = g[1];
      const dT = heat.T[heat.T.length - 1] - heat.T[0];
      near(dT * (kind === 'otto' ? 717.5 : 1004.5), sim.Qtot / sim.mass, 1e-3);
      near(f.eta.gap, f.eta.ideal - sim.etaBrake, 1e-12);
    }
  });
  it('Dual real: tanpa garis pembanding (q_in tidak disamakan) dan ada catatan', () => {
    const s = { ...st('dual'), ...cycleModePatch(st('dual'), 'real') };
    const f = deriveCycles(s, { sim: cylinderSim(realSimParams(s)) });
    expect(f.ghost).toBeNull();
    expect(f.notes.join(' ')).toMatch(/Dual/);
  });
  it('Otto: r di-clamp ke rentang gas engine di mode Real; catatan knocking di Ideal saat r > 14', () => {
    const ideal18 = st('otto', { cR: 18 });
    expect(deriveCycles(ideal18).notes.join(' ')).toMatch(/knocking/);
    expect(deriveCycles(st('otto', { cR: 12 })).notes).toEqual([]);
    const real = { ...ideal18, ...cycleModePatch(ideal18, 'real') };
    expect(real.cR).toBe(ENGINES.gas.ranges.r.max);
    expect(rEngine(ideal18)).toBe(ENGINES.gas.ranges.r.max);
    expect(deriveCycles(real, { sim: cylinderSim(realSimParams(real)) }).notes.join(' ')).toMatch(/knocking/);
  });
  it('ganti jenis siklus: parameter ke nilai acuan jenis tsb', () => {
    const s = st('otto', { cR: 7 });
    expect(cycleKindPatch(s, 'diesel')).toMatchObject({ cKind: 'diesel', cR: 18, cRc: 2 });
    expect(cycleKindPatch(s, 'brayton')).toMatchObject({ cKind: 'brayton', cRpB: 15, cT3: 1500 });
  });
  it('label tingkat model per mode', () => {
    expect(deriveCycles(st('diesel')).modelLevel).toBe('Ideal');
    const s = { ...st('diesel'), ...cycleModePatch(st('diesel'), 'real') };
    expect(deriveCycles(s, { sim: cylinderSim(realSimParams(s)) }).modelLevel).toBe('Semi-empiris');
    expect(deriveCycles(st('brayton')).modelLevel).toBe('Ideal');
  });
});

describe('Scene 2: waterfall', () => {
  it('window preset; langkah terakhir = η rem HUD mode Real pada r yang sama (diesel & gas, beberapa r)', () => {
    for (const [kind, rs] of [['diesel', [14, 18, 22]], ['otto', [9, 11, 14]]]) {
      for (const r of rs) {
        const s = { ...st(kind), cMode: 'real', cR: r };
        const p = waterfallParams(s);
        expect(p.opts).toEqual({ window: 'preset' });
        const wf = lossWaterfall(p.kind, p.over, p.opts);
        const sim = cylinderSim(realSimParams(s));
        const f = deriveCycles(s, { sim, waterfall: wf });
        near(f.waterfall[f.waterfall.length - 1].eta, f.eta.brake, 1e-12);
      }
    }
  });
});
