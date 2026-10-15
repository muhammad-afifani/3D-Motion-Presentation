// Scene 6 (part-load): store — batas presenter (default kosong), kalibrasi DLN per konfigurasi.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadSweep, singleShaftLoad, twinShaftForLoad, emissionAtBasis, MW } from '../src/model/thermo.js';
import { basisInitialState, calibInitialState as calInit } from '../src/state/store.js';
import { deriveLoad, rawCurve, operatingWindow, IGV_MIN } from '../src/state/deriveLoad.js';
import { hudItems, keyMessage } from '../src/scenes/partload.js';
import { createGasTurbineRig } from '../src/gfx/turbineRig.js';
import { LOAD_DESIGNS } from '../src/model/presets.js';
import { limitsInitialState, limitsPatch, loadInitialState, calibInitialState, calibDlnPatch, calibResetPatch } from '../src/state/store.js';
import { NOX_CALIB_DEFAULTS, LOAD_LOADS, LOAD_RANGE } from '../src/model/presets.js';
import { STR } from '../src/ui/strings.js';

describe('Scene 6: store', () => {
  it('batas emisi default KOSONG (null); patch: kosong / tidak valid / ≤ 0 → null', () => {
    expect(limitsInitialState()).toEqual({ limNOx: null, limCO: null });
    expect(limitsPatch({ nox: '10', co: '25,5' })).toEqual({ limNOx: 10, limCO: 25.5 });
    expect(limitsPatch({ nox: '' })).toEqual({ limNOx: null });
    expect(limitsPatch({ co: 'abc' })).toEqual({ limCO: null });
    expect(limitsPatch({ co: -3 })).toEqual({ limCO: null });
    expect(limitsPatch({})).toEqual({});
  });
  it('state awal: beban 100 %, strategi IGV; slider 1 % → 61 titik kurva 1,00 … 0,40', () => {
    expect(loadInitialState()).toMatchObject({ lLoad: 100, lStrategy: 'igv' });
    expect(LOAD_LOADS.length).toBe((LOAD_RANGE.max - LOAD_RANGE.min) / LOAD_RANGE.step + 1);
    expect(LOAD_LOADS[0]).toBe(1); expect(LOAD_LOADS.at(-1)).toBe(0.4);
  });
  it('calDln per konfigurasi; patch hanya mengubah satu; Reset mengembalikan keduanya', () => {
    const s = calibInitialState();
    expect(s.calDln).toEqual({ ...NOX_CALIB_DEFAULTS.dln });
    const p = calibDlnPatch(s, 'twin', 7);
    expect(p.calDln).toEqual({ single: NOX_CALIB_DEFAULTS.dln.single, twin: 7 });
    expect(calibResetPatch().calDln).toEqual({ ...NOX_CALIB_DEFAULTS.dln });
  });
  it('panel H mencatat anggapan basis CO (coDLN @15 % O₂) dan fuel staging OEM tidak dimodelkan (fixed premix split)', () => {
    const t = STR.assumptions.turbine.items.join(' ');
    expect(t).toMatch(/CO from coDLN is read as ppmvd @ 15 % O₂/);
    expect(t).toMatch(/OEM fuel-staging schedule is not modeled \(fixed premix split\)/);
  });
});

const near = (got, want, tol) => expect(Math.abs(got - want), `got ${got}, want ${want}`).toBeLessThanOrEqual(tol);
const st = (extra = {}) => ({ ...loadInitialState(), ...basisInitialState(), ...calInit(), ...limitsInitialState(), theta: 0, ...extra });
// Contoh batas HANYA untuk tes (bukan angka baku mutu; aplikasi default kosong)
const TEST_LIMITS = { limNOx: 10, limCO: 25 };

