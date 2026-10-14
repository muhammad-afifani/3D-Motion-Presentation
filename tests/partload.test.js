// Scene 6 (part-load): store — batas presenter (default kosong), kalibrasi DLN per konfigurasi.
import { describe, it, expect } from 'vitest';
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
    expect(t).toMatch(/coDLN dinyatakan sebagai ppmvd @ 15 % O₂/);
    expect(t).toMatch(/fuel staging OEM tidak dimodelkan \(fixed premix split\)/);
  });
});
