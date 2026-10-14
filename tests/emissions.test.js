// Scene 8: emisi gabungan — frame = cylinderSim / braytonReal+DLN+ppmToGkWh / co2eWithSlip; partikel ∝ frame.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { cylinderSim, braytonReal, dlnFromResult, ppmToGkWh, co2Specific, co2eWithSlip, logNorm, ENGINE_PRESETS, GWP_CH4, MW } from '../src/model/thermo.js';
import { EMIS, LOAD_DESIGNS, NOX_CALIB_DEFAULTS } from '../src/model/presets.js';
import { emisInitialState, calibInitialState, basisInitialState, calibEnginePatch } from '../src/state/store.js';
import { deriveEmis } from '../src/state/deriveEmis.js';
import { hudItems, co2Rows, noxRows, keyMessage, noxNote } from '../src/scenes/emissions.js';
import { createEmissionRig } from '../src/gfx/emissionRig.js';
import { STR } from '../src/ui/strings.js';

const near = (got, want, tol) => expect(Math.abs(got - want), `got ${got}, want ${want}`).toBeLessThanOrEqual(tol);
const st = (extra = {}) => ({ ...emisInitialState(), ...calibInitialState(), ...basisInitialState(), ...extra });

describe('Scene 8: angka dari model', () => {
  const f = deriveEmis(st({ eSlip: 0 }));
  it('diesel & gas engine = cylinderSim preset (NOx, η, CO₂); 605 / 478 g/kWh, NOx 10,7 / 2,6', () => {
    const d = cylinderSim(ENGINE_PRESETS.diesel), g = cylinderSim(ENGINE_PRESETS.gas);
    expect(f.rows.diesel.nox).toBe(d.NOx_gkWh); expect(f.rows.diesel.co2).toBe(d.co2_gkWh); expect(f.rows.diesel.eta).toBe(d.etaBrake);
    expect(f.rows.gas.nox).toBe(g.NOx_gkWh); near(f.rows.gas.co2, g.co2_gkWh, 1e-9);
    near(f.rows.diesel.co2, 605, 0.5); near(f.rows.gas.co2, 478, 0.5);
    near(f.gasVsDiesel.co2 * 100, 21, 0.2);
  });
  it('gas turbine (generator) = braytonReal desain + DLN single + ppmToGkWh: NOx 15 ppm → 0,258 g/kWh; CO₂ 534,7', () => {
    const d = braytonReal(LOAD_DESIGNS.single), e = dlnFromResult(d, d, { calib: NOX_CALIB_DEFAULTS.dln.single });
    near(f.rows.turbine.nox, ppmToGkWh({ ppm: e.NOx_ppm, MWspecies: MW.NO2, eta: d.eta, fuel: 'gas' }), 1e-12);
    near(f.rows.turbine.nox, 0.258, 0.001);
    near(f.rows.turbine.co2, co2Specific(d.eta, 'gas'), 1e-9); near(f.rows.turbine.co2, 534.7, 0.2);
  });
  it('slip berlaku untuk gas engine & turbin, tidak untuk diesel; 1 % → +11,1 % CO₂e (co2eWithSlip, GWP 29,8)', () => {
    const g = deriveEmis(st({ eSlip: 1 }));
    expect(g.rows.diesel.co2e).toBe(g.rows.diesel.co2); expect(g.rows.diesel.ch4).toBe(0);
    near(g.rows.gas.co2e, co2eWithSlip({ eta: g.rows.gas.eta, slipFrac: 0.01 }).co2e, 1e-9);
    near(g.slipIncrease * 100, 11.1, 0.05); near(g.slipIncreaseTurbine, g.slipIncrease, 1e-12);
    near(deriveEmis(st({ eSlip: 3 })).slipIncrease * 100, 33.2, 0.05);
    expect(g.gwp).toBe(GWP_CH4); expect(g.gwp).toBe(29.8);
  });
  it('kalibrasi engine dari store memengaruhi NOx engine', () => {
    const s = st(); const g = deriveEmis({ ...s, ...calibEnginePatch(s, 'diesel', 0.1) });
    expect(g.rows.diesel.nox).toBeLessThan(f.rows.diesel.nox);
    expect(g.calib.engine.diesel).toBe(0.1);
  });
});

