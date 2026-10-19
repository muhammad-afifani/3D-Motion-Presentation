// Paket D1: kerangka dua bahasa (state/i18n.js), format angka ikut bahasa dan isian koma/titik (ui/format.js),
// kotak isian angka (ui/numberInput.js). Kelompok di MIGRATED_GROUPS wajib lengkap di kedua bahasa.
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { STR, STR_SOURCE, applyStringLang } from '../src/ui/strings.js';
import { MIGRATED_GROUPS, isPair, createStrings, resolveText } from '../src/state/i18n.js';
import { KEEP, KEEP_TEXTS, KEEP_PATHS, keptIdentical } from './helpers/keepEnglish.js';
import { applyToDoc } from '../scripts/gen-tetap-inggris.mjs';
import { createRelabeler } from '../src/ui/relabel.js';
import { validateRegulations, validateReferences } from '../src/state/content.js';
import { fmt, pct, sci, formatNumber, formatInput, parseNumber, checkNumber, setNumberLang, numberLang, dateTime } from '../src/ui/format.js';
import { tickDigits } from '../src/charts/chartBase.js';
import { ID_WORDS } from './language.test.js';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(`${ROOT}${p}`, 'utf8');
const ID_RE = new RegExp(`(?<![\\p{L}\\p{N}_])(${ID_WORDS.join('|')})(?![\\p{L}\\p{N}_])`, 'iu');
const sample = (v) => (typeof v === 'function' ? v('1', '2', '3', '4', '5', '6') : v);

const atPath = (root, dotted) => dotted.split('.').reduce((o, k) => o[k], root);
/** Semua daun kelompok sumber: [jalur, nilai]; larik: jalur[i]. */
function leaves(o, path, out = []) {
  if (isPair(o) || typeof o !== 'object' || o == null) { out.push([path, o]); return out; }
  for (const [k, v] of Object.entries(o)) leaves(v, Array.isArray(o) ? `${path}[${k}]` : `${path}.${k}`, out);
  return out;
}
/** [jalur tanpa awalan STR., pasangan] untuk semua kelompok yang sudah dimigrasi */
const migrated = MIGRATED_GROUPS.flatMap((g) => leaves(atPath(STR_SOURCE, g), g));

const json = (f) => JSON.parse(read(`content/${f}.json`));
/** [jalur, pasangan] untuk semua pasangan { en, id } di dalam satu berkas */
const pairsIn = (x, path = '', out = []) => {
  if (Array.isArray(x)) x.forEach((v, i) => pairsIn(v, `${path}[${i}]`, out));
  else if (x && typeof x === 'object') {
    if (isPair(x)) out.push([path, x]);
    else for (const [k, v] of Object.entries(x)) pairsIn(v, `${path}.${k}`, out);
  }
  return out;
};
const files = { glossary: json('glossary'), references: json('references'), regulations: json('regulations') };

afterEach(() => { applyStringLang('en'); setNumberLang('en'); });

