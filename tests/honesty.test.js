// Paket D: kalimat jujur model di sisi ID (dan kebersihan sisi ID). Aturan berbasis frasa di sisi EN, jadi otomatis
// berlaku untuk kelompok yang dimigrasi tahap berikutnya (D4: twin/single-shaft, D5: batas dan kebijakan, dst.).
import { describe, it, expect } from 'vitest';
import * as thermo from '../src/model/thermo.js';
import { STR_SOURCE } from '../src/ui/strings.js';
import { MIGRATED_GROUPS, isPair } from '../src/state/i18n.js';

const atPath = (root, dotted) => dotted.split('.').reduce((o, k) => o[k], root);
const sample = (v) => { if (typeof v !== 'function') return v; try { return v('1', '2', '3', '4', '5', '6'); } catch { return v([[100, 50]], 2, 3, 4, 5, 6); } }; // windowText butuh larik
function leaves(o, path, out = []) {
  if (isPair(o)) { out.push([path, o]); return out; }
  if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) leaves(v, Array.isArray(o) ? `${path}[${k}]` : `${path}.${k}`, out);
  return out;
}
/** [jalur, en, id] untuk semua pasangan string di kelompok yang sudah dimigrasi */
const ALL = MIGRATED_GROUPS.flatMap((g) => leaves(atPath(STR_SOURCE, g), g));
const PAIRS = ALL.map(([p, v]) => [p, String(sample(v.en) ?? ''), String(sample(v.id) ?? '')]);
/** hanya teks statis: fungsi memakai fmt() yang mengikuti bahasa angka aktif (EN di tes), jadi keluarannya bukan teks tetap */
const STATIC = ALL.filter(([, v]) => typeof v.id === 'string').map(([p, v]) => [p, v.en, v.id]);
const where = (rows) => rows.map(([p, , id]) => `${p}: ${id.slice(0, 90)}`);

