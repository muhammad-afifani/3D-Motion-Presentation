// M9 Step 05b: leverSweep (pembungkus cylinderSim) — golden konsistensi terhadap retardSweep dan cylinderSim,
// grid tuas Scene 9 memuat nilai preset (titik operasi selalu di kurva).
import { describe, it, expect } from 'vitest';
import { leverSweep, retardSweep, cylinderSim, ENGINE_PRESETS, LEVER_PARAMS } from '../src/model/thermo.js';
import { LEVER_GRID, LEVER_AXES, NOX_TIMING } from '../src/model/presets.js';

describe('leverSweep', () => {
  it('param theta0 identik dengan retardSweep (golden konsistensi)', () => {
    for (const kind of ['diesel', 'gas']) {
      const th = NOX_TIMING[kind].sweep.filter((_, i) => i % 4 === 0);
      const a = leverSweep(kind, 'theta0', th, { calib: 0.17 }), b = retardSweep(kind, th, { calib: 0.17 });
      a.forEach((r, i) => {
        expect(r.value).toBe(b[i].theta0);
        for (const k of ['Pmax_bar', 'NOx_ppm', 'NOx_gkWh', 'etaBrake', 'co2_gkWh', 'bsfc', 'TburnedMax']) expect(r[k], `${kind} ${k}`).toBe(b[i][k]);
      });
    }
  });
  it('setiap titik identik dengan cylinderSim tunggal (phi, Tivc, Pivc, N)', () => {
    for (const [param, v] of [['phi', 0.45], ['Tivc', 310], ['Pivc', 2.2e5], ['N', 850]]) {
      const [r] = leverSweep('diesel', param, [v]);
      const s = cylinderSim({ ...ENGINE_PRESETS.diesel, [param]: v });
      expect(r.NOx_gkWh, param).toBe(s.NOx_gkWh); expect(r.etaBrake, param).toBe(s.etaBrake); expect(r.Pmax_bar, param).toBe(s.Pmax / 1e5);
    }
  });
  it('param tidak dikenal ditolak; daftar tuas = sumbu Scene 9', () => {
    expect(() => leverSweep('diesel', 'egr', [0.1])).toThrow();
    expect([...LEVER_PARAMS]).toEqual([...LEVER_AXES]);
  });
});

describe('grid tuas Scene 9', () => {
  it('nilai preset tepat ada di grid setiap sumbu (diesel dan gas)', () => {
    for (const kind of ['diesel', 'gas']) for (const ax of LEVER_AXES) {
      expect(LEVER_GRID[kind][ax].sweep, `${kind}.${ax}`).toContain(ENGINE_PRESETS[kind][ax]);
    }
  });
});
