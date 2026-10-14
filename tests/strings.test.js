// Teks UI hanya boleh berada di src/ui/strings.js.
//
// ATURAN PEMINDAIAN (sengaja sederhana; perluas daftar ALLOW bila muncul positif palsu):
//  1. File yang dipindai: src/scenes/, src/charts/, src/ui/ (kecuali strings.js & format.js),
//     src/main.js, src/state/derive*.js. Model (thermo.js) dan gfx/ tidak dipindai.
//  2. Komentar dibuang. Setiap literal '…', "…", dan `…` diambil; bagian ${…} dibuang
//     (template bersarang di dalam ${…} ikut diperiksa).
//  3. Tag HTML dibuang; nilai atribut teks (data-tip, title, aria-label, placeholder) diperiksa.
//  4. Sisa teks DIIZINKAN bila salah satu:
//     a. tidak mengandung huruf (angka, tanda baca, simbol, spasi);
//     b. kunci tanpa spasi berawalan huruf kecil: huruf/angka dan . _ - | : $ (mis. 'diesel', 'fMode',
//        'chart__level', 'is-on', 'preset|');
//     c. kunci pendek ≤ 3 karakter tanpa spasi (mis. 'F', 'Vc', 'K', '2d');
//     d. daftar kelas CSS: kata huruf kecil dipisah spasi dan ada yang memakai '-' atau '_';
//     e. selector/path/warna/log internal: berawalan '.', '#', '[', './', '../';
//     f. nilai fungsi CSS: nama(…) mis. rgb(…), translate(…), scaleX(…);
//     g. string font CSS: berawalan angka + 'px' (mis. '12px Inter, sans-serif');
//     h. daftar ALLOW di bawah (nama tombol keyboard dsb., bukan teks tampilan).
//  Selain itu dianggap teks UI → pindahkan ke src/ui/strings.js.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { STR } from '../src/ui/strings.js';

const ROOT = new URL('..', import.meta.url).pathname;
const ALLOW = new Set(['ArrowRight', 'ArrowLeft', 'Escape']);

function files() {
  const out = [];
  const add = (dir, filter = () => true) => {
    for (const f of readdirSync(join(ROOT, dir))) if (f.endsWith('.js') && filter(f)) out.push(join(dir, f));
  };
  add('src/scenes');
  add('src/charts');
  add('src/ui', (f) => f !== 'strings.js' && f !== 'format.js');
  add('src/state', (f) => f.startsWith('derive'));
  out.push('src/main.js');
  return out;
}

/** Ambil literal string dari sumber JS (tanpa komentar). Template: segmen teks di luar ${…}. */
function literals(src) {
  const out = [];
  let i = 0;
  const n = src.length;
  function readQuoted(q) { // i berada di karakter pembuka
    let s = '';
    for (i++; i < n && src[i] !== q; i++) { if (src[i] === '\\') { s += src[i + 1]; i++; } else s += src[i]; }
    i++;
    out.push(s);
  }
  function readTemplate() { // i berada di ` pembuka
    let seg = '';
    const segs = [];
    for (i++; i < n && src[i] !== '`'; i++) {
      if (src[i] === '\\') { seg += src[i + 1]; i++; continue; }
      if (src[i] === '$' && src[i + 1] === '{') {
        segs.push(seg); seg = '';
        i += 2;
        let depth = 1;
        while (i < n && depth > 0) {
          const c = src[i];
          if (c === '`') { readTemplate(); continue; }
          if (c === "'" || c === '"') { readQuoted(c); continue; }
          if (c === '{') depth++;
          if (c === '}') depth--;
          if (depth > 0) i++;
        }
        continue;
      }
      seg += src[i];
    }
    i++;
    segs.push(seg);
    out.push(segs.join(''));
  }
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 2; continue; }
    if (c === "'" || c === '"') { readQuoted(c); continue; }
    if (c === '`') { readTemplate(); continue; }
    i++;
  }
  return out;
}

/** Pecah literal menjadi potongan teks yang harus diperiksa (teks luar tag + atribut teks). */
function textPieces(lit) {
  const pieces = [];
  for (const m of lit.matchAll(/\b(?:data-tip|title|aria-label|placeholder)\s*=\s*"([^"]*)"/g)) pieces.push(m[1]);
  pieces.push(lit.replace(/<[^>]*>/g, ' '));
  return pieces.map((p) => p.trim()).filter(Boolean);
}

