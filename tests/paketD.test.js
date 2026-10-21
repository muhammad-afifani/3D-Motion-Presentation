// Penutupan Paket D (D6): tes sapu akhir seluruh aplikasi. Semua kelompok string terdaftar dan berpasangan, kunci lengkap di kedua
// bahasa, sisi id tidak identik dengan en kecuali daftar "Tetap Inggris", sisi en bebas kata Indonesia, format angka kedua bahasa,
// konten JSON dua bahasa lengkap. Pengecualian eksplisit: basis.enOnly (sisi en kosong) dan src/model/basis.js (English).
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { STR_SOURCE, STR, applyStringLang } from '../src/ui/strings.js';
import { MIGRATED_GROUPS, isPair } from '../src/state/i18n.js';
import { KEEP_TEXTS, KEEP_PATHS } from './helpers/keepEnglish.js';
import { ID_WORDS } from './language.test.js';
import { fmt, setNumberLang, parseNumber } from '../src/ui/format.js';

const ROOT = new URL('..', import.meta.url).pathname;
const json = (f) => JSON.parse(readFileSync(`${ROOT}content/${f}.json`, 'utf8'));
const ID_RE = new RegExp(`(?<![\\p{L}\\p{N}_])(${ID_WORDS.join('|')})(?![\\p{L}\\p{N}_])`, 'iu');
const EN_WORDS = /(?<![\p{L}\p{N}_])(the|and|with|for|not|from|this|that|are|is|you|your|press|open|close|show|hide|click|saved|failed|error)(?![\p{L}\p{N}_])/iu;
const EN_EMPTY_BY_DESIGN = new Set(['basis.enOnly']);
const sample = (v) => { if (typeof v !== 'function') return v; try { return v('1', '2', '3', '4', '5', '6'); } catch { return v([[100, 50]], 2, 3, 4, 5, 6); } };

/** Semua daun pohon sumber: [jalur, nilai] (pasangan = satu daun). */
function leaves(o, path, out = []) {
  if (isPair(o) || typeof o !== 'object' || o == null) { out.push([path, o]); return out; }
  for (const [k, v] of Object.entries(o)) leaves(v, Array.isArray(o) ? `${path}[${k}]` : `${path}.${k}`, out);
  return out;
}
const ALL = leaves(STR_SOURCE, 'STR').map(([p, v]) => [p.replace(/^STR\./, ''), v]);
const pairsIn = (x, path = '', out = []) => {
  if (Array.isArray(x)) x.forEach((v, i) => pairsIn(v, `${path}[${i}]`, out));
  else if (x && typeof x === 'object') { if (isPair(x)) out.push([path, x]); else for (const [k, v] of Object.entries(x)) pairsIn(v, `${path}.${k}`, out); }
  return out;
};

afterEach(() => { applyStringLang('en'); setNumberLang('en'); });

