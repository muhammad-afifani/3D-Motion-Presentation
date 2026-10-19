// Paket D1: kerangka dua bahasa (state/i18n.js), format angka ikut bahasa dan isian koma/titik (ui/format.js),
// kotak isian angka (ui/numberInput.js). Kelompok di MIGRATED_GROUPS wajib lengkap di kedua bahasa.
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { STR, STR_SOURCE, applyStringLang } from '../src/ui/strings.js';
import { MIGRATED_GROUPS, SAME_OK, isPair, createStrings, resolveText } from '../src/state/i18n.js';
import { fmt, pct, sci, formatNumber, formatInput, parseNumber, checkNumber, setNumberLang, numberLang, dateTime } from '../src/ui/format.js';
import { tickDigits } from '../src/charts/chartBase.js';
import { ID_WORDS } from './language.test.js';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(`${ROOT}${p}`, 'utf8');
const ID_RE = new RegExp(`(?<![\\p{L}\\p{N}_])(${ID_WORDS.join('|')})(?![\\p{L}\\p{N}_])`, 'iu');
const sample = (v) => (typeof v === 'function' ? v('1', '2', '3', '4', '5', '6') : v);

/** Semua daun kelompok sumber: [jalur, nilai]. */
function leaves(o, path, out = []) {
  if (isPair(o) || typeof o !== 'object' || o == null) { out.push([path, o]); return out; }
  for (const [k, v] of Object.entries(o)) leaves(v, `${path}.${k}`, out);
  return out;
}
const migrated = MIGRATED_GROUPS.flatMap((g) => leaves(STR_SOURCE[g], `STR.${g}`));

afterEach(() => { applyStringLang('en'); setNumberLang('en'); });

describe('kelompok dua bahasa (MIGRATED_GROUPS)', () => {
  it('kelompok terdaftar ada di strings.js dan tidak kosong', () => {
    expect(MIGRATED_GROUPS).toEqual(expect.arrayContaining(['theme', 'formula', 'input']));
    for (const g of MIGRATED_GROUPS) expect(Object.keys(STR_SOURCE[g] ?? {}).length, g).toBeGreaterThan(0);
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
  it('sisi id tidak sama dengan sisi en kecuali istilah SAME_OK (menangkap terjemahan yang tertinggal)', () => {
    const same = migrated.filter(([, v]) => sample(v.en) === sample(v.id) && !SAME_OK.includes(sample(v.en))).map(([p, v]) => `${p}: ${sample(v.en)}`);
    expect(same).toEqual([]);
  });
  it('sisi en tetap bebas kata Indonesia', () => {
    expect(migrated.filter(([, v]) => ID_RE.test(sample(v.en))).map(([p, v]) => `${p}: ${sample(v.en)}`)).toEqual([]);
  });
  it('SAME_OK tercantum di bagian "Tetap Inggris" docs/PADANAN_ISTILAH.md', () => {
    const doc = read('docs/PADANAN_ISTILAH.md');
    const sec = doc.slice(doc.indexOf('## Tetap Inggris'), doc.indexOf('| No |'));
    expect(sec.length).toBeGreaterThan(100);
    const listed = new Set([...sec.matchAll(/`([^`]+)`/g)].map((m) => m[1]));
    expect(SAME_OK.filter((t) => !listed.has(t))).toEqual([]);
  });
});

describe('STR: tampilan diisi di tempat saat bahasa berubah', () => {
  it('default English; id mengganti teks tanpa mengganti objek (alias modul tetap sah)', () => {
    const T = STR.theme, I = STR.input;
    expect(T.dark).toBe('Dark');
    expect(I.min('5')).toBe('Minimum 5.');
    applyStringLang('id');
    expect(STR.theme).toBe(T);
    expect(T.dark).toBe('Gelap');
    expect(STR.formula.label).toBe('Rumus');
    expect(I.min('5')).toBe('Minimal 5.');
    applyStringLang('en');
    expect(T.dark).toBe('Dark');
  });
  it('kelompok yang belum dimigrasi tidak disalin ulang (objek sumber yang sama)', () => {
    for (const g of Object.keys(STR_SOURCE).filter((k) => !MIGRATED_GROUPS.includes(k))) expect(STR[g], g).toBe(STR_SOURCE[g]);
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

describe('parseNumber: koma maupun titik (aturan terdokumentasi)', () => {
  const cases = [
    ['1500', 1500], ['0,5', 0.5], ['0.5', 0.5], ['-1,5', -1.5], ['−2', -2], [' 2 ', 2], ['.5', 0.5], [',5', 0.5], ['5.', 5],
    // dua jenis pemisah: yang terakhir desimal
    ['1.500,5', 1500.5], ['1,500.5', 1500.5], ['1.500.000,25', 1500000.25],
    // satu jenis pemisah lebih dari sekali = ribuan (kelompok 3 digit)
    ['1.500.000', 1500000], ['1,500,000', 1500000], ['12.345.678', 12345678],
    // satu pemisah sekali = DESIMAL, juga bila diikuti tepat 3 digit
    ['1.500', 1.5], ['1,500', 1.5], ['0,125', 0.125], ['20.900', 20.9],
  ];
  for (const [t, v] of cases) it(`"${t}" → ${v}`, () => expect(parseNumber(t)).toBeCloseTo(v, 9));
  it('kosong → null; bukan angka → NaN', () => {
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('   ')).toBeNull();
    expect(parseNumber(null)).toBeNull();
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
