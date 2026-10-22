// Paket D: kalimat jujur model di sisi ID (dan kebersihan sisi ID). Aturan berbasis frasa di sisi EN, jadi otomatis
// berlaku untuk kelompok yang dimigrasi tahap berikutnya (D4: twin/single-shaft, D5: batas dan kebijakan, dst.).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { BASIS } from '../src/model/basis.js';
import { levelKey, cardData } from '../src/state/basisView.js';
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
    // panel asumsi (H, assumptions.*) sengaja boleh menyebut nama fungsi / konstanta (CLAUDE.md: hanya kartu Basis dan panel H)
    expect(where(PAIRS.filter(([p, , id]) => !/^assumptions\./.test(p) && re.test(id)))).toEqual([]);
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

// D5a: Scene 9 (kelima tab), konten Formation, banner dan chip belum diverifikasi.
describe('D5a: Scene 9, Formation, banner "Transcribed…" dan chip "not verified", sisi ID', () => {
  const S9 = STR_SOURCE.scene9;
  const id = (pair, ...a) => String(typeof pair.id === 'function' ? pair.id(...a) : pair.id);
  const findKey = (root, key) => { for (const [k, v] of Object.entries(root ?? {})) { if (k === key && isPair(v)) return v; if (v && typeof v === 'object' && !isPair(v)) { const r = findKey(v, key); if (r) return r; } } return null; };
  it('nama tab: "Limits" menjadi "Batas"; kelima tab disebut di tooltip tab', () => {
    expect(['limits', 'formation', 'levers', 'C', 'B'].map((k) => id(S9.tabs[k]))).toEqual(['Batas', 'Terbentuk', 'Tuas', 'Jendela beban', 'GRK']);
    const tip = id(S9.tips.tab);
    for (const n of ['Batas', 'Terbentuk', 'Tuas', 'Jendela beban', 'GRK']) expect(tip).toContain(n);
    expect(id(STR_SOURCE.regulation.scene6Link)).toMatch(/→ Batas$/);
  });
  it('komposisi bahan bakar tidak mengubah NOx / CO; EGR tidak tersedia; beban bukan tuas terpisah', () => {
    expect(id(S9.fuelPanel.noEffect)).toMatch(/Komposisi tidak mengubah NOx atau CO di model ini/);
    expect(id(S9.limitsTab.composition)).toMatch(/NOx dan CO di model ini tidak bergantung pada komposisi/);
    expect(id(S9.leversTab.egrNA)).toBe('tidak tersedia di model ini');
    expect(id(S9.leversTab.load)).toMatch(/^Beban bukan tuas terpisah/);
    expect(id(S9.leversTab.turbineNote)).toMatch(/tab 4, Jendela beban/);
  });
  it('banner "Transcribed…" dan chip "not verified": makna sama kuat (ditranskripsi, cocokkan sebelum mengutip, belum diverifikasi)', () => {
    const banner = findKey(STR_SOURCE.regulation, 'banner');
    expect(banner.en).toBe('Transcribed from the published tables. Confirm against the official text before quoting.');
    expect(banner.id).toBe('Ditranskripsi dari tabel yang dipublikasikan. Cocokkan dengan teks resmi sebelum mengutip.');
    const chip = findKey(STR_SOURCE.regulation, 'unverified');
    expect(chip.id).toBe('belum diverifikasi');
    expect(id(S9.disclaimer, 'a', 'b')).toMatch(/ditranskripsi, periksa ke teks resmi sebelum mengutip/);
    expect(id(S9.disclaimer, 'a', 'b')).toMatch(/tidak ada batas yang ditulis di kode/);
  });
  it('batas dan status: nilai model vs batas (indikatif), bukan hasil uji; CO turbin hanya dari nilai izin atau OEM', () => {
    expect(id(S9.leversTab.hud.status.tip)).toBe('Nilai model vs batas (indikatif). Bukan hasil uji.');
    expect(id(S9.leversTab.hud.nox.label)).toMatch(/indikatif/);
    expect(id(S9.C.prompt)).toMatch(/Tabel turbin tidak punya batas CO/);
    expect(id(S9.hud.limC.tip)).toMatch(/tabel turbin tidak punya batas CO/);
    expect(id(S9.leversTab.caption, 'a', 'b')).toMatch(/Dikalibrasi ke nilai tipikal literatur, bukan data lapangan/);
    expect(id(S9.C.model)).toMatch(/tebing CO setelah IGV habis/);
    expect(id(S9.C.model)).toMatch(/jendela operasi bergeser dan menyempit/);
    expect(id(S9.C.caption, 'a', 'b', 'c', 'd', true)).toMatch(/melampaui batas CO/);
  });
  it('CO₂ vs CO₂e: CO₂e = CO₂ + GWP × slip CH₄ (AR6, 100 tahun), CO₂ naik sebanding bahan bakar, bukan klaim kepastian', () => {
    expect(id(S9.B.slipNote, 29.8)).toMatch(/CO₂e = CO₂ \+ GWP × slip CH₄/);
    expect(id(S9.B.slipNote, 29.8)).toMatch(/IPCC AR6, 100 tahun/);
    expect(id(S9.B.result, 3, 500, 515)).toMatch(/\(model\)\.$/);
    expect(id(S9.B.caption, 1)).toMatch(/indikatif$/);
    expect(id(S9.B.sub.caption)).toMatch(/indikatif$/);
    expect(id(S9.titles.B)).toMatch(/methane slip menambah CO₂e/);
  });
});