describe('sapu akhir Paket D: STR', () => {
  it('semua kelompok terdaftar: setiap daun STR_SOURCE berupa pasangan { en, id } (tidak ada teks English polos tersisa)', () => {
    // lang.* = nama bahasa di sakelar ("EN" / "ID"), bukan teks terjemahan
    const plain = ALL.filter(([p, v]) => !isPair(v) && !p.startsWith('lang.')).map(([p, v]) => `${p}: ${JSON.stringify(v).slice(0, 60)}`);
    expect(plain).toEqual([]);
    const top = new Set(MIGRATED_GROUPS.map((g) => g.split('.')[0]));
    for (const k of Object.keys(STR_SOURCE)) if (!['bi', 'lang'].includes(k)) expect(top.has(k), `kelompok ${k} belum terdaftar di MIGRATED_GROUPS`).toBe(true);
  });
  it('kunci lengkap di kedua bahasa: sisi id tidak kosong, tipe dan jumlah argumen sama; satu-satunya sisi en kosong = basis.enOnly', () => {
    for (const [p, v] of ALL.filter(([, x]) => isPair(x))) {
      expect(typeof v.id, p).toBe(typeof v.en);
      if (typeof v.en === 'function') expect(v.id.length, p).toBe(v.en.length);
      expect(String(sample(v.id) ?? '').trim(), `${p}.id`).not.toBe('');
      if (EN_EMPTY_BY_DESIGN.has(p)) expect(String(sample(v.en) ?? ''), p).toBe('');
      else expect(String(sample(v.en) ?? '').trim(), `${p}.en`).not.toBe('');
    }
  });
  it('sisi id tidak identik dengan en kecuali daftar Tetap Inggris (teks utuh atau jalur fungsi)', () => {
    const bad = [];
    for (const [p, v] of ALL.filter(([, x]) => isPair(x))) {
      const en = String(sample(v.en) ?? ''), id = String(sample(v.id) ?? '');
      if (en === id && en.trim() && !KEEP_TEXTS.has(en) && !KEEP_PATHS.has(p) && !/^bi\.|^lang\./.test(p)) bad.push(`${p}: ${en.slice(0, 50)}`);
    }
    expect(bad).toEqual([]);
  });
  it('sisi en bebas kata Indonesia; sisi id bebas kata fungsi English (di luar teks dalam tanda kutip dan nama berkas)', () => {
    const enBad = [], idBad = [];
    for (const [p, v] of ALL.filter(([, x]) => isPair(x))) {
      const en = String(sample(v.en) ?? ''), id = String(sample(v.id) ?? '');
      if (ID_RE.test(en.replace(/Permen LHK? [0-9/]+/g, ' '))) enBad.push(`${p}: ${en.slice(0, 60)}`);
      if (id !== en && EN_WORDS.test(id.replace(/"[^"]*"/g, '').replace(/content\/[\w.]+/g, ''))) idBad.push(`${p}: ${id.slice(0, 60)}`);
    }
    expect(enBad).toEqual([]);
    expect(idBad).toEqual([]);
  });
  it('mengganti bahasa mengisi ulang STR di tempat untuk semua kelompok (objek tetap, teks berubah, kembali ke EN)', () => {
    const before = STR.scene9;
    const en = STR.scene9.title;
    applyStringLang('id');
    expect(STR.scene9).toBe(before);
    expect(STR.scene9.title).not.toBe(en);
    expect(STR.basis.enOnly).toMatch(/hanya tersedia dalam bahasa Inggris/);
    applyStringLang('en');
    expect(STR.scene9.title).toBe(en);
    expect(STR.basis.enOnly).toBe('');
  });
});

describe('sapu akhir Paket D: konten JSON dua bahasa', () => {
  const FILES = ['glossary', 'references', 'regulations', 'emission_formation', 'controls', 'closing', 'help', 'learn'];
  it('setiap pasangan lengkap; id tidak identik dengan en kecuali daftar Tetap Inggris; en bebas kata Indonesia', () => {
    for (const f of FILES) {
      const pairs = pairsIn(json(f));
      expect(pairs.length, f).toBeGreaterThan(0);
      const bad = [];
      for (const [p, v] of pairs) {
        if (!String(v.en).trim() || !String(v.id).trim()) bad.push(`${p}: kosong`);
        else if (f !== 'learn' && v.en === v.id && !KEEP_TEXTS.has(v.en)) bad.push(`${p}: identik "${String(v.en).slice(0, 40)}"`);
        else if (f !== 'learn' && ID_RE.test(String(v.en).replace(/Permen LHK? [0-9/]+/g, ' '))) bad.push(`${p}: kata Indonesia di sisi en`);
      }
      expect(bad.slice(0, 5), f).toEqual([]);
    }
  });
});

describe('sapu akhir Paket D: format angka kedua bahasa', () => {
  it('EN 1,500.5 / 0.87; ID 1.500,5 / 0,87; isian menerima koma dan titik di kedua bahasa', () => {
    setNumberLang('en');
    expect([fmt(1500.5, 1), fmt(0.87, 2)]).toEqual(['1,500.5', '0.87']);
    setNumberLang('id');
    expect([fmt(1500.5, 1), fmt(0.87, 2)]).toEqual(['1.500,5', '0,87']);
    for (const lang of ['en', 'id']) for (const t of ['0,5', '0.5']) expect(parseNumber(t, lang), `${lang} ${t}`).toBe(0.5);
    expect(parseNumber('1.500', 'id')).toBe(1500);
    expect(parseNumber('1,500', 'en')).toBe(1500);
  });
  it('tidak ada pemformatan angka di luar format.js (toFixed / toLocaleString / Intl) di scenes, charts, ui, state', async () => {
    const { readdirSync } = await import('node:fs');
    const bad = [];
    for (const d of ['src/scenes', 'src/charts', 'src/ui', 'src/state']) for (const f of readdirSync(`${ROOT}${d}`).filter((x) => x.endsWith('.js'))) {
      if (d === 'src/ui' && f === 'format.js') continue;
      const code = readFileSync(`${ROOT}${d}/${f}`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      const shown = code.split('\n').filter((l) => !/\.style\.|setProperty\(/.test(l)).join('\n'); // angka CSS (mis. scaleX) bukan teks tampil
      if (/\.toLocaleString\(|\bIntl\.|\.toFixed\(/.test(shown)) bad.push(`${d}/${f}`);
    }
    expect(bad).toEqual([]);
  });
});