describe('kalimat jujur model, sisi ID', () => {
  it('"indicative" di EN → "indikatif" di ID; korelasi tidak pernah disajikan sebagai pasti', () => {
    const miss = PAIRS.filter(([, en, id]) => /indicative/i.test(en) && !/indikatif/i.test(id));
    expect(where(miss)).toEqual([]);
    expect(PAIRS.some(([, en]) => /indicative/i.test(en))).toBe(true);
  });
  it('basis O₂ dan volume tetap di samping angka: O₂ → O₂, "dry" → "kering", suhu basis (0 °C / 25 °C) dan "ppmvd" tidak hilang', () => {
    // sub-label tile HUD (common.basis.tile / tileCO): satuan ppmvd sudah menempel di samping angka tile, sisi ID tanpa "(ppmvd)" (diperiksa di bawah)
    const rows = PAIRS.filter(([p, en]) => !/^common\.basis\.tile/.test(p) && /O₂/.test(en) && /(ppm|mg\/Nm³|dry)/i.test(en));
    expect(rows.length).toBeGreaterThan(8);
    const bad = rows.filter(([, en, id]) => !/O₂/.test(id) || (/\bdry\b/i.test(en) && !/kering/i.test(id)) || (/°C/.test(en) && !/°C/.test(id)) || (/ppmvd/.test(en) && !/ppmvd/.test(id)) || (/mg\/Nm³/.test(en) && !/mg\/Nm³/.test(id)));
    expect(where(bad)).toEqual([]);
  });
  it('sub-label tile HUD: basis O₂, kering, °C tetap; satuan ppmvd menempel di tile NOx / CO (Scene 6 dan 7)', () => {
    for (const k of ['tile', 'tileCO']) {
      const t = STR_SOURCE.common.basis[k].id(15, 0);
      expect(t, k).toMatch(/^sebagai (NO₂|CO), kering, @ 15 % O₂, 0 °C$/);
    }
    for (const sc of [STR_SOURCE.scene6.hud, STR_SOURCE.scene7.hud]) for (const k of ['nox', 'co']) expect(sc[k].unit.id).toBe('ppmvd');
  });
  it('tidak ada klaim kepatuhan: tanpa "lulus", "patuh", "compliant", "memenuhi baku mutu/batas"; chip tetap Within / Above / Not modeled', () => {
    const bad = PAIRS.filter(([, , id]) => /\b(lulus|patuh|kepatuhan terpenuhi|compliant|comply|memenuhi (baku mutu|batas|regulasi))\b/i.test(id));
    expect(where(bad)).toEqual([]);
    const st = STR_SOURCE.regulation.status;
    expect([st.within.id, st.above.id, st.notModeled.id]).toEqual(['Within', 'Above', 'Not modeled']);
    expect(STR_SOURCE.regulation.title.id).toMatch(/^Nilai model vs batas \(indikatif\)$/);
    expect(STR_SOURCE.regulation.statusTip.id).toMatch(/Bukan hasil uji/);
  });
  it('twin-shaft = jendela operasi bergeser dan menyempit; single-shaft = tebing CO setelah IGV habis; tidak ada "CO meledak"', () => {
    for (const [p, en, id] of PAIRS) {
      if (/shifts and narrows/i.test(en)) expect(id, p).toMatch(/bergeser dan menyempit/i);
      if (/cliff/i.test(en)) expect(id, p).toMatch(/tebing/i);
      if (/(single-shaft)[\s\S]*(IGV runs out|IGV is used up)/i.test(en)) expect(id, p).toMatch(/IGV[\s\S]*habis/i);
      if (/CO[\s\S]*(explod|blow up)/i.test(en)) expect(id, p).toBe('');
    }
    expect(PAIRS.filter(([, , id]) => /meledak|CO melonjak|CO lonjak/i.test(id))).toEqual([]);
  });
  it('kalibrasi bukan data unit dan bukan prediksi vendor: "literature" → "literatur" + "bukan data"; "vendor" tetap kata umum (tanpa nama vendor)', () => {
    const lit = PAIRS.filter(([, en]) => /calibrated to typical literature/i.test(en));
    expect(lit.length).toBeGreaterThan(2);
    expect(where(lit.filter(([, , id]) => !/literatur/i.test(id) || !/bukan (data|prediksi)/i.test(id)))).toEqual([]);
    const vend = PAIRS.filter(([, en]) => /not (a )?(unit or )?vendor/i.test(en));
    expect(vend.length).toBeGreaterThan(0);
    expect(where(vend.filter(([, , id]) => !/bukan/i.test(id) || !/vendor/i.test(id)))).toEqual([]);
    expect(JSON.stringify(PAIRS)).not.toMatch(/\b(Siemens|Solar Turbines|Caterpillar|Wärtsilä|Wartsila|Cummins|Rolls-Royce|Baker Hughes|Mitsubishi)\b/);
  });
  it('sisi ID bersih: tanpa nama fungsi / konstanta kode, tanpa tanda pisah panjang, angka desimal gaya Indonesia', () => {
    const names = Object.keys(thermo).filter((n) => /[a-z][A-Z0-9]|_/.test(n));
    const re = new RegExp(`(?<![\\p{L}\\p{N}_])(${names.join('|')})(?![\\p{L}\\p{N}_])`, 'u');
    expect(where(PAIRS.filter(([, , id]) => re.test(id)))).toEqual([]);
    expect(where(PAIRS.filter(([, , id]) => /—/.test(id)))).toEqual([]); // tanda pisah panjang (em dash)
    // desimal bertitik gaya en-US ("1.4") tidak boleh ada di teks ID; pemisah ribuan titik (2.200) boleh
    const bad = STATIC.filter(([, , id]) => /\d\.\d/.test(id.replace(/\d{1,3}(\.\d{3})+(?!\d)/g, '').replace(/\d+\.\d+\.\d+/g, '')));
    expect(where(bad)).toEqual([]);
  });
  it('angka statis di sisi ID sama dengan sisi EN (nilai tidak berubah saat diterjemahkan; pemisah ribuan / desimal diabaikan)', () => {
    const nums = (t) => (t.replace(/<[^>]+>/g, ' ').replace(/(\d)[.,](?=\d)/g, '$1').match(/\d+/g) ?? []);
    const bad = [];
    for (const [p, en, id] of STATIC) {
      const a = nums(en), b = nums(id);
      if (a.length && b.length && JSON.stringify([...new Set(a)].sort()) !== JSON.stringify([...new Set(b)].sort())) bad.push(`${p}: EN [${a}] vs ID [${b}]`);
    }
    expect(bad).toEqual([]);
  });
});