describe('D5a: content/emission_formation.json sisi ID', () => {
  const form = JSON.parse(readFileSync(new URL('../content/emission_formation.json', import.meta.url), 'utf8'));
  const pairs = [];
  const walk = (o, p) => { if (isPair(o)) pairs.push([p, o]); else if (Array.isArray(o)) o.forEach((x, i) => walk(x, `${p}[${i}]`)); else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, `${p}.${k}`); };
  walk(form.equipment, 'equipment');
  const nums = (t) => (t.replace(/(\d)[.,](?=\d)/g, '$1').match(/\d+/g) ?? []).join(',');
  it('angka dan rumus kimia sama dengan sisi EN (massa molar 64,07 / 32,06, 44,01 / 12,011, NO2, H2S, Permen LH 13/2009)', () => {
    const bad = pairs.filter(([, v]) => nums(v.en) !== nums(v.id)).map(([p, v]) => `${p}: [${nums(v.en)}] vs [${nums(v.id)}]`);
    expect(bad).toEqual([]);
    expect(pairs.some(([, v]) => /64\.07 \/ 32\.06/.test(v.en) && /64,07 \/ 32,06/.test(v.id))).toBe(true);
    expect(pairs.some(([, v]) => /44\.01 \/ 12\.011/.test(v.en) && /44,01 \/ 12,011/.test(v.id))).toBe(true);
  });
  it('tanpa klaim kepatuhan, tanpa "meledak", tanpa em dash, tanpa nama vendor', () => {
    const idText = pairs.map(([, v]) => v.id).join('\n');
    expect(idText).not.toMatch(/\b(lulus|patuh|compliant|memenuhi baku mutu)\b/i);
    expect(idText).not.toMatch(/meledak|melonjak/i);
    expect(idText).not.toMatch(/—/);
    expect(idText).not.toMatch(/\b(Siemens|Solar Turbines|Caterpillar|Wärtsilä|Cummins|Rolls-Royce|Baker Hughes|Mitsubishi)\b/);
  });
  it('catatan CO turbin: tabel Permen LH 13/2009 tidak punya batas CO; batas dari izin lokasi atau jaminan OEM', () => {
    const co = form.equipment.turbine.params.CO.formation.rateNote;
    expect(co.id).toMatch(/Permen LH 13\/2009 tidak punya batas CO/);
    expect(co.id).toMatch(/izin operasi unit atau jaminan OEM/);
    expect(form.equipment.turbine.params.CO.modeled).toBe('semi-empirical');
  });
  it('formasi NOx diesel / mesin gas / turbin: mekanisme termal, tuas dan efek samping tetap disebut (EGR, jelaga, misfire, IGV)', () => {
    const g = (path) => path.split('.').reduce((o, k) => o[k], form.equipment);
    expect(g('diesel.params.NOx.levers').some((l) => /EGR/.test(l.label.id) && /Tidak tersedia di semua mesin/.test(l.consequence.id))).toBe(true);
    expect(g('gas-engine.params.NOx.levers')[0].consequence.id).toMatch(/Misfire/);
    expect(g('turbine.params.NOx.levers')[0].consequence.id).toMatch(/Jendela operasi menutup di kedua ujung/);
    expect(g('turbine.params.NOx.levers')[1].consequence.id).toMatch(/fuel split premix tetap/);
  });
});