function allowed(t) {
  if (!/\p{L}/u.test(t)) return true;                                   // a
  if (/^[a-z][\w.|:$-]*$/.test(t)) return true;                           // b
  if (!/\s/.test(t) && t.length <= 3) return true;                        // c
  if (/^[a-z0-9_-]+( [a-z0-9_-]+)+$/.test(t) && /[-_]/.test(t)) return true; // d
  if (/^(\.|#|\[|\.\/|\.\.\/)/.test(t)) return true;                      // e
  if (/^[a-zA-Z-]+\(.*\)$/.test(t)) return true;                          // f
  if (/^\d+px\s/.test(t)) return true;                                    // g
  return ALLOW.has(t);                                                    // h
}

describe('Teks UI terpusat di src/ui/strings.js', () => {
  for (const f of files()) {
    it(`${f}: tanpa teks UI tertulis langsung`, () => {
      const bad = [];
      for (const lit of literals(readFileSync(join(ROOT, f), 'utf8'))) {
        for (const t of textPieces(lit)) if (!allowed(t)) bad.push(t);
      }
      expect(bad, `pindahkan ke strings.js:\n${bad.join('\n')}`).toEqual([]);
    });
  }

  it('pemindai mendeteksi pelanggaran yang jelas (uji pemindai)', () => {
    const lits = literals("const a = 'Kecepatan animasi'; const b = `<b>Beku</b> ${x} <span class=\"pill\">${y}</span>`; // 'Komentar diabaikan'\nconst c = `<div data-tip=\"Tooltip langsung\"></div>`;");
    const bad = lits.flatMap(textPieces).filter((t) => !allowed(t));
    expect(bad).toEqual(['Kecepatan animasi', 'Beku', 'Tooltip langsung']);
    for (const ok of ['diesel', 'is-on', 'ctl-group ctl-group--buttons', 'F', '.chart__level', 'rgba(1,2,3,0.5)', '12px Inter, sans-serif', 'preset|', '−']) expect(allowed(ok)).toBe(true);
  });
});

describe('strings.js: isi', () => {
  /** Telusuri semua daun: string tidak kosong; fungsi menghasilkan string tidak kosong. */
  function walk(o, path, bad) {
    for (const [k, v] of Object.entries(o)) {
      const p = `${path}.${k}`;
      if (typeof v === 'string') { if (!v.trim()) bad.push(p); } else if (typeof v === 'function') {
        const r = v(1, 2, 3, 4, 5, 6);
        if (typeof r !== 'string' || !r.trim()) bad.push(p);
      } else if (Array.isArray(v)) v.forEach((x, i) => { if (typeof x !== 'string' || !x.trim()) bad.push(`${p}[${i}]`); });
      else if (v && typeof v === 'object') walk(v, p, bad);
    }
    return bad;
  }
  it('semua entri terisi', () => expect(walk(STR, 'STR', [])).toEqual([]));

  it('label kontrol berbahasa Inggris (aturan pemilik proyek)', () => {
    const c = STR.common;
    expect([c.play, c.pause, c.freeze, c.reset, c.animSpeed]).toEqual(['Play', 'Pause', 'Freeze', 'Reset', 'Animation speed']);
    expect(STR.scene2.replay).toBe('Replay waterfall');
    expect(Object.values(STR.scene3.bloom)).toEqual(['Bloom: Auto', 'Bloom: On', 'Bloom: Off']);
    expect(STR.scene3.focus).toBe('Combustion window focus');
  });

  it('tooltip Bloom (Indonesia) sesuai permintaan', () => {
    expect(STR.scene3.tips.bloom.startsWith('Efek cahaya (glow) di sekitar nyala. Matikan bila animasi berat.')).toBe(true);
  });

  it('pesan kunci & judul scene tetap berbahasa Indonesia', () => {
    for (const k of ['scene1', 'scene2', 'scene3', 'scene4', 'scene6', 'scene7', 'scene8', 'scene9', 'scene10', 'scene11']) {
      expect(STR[k].message).toMatch(/\b(dan|di|pada|karena|satu|luas|punya|tidak|dengan|bukan|mengikuti|tetapi|lebih)\b/);
    }
  });
});
