// Tag Basis, kartu Basis, halaman References: data (basisView) dan pemasangan di semua grafik/HUD.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BASIS, BASIS_GROUPS } from '../src/model/basis.js';
import { resolveBasis, cardData, groupReferences, citedBy, isReferencesHash, REFERENCES_HASH } from '../src/state/basisView.js';
import { REFERENCE_TYPES } from '../src/state/content.js';
import { STR } from '../src/ui/strings.js';

const ROOT = new URL('..', import.meta.url).pathname;
const refsJson = JSON.parse(readFileSync(join(ROOT, 'content/references.json'), 'utf8'));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

describe('basisView: data kartu Basis', () => {
  it('kelompok: semua nama ada di BASIS; setiap kelompok punya judul di strings.js', () => {
    for (const [g, keys] of Object.entries(BASIS_GROUPS)) {
      expect(keys.filter((k) => !(k in BASIS)), g).toEqual([]);
      expect(STR.basis.groups[g], g).toBeTruthy();
    }
    expect(Object.keys(STR.basis.groups).sort()).toEqual(Object.keys(BASIS_GROUPS).sort());
  });
  it('resolveBasis: id kelompok, daftar nama, string "a,b"; nama tak dikenal dibuang', () => {
    expect(resolveBasis('flame').id).toBe('flame');
    expect(resolveBasis(['otto', 'tidakAda']).keys).toEqual(['otto']);
    expect(resolveBasis('otto, diesel').keys).toEqual(['otto', 'diesel']);
    expect(resolveBasis('tidakAda').keys).toEqual([]);
  });
  it('kartu: kata level tetap tampil (Ideal / Real / Semi-empirical / Site data) dan sumber diambil dari references.json', () => {
    const d = cardData('idealCycles', refsJson);
    expect(d.levels).toEqual(['Ideal']);
    const otto = d.entries.find((e) => e.name === 'otto');
    expect(otto.refs.every((r) => r.known && r.cite && r.locatorVerified === false)).toBe(true);
    expect(cardData('noxCo', refsJson).levels).toEqual(expect.arrayContaining(['Semi-empirical', 'Site data']));
  });
  it('id yang hilang dari references.json → known:false ("source to verify"), bukan sumber karangan', () => {
    const cut = { references: refsJson.references.filter((r) => r.id !== 'heywood') };
    const e = cardData(['wiebe'], cut).entries[0];
    const miss = e.refs.find((r) => r.id === 'heywood');
    expect(miss).toEqual({ id: 'heywood', known: false });
    expect(STR.basis.card.unknownRef('heywood')).toMatch(/source to verify/);
    expect(cardData(['wiebe'], null).entries[0].refs.every((r) => !r.known)).toBe(true); // file tak terbaca → semuanya "to verify"
  });
  it('flag locatorVerified dibaca apa adanya (true hanya bila true di file)', () => {
    const one = { references: refsJson.references.map((r) => (r.id === 'cengel-boles' ? { ...r, locatorVerified: true } : r)) };
    const r = cardData(['otto'], one).entries[0].refs.find((x) => x.id === 'cengel-boles');
    expect(r.locatorVerified).toBe(true);
  });
  it('halaman References: kelompok mengikuti urutan jenis; jumlah sama dengan file; citedBy terisi', () => {
    const g = groupReferences(refsJson);
    expect(g.map((x) => x.type)).toEqual(REFERENCE_TYPES.filter((t) => refsJson.references.some((r) => r.type === t)));
    expect(g.flatMap((x) => x.items).length).toBe(refsJson.references.length);
    expect(citedBy().get('cengel-boles')).toEqual(expect.arrayContaining(['otto', 'diesel', 'braytonIdeal']));
  });
  it('alamat #/references', () => {
    expect(REFERENCES_HASH).toBe('#/references');
    for (const h of ['#/references', '#/references/', '#/references?x=1']) expect(isReferencesHash(h), h).toBe(true);
    for (const h of ['', '#', '#/scene/3', '#/referencesx', undefined]) expect(isReferencesHash(h), String(h)).toBe(false);
  });
});

describe('tag Basis terpasang di semua grafik dan HUD', () => {
  /** Isi argumen satu pemanggilan f(...) mulai dari indeks '(' (pencocokan kurung sederhana). */
  function callArgs(src, openIdx) {
    let depth = 0;
    for (let i = openIdx; i < src.length; i++) {
      if (src[i] === '(') depth++;
      else if (src[i] === ')' && --depth === 0) return src.slice(openIdx, i + 1);
    }
    return src.slice(openIdx);
  }
  const FACTORY = /\b(createXYChart|createLineChart|createMultiLineChart|createBarChart|createPVChart|createFlameChart|createCycleChart|createWaterfall|createBraytonSchematic)\(/g;
  const scenes = readdirSync(join(ROOT, 'src/scenes')).filter((f) => f.endsWith('.js'));

  it('setiap pembuatan grafik di scenes/ memberi opsi basis', () => {
    const missing = [];
    let n = 0;
    for (const f of scenes) {
      const src = read(`src/scenes/${f}`);
      for (const m of src.matchAll(FACTORY)) {
        const line = src.slice(0, m.index).split('\n').pop();
        if (/^\s*(import|export)\b/.test(line) || /function\s+$/.test(line)) continue;
        n++;
        if (!/\bbasis\b/.test(callArgs(src, m.index + m[1].length))) missing.push(`${f}: ${m[1]}`);
      }
    }
    expect(n).toBeGreaterThanOrEqual(16);
    expect(missing).toEqual([]);
  });
  it('setiap createHud dengan level juga memberi basis', () => {
    const missing = [];
    for (const f of scenes) {
      const src = read(`src/scenes/${f}`);
      for (const m of src.matchAll(/createHud\(/g)) {
        const a = callArgs(src, m.index + 'createHud'.length);
        if (/\blevel:/.test(a) && !/\bbasis:/.test(a)) missing.push(f);
      }
    }
    expect(missing).toEqual([]);
  });
  it('tag hand-written (.level / .cyc-level) di template scene membawa data-basis', () => {
    const bad = [];
    for (const f of scenes) {
      for (const m of read(`src/scenes/${f}`).matchAll(/<(?:span|div) class="(?:level|cyc-level)"[^>]*>/g)) if (!/data-basis|data-k="level"/.test(m[0])) bad.push(`${f}: ${m[0]}`);
    }
    expect(bad).toEqual([]);
  });
  it('chartBase menampilkan "Basis · <kata level>" dan tooltip', () => {
    const src = read('src/charts/chartBase.js');
    expect(src).toMatch(/STR\.basis\.tag.*STR\.common\.level\[k\]/);
    expect(STR.basis.tag).toBe('Basis');
    expect(Object.values(STR.common.level)).toEqual(['Ideal', 'Real (component efficiency)', 'Semi-empirical', 'Site data']);
  });
});