// D5b: Scene 10–11, controls.json, closing.json, kalimat hdr.switches.
describe('D5b: Scene 10–11, controls.json, closing.json, hdr.switches, sisi ID', () => {
  const S10 = STR_SOURCE.scene10, S11 = STR_SOURCE.scene11;
  const id = (pair, ...a) => String(typeof pair.id === 'function' ? pair.id(...a) : pair.id);
  const readJson = (f) => JSON.parse(readFileSync(new URL(`../content/${f}`, import.meta.url), 'utf8'));
  const controls = readJson('controls.json'), closing = readJson('closing.json'), help = readJson('help.json');
  const card = (cid) => controls.cards.find((c) => c.id === cid);
  const all = (o) => (isPair(o) ? [o] : Array.isArray(o) ? o.flatMap(all) : o && typeof o === 'object' ? Object.values(o).flatMap(all) : []);
  it('judul dan pesan kunci: kartu dari file (diisi presenter), bukan dari model; besarnya kualitatif', () => {
    expect(id(S10.title)).toBe('Perangkat pengendali emisi');
    expect(id(S10.note)).toMatch(/content\/controls\.json \(diisi presenter\), bukan dari model/);
    expect(id(S10.note)).toMatch(/Besarnya kualitatif; periksa sebelum dipakai/);
    expect(id(S11.title)).toBe('Penutup');
    expect(id(S11.message)).toMatch(/bukan melonggarkan batas, tetapi mengukur cara mesin benar-benar bekerja/);
    expect(id(S11.note)).toMatch(/tanpa klaim baru/);
  });
  it('kartu: besar efek butuh data unit (bukan angka), tanpa angka model, tanpa nama vendor', () => {
    for (const c of controls.cards) {
      const texts = all([c.name, c.efficiency, c.lowers, c.raises, c.operation]);
      for (const t of texts) expect(/\d/.test(t.id.replace(/Scene \d+/g, "")), `${c.id}: ${t.id}`).toBe(false);
      const enNeeds = texts.filter((t) => /unit data|unit or supplier data|needs unit data/i.test(t.en));
      for (const t of enNeeds) expect(t.id, `${c.id}: ${t.id}`).toMatch(/data unit/);
    }
    const idText = all(controls).map((t) => t.id).join('\n');
    expect(idText).not.toMatch(/\b(Siemens|Solar Turbines|Caterpillar|Wärtsilä|Cummins|Rolls-Royce|Baker Hughes|Mitsubishi)\b/);
    expect(idText).not.toMatch(/\b(lulus|patuh|compliant)\b|—/i);
  });
  it('kartu kunci: DLN (jadwal OEM tidak dimodelkan), lean-burn (methane slip menambah CO₂e), EGR, SCR memutus trade-off, oksidasi tidak menurunkan NOx', () => {
    expect(card('dln').name.id).toBe('DLN / lean premix');
    expect(card('scr').raises[0].id).toMatch(/^Ammonia slip/);
    expect(card('oxcat').lowers[0].id).toMatch(/VOC \(senyawa organik volatil\)/);
    expect(card('dln').operation[0].id).toMatch(/jadwal OEM, tidak dimodelkan/);
    expect(card('dln').raises[0].id).toMatch(/risiko nyala tidak stabil/);
    expect(card('leanburn').raises[1].id).toMatch(/Methane slip .* menambah CO₂e/);
    expect(card('leanburn').efficiency.id).toMatch(/memakan keunggulan CO₂e \(lihat Scene 8\)/);
    expect(card('egr').name.id).toMatch(/^EGR /);
    expect(card('scr').lowers[0].id).toMatch(/Memutus trade-off dengan ruang bakar/);
    expect(card('oxcat').raises[0].id).toBe('Tidak menurunkan NOx');
  });
  it('penutup: tiga poin dan empat opsi tetap bermakna sama (suhu nyala eksponensial, jendela turbin kompresor bergerak, batas efektif memperhitungkan GRK, CEMS)', () => {
    expect(closing.points.map((p) => p.id)).toEqual([
      'Suhu nyala menentukan NOx secara eksponensial.',
      'Tiap mesin punya jendela operasinya sendiri, dan jendela turbin kompresor bergerak mengikuti proses.',
      'Batas yang efektif harus memperhitungkan jenis mesin, rentang beban, dan dampak GRK.',
    ]);
    expect(closing.options.map((o) => o.id)).toEqual(['by-type', 'load-range', 'inventory', 'cems']);
    expect(closing.options[3].text.id).toMatch(/Pemantauan kontinu \(CEMS\)/);
    expect(closing.options[2].text.id).toMatch(/^Evaluasi NOx dan GRK bersama/);
  });
  it('hdr.switches: sakelar bahasa menerjemahkan seluruh aplikasi (bukan hanya halaman belajar); catatan presenter dan nama resmi regulasi tetap Indonesia', () => {
    const t = help.items['hdr.switches'];
    expect(t.how.en).toMatch(/change the language of the whole app/);
    expect(t.how.en).not.toMatch(/for now|rest of the app stays in English/);
    expect(t.how.en).toMatch(/Presenter notes stay in Indonesian/);
    expect(t.how.en).toMatch(/official regulation names stay in Indonesian/);
    expect(t.how.id).toMatch(/mengubah bahasa seluruh aplikasi/);
    expect(t.how.id).not.toMatch(/sementara|tetap berbahasa Inggris/);
    expect(t.how.id).toMatch(/Catatan presenter tetap berbahasa Indonesia/);
    expect(t.how.id).toMatch(/nama resmi regulasi tetap berbahasa Indonesia/);
    expect(t.how.id).toMatch(/Gelap dan Terang/);
  });
  it('hdr.status: ID memakai nama chip yang tampil ("Kualitas turun"), lencana bukan klaim tentang unit', () => {
    const t = help.items['hdr.status'];
    expect(t.what.id).toMatch(/chip Kualitas turun/);
    expect(t.how.id).toMatch(/Ini tidak menjamin angka apa pun cocok dengan data unit/);
    expect(id(STR_SOURCE.app.qualityFlag)).toBe('Kualitas turun (Auto)');
  });
});

