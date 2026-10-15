// Scene 7: kompresor gas + hukum affinitas — frame = gasCompressor / affinity / speedForHead / compressorTrain.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { gasCompressor, affinity, speedForHead, suctionFlow, compressorTrain, emissionAtBasis, MW } from '../src/model/thermo.js';
import { GAS_COMPRESSOR, LOAD_DESIGNS, NOX_CALIB_DEFAULTS } from '../src/model/presets.js';
import { compInitialState, compPressurePatch, basisInitialState, calibInitialState } from '../src/state/store.js';
import { deriveComp, compParams } from '../src/state/deriveComp.js';
import { compHudItems, driveHudItems, keyMessage } from '../src/scenes/compressor.js';
import { createCompressorRig, N_BLADES } from '../src/gfx/compressorRig.js';
import { STR } from '../src/ui/strings.js';

const near = (got, want, tol) => expect(Math.abs(got - want), `got ${got}, want ${want}`).toBeLessThanOrEqual(tol);
const st = (extra = {}) => ({ ...compInitialState(), ...basisInitialState(), ...calibInitialState(), theta: 30, ...extra });
const D = GAS_COMPRESSOR.design;

describe('Scene 7: angka dari model', () => {
  it('demo case = golden: rp 3, head 172 kJ/kg, daya 4,31 MW, T discharge 412 K, Q 1,352 m³/s, speed 100 %', () => {
    const f = deriveComp(st());
    const g = gasCompressor(D);
    expect(compParams(st())).toEqual({ ...D });
    expect(f.comp.head).toBe(g.head); expect(f.comp.power).toBe(g.power); expect(f.comp.Tdis).toBe(g.Tdis);
    near(f.comp.head / 1e3, 172, 1); near(f.comp.power / 1e6, 4.31, 0.03); near(f.comp.Tdis, 412, 1);
    near(f.comp.Q, suctionFlow(D), 1e-12); near(f.Nreq, 1, 1e-12);
    expect(f.shift.atDesign).toBe(true);
  });
  it('titik desain kompresor ≈ beban turbin 65,5 % (compressorTrain); baris HUD dari model', () => {
    const f = deriveComp(st());
    near(f.design.load, 0.655, 0.002);
    expect(f.design.load).toBe(compressorTrain({ comp: D, compDesign: D, gtDesign: LOAD_DESIGNS.twin }).loadRaw);
    expect(STR.scene7.hud.designLine(f.design.load)).toBe('Compressor design point ≈ turbine load 65.5 % (model)');
    expect(STR.scene7.demoCase(f.comp.mdot)).toBe('Demo case (ṁ = 20.0 kg/s)');
  });
  it('Psuc 18 bar: speed 105,5 %, beban 72,8 %, N_GG 0,795, flame T 1834 K; Psuc 15 bar: 114,6 % / 86,0 % / 0,896 / 1858 K', () => {
    const a = deriveComp(st({ cPsuc: 18 }));
    near(a.Nreq, 1.055, 0.001); near(a.train.loadRaw, 0.728, 0.002); near(a.train.Ngg, 0.795, 0.002); near(a.train.Tflame, 1834, 1);
    near(a.Nreq, speedForHead({ Hreq: a.comp.head, Hdesign: gasCompressor(D).head, Ndesign: 1 }), 1e-12);
    const b = deriveComp(st({ cPsuc: 15 }));
    near(b.Nreq, 1.146, 0.001); near(b.train.loadRaw, 0.860, 0.002); near(b.train.Ngg, 0.896, 0.002); near(b.train.Tflame, 1858, 1);
    expect(b.train.inRange).toBe(true);
    near(b.shift.dTflame, b.train.Tflame - deriveComp(st()).train.Tflame, 1e-9);
  });
  it('mass flow memengaruhi beban turbin (demo case input): ṁ 16 kg/s → 52,4 %; ṁ 10 → di luar rentang (diklem, ditandai)', () => {
    near(deriveComp(st({ cMdot: 16 })).train.loadRaw, 0.524, 0.002);
    const lo = deriveComp(st({ cMdot: 10 }));
    expect(lo.train.inRange).toBe(false); expect(lo.train.load).toBe(0.4);
    expect(driveHudItems(lo).find((x) => x.id === 'load').flag).toBe(STR.scene7.hud.outOfRange);
    expect(driveHudItems(deriveComp(st())).find((x) => x.id === 'load').flag).toBeUndefined();
  });
  it('NOx & CO compressor drive pada basis aktif, kalibrasi twin dari store', () => {
    const f = deriveComp(st({ emRefO2: 3 }));
    const t = compressorTrain({ comp: D, compDesign: D, gtDesign: LOAD_DESIGNS.twin, calib: NOX_CALIB_DEFAULTS.dln.twin });
    near(f.train.nox, emissionAtBasis({ ppm: t.NOx_ppm, refO2: 3, MWspecies: MW.NO2 }).ppm, 1e-9);
    near(f.train.co, t.CO_ppm * 17.9 / 5.9, 1e-9);
    const it2 = driveHudItems(f).find((x) => x.id === 'nox');
    expect(it2.sub).toBe('as NO₂, dry (ppmvd), @ 3 % O₂, 0 °C');
    expect(it2.flag).toBe(STR.common.basis.flag);
  });
});