describe('Scene 8: chart, HUD, pesan, label', () => {
  const f = deriveEmis(st({ eSlip: 1 }));
  it('bar CO₂e = segmen CO₂ + CH₄·GWP; NOx turbin menampilkan ppm dengan basis', () => {
    const rows = co2Rows(f);
    rows.forEach((r, i) => near(r.stack[0].value + r.stack[1].value, f.list[i].co2e, 1e-9));
    expect(rows[0].stack[1].value).toBe(0);
    const n = noxRows(f);
    expect(n[2].sub).toMatch(/ppmvd @ 15 % O₂ dry, 0 °C/);
  });
  it('label permanen NOx dikalibrasi + faktor aktif & target di bawah grafik NOx dan di HUD', () => {
    expect(noxNote(f)).toMatch(/^NOx dikalibrasi ke nilai tipikal literatur, bukan data unit atau vendor/);
    expect(noxNote(f)).toMatch(/engine ×0,17 \(diesel\) \/ ×0,17 \(gas\), target ≈ 11 \/ 2,5 g\/kWh · DLN ×14,33, target 15 ppmvd @ 15 % O₂/);
    expect(STR.scene8.hud.note).toMatch(/NOx dikalibrasi ke nilai tipikal literatur, bukan data unit atau vendor/);
    const cal = hudItems().find((x) => x.id === 'cal');
    expect(cal.value(f)).toBe('×0,17 / ×14,33');
  });
  it('PM kualitatif, tidak dimodelkan (tanpa angka); GWP dengan horizon', () => {
    const pm = hudItems().find((x) => x.id === 'pm');
    expect(pm.value(f)).toBe('kualitatif'); expect(pm.sub).toBe('kualitatif, tidak dimodelkan');
    expect(hudItems().find((x) => x.id === 'gwp').sub).toMatch(/AR6 · horizon 100 tahun · fosil/);
  });
  it('pesan kunci dari model: "slip x % menambah y % CO₂e"', () => {
    expect(keyMessage(f)).toMatch(/^Slip 1,0 % menambah 11,1 % CO₂e/);
    expect(keyMessage(deriveEmis(st({ eSlip: 0 })))).toMatch(/21 % lebih rendah dari diesel/);
  });
  it('panel H: basis ppmToGkWh dan GWP AR6 100 tahun fosil + horizon lain berbeda', () => {
    const t = STR.assumptions.ghg.items.join(' ');
    expect(t).toMatch(/O₂ acuan \(default 15 %\)/); expect(t).toMatch(/F-factor kering stoikiometrik/);
    expect(t).toMatch(/GWP CH₄ = 29,8 \(AR6, horizon 100 tahun, CH₄ fosil\)\. Horizon waktu lain memberi hasil berbeda\./);
  });
});

describe('Scene 8: partikel 3D ∝ frame', () => {
  it('laju partikel = logNorm nilai frame relatif maksimum antar mesin; PM = tingkat kualitatif tetap', () => {
    const f = deriveEmis(st({ eSlip: 1 }));
    const maxNox = Math.max(...f.list.map((r) => r.nox));
    for (const r of f.list) {
      near(f.particles[r.id].NOx, logNorm(r.nox, maxNox, 2), 1e-12);
      expect(f.particles[r.id].PM).toBe(EMIS.pmParticles[EMIS.pmLevel[r.id]]);
    }
    expect(f.particles.diesel.CH4).toBe(0);
    expect(deriveEmis(st({ eSlip: 0 })).particles.gas.CH4).toBe(0);
    expect(EMIS.pmLevel).toEqual({ diesel: 'high', gas: 'low', turbine: 'veryLow' });
  });
  it('rig memancarkan partikel sebanding laju frame (NOx diesel > turbin), InstancedMesh, diam saat dt = 0', () => {
    let seed = 7;
    const rig = createEmissionRig({ random: () => ((seed = (seed * 16807) % 2147483647) / 2147483647) });
    const f = deriveEmis(st({ eSlip: 1 }));
    rig.update(f, 0);
    expect(rig.parts.alive).toBe(0);
    for (let i = 0; i < 30; i++) rig.update(f, 0.05);
    expect(rig.parts.particles.isInstancedMesh).toBe(true);
    expect(rig.countBy('diesel', 'NOx')).toBeGreaterThan(rig.countBy('turbine', 'NOx'));
    expect(rig.countBy('diesel', 'CH4')).toBe(0);
    expect(rig.countBy('gas', 'CH4')).toBeGreaterThan(0);
    rig.dispose();
  });
  it('scene, rig, chart tidak mengimpor thermo.js', () => {
    for (const p of ['../src/scenes/emissions.js', '../src/gfx/emissionRig.js', '../src/charts/barChart.js']) {
      expect(readFileSync(new URL(p, import.meta.url), 'utf8')).not.toMatch(/model\/thermo/);
    }
  });
});
