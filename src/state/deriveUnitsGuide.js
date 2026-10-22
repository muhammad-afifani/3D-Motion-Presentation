/**
 * deriveUnitsGuide.js — contoh hitung untuk penjelasan satuan (Settings → Units → "ppmvd or mg/Nm³").
 * Angka berasal dari model, bukan ditulis tangan: NOx turbin gas pada beban penuh dari kurva part-load Scene 6
 * (rawCurve, kalibrasi DLN aktif di store), lalu dipindah ke tiga basis lewat concentrationToUnit (jalur tampilan).
 * Basis aktif = basis global panel H (emRefO2, emTrefC); "O₂ lain" dan "volume lain" adalah pilihan basis yang berbeda
 * (batas dan opsi dari EMISSION_BASIS). Nilai berlabel indikatif di UI; bukan data unit atau angka vendor.
 */
import { concentrationToUnit, molarVolume, MW } from '../model/thermo.js';
import { EMISSION_BASIS } from '../model/presets.js';
import { rawCurve, dlnCalib } from './deriveLoad.js';

/** O₂ acuan nilai mentah kurva part-load (ppmvd @ 15 % O₂). */
const RAW_REF_O2 = 15;

/**
 * @param {{emRefO2:number, emTrefC:number, [k:string]:any}} s state store
 * @returns {{ppmRaw:number, refFrom:number, rows:{kind:'active'|'o2'|'volume', refO2:number, TrefC:number, ppm:number, mg:number}[], M:number, V0:number, V25:number}}
 */
export function unitsGuideExample(s) {
  const r0 = rawCurve('single', 'igv', dlnCalib(s, 'single'))[0]; // beban 100 %
  const refO2 = s.emRefO2, TrefC = s.emTrefC;
  const altO2 = refO2 === EMISSION_BASIS.refO2.default ? EMISSION_BASIS.refO2.min : EMISSION_BASIS.refO2.default;
  const altT = EMISSION_BASIS.TrefC.options.find((t) => t !== TrefC) ?? TrefC;
  const row = (kind, o2, T) => ({
    kind, refO2: o2, TrefC: T,
    ppm: concentrationToUnit({ ppm: r0.NOx_ppm, species: 'nox', unit: 'ppmvd', refFrom: RAW_REF_O2, refO2: o2, TrefC: T }),
    mg: concentrationToUnit({ ppm: r0.NOx_ppm, species: 'nox', unit: 'mgNm3', refFrom: RAW_REF_O2, refO2: o2, TrefC: T }),
  });
  return {
    ppmRaw: r0.NOx_ppm,
    refFrom: RAW_REF_O2,
    rows: [row('active', refO2, TrefC), row('o2', altO2, TrefC), row('volume', refO2, altT)],
    M: MW.NO2,
    V0: molarVolume(273.15),
    V25: molarVolume(298.15),
  };
}