describe('Scene 6: frame = loadSweep', () => {
  it('kurva = loadSweep(LOAD_DESIGNS, loads, {mode, calib}) untuk single / fuel-only / twin', () => {
    const f = deriveLoad(st());
    const ref = loadSweep(LOAD_DESIGNS.single, LOAD_LOADS, { mode: 'single', calib: NOX_CALIB_DEFAULTS.dln.single });
    const reft = loadSweep(LOAD_DESIGNS.twin, LOAD_LOADS, { mode: 'twin', calib: NOX_CALIB_DEFAULTS.dln.twin });
    ref.forEach((r, i) => { expect(f.single.curve.Tflame[i]).toBe(r.Tflame); near(f.single.curve.nox[i], r.NOx_ppm, 1e-9); near(f.single.curve.co[i], r.CO_ppm, 1e-9); expect(f.single.curve.eta[i]).toBe(r.eta); });
    reft.forEach((r, i) => { expect(f.twin.curve.Tflame[i]).toBe(r.Tflame); near(f.twin.curve.nox[i], r.NOx_ppm, 1e-9); expect(f.twin.curve.N[i]).toBe(r.N); });
    const fo = deriveLoad(st({ lStrategy: 'fuelOnly' }));
    expect(fo.single.curve.raw).toEqual(loadSweep(LOAD_DESIGNS.single, LOAD_LOADS, { mode: 'fuelOnly', calib: NOX_CALIB_DEFAULTS.dln.single }));
  });
  it('titik operasi = baris kurva pada setiap posisi slider (40…100 %), dan = loadSweep pada beban itu', () => {
    for (let L = LOAD_RANGE.min; L <= LOAD_RANGE.max; L += 3) {
      const f = deriveLoad(st({ lLoad: L }));
      for (const cfg of ['single', 'twin']) {
        const c = f[cfg].curve, i = c.load.indexOf(L);
        expect(i).toBeGreaterThanOrEqual(0);
        expect(f[cfg].point.Tflame).toBe(c.Tflame[i]);
        expect(f[cfg].point.nox).toBe(c.nox[i]);
        expect(f[cfg].point.co).toBe(c.co[i]);
      }
      const one = loadSweep(LOAD_DESIGNS.twin, [L / 100], { mode: 'twin', calib: NOX_CALIB_DEFAULTS.dln.twin })[0];
      near(f.twin.point.Tflame, one.Tflame, 1e-6);
    }
  });
  it('rig membaca fungsi part-load yang sama: tahap kompresor terakhir = T₂; N_GG = loadSweep', () => {
    const f = deriveLoad(st({ lLoad: 60 }));
    near(f.single.stages.comp.at(-1).T, singleShaftLoad(LOAD_DESIGNS.single, 0.6).T2, 1e-9);
    const tw = twinShaftForLoad(LOAD_DESIGNS.twin, 0.6);
    near(f.twin.stages.comp.at(-1).T, tw.T2, 1e-9);
    near(f.twin.stages.pt.at(-1).T, tw.T5, 1e-6);
    near(f.twin.N.gg, tw.Ngg, 1e-6);
    expect(f.single.N.rpm).toBe(3000);
  });
  it('basis aktif: NOx & CO = emissionAtBasis (CO dianggap @15 % O₂); 3 % O₂ ×17,9/5,9', () => {
    const f = deriveLoad(st({ emRefO2: 3, emTrefC: 25 }));
    const raw = rawCurve('twin', 'twin', NOX_CALIB_DEFAULTS.dln.twin)[0];
    near(f.twin.point.nox, emissionAtBasis({ ppm: raw.NOx_ppm, refO2: 3, TrefK: 298.15, MWspecies: MW.NO2 }).ppm, 1e-9);
    near(f.twin.point.co, raw.CO_ppm * 17.9 / 5.9, 1e-9);
    expect(f.basis.isDefault).toBe(false);
  });
});

describe('Scene 6: perilaku kualitatif (dari model)', () => {
  const f = deriveLoad(st());
  it('single-shaft IGV: flame T tetap sampai IGV habis (70 %), lalu CO naik tajam (> 10× dalam 10 % beban)', () => {
    expect(f.facts.holdLoad).toBe(Math.round(IGV_MIN * 100));
    expect(f.facts.coRatio).toBeGreaterThan(10);
    const c = f.single.curve, i70 = c.load.indexOf(70), i71 = c.load.indexOf(71), i69 = c.load.indexOf(69);
    expect(c.co[i71]).toBe(c.co[i70]);                 // datar selama IGV menahan
    expect(c.co[i69]).toBeGreaterThan(c.co[i70]);      // naik begitu IGV habis
  });
  it('twin-shaft: flame T turun bertahap (monoton, tanpa tebing ≥ 25 K per 1 %); 100 → 50 % ≈ 88 K', () => {
    const t = f.twin.curve.Tflame;
    for (let i = 1; i < t.length; i++) { expect(t[i]).toBeLessThan(t[i - 1]); expect(t[i - 1] - t[i]).toBeLessThan(25); }
    near(f.facts.twinDT, 88, 2);
  });
  it('jendela (batas contoh di tes saja: NOx ≤ 10, CO ≤ 25): twin = 44–90 %, bergeser dari desain dan lebih sempit dari 40–100 %', () => {
    const g = deriveLoad(st(TEST_LIMITS));
    expect(g.twin.window.ranges).toEqual([[90, 44]]);
    const [hi, lo] = g.twin.window.ranges[0];
    expect(hi).toBeLessThan(100);                     // titik desain (100 %) di luar jendela
    expect(hi - lo).toBeLessThan(LOAD_RANGE.max - LOAD_RANGE.min);
    expect(g.single.window.ranges).toEqual([[68, 67]]); // hasil model apa adanya
  });
  it('jendela hanya bila kedua batas diisi', () => {
    expect(deriveLoad(st({ limNOx: 10 })).twin.window).toBeNull();
    expect(deriveLoad(st()).single.window).toBeNull();
    expect(operatingWindow({ load: [100, 99], nox: [1, 1], co: [1, 1] }, 2, 2).ranges).toEqual([[100, 99]]);
  });
});