describe('Scene 7: hukum affinitas (what-if)', () => {
  it('what-if = affinity({ N0: N dibutuhkan, N1: slider }) dari titik proses; speed 90 % di demo case → daya ×0,729', () => {
    const f = deriveComp(st({ cSpeed: 90 }));
    const a = affinity({ N0: 1, N1: 0.9, Q0: f.comp.Q, H0: f.comp.head, P0: f.comp.power });
    expect(f.whatIf.Q).toBe(a.Q); expect(f.whatIf.H).toBe(a.H); expect(f.whatIf.P).toBe(a.P);
    near(f.whatIf.P / f.comp.power, 0.729, 1e-9);
    const g = deriveComp(st({ cPsuc: 18, cSpeed: 100 }));
    near(g.whatIf.ratio, 1 / g.Nreq, 1e-12);
  });
  it('titik grafik di kurva: what-if & proses (pada N bulat) berada di titik kurva affinity', () => {
    const f = deriveComp(st({ cSpeed: 80 }));
    const c = f.curve, i = c.N.indexOf(80), j = c.N.indexOf(100);
    expect(c.Q[i]).toBe(f.whatIf.Q); expect(c.H[i]).toBe(f.whatIf.H / 1e3); expect(c.P[i]).toBe(f.whatIf.P / 1e6);
    near(c.Q[j], f.comp.Q, 1e-12); near(c.H[j], f.comp.head / 1e3, 1e-9);
    for (let k = 1; k < c.N.length; k++) near(c.H[k] / c.H[0], (c.Q[k] / c.Q[0]) ** 2, 1e-9); // H ∝ Q²
  });
  it('kurva diperluas bila speed dibutuhkan > 110 %', () => {
    const f = deriveComp(st({ cPsuc: 15 }));
    expect(f.curve.N.at(-1)).toBeGreaterThanOrEqual(f.Nreq * 100);
  });
});