// D6: panel asumsi (H), kartu Basis, pengecualian basis.js (tetap English).
describe('D6: panel asumsi, kartu Basis, basis.js tetap English, sisi ID', () => {
  const A = STR_SOURCE.assumptions, K = STR_SOURCE.basis.card;
  const id = (pair, ...a) => String(typeof pair.id === 'function' ? pair.id(...a) : pair.id);
  const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  it('kalimat kejujuran panel H: indikatif, kalibrasi ke nilai tipikal literatur bukan data unit atau vendor, efek butuh data OEM/CEMS unit', () => {
    expect(id(A.intro)).toMatch(/^Semua korelasi emisi bersifat indikatif\./);
    expect(id(A.intro)).toMatch(/dikalibrasi ke nilai tipikal literatur, bukan data unit atau vendor/);
    expect(id(A.calib.notUnit)).toMatch(/^Bukan data unit atau vendor\. Ganti dengan data CEMS\/OEM/);
    expect(id(A.flame.title)).toMatch(/indikatif ±100 K/);
    expect(id(A.turbine.items[1])).toMatch(/Fuel split premix tetap/);
    expect(id(A.turbine.items[1])).toMatch(/tidak dimodelkan/);
    expect(id(A.turbine.items[3])).toMatch(/Besar efeknya butuh data OEM\/CEMS unit Anda/);
    expect(id(A.turbine.items[4])).toMatch(/single-shaft = IGV menjaga T3 tetap[\s\S]*Twin-shaft/);
    expect(id(A.compressor.items[3])).toMatch(/Bukan klaim tentang beban unit sungguhan/);
    expect(id(A.engine.items[3])).toMatch(/bukan prediksi vendor/);
    expect(id(A.issues.intro)).toMatch(/bukan koreksi tersembunyi/);
  });
  it('GWP dan CO₂e: 29,8 (AR6, horizon 100 tahun), horizon lain memberi hasil lain, CO₂e sedikit konservatif; PM hanya kualitatif', () => {
    expect(id(A.ghg.items[1])).toMatch(/GWP CH₄ = 29,8 \(AR6, horizon 100 tahun, CH₄ fosil\)/);
    expect(id(A.ghg.items[1])).toMatch(/Horizon waktu lain memberi hasil lain/);
    expect(id(A.ghg.items[2])).toMatch(/CO₂e sedikit konservatif/);
    expect(id(A.ghg.items[3])).toMatch(/PM tidak dimodelkan \(hanya kualitatif\)/);
  });
  it('panel H boleh menyebut nama fungsi: nama tetap persis (cylinderSim, lossFrac, ppmToGkWh, co2eWithSlip, co2Specific, speedForHead, gasCompressor, coDLN)', () => {
    const all = JSON.stringify([A.engine, A.turbine, A.ghg, A.compressor].map((g) => JSON.parse(JSON.stringify(g, (k, v) => (isPair(v) ? v.id : v)))));
    for (const n of ['cylinderSim', 'lossFrac', 'ppmToGkWh', 'co2eWithSlip', 'co2Specific', 'speedForHead', 'gasCompressor', 'coDLN']) expect(all, n).toContain(n);
  });
  it('kartu Basis: label terjemahan; "source to verify" dan lokasi belum diverifikasi tidak melunak', () => {
    expect(id(K.derivation)).toBe('Diturunkan dari');
    expect(id(K.toVerify)).toBe('Source to verify');
    expect(id(K.unknownRef, 'x')).toMatch(/^source to verify \(x tidak ada di daftar referensi\)$/);
    expect(id(K.locatorUnchecked)).toBe('lokasi belum diverifikasi');
    expect(id(K.note)).toMatch(/belum dicocokkan dengan salinan cetak/);
    expect(id(K.knownIssue)).toBe('Penyimpangan yang diketahui');
  });
  it('PENGECUALIAN EKSPLISIT: src/model/basis.js (derivasi, asumsi, penyimpangan) tetap English; sisi ID punya satu catatan tetap, kosong di sisi EN', () => {
    const note = STR_SOURCE.basis.enOnly;
    expect(note.en).toBe('');
    expect(note.id).toMatch(/hanya tersedia dalam bahasa Inggris/);
    for (const [name, b] of Object.entries(BASIS)) {
      expect(typeof b.derivation, name).toBe('string'); // bukan pasangan { en, id }
      expect(b.assumptions.every((x) => typeof x === 'string'), name).toBe(true);
      expect(levelKey(b.level), `${name}: tingkat ${b.level} tanpa kunci STR.common.level`).not.toBeNull();
    }
    const d = cardData('compressor', null);
    expect(d.levelKeys.every(Boolean)).toBe(true);
    expect(d.levels.every((x) => typeof x === 'string')).toBe(true);
  });
  it('catatan tetap bukan catatan kerja: tidak lewat markNote (tidak ikut Hide working notes) di kartu Basis dan panel H', () => {
    const card = read('src/ui/basisCard.js'), asm = read('src/ui/assumptions.js');
    expect(card).toMatch(/B\.enOnly/);
    expect(card).not.toMatch(/markNote\([^)]*enOnly/);
    expect(card).toMatch(/data-en-only/);
    expect(asm).toMatch(/STR\.basis\.enOnly/);
    expect(asm).not.toMatch(/markNote/);
    expect((asm.match(/data-en-only/g) ?? []).length).toBe(2); // bagian fungsi dan bagian penyimpangan
  });
  it('aturan tertulis di CLAUDE.md (basis.js tetap English; catatan tetap di sisi ID; dijaga tes)', () => {
    const md = read('CLAUDE.md');
    expect(md).toMatch(/src\/model\/basis\.js[^\n]*TETAP English/);
    expect(md).toMatch(/basis\.enOnly/);
  });
});


