// docs/PADANAN_ISTILAH.md tetap sinkron dengan aplikasi: setiap label English di tabel benar-benar ada di
// src/ui/strings.js atau content/*.json, dan setiap istilah Indonesia ada di dokumen yang disebut kolom "Dipakai di".
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { STR_SOURCE } from '../src/ui/strings.js';
import { isPair } from '../src/state/i18n.js';
import { KEEP_TEXTS } from './helpers/keepEnglish.js';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(`${ROOT}${p}`, 'utf8');
const strings = read('src/ui/strings.js');
const content = readdirSync(`${ROOT}content`).filter((f) => f.endsWith('.json')).map((f) => read(`content/${f}`)).join('\n');
const presenter = JSON.stringify(JSON.parse(read('content/presenter.json')));
// penanda Markdown (tebal, kode) dibuang agar "mode **Explore**" cocok dengan "mode Explore"
const plain = (t) => t.replace(/\*\*|`/g, '');
const docs = { ALUR: plain(read('docs/ALUR_SLIDE_presentasi.md')), PROMPT: plain(read('docs/PROMPT_simulasi_3D.md')) };

/** Baris tabel: [no, istilah, dipakai di, label, sumber, catatan]. */
const rows = read('docs/PADANAN_ISTILAH.md').split('\n')
  .filter((l) => /^\| \d+ \|/.test(l))
  .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
const unquote = (s) => s.replace(/^`|`$/g, '');
const lower = (s) => s.toLowerCase();
/** Varian istilah: dipisah "/" dan isi kurung ikut dicoba (mis. "titik mati atas (TDC)" → "titik mati atas", "TDC"). */
const variants = (term) => term.split(' / ').flatMap((t) => { const m = /^(.*?)\s*\((.*)\)\s*$/.exec(t); return m ? [m[1], m[2]] : [t]; }).map((t) => t.trim()).filter(Boolean);

describe('docs/PADANAN_ISTILAH.md', () => {
  it('tabel berisi istilah, dan nomor urut tanpa celah', () => {
    expect(rows.length).toBeGreaterThan(60);
    rows.forEach((r, i) => expect(Number(r[0]), r[1]).toBe(i + 1));
  });
  it('setiap label English ada di strings.js atau content/*.json (kecuali baris "Tidak ada padanan")', () => {
    const missing = rows.filter((r) => r[3] !== '—').filter((r) => { const l = unquote(r[3]); return !strings.includes(l) && !content.includes(l); });
    expect(missing.map((r) => `${r[0]} ${r[3]}`)).toEqual([]);
  });
  it('baris tanpa padanan ditandai jelas dan tidak menulis sumber', () => {
    for (const r of rows.filter((x) => x[3] === '—')) {
      expect(r[4], r[1]).toBe('—');
      expect(r[5], r[1]).toMatch(/^\*\*Tidak ada padanan di UI\.\*\*/);
    }
  });
  it('sumber menunjuk kunci strings.js (STR.…) atau file content/', () => {
    for (const r of rows.filter((x) => x[3] !== '—')) expect(unquote(r[4]), r[1]).toMatch(/^(STR\.|content\/)/);
  });
  it('istilah Indonesia ditemukan di tempat yang disebut kolom "Dipakai di"', () => {
    const bad = [];
    for (const r of rows) {
      const where = r[2], vs = variants(r[1]).map(lower);
      const places = [];
      if (/presenter/.test(where)) places.push(lower(presenter));
      if (/ALUR/.test(where)) places.push(lower(docs.ALUR));
      if (/PROMPT/.test(where)) places.push(lower(docs.PROMPT));
      if (!places.length || !places.some((p) => vs.some((v) => p.includes(v)))) bad.push(`${r[0]} ${r[1]} @ ${where}`);
    }
    expect(bad).toEqual([]);
  });
  it('Paket D: label ID yang sudah terpasang memuat istilah Indonesia di tabel ini (atau sengaja tetap Inggris)', () => {
    const out = [];
    let checked = 0;
    for (const r of rows.filter((x) => x[3] !== '—')) {
      const m = /^STR\.([A-Za-z0-9_.]+?)(\(\))?$/.exec(unquote(r[4]));
      if (!m) continue;
      let node = STR_SOURCE;
      for (const k of m[1].split('.')) node = node?.[k];
      if (!isPair(node) || typeof node.id !== 'string') continue; // belum dimigrasi (D3–D6) atau fungsi
      checked++;
      const id = lower(node.id), vs = variants(r[1]).map(lower);
      const kept = node.id === node.en && KEEP_TEXTS.has(node.en);
      if (!kept && !vs.some((v) => id.includes(v))) out.push(`${r[0]} ${r[1]} ↔ ${r[3]} → "${node.id}"`);
    }
    expect(checked).toBeGreaterThan(12);
    expect(out).toEqual([]);
  });
});