describe('Scene 7: kontrol, pesan, teks', () => {
  it('Pdis selalu ≥ 1,05 × Psuc', () => {
    const s = compInitialState();
    const a = compPressurePatch({ ...s, cPdis: 30 }, { Psuc: 35 });
    expect(a.cPdis).toBeGreaterThanOrEqual(35 * 1.05);
    const b = compPressurePatch({ ...s, cPsuc: 30 }, { Pdis: 20 });
    expect(b.cPsuc * 1.05).toBeLessThanOrEqual(20 + 1e-9);
  });
  it('pesan kunci: demo case vs pergeseran (arah & besar dari model, tanpa klaim unit nyata)', () => {
    const f0 = deriveComp(st());
    expect(keyMessage(f0)).toBe(STR.scene7.messageDesign(f0.Nreq, f0.train.loadRaw, f0.train.Tflame));
    const m = keyMessage(deriveComp(st({ cPsuc: 18 })));
    expect(m).toMatch(/required speed 105\.5 % \(\+5\.5 pp\)/);
    expect(m).toMatch(/turbine load 72\.8 % \(\+7\.3 pp\)/);
    expect(m).toMatch(/\+13 K/);
    expect(m).not.toMatch(/unit nyata|lapangan|vendor/i);
  });
  it('HUD kompresor memakai label model fungsi thermo.js', () => {
    expect(compHudItems().map((x) => x.model)).toEqual(['compressor model', 'compressor model', 'compressor model', 'compressor model', 'actual flow at suction', 'from head alone']);
  });
  it('panel H: speed dari head saja, peta/surge/batas speed tidak dimodelkan, Tsuc tetap, H ∝ Q² = affinity Ideal', () => {
    const t = STR.assumptions.compressor.items.join(' ');
    expect(t).toMatch(/from head alone \(speedForHead/);
    expect(t).toMatch(/compressor map, the surge line, and speed limits are not modeled/);
    expect(t).toMatch(/Suction T fixed at 308 K/);
    expect(t).toMatch(/H ∝ Q² .*affinity laws \(Ideal, constant η\)/);
    // dulu: tidak ada klaim "surge line digambar" / peta kompresor. Kini teks English menyebut peta hanya sebagai TIDAK dimodelkan.
    expect(JSON.stringify(STR.scene7)).not.toMatch(/surge line digambar|surge line (is )?(drawn|shown)|compressor map (is )?(drawn|shown|included)/i);
    expect(STR.scene7.note).toMatch(/compressor map, surge line, and speed limits are not modeled/);
  });
});

describe('Scene 7: rig kompresor sentrifugal', () => {
  it('impeller berputar dengan sudut dari frame (speed dibutuhkan); bilah & partikel InstancedMesh', () => {
    const rig = createCompressorRig({ random: () => 0.5 });
    const f = deriveComp(st({ cPsuc: 18 }));
    rig.update(f, 0.016);
    expect(rig.parts.rotor.rotation.x).toBeCloseTo(f.rotor.angle, 12);
    expect(f.rotor.angle).toBeCloseTo(30 * f.Nreq * Math.PI / 180, 12);
    expect(rig.parts.blades.isInstancedMesh).toBe(true);
    expect(rig.parts.blades.count).toBe(N_BLADES);
    expect(rig.parts.particles.isInstancedMesh).toBe(true);
    expect(rig.drawCalls()).toBeLessThanOrEqual(16);
    rig.dispose();
  });
  it('warna partikel inlet = gasRGB[0] (Tsuc), discharge = gasRGB terakhir (Tdis)', () => {
    const rig = createCompressorRig({ particles: 2, random: () => 0.5 });
    const f = deriveComp(st());
    rig.parts.P[0].u = 0.05; rig.parts.P[1].u = 0.9;
    rig.update(f, 0);
    const c = new THREE.Color();
    rig.parts.particles.getColorAt(0, c);
    const w0 = new THREE.Color().setRGB(...f.gasRGB[0], THREE.SRGBColorSpace);
    near(c.r, w0.r, 1e-6); near(c.b, w0.b, 1e-6);
    rig.parts.particles.getColorAt(1, c);
    const w1 = new THREE.Color().setRGB(...f.gasRGB.at(-1), THREE.SRGBColorSpace);
    near(c.r, w1.r, 1e-6); near(c.b, w1.b, 1e-6);
    rig.dispose();
  });
  it('scene, rig tidak mengimpor thermo.js', () => {
    for (const p of ['../src/scenes/compressor.js', '../src/gfx/compressorRig.js']) {
      expect(readFileSync(new URL(p, import.meta.url), 'utf8')).not.toMatch(/model\/thermo/);
    }
  });
});