describe('U1: pengaturan satuan (Settings → Units), kartu bantuan, sisi ID', () => {
  const U = STR_SOURCE.units;
  const help = JSON.parse(readFileSync(new URL('../content/help.json', import.meta.url), 'utf8')).items;
  it('contoh hitung berlabel "model example, indicative" / "indikatif", bukan data unit dan bukan angka vendor', () => {
    expect(U.guide.exampleTitle.en).toMatch(/Model example \(indicative\)/);
    expect(U.guide.exampleTitle.id).toMatch(/Contoh dari model \(indikatif\)/);
    expect(U.guide.exampleNote.en).toMatch(/Indicative[\s\S]*typical literature values[\s\S]*not unit data and not a vendor figure/);
    expect(U.guide.exampleNote.id).toMatch(/indikatif[\s\S]*tipikal literatur[\s\S]*Bukan data unit dan bukan angka vendor/i);
  });
  it('basis O₂ dan volume selalu di samping angka contoh: baris tabel, ringkasan basis, dan kalimat pembuka', () => {
    for (const lang of ['en', 'id']) {
      const row = U.guide.basisOf[lang](15, 25), line = U.basisLine[lang](15, 0), lead = U.guide.exampleLead[lang](14.8, 15);
      for (const t of [row, line, lead]) { expect(t, lang).toMatch(/15 % O₂/); }
      expect(row).toMatch(lang === 'en' ? /dry/ : /kering/); expect(row).toMatch(/25 °C/);
      expect(line).toMatch(lang === 'en' ? /dry/ : /kering/); expect(line).toMatch(/0 °C/);
      expect(lead).toMatch(lang === 'en' ? /dry/ : /kering/); expect(lead).toMatch(/NO₂/); expect(lead).toMatch(/ppmvd/);
    }
    expect(U.guide.exampleHead.map((c) => c.id)).toEqual(['Basis', 'ppmvd', 'mg/Nm³']);
  });
  it('penjelasan: butuh O₂ acuan karena udara berlebih mengencerkan; butuh basis volume karena gas memuai; bandingkan hanya pada basis yang sama', () => {
    expect(U.guide.whyO2.en).toMatch(/Excess air dilutes/); expect(U.guide.whyO2.id).toMatch(/Udara berlebih mengencerkan/);
    expect(U.guide.whyO2.id).toMatch(/O₂ acuan/);
    expect(U.guide.whyVolume.en).toMatch(/expands with temperature/); expect(U.guide.whyVolume.id).toMatch(/memuai/);
    expect(U.guide.whyVolume.id).toMatch(/basis volume/);
    expect(U.guide.differ.en).toMatch(/the gap is not a model difference[\s\S]*same basis/); expect(U.guide.differ.id).toMatch(/selisihnya bukan selisih model[\s\S]*basis yang sama/);
    expect(U.guide.what.id).toMatch(/kering/);
    expect(U.guide.how.id).toMatch(/NOx dihitung sebagai NO₂/);
  });
  it('jalur regulasi tidak terpengaruh: kalimat cakupan menyebut basis regulasi dan Within / Above; halaman Learn, kartu bantuan, catatan presenter tetap SI', () => {
    expect(U.scope.en).toMatch(/limit checks \(Within \/ Above\) always use the regulation basis and do not depend on these choices/);
    expect(U.scope.id).toMatch(/Within \/ Above[\s\S]*basis regulasi[\s\S]*tidak bergantung pada pilihan ini/);
    expect(U.scope.en).toMatch(/Learn pages, help cards and presenter notes keep SI units/);
    expect(U.scope.id).toMatch(/tetap memakai satuan SI/);
    expect(U.lead.en).toMatch(/limit checks stay the same/); expect(U.lead.id).toMatch(/pemeriksaan batas tetap/);
  });
  it('tekanan dan debit: psia absolut (bukan gauge); debit aktual, bukan standar; selisih suhu tanpa offset', () => {
    expect(U.qtyTip.pressure.en).toMatch(/absolute[\s\S]*psia, not psig/); expect(U.qtyTip.pressure.id).toMatch(/absolut[\s\S]*psia, bukan psig/);
    expect(U.qtyTip.power.en).toMatch(/mechanical \(imperial\) horsepower[\s\S]*not metric hp/); expect(U.qtyTip.power.id).toMatch(/horsepower mekanik[\s\S]*bukan hp metrik/);
    expect(U.qtyTip.volumeFlow.en).toMatch(/Actual flow at suction conditions\. Standard flow[\s\S]*is not modeled/); expect(U.qtyTip.volumeFlow.id).toMatch(/Laju alir aktual pada kondisi suction\. Laju alir standar[\s\S]*tidak dimodelkan/);
    expect(U.qtyTip.temperature.en).toMatch(/with no offset/); expect(U.qtyTip.temperature.id).toMatch(/tanpa offset/);
    expect(U.qtyTip.concentration.en).toMatch(/side by side keep both/); expect(U.qtyTip.concentration.id).toMatch(/berdampingan tetap menampilkan keduanya/);
  });
  it('kartu bantuan ui.units / ui.concentration: dua bahasa, ppmvd dan mg/Nm³, basis, "bukan data unit", tanpa klaim kepatuhan', () => {
    for (const id of ['ui.units', 'ui.concentration']) expect(help[id], id).toBeTruthy();
    const c = help['ui.concentration'];
    expect(c.how.en).toMatch(/molar mass over molar volume[\s\S]*reference O₂[\s\S]*volume basis[\s\S]*not a model difference[\s\S]*same basis/);
    expect(c.how.id).toMatch(/massa molar dibagi volume molar[\s\S]*O₂ acuan[\s\S]*basis volume[\s\S]*bukan selisih model[\s\S]*basis yang sama/);
    expect(c.how.id).toMatch(/ppmvd/); expect(c.how.id).toMatch(/mg\/Nm³/);
    expect(c.glossary).toEqual(['ppmvd', 'nm3', 'o2-correction']);
    expect(help['ui.units'].how.en).toMatch(/limit checks/); expect(help['ui.units'].how.id).toMatch(/pemeriksaan batas/);
    for (const it of [help['ui.units'], help['ui.concentration']]) for (const t of [it.what.id, it.how.id]) expect(t).not.toMatch(/\b(lulus|patuh|compliant|memenuhi (baku mutu|batas))\b/i);
  });
  it('nama preset: SI dan "US customary" tetap (daftar Tetap Inggris); "Custom" → "Kustom"; satuan preset tidak mengubah konsentrasi', () => {
    expect([U.preset.si.id, U.preset.us.id, U.preset.custom.id]).toEqual(['SI', 'US customary', 'Kustom']);
    expect(U.presetTip.us.id).toMatch(/Satuan US customary:[\s\S]*Konsentrasi gas tetap seperti yang ditampilkan tiap scene/);
    expect(U.exampleLead?.id ?? U.guide.exampleLead.id(14.8, 15)).toMatch(/Turbin generator \(single-shaft\)/);
    expect(U.presetTip.si.id).toMatch(/Daya dan konsentrasi gas tetap/);
  });
});