// D4: Scene 5–8. Kalimat tertentu dijaga per jalur karena memuat klaim yang tidak boleh bergeser maknanya.
describe('D4: Scene 6 (part-load), Scene 7 (kompresor), Scene 8 (emisi gabungan), sisi ID', () => {
  const S6 = STR_SOURCE.scene6, S7 = STR_SOURCE.scene7, S8 = STR_SOURCE.scene8;
  const id = (pair, ...a) => String(typeof pair.id === 'function' ? pair.id(...a) : pair.id);
  it('Scene 6: tebing CO single-shaft setelah IGV habis, twin-shaft bergeser bertahap, fuel split premix tetap, tanpa "CO meledak"', () => {
    const n = id(S6.note);
    expect(n).toMatch(/Single-shaft[\s\S]*tebing CO[\s\S]*IGV habis/);
    expect(n).toMatch(/twin-shaft[\s\S]*pergeseran bertahap/);
    expect(n).toMatch(/fuel split premix tetap/);
    expect(n).toMatch(/OEM\/CEMS/);
    expect(n).not.toMatch(/meledak|melonjak|lonjak/i);
    expect(id(S6.hudNote)).toMatch(/indikatif/);
    expect(id(S6.hudNote)).toMatch(/literatur, bukan data unit atau vendor/);
  });
  it('Scene 6: label NOx/CO indikatif, basis O₂ dan basis aktif disebut, kalibrasi bukan data unit atau vendor', () => {
    for (const k of ['nox', 'co']) {
      expect(id(S6.hud[k].label)).toMatch(/indikatif/);
      expect(id(S6.hud[k].tip)).toMatch(/15 % O₂/);
      expect(id(S6.hud[k].tip)).toMatch(/basis aktif/);
    }
    expect(id(S6.hud.calib.tip)).toMatch(/literatur, bukan data unit atau vendor/);
    expect(id(S6.messageWindow, 15, 50, '@ 15 % O₂', 'a', 'b')).toMatch(/ppmvd @ 15 % O₂/);
    expect(id(S6.messageWindow, 15, 50, '@ 15 % O₂', 'a', 'b')).toMatch(/\(model\)\.$/);
  });
  it('Scene 6: batas dan isian (override pengguna, CO hanya dari nilai izin/OEM) tidak terbaca sebagai klaim kepatuhan', () => {
    expect(id(S6.limits.tip)).toMatch(/override pengguna/);
    expect(id(S6.limits.tip)).toMatch(/tabel turbin tidak punya batas CO/);
    expect(id(S6.limits.tip)).toMatch(/basis tampilan aktif/);
    expect(id(S6.charts.limit.noxOverride)).toMatch(/override pengguna/);
    expect(id(S6.charts.limit.co)).toMatch(/isian pengguna/);
    expect(id(S6.hud.window.tip)).toMatch(/nilai model di bawah kedua batas presenter/);
  });
  it('Scene 6: pasangan konfigurasi memakai nama padanan (turbin generator / turbin kompresor)', () => {
    expect(id(S6.configs.single)).toBe('Turbin generator (single-shaft)');
    expect(id(S6.configs.twin)).toBe('Turbin kompresor (twin-shaft)');
    expect(id(S6.strategies.fuelOnly)).toBe('Tanpa IGV');
    expect(id(S6.tips.strategy)).toMatch(/fuel-only/);
  });
  it('Scene 7: istilah kompresor tetap (suction, discharge, head, surge), batas model disebut', () => {
    expect(id(S7.Psuc)).toMatch(/suction/);
    expect(id(S7.Pdis)).toMatch(/discharge/);
    expect(id(S7.hud.head.label)).toMatch(/Head/);
    expect(id(S7.note)).toMatch(/surge/);
    expect(id(S7.note)).toMatch(/tidak dimodelkan/);
    expect(id(S7.hud.nreq.tip)).toMatch(/tidak dimodelkan/);
    expect(id(S7.hud.load.tip)).toMatch(/Bukan klaim/);
    expect(id(S7.title)).toMatch(/hukum affinitas/);
    for (const k of ['nox', 'co']) expect(id(S7.hud[k].label)).toMatch(/indikatif/);
  });
  it('Scene 8: methane slip, CO₂e dan GWP dengan horizon, PM kualitatif, kalibrasi bukan data unit atau vendor', () => {
    expect(id(S8.slip)).toBe('Methane slip');
    expect(id(S8.messageNoSlip, 0.3)).toMatch(/methane slip/);
    expect(id(S8.messageNoSlip, 0.3)).toMatch(/\(model\)\./);
    expect(id(S8.messageSlip, 0.01, 0.1, 0.2)).toMatch(/CO₂e/);
    expect(id(S8.tips.slip)).toMatch(/CO₂e = CO₂ \+ GWP × CH₄/);
    expect(id(S8.hud.gwp.sub)).toMatch(/AR6/);
    expect(id(S8.hud.gwp.sub)).toMatch(/100 tahun/);
    expect(id(S8.charts.co2.caption, 'a', 'b', 28)).toMatch(/AR6, horizon 100 tahun/);
    expect(id(S8.pm.tip)).toMatch(/tidak dimodelkan/);
    expect(id(S8.hud.note)).toMatch(/Indikatif/);
    expect(id(S8.hud.note)).toMatch(/literatur, bukan data unit atau vendor/);
    expect(id(S8.charts.noxNote, 1, 1, 1, 11, 2.5, 15, 15)).toMatch(/literatur, bukan data unit atau vendor/);
    expect(id(S8.charts.noxNote, 1, 1, 1, 11, 2.5, 15, 15)).toMatch(/@ 15 % O₂/);
  });
});
