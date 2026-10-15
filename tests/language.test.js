// Step 02 (M9 pack): semua teks di layar English; catatan presenter tetap Indonesia; tanpa identifier kode di caption/tooltip.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as thermo from '../src/model/thermo.js';
import { STR } from '../src/ui/strings.js';
import { fmt, dateTime } from '../src/ui/format.js';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(`${ROOT}${p}`, 'utf8');

/** Kata Indonesia umum (daftar dari pack Step 02 + tambahan yang jelas bukan English). */
export const ID_WORDS = [
  'yang', 'dan', 'dengan', 'untuk', 'tidak', 'ada', 'dari', 'pada', 'adalah', 'atau', 'ini', 'itu', 'sebagai', 'beban', 'tekanan', 'suhu',
  'bahan bakar', 'emisi', 'baku mutu', 'lihat', 'tampil',
  'jendela', 'kosong', 'terhadap', 'dibutuhkan', 'dimodelkan', 'diisi', 'hanya', 'bukan', 'karena', 'lebih', 'semua', 'setiap', 'tetapi', 'namun',
  'sudah', 'belum', 'bisa', 'harus', 'kurva', 'titik', 'nyala', 'campuran', 'mesin', 'turbin', 'kompresor', 'siklus', 'efisiensi', 'daya',
  'kecepatan', 'indikatif', 'kualitatif', 'kalibrasi', 'pembakaran', 'tahun', 'tampilan', 'simpan', 'hapus', 'pilih',
];
const ID_RE = new RegExp(`(?<![\\p{L}\\p{N}_])(${ID_WORDS.join('|')})(?![\\p{L}\\p{N}_])`, 'iu');
/** Allowlist: nama resmi regulasi (Indonesia, apa adanya) dan isi presenter.json. Belum ada regulasi di UI (Step 03). */
const ALLOW_PATTERNS = [/Permen LHK? [0-9/]+/, /Peraturan Menteri[^.;]*/];
const clean = (t) => ALLOW_PATTERNS.reduce((s, re) => s.replace(re, ' '), t);

/** Semua teks daun di STR; fungsi dipanggil dengan argumen contoh (hasil template ikut diperiksa). */
function leaves(o, path = 'STR', out = []) {
  for (const [k, v] of Object.entries(o)) {
    const p = `${path}.${k}`;
    if (typeof v === 'string') out.push([p, v]);
    else if (typeof v === 'function') { try { const r = v(1, 2, 3, 4, 5, 6); if (typeof r === 'string') out.push([p, r]); } catch { /* butuh objek */ } }
    else if (Array.isArray(v)) v.forEach((x, i) => typeof x === 'string' && out.push([`${p}[${i}]`, x]));
    else if (v && typeof v === 'object') leaves(v, p, out);
  }
  return out;
}
const textsOf = (j) => (typeof j === 'string' ? [j] : Array.isArray(j) ? j.flatMap(textsOf) : j && typeof j === 'object' ? Object.values(j).flatMap(textsOf) : []);