describe('kelompok dua bahasa (MIGRATED_GROUPS)', () => {
  it('kelompok terdaftar ada di strings.js dan tidak kosong; D2 sudah masuk', () => {
    expect(MIGRATED_GROUPS).toEqual(expect.arrayContaining(['theme', 'formula', 'input', 'common', 'app', 'nav', 'pages', 'content', 'debug', 'snapshot', 'presenter', 'regulation', 'landing', 'basis.refs']));
    for (const g of MIGRATED_GROUPS) expect(Object.keys(atPath(STR_SOURCE, g) ?? {}).length, g).toBeGreaterThan(0);
    expect(migrated.length).toBeGreaterThan(330);
  });
  it('setiap daun berupa pasangan { en, id } lengkap; tipe dan jumlah argumen sama', () => {
    const notPair = migrated.filter(([, v]) => !isPair(v)).map(([p]) => p);
    expect(notPair).toEqual([]);
    for (const [p, v] of migrated) {
      expect(typeof v.en, p).toBe(typeof v.id);
      if (typeof v.en === 'function') expect(v.id.length, p).toBe(v.en.length);
      expect(String(sample(v.en) ?? '').trim(), `${p}.en`).not.toBe('');
      expect(String(sample(v.id) ?? '').trim(), `${p}.id`).not.toBe('');
    }
  });
  it('sisi id tidak sama dengan sisi en kecuali entri docs/tetap_inggris.json (menangkap terjemahan yang tertinggal)', () => {
    const same = migrated.filter(([p, v]) => sample(v.en) === sample(v.id) && !keptIdentical(p, sample(v.en))).map(([p, v]) => `${p}: ${sample(v.en)}`);
    expect(same).toEqual([]);
  });
  it('sisi en tetap bebas kata Indonesia', () => {
    expect(migrated.filter(([, v]) => ID_RE.test(sample(v.en))).map(([p, v]) => `${p}: ${sample(v.en)}`)).toEqual([]);
  });
  it('sisi id tidak membawa kalimat English yang tertinggal (kata fungsi English umum)', () => {
    const EN_WORDS = /(?<![\p{L}\p{N}_])(the|and|with|for|not|from|this|that|are|is|you|your|press|open|close|show|hide|click|saved|failed|error)(?![\p{L}\p{N}_])/iu;
    // kutipan nama tetap ("source to verify", "Start here") dan token berkode boleh muncul; hanya kalimat yang diperiksa
    const bad = migrated.filter(([, v]) => typeof v.id !== 'function' && typeof v.id === 'string' && v.id !== v.en && EN_WORDS.test(v.id.replace(/"[^"]*"/g, '').replace(/content\/[\w.]+/g, ''))).map(([p, v]) => `${p}: ${v.id}`);
    expect(bad).toEqual([]);
  });
});

describe('content/*.json dua bahasa (D2): glossary, references, regulations', () => {
  it('jumlah pasangan: glossary (term + expansion + definition), references (use), regulations (scope, equipment, label, basisNote, notes)', () => {
    expect(pairsIn(files.glossary).length).toBe(40 + 26 + 40);
    expect(pairsIn(files.references).length).toBe(51);
    expect(pairsIn(files.regulations).length).toBeGreaterThanOrEqual(15);
  });
  it('setiap pasangan lengkap; sisi id tidak sama dengan en kecuali entri docs/tetap_inggris.json', () => {
    for (const [f, data] of Object.entries(files)) {
      for (const [p, v] of pairsIn(data)) {
        expect(String(v.en).trim().length, `${f}${p}.en`).toBeGreaterThan(0);
        expect(String(v.id).trim().length, `${f}${p}.id`).toBeGreaterThan(0);
        if (v.en === v.id) expect(KEEP_TEXTS.has(v.en), `${f}${p}: "${v.en}" sama di kedua bahasa tetapi tidak ada di daftar Tetap Inggris`).toBe(true);
      }
    }
  });
  it('sisi id tidak membawa kalimat English yang tertinggal', () => {
    const EN_WORDS = /(?<![\p{L}\p{N}_])(the|and|with|for|not|from|this|that|are|is|you|your|press|open|close|show|hide|click|saved|failed|error)(?![\p{L}\p{N}_])/iu;
    const bad = [];
    for (const [f, data] of Object.entries(files)) for (const [p, v] of pairsIn(data)) if (v.id !== v.en && EN_WORDS.test(v.id.replace(/"[^"]*"/g, ''))) bad.push(`${f}${p}: ${v.id.slice(0, 80)}`);
    expect(bad).toEqual([]);
  });
  it('nama resmi regulasi: satu string Indonesia apa adanya (tanpa pasangan); penjelasan English singkat: pasangan', () => {
    for (const s of files.regulations.sources) {
      expect(typeof s.title, s.id).toBe('string'); expect(typeof s.short, s.id).toBe('string');
      expect(s.title, s.id).toMatch(/^Peraturan Menteri /);
      expect(s.short, s.id).toMatch(/^Permen LHK? \d+\/\d{4}$/);
      expect(isPair(s.scope), `${s.id}.scope`).toBe(true);
    }
    expect(validateRegulations(files.regulations)).toEqual([]);
  });
  it('validateRegulations: nama resmi sebagai pasangan ditolak, penjelasan sebagai string polos ditolak, bagian lain wajib pasangan', () => {
    const clone = () => JSON.parse(JSON.stringify(files.regulations));
    const codes = (j) => validateRegulations(j).map((e) => `${e.field}:${e.code}`);
    const a = clone(); a.sources[0].title = { en: 'Regulation', id: 'Peraturan' };
    expect(codes(a)).toContain('sources[0].title:officialName');
    const b = clone(); b.sources[0].short = { en: 'LH 13', id: 'LH 13' };
    expect(codes(b)).toContain('sources[0].short:officialName');
    const c = clone(); c.sources[0].scope = 'Gas turbines';
    expect(codes(c)).toContain('sources[0].scope:pair');
    const d = clone(); d.groups[0].equipment = 'Gas turbine';
    expect(codes(d)).toContain('groups[0].equipment:pair');
    const e = clone(); e.groups[1].capacityClasses[0].label = { en: '100-500 kW', id: '' };
    expect(codes(e)).toContain('groups[1].capacityClasses[0].label:pair');
    const f = clone(); f.groups[0].notes[0] = 'Plain text note';
    expect(codes(f)).toContain('groups[0].notes:pair');
    const g = clone(); g.sources[0].title = '';
    expect(codes(g)).toContain('sources[0].title:text');
    expect(codes(clone())).toEqual([]);
  });
  it('validateReferences: use wajib pasangan', () => {
    const r = JSON.parse(JSON.stringify(files.references)); r.references[0].use = 'Plain';
    expect(validateReferences(r).map((e) => `${e.field}:${e.code}`)).toContain('references[0].use:pair');
    expect(validateReferences(files.references)).toEqual([]);
  });
});

describe('docs/tetap_inggris.json: daftar putih "Tetap Inggris"', () => {
  it('berkas data: tiap kelompok punya alasan dan penanda terhadap PADANAN_ISTILAH.md; padanan menyimpang dijelaskan', () => {
    expect(KEEP.version).toBe(1);
    expect(KEEP.groups.length).toBeGreaterThan(5);
    const ids = new Set();
    for (const g of KEEP.groups) {
      expect(ids.has(g.id), g.id).toBe(false); ids.add(g.id);
      expect(String(g.title ?? '').length, g.id).toBeGreaterThan(3);
      expect(String(g.reason ?? '').length, g.id).toBeGreaterThan(30);
      expect(['sesuai', 'menyimpang', 'tidak-diatur'], g.id).toContain(g.padanan);
      if (g.padanan === 'menyimpang') expect(String(g.padananNote ?? '').length, g.id).toBeGreaterThan(30);
      expect((g.texts?.length ?? 0) + (g.paths?.length ?? 0) + (g.inline?.length ?? 0), g.id).toBeGreaterThan(0);
    }
  });
  it('setiap teks dan jalur whole-string yang terdaftar dipakai oleh pasangan identik (tanpa entri basi) atau ditandai inline', () => {
    const used = new Set([
      ...migrated.filter(([, v]) => sample(v.en) === sample(v.id)).flatMap(([p, v]) => [sample(v.en), p]),
      ...Object.values(files).flatMap((data) => pairsIn(data).filter(([, v]) => v.en === v.id).map(([, v]) => v.en)),
    ]);
    // teks yang baru dipakai tahap D3–D6 boleh belum muncul; D2 sudah memakai hampir semuanya
    const unused = [...KEEP_TEXTS, ...KEEP_PATHS].filter((t) => !used.has(t));
    expect(unused).toEqual([]);
  });
  it('bagian "Tetap Inggris" docs/PADANAN_ISTILAH.md sama dengan hasil scripts/gen-tetap-inggris.mjs', () => {
    const doc = read('docs/PADANAN_ISTILAH.md');
    expect(applyToDoc(doc, KEEP)).toBe(doc);
  });
});

describe('STR: tampilan diisi di tempat saat bahasa berubah', () => {
  it('default English; id mengganti teks tanpa mengganti objek (alias modul tetap sah)', () => {
    const T = STR.theme, I = STR.input;
    expect(T.dark).toBe('Dark');
    expect(I.min('5')).toBe('Minimum 5');
    applyStringLang('id');
    expect(STR.theme).toBe(T);
    expect(T.dark).toBe('Gelap');
    expect(STR.formula.label).toBe('Rumus');
    expect(I.min('5')).toBe('Minimal 5');
    applyStringLang('en');
    expect(T.dark).toBe('Dark');
  });
  it('kelompok yang belum dimigrasi tidak disalin ulang (objek sumber yang sama)', () => {
    const topMigrated = new Set(MIGRATED_GROUPS.map((g) => g.split('.')[0]));
    for (const g of Object.keys(STR_SOURCE).filter((k) => !topMigrated.has(k))) expect(STR[g], g).toBe(STR_SOURCE[g]);
    // subkelompok bertitik: induknya disalin tipis, saudaranya yang belum dimigrasi tetap objek sumber
    expect(STR.basis.card).toBe(STR_SOURCE.basis.card);
    expect(STR.basis.refs).not.toBe(STR_SOURCE.basis.refs);
  });
  it('createStrings / resolveText: larik, objek bertingkat, fungsi; bahasa sama tidak dihitung ulang', () => {
    const src = { a: { x: { en: 'One', id: 'Satu' }, list: [{ en: 'A', id: 'B' }], fn: { en: (n) => `${n} items`, id: (n) => `${n} butir` } }, b: { y: 'plain' } };
    const s = createStrings(src, ['a']);
    expect(s.view.a.x).toBe('One');
    expect(s.view.b).toBe(src.b);
    const nested = s.view.a;
    s.apply('id');
    expect(s.view.a).toBe(nested);
    expect(nested.list).toEqual(['B']);
    expect(nested.fn(3)).toBe('3 butir');
    expect(resolveText({ en: 'E', id: '' }, 'id')).toBe('E'); // sisi id kosong → English (tes kelengkapan mencegahnya)
  });
});

describe('format angka ikut bahasa (satu modul)', () => {
  it('EN 1,500.5 · ID 1.500,5; persen, notasi ilmiah, tanda minus', () => {
    expect(numberLang()).toBe('en');
    expect(fmt(1500.5, 1)).toBe('1,500.5');
    expect(fmt(0.87, 2)).toBe('0.87');
    setNumberLang('id');
    expect(fmt(1500.5, 1)).toBe('1.500,5');
    expect(fmt(1500, 0)).toBe('1.500');
    expect(fmt(69090, 0)).toBe('69.090');
    expect(fmt(0.87, 2)).toBe('0,87');
    expect(fmt(-31.04, 1)).toBe('-31,0');
    expect(fmt(null)).toBe('–');
    expect(pct(0.441, 1)).toBe('44,1');
    expect(sci(1500, 1)).toBe('1,5×10³');
    setNumberLang('fr'); // bahasa tidak dikenal diabaikan
    expect(numberLang()).toBe('id');
  });
  it('tanda tangan siap pengaturan satuan: qty diterima, belum mengubah angka; bahasa bisa dipaksa per panggilan', () => {
    expect(formatNumber(101325, { digits: 0, qty: 'pressure' })).toBe('101,325');
    expect(formatNumber(1500.5, { digits: 1, lang: 'id' })).toBe('1.500,5');
    expect(formatNumber(1500.5, { digits: 1, grouping: false })).toBe('1500.5');
  });
  it('tick sumbu canvas memakai fmt (ikut bahasa)', () => {
    const base = read('src/charts/chartBase.js');
    expect(base).toMatch(/fmt\(t, tickDigits\(t\)\)/);
    setNumberLang('id');
    expect(fmt(0.25, tickDigits(0.25))).toBe('0,25');
    expect(fmt(2.5, tickDigits(2.5))).toBe('2,5');
    expect(fmt(1200, tickDigits(1200))).toBe('1.200');
  });
  it('isian: formatInput tanpa pemisah ribuan, desimal sesuai bahasa', () => {
    expect(formatInput(0.5)).toBe('0.5');
    expect(formatInput(1500)).toBe('1500');
    expect(formatInput(null)).toBe('');
    setNumberLang('id');
    expect(formatInput(0.5)).toBe('0,5');
    expect(formatInput(20.9)).toBe('20,9');
  });
  it('tanggal ikut bahasa', () => {
    const d = new Date(2026, 9, 14, 8, 5);
    expect(dateTime(d)).toMatch(/Oct 14, 2026/);
    setNumberLang('id');
    expect(dateTime(d)).toMatch(/14 Okt 2026/);
  });
});

describe('parseNumber: koma maupun titik, satu kasus ambigu mengikuti bahasa (aturan terdokumentasi)', () => {
  // [teks, EN, ID]; EN = koma ribuan / titik desimal, ID = titik ribuan / koma desimal
  const cases = [
    ['1500', 1500, 1500], ['0,5', 0.5, 0.5], ['0.5', 0.5, 0.5], ['-1,5', -1.5, -1.5], ['−2', -2, -2], [' 2 ', 2, 2], ['.5', 0.5, 0.5], [',5', 0.5, 0.5], ['5.', 5, 5],
    ['1.5', 1.5, 1.5], ['1,5', 1.5, 1.5], ['150,25', 150.25, 150.25], ['20.9', 20.9, 20.9],
    // dua jenis pemisah: yang terakhir desimal
    ['1.500,5', 1500.5, 1500.5], ['1,500.5', 1500.5, 1500.5], ['1.500.000,25', 1500000.25, 1500000.25],
    // satu jenis pemisah lebih dari sekali = ribuan (kelompok 3 digit)
    ['1.500.000', 1500000, 1500000], ['1,500,000', 1500000, 1500000], ['12.345.678', 12345678, 12345678],
    // satu pemisah + tepat tiga digit + bagian depan bukan 0: pemisah ribuan bahasa itu = ribuan, lawannya = desimal
    ['1.500', 1.5, 1500], ['1,500', 1500, 1.5], ['12.345', 12.345, 12345], ['12,345', 12345, 12.345], ['100.000', 100, 100000], ['100,000', 100000, 100],
    // bagian depan 0 atau lebih dari 3 digit tetap desimal
    ['0.500', 0.5, 0.5], ['0,500', 0.5, 0.5], ['0,125', 0.125, 0.125], ['0.125', 0.125, 0.125], ['20.900', 20.9, 20900], ['1234.567', 1234.567, 1234.567], ['1234,567', 1234.567, 1234.567],
    // bukan tiga digit → desimal di kedua bahasa
    ['1.50', 1.5, 1.5], ['1,50', 1.5, 1.5], ['1.5000', 1.5, 1.5], ['1,5000', 1.5, 1.5],
  ];
  for (const [t, en, id] of cases) {
    it(`"${t}" → EN ${en} · ID ${id}`, () => { expect(parseNumber(t, 'en')).toBeCloseTo(en, 9); expect(parseNumber(t, 'id')).toBeCloseTo(id, 9); });
  }
  it('tanpa argumen bahasa memakai bahasa format angka aktif', () => {
    expect(parseNumber('1,500')).toBe(1500); // en
    setNumberLang('id');
    expect(parseNumber('1,500')).toBe(1.5);
    expect(parseNumber('1.500')).toBe(1500);
    expect(checkNumber('1.500', { max: 2000 })).toEqual({ value: 1500, error: null });
    expect(checkNumber('1.500', { max: 2000, lang: 'en' })).toEqual({ value: 1.5, error: null });
  });
  it('bolak-balik: formatInput lalu parseNumber memberi nilai yang sama di kedua bahasa', () => {
    for (const lang of ['en', 'id']) for (const v of [0.5, 1.5, 1.234, 12.345, 150.25, 1500, 1500.5, 20.9, 0.125, 100000, 1234.567]) {
      expect(parseNumber(formatInput(v, { lang }), lang), `${lang} ${v}`).toBeCloseTo(v, 9);
    }
  });
  it('kosong → null; bukan angka → NaN', () => {
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('   ')).toBeNull();
    expect(parseNumber(null)).toBeNull();
    expect(parseNumber('-1.500', 'id')).toBe(-1500);
    expect(parseNumber('-1,500', 'en')).toBe(-1500);
    for (const t of ['abc', '1.5.6', '1,50,000', '1..5', '1,5.5,5', '1.500,5.5', '1e3', '-', '.', '12a']) expect(parseNumber(t), t).toBeNaN();
    expect(parseNumber(2.5)).toBe(2.5);
  });
  it('checkNumber: min / max / di atas min / wajib isi (pengganti type="number")', () => {
    expect(checkNumber('0,5', { min: 0 })).toEqual({ value: 0.5, error: null });
    expect(checkNumber('-1', { min: 0 })).toEqual({ value: null, error: 'min' });
    expect(checkNumber('21', { min: 0, max: 20.9 })).toEqual({ value: null, error: 'max' });
    expect(checkNumber('20,9', { min: 0, max: 20.9 })).toEqual({ value: 20.9, error: null });
    expect(checkNumber('0', { min: 0, minExclusive: true })).toEqual({ value: null, error: 'min' });
    expect(checkNumber('', { allowEmpty: false })).toEqual({ value: null, error: 'empty' });
    expect(checkNumber('')).toEqual({ value: null, error: null });
    expect(checkNumber('x')).toEqual({ value: null, error: 'nan' });
  });
});

describe('kotak isian angka: tanpa type="number", satu pembaca', () => {
  const ui = (dir) => readdirSync(`${ROOT}${dir}`).filter((f) => f.endsWith('.js')).map((f) => [`${dir}/${f}`, read(`${dir}/${f}`)]);
  const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); // komentar boleh menyebutnya
  const files = [...ui('src/ui'), ...ui('src/scenes'), ...ui('src/state'), ['src/main.js', read('src/main.js')]].map(([f, s]) => [f, code(s)]);
  it('tidak ada type="number" dan tidak ada replace(\',\', \'.\') tersisa', () => {
    expect(files.filter(([, s]) => /type="number"|type = 'number'/.test(s)).map(([f]) => f)).toEqual([]);
    expect(files.filter(([, s]) => s.includes("replace(',', '.')")).map(([f]) => f)).toEqual([]);
  });
  it('lima kelompok isian memakai createNumberField; pesan galat dari STR.input', () => {
    for (const f of ['src/ui/limitsInput.js', 'src/ui/limitsTab.js', 'src/ui/calibrationPanel.js', 'src/ui/assumptions.js']) expect(read(f), f).toMatch(/createNumberField\(/);
    const ni = read('src/ui/numberInput.js');
    expect(ni).toMatch(/const T = STR\.input/);
    expect(ni).toMatch(/inputMode = 'decimal'/);
    expect(ni).toMatch(/checkNumber\(/);
  });
  it('state memakai parseNumber (store, regulasi, bahan bakar, policy)', () => {
    for (const f of ['src/state/store.js', 'src/state/regulations.js', 'src/state/deriveFuel.js', 'src/state/derivePolicy.js']) expect(read(f), f).toMatch(/parseNumber\(/);
  });
  it('main.js: bahasa → teks + angka sebelum komponen lain berlangganan; ganti bahasa memasang ulang scene', () => {
    const main = read('src/main.js');
    expect(main.indexOf('langStore.subscribe(applyUiLang)')).toBeGreaterThan(0);
    expect(main.indexOf('langStore.subscribe(applyUiLang)')).toBeLessThan(main.indexOf('createLearnHost('));
    expect(main).toMatch(/function relangView\(\)[\s\S]*goTo\(index, true\)/);
    expect(read('src/presenter.js')).toMatch(/setNumberLang\(l\); applyStringLang\(l\)/);
  });
});

describe('ganti bahasa tanpa muat ulang (D2): relabeler dan sambungannya', () => {
  const stub = () => { const attrs = new Map(); return { textContent: '', data: '', dataset: {}, getAttribute: (k) => attrs.get(k) ?? null, setAttribute: (k, v) => attrs.set(k, v), removeAttribute: (k) => attrs.delete(k) }; };
  it('createRelabeler: text / node / attr / data / job dijalankan ulang oleh run(); atribut null dihapus', () => {
    let lang = 'en';
    const T = { en: { a: 'Hello', tip: 'Tip', gone: 'x' }, id: { a: 'Halo', tip: 'Petunjuk', gone: null } };
    const rl = createRelabeler();
    const el = stub(), tn = stub(), at = stub(), dt = stub(); let jobs = 0;
    rl.text(el, () => T[lang].a); rl.node(tn, () => T[lang].a); rl.attr(at, 'aria-label', () => T[lang].tip); rl.attr(at, 'title', () => T[lang].gone); rl.data(dt, 'tip', () => T[lang].tip); rl.job(() => { jobs++; });
    expect([el.textContent, tn.data, at.getAttribute('aria-label'), at.getAttribute('title'), dt.dataset.tip, jobs]).toEqual(['Hello', 'Hello', 'Tip', 'x', 'Tip', 1]);
    lang = 'id'; rl.run();
    expect([el.textContent, tn.data, at.getAttribute('aria-label'), at.getAttribute('title'), dt.dataset.tip, jobs]).toEqual(['Halo', 'Halo', 'Petunjuk', null, 'Petunjuk', 2]);
  });
  it('main.js: urutan pelanggan bahasa (teks + angka dulu) lalu relabelChrome (navigasi, Explore, lencana, flag, presenter) dan halaman penuh', () => {
    const main = read('src/main.js');
    expect(main).toMatch(/function relabelChrome\(\)[\s\S]*nav\.relabel\(\)[\s\S]*exitPresent\.setLabel[\s\S]*relabelModelBadge[\s\S]*calibFlag\.relabel\(\)[\s\S]*qualityFlag\.relabel\(\)[\s\S]*presenter\.relabel\(\)/);
    expect(main).toMatch(/langStore\.subscribe\(\(l\) => \{ langSwitch\.set\(l\); themeSwitch\.relabel\(\); backPill\.refresh\(\); relabelChrome\(\); relangView\(\); \}\)/);
    expect(main).toMatch(/for \(const p of OVERLAYS\) \{ const api = PAGE_API\[p\]; if \(api\.refresh\) api\.refresh\(\); \}/);
  });
  it('jendela presenter: relabel() di presenterView, event storage etel:lang di presenter.js, hook uji', () => {
    expect(read('src/ui/presenterView.js')).toMatch(/relabel\(\) \{ rl\.run\(\); paintStatus\(\); paintCurrent\(\); tick\(\); \}/);
    const pres = read('src/presenter.js');
    expect(pres).toMatch(/e\.key === LANG_KEY/);
    expect(pres).toMatch(/view\?\.relabel\(\)/);
    expect(pres).toMatch(/__etelPresenter/);
    expect(read('src/ui/presenterMode.js')).toMatch(/relabel\(\) \{ panel\?\.relabel\(\); \}/);
  });
  it('halaman penuh dan nav: judul lewat fungsi / relabeler (tidak membeku di bahasa awal)', () => {
    expect(read('src/ui/pageShell.js')).toMatch(/typeof o\.title === 'function'/);
    expect(read('src/ui/formationPage.js')).toMatch(/title: \(\) => P\.title/);
    expect(read('src/ui/glossaryPage.js')).toMatch(/title: \(\) => STR\.pages\.glossary\.title/);
    expect(read('src/ui/nav.js')).toMatch(/createRelabeler\(\)/);
    for (const f of ['src/ui/referencesPage.js', 'src/ui/regulationsPage.js']) expect(read(f), f).toMatch(/refresh\(\)/);
  });
  it('galat isian: slot .num-err satu baris tetap (tanpa gelembung melayang)', () => {
    const css = read('src/styles.css');
    expect(css).toMatch(/\.num-err \{[^}]*height: 14px/);
    expect(css).not.toMatch(/num-field__err/);
    const ni = read('src/ui/numberInput.js');
    expect(ni).toMatch(/errorHost/);
    expect(ni).not.toMatch(/num-field__err/);
  });
  it('tl(): pasangan data content/ mengikuti bahasa aktif; string polos (nama resmi) tetap', async () => {
    const { langStore, tl } = await import('../src/state/langStore.js');
    const before = langStore.lang;
    langStore.set('id'); expect(tl({ en: 'Gas turbine', id: 'Turbin gas' })).toBe('Turbin gas'); expect(tl('Permen LH 13/2009')).toBe('Permen LH 13/2009');
    langStore.set('en'); expect(tl({ en: 'Gas turbine', id: 'Turbin gas' })).toBe('Gas turbine');
    langStore.set(before);
  });
});