describe('Scene 6: kalibrasi DLN per konfigurasi', () => {
  it('ubah faktor twin hanya mengubah kurva twin; HUD menampilkan faktor ≠ 1 (default / custom)', () => {
    const base = deriveLoad(st());
    const g = deriveLoad(st({ calDln: { single: NOX_CALIB_DEFAULTS.dln.single, twin: 8 } }));
    expect(g.single.curve.nox).toEqual(base.single.curve.nox);
    expect(g.twin.point.nox).toBeGreaterThan(base.twin.point.nox);
    const cal = hudItems(g, 'twin').find((x) => x.id === 'cal');
    expect(cal.value(g)).toBe('×8.00');
    expect(cal.sub).toBe(STR.scene6.hud.calib.sub(false));
    expect(hudItems(base, 'single').find((x) => x.id === 'cal').value(base)).toBe('×14.33');
  });
});

describe('Scene 6: HUD, pesan kunci, teks', () => {
  it('ppm di HUD dengan basis lengkap NO₂ / CO; penanda bila basis ≠ default', () => {
    const f = deriveLoad(st({ emRefO2: 5 }));
    const it2 = hudItems(f, 'single');
    expect(it2.find((x) => x.id === 'nox').sub).toBe('as NO₂, dry (ppmvd), @ 5 % O₂, 0 °C');
    expect(it2.find((x) => x.id === 'co').sub).toBe('as CO, dry (ppmvd), @ 5 % O₂, 0 °C');
    expect(it2.find((x) => x.id === 'nox').flag).toBe(STR.common.basis.flag);
    expect(hudItems(deriveLoad(st()), 'twin').find((x) => x.id === 'nox').flag).toBeUndefined();
  });
  it('tanpa batas: pesan membandingkan kurva dengan angka model', () => {
    const f = deriveLoad(st());
    const m = keyMessage(f);
    expect(m).toBe(STR.scene6.messageCurves(f.facts));
    expect(m).toMatch(/down to 70 % load/);
    expect(m).toMatch(/CO rises ×14 at 60 %/);
    expect(m).toMatch(/88 K/);
  });
  it('dengan batas: pesan menyebut batas, basis, dan jendela hasil model', () => {
    const m = keyMessage(deriveLoad(st(TEST_LIMITS)));
    expect(m).toMatch(/NOx 10\.0 and CO 25\.0 ppmvd @ 15 % O₂ dry, 0 °C/);
    expect(m).toMatch(/Generator = 67–68 %/);
    expect(m).toMatch(/Compressor drive = 44–90 %/);
  });
  it('tidak ada klaim "CO meledak" atau nama vendor; catatan akurasi fixed premix fuel split', () => {
    const all = JSON.stringify(STR.scene6) + STR.scene6.messageCurves({ holdT: 1, holdLoad: 1, nextLoad: 1, coRatio: 1, twinDT: 1, twinNoxRatio: 1, twinCoRatio: 1 });
    expect(all).not.toMatch(/meledak|explod|blow up/i);
    expect(STR.scene6.note).toMatch(/fixed premix fuel split/);
    expect(STR.scene6.windowText([])).toBe('none');
  });
  it('tidak ada angka batas baku mutu di kode aplikasi (default kosong)', () => {
    for (const p of ['../src/scenes/partload.js', '../src/state/deriveLoad.js', '../src/ui/limitsInput.js', '../src/model/presets.js']) {
      expect(readFileSync(new URL(p, import.meta.url), 'utf8')).not.toMatch(/lim(NOx|CO)\s*[:=]\s*\d/);
    }
    expect(limitsInitialState()).toEqual({ limNOx: null, limCO: null });
  });
});

describe('Scene 6: rig (IGV) dan arsitektur', () => {
  it('rig single dengan IGV: InstancedMesh vane, sudut dari frame (terbuka di 100 %, tertutup di ≤ 70 %)', () => {
    const rig = createGasTurbineRig({ config: 'single', igv: true });
    const igv = rig.parts.igv;
    expect(igv.mesh.isInstancedMesh).toBe(true);
    const f100 = deriveLoad(st()), f60 = deriveLoad(st({ lLoad: 60 }));
    rig.update({ ...f100.single, time: 0 });
    expect(rig.parts.igv.angle).toBe(0);
    rig.update({ ...f60.single, time: 0 });
    expect(rig.parts.igv.angle).toBeCloseTo(f60.single.igv.angle, 12);
    expect(f60.single.igv.closed).toBe(true);
    expect(deriveLoad(st({ lLoad: 60, lStrategy: 'fuelOnly' })).single.igv.open).toBe(1);
    expect(createGasTurbineRig({ config: 'twin' }).parts.igv).toBeNull();
    rig.dispose();
  });
  it('scene, chart, dan input batas tidak mengimpor thermo.js', () => {
    for (const p of ['../src/scenes/partload.js', '../src/charts/multiLineChart.js', '../src/ui/limitsInput.js']) {
      expect(readFileSync(new URL(p, import.meta.url), 'utf8')).not.toMatch(/model\/thermo/);
    }
  });
});