describe('bahasa UI: English, tanpa sisa kata Indonesia', () => {
  it('strings.js: tidak ada kata Indonesia umum yang tertinggal', () => {
    const bad = leaves(STR).filter(([, t]) => ID_RE.test(clean(t))).map(([p, t]) => `${p}: ${t.slice(0, 80)} [${(clean(t).match(ID_RE) ?? [])[0]}]`);
    expect(bad).toEqual([]);
  });
  it('content/controls.json dan closing.json (kartu & penutup) berbahasa English', () => {
    for (const f of ['content/controls.json', 'content/closing.json']) {
      const bad = textsOf(JSON.parse(read(f))).filter((t) => ID_RE.test(clean(t)));
      expect(bad, f).toEqual([]);
    }
  });
  it('presenter.json (naskah lisan) tetap Indonesia dan tidak diubah isinya oleh pass bahasa', () => {
    const t = textsOf(JSON.parse(read('content/presenter.json'))).join(' ');
    expect(t).toMatch(/\b(yang|dan|dengan|tidak|adalah)\b/);
    expect(t).toMatch(/Pembuka: bahan bakar sama, mesin beda, emisi beda/);
  });
  it('pemindai mendeteksi kata Indonesia (uji pemindai) dan tidak salah menandai English', () => {
    for (const t of ['Beban turbin tidak ada', 'Lihat grafik', 'kalibrasi']) expect(ID_RE.test(t), t).toBe(true);
    for (const t of ['Load window', 'Peak burned-zone temperature', 'Dry gas, NOx as NO₂', 'Idaho data', 'Panel A · Retard timing', 'Adaptive']) expect(ID_RE.test(t), t).toBe(false);
  });
  it('index.html dan presenter.html: lang="en"; blok catatan presenter di jendela presenter diberi lang="id"', () => {
    expect(read('index.html')).toMatch(/<html lang="en">/);
    expect(read('presenter.html')).toMatch(/<html lang="en">/);
    const v = read('src/ui/presenterView.js');
    expect(v).toMatch(/class="pres__key" data-v="key" lang="id"/);
    expect(v).toMatch(/class="pres__notes" data-v="notes" lang="id"/);
    expect(v).toMatch(/pres-next__key" lang="id"/);
  });
});

describe('format angka en-US', () => {
  it('titik desimal, koma ribuan; satuan tetap', () => {
    expect(fmt(0.87, 2)).toBe('0.87');
    expect(fmt(1821, 0)).toBe('1,821');
    expect(fmt(69090, 0)).toBe('69,090');
    expect(fmt(-31.04, 1)).toBe('-31.0');
    expect(fmt(null)).toBe('–');
  });
  it('tanggal+jam English', () => {
    expect(dateTime(new Date(2026, 9, 14, 8, 5))).toMatch(/^Oct 14, 2026,? (at )?8:05\s?AM$/);
  });
});

describe('tanpa identifier kode di teks layar (kecuali panel asumsi H)', () => {
  const names = Object.keys(thermo).filter((k) => /[a-z][A-Z]/.test(k) || /_/.test(k) || k === 'selfTest');
  const re = new RegExp(`(?<![\\p{L}\\p{N}_])(${[...names, 'thermo\\.js', 'presets\\.js', 'strings\\.js', 'derive[A-Z]\\w*', 'loadSweep', 'lossWaterfall', 'retardSweep'].join('|')})(?![\\p{L}\\p{N}_])`, 'u');
  const own = leaves(STR).filter(([p]) => !p.startsWith('STR.assumptions'));
  it('caption, tooltip, label HUD, toast, sublabel: tidak ada nama fungsi/konstanta/file kode', () => {
    const bad = own.filter(([, t]) => re.test(t)).map(([p, t]) => `${p}: ${t.slice(0, 90)}`);
    expect(bad).toEqual([]);
  });
  it('caption waterfall Scene 2: keterangan biasa, bukan tanda tangan fungsi', () => {
    expect(STR.scene2.waterfall.caption).toBe('Efficiency lost between the ideal limit and brake efficiency, at preset valve timing (IVC to EVO)');
    const scene2Text = leaves(STR.scene2).map(([, t]) => t).join('\n');
    expect(scene2Text).not.toMatch(/lossWaterfall|window:|cylinderSim|braytonReal|\{…|…,/);
  });
  it('tooltip "Sumber: …" diganti keterangan biasa, tidak dihapus (HUD Scene 1 tetap berisi penjelasan)', () => {
    for (const k of ['pmax', 'thpmax', 'imep', 'etai', 'etab', 'bsfc']) {
      const tip = STR.scene1.hud[k].tip;
      expect(tip.length, k).toBeGreaterThan(20);
      expect(tip, k).not.toMatch(/Sumber:|Source:/);
    }
    expect(JSON.stringify(STR)).not.toMatch(/Sumber:/);
  });
  it('kejujuran model tetap: twin-shaft bergeser/menyempit tanpa "CO meledak"; single-shaft punya tebing CO; label indicative; basis O₂/volume', () => {
    const all = JSON.stringify(STR);
    expect(STR.scene6.note).toMatch(/Single-shaft shows a CO "cliff" once the IGV runs out; twin-shaft shows a gradual shift/);
    expect(STR.scene6.hudNote).toMatch(/indicative/);
    expect(STR.scene6.hud.nox.label).toMatch(/indicative/);
    expect(STR.common.indicative).toBe('indicative');
    expect(STR.common.basis.full(15, 0)).toMatch(/dry \(ppmvd\), @ 15 % O₂, 0 °C/);
    expect(STR.common.basis.fullMg(15, 25)).toMatch(/@ 15 % O₂, 25 °C \(mg\/Nm³\)/);
    expect(all).not.toMatch(/CO (explodes|blows up|spikes explosively)|meledak/i);
    expect(STR.assumptions.turbine.items.join(' ')).toMatch(/Real behavior can be better or worse/);
  });
});
