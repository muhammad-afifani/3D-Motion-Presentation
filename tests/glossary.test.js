// M9 Step 06: content/glossary.json — definisi saja (tanpa angka limit / faktor), sumber hanya id references.json,
// loader dengan fallback, data halaman Glossary.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateGlossary, loadContent, fallbackContent, CONTENT_FILES } from '../src/state/content.js';
import { glossaryTerms } from '../src/state/glossaryView.js';
import { SCENE_NUMBERS } from '../src/state/scenes.js';
import * as thermo from '../src/model/thermo.js';

const ROOT = new URL('..', import.meta.url).pathname;
const G = JSON.parse(readFileSync(`${ROOT}content/glossary.json`, 'utf8'));
const REFS = JSON.parse(readFileSync(`${ROOT}content/references.json`, 'utf8'));
const textOf = (t) => [t.term, t.expansion ?? '', t.definition].join(' ');

describe('glossary.json', () => {
  it('skema valid; istilah wajib dari pack ada', () => {
    expect(CONTENT_FILES.glossary).toBe('glossary.json');
    expect(validateGlossary(G, [...SCENE_NUMBERS])).toEqual([]);
    const terms = G.terms.map((t) => t.term);
    for (const t of ['NOx', 'CO', 'UHC', 'PM', 'CEMS', 'IGV', 'DLN', 'λ (lambda)', 'TDC']) expect(terms, t).toContain(t);
  });
  it('definisi saja: tanpa angka (limit, faktor, nilai model tidak ditulis di glossary)', () => {
    for (const t of G.terms) expect(textOf(t), t.id).not.toMatch(/[0-9]/);
  });
  it('sumber hanya id dari references.json; scene yang ditautkan ada', () => {
    const ids = new Set(REFS.references.map((r) => r.id));
    for (const t of G.terms) for (const r of t.refs ?? []) expect(ids.has(r), `${t.id}: ${r}`).toBe(true);
    for (const t of G.terms) for (const n of t.scenes ?? []) expect(SCENE_NUMBERS).toContain(n);
  });
  it('tanpa nama fungsi / konstanta kode dan tanpa vendor', () => {
    const names = Object.keys(thermo).filter((n) => /[a-z][A-Z0-9]|_/.test(n)); // identifier kode (camelCase / KONSTANTA_); kata biasa seperti diesel tidak dihitung
    const re = new RegExp(`(?<![\\p{L}\\p{N}_])(${names.join('|')})(?![\\p{L}\\p{N}_])`, 'u');
    for (const t of G.terms) expect(re.test(textOf(t)), t.id).toBe(false);
    expect(JSON.stringify(G)).not.toMatch(/\b(GE|Siemens|Solar Turbines|Caterpillar|Wärtsilä|Wartsila|Cummins|MAN|Rolls-Royce|Baker Hughes|Mitsubishi)\b/);
  });
  it('validator menolak angka, id ganda, sumber bukan id, scene tak dikenal', () => {
    const base = { version: 1, terms: [{ id: 'a', term: 'A', definition: 'Text.' }] };
    expect(validateGlossary(base)).toEqual([]);
    const codes = (j) => validateGlossary(j).map((e) => e.code);
    expect(codes({ ...base, terms: [{ id: 'a', term: 'A', definition: 'Limit 320 mg.' }] })).toContain('noNumbers');
    expect(codes({ ...base, terms: [base.terms[0], base.terms[0]] })).toContain('duplicate');
    expect(codes({ ...base, terms: [{ ...base.terms[0], refs: ['Not An Id'] }] })).toContain('refId');
    expect(codes({ ...base, terms: [{ ...base.terms[0], scenes: [42] }] })).toContain('scenes');
    expect(codes({ version: 2, terms: [] })).toEqual(['version', 'array']);
  });
  it('loader: file tidak ada → fallback bawaan tanpa galat; JSON rusak → fallback + galat', async () => {
    const r404 = await loadContent('glossary', { fetchFn: async () => ({ ok: false }) });
    expect(r404.source).toBe('fallback'); expect(r404.errors).toEqual([]); expect(r404.data).toBe(fallbackContent('glossary'));
    const bad = await loadContent('glossary', { fetchFn: async () => ({ ok: true, headers: { get: () => 'application/json' }, text: async () => '{"version":1,"terms":[{"id":"x","term":"X","definition":"Has 15 %"}]}' }) });
    expect(bad.source).toBe('fallback'); expect(bad.errors.map((e) => e.code)).toContain('noNumbers');
  });
});

describe('data halaman Glossary', () => {
  it('urut abjad, filter teks, sumber tak dikenal → known:false ("source to verify")', () => {
    const all = glossaryTerms(G, REFS);
    expect(all.length).toBe(G.terms.length);
    const sorted = [...all].map((t) => t.term).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
    expect(all.map((t) => t.term)).toEqual(sorted);
    expect(glossaryTerms(G, REFS, 'inlet guide').map((t) => t.id)).toEqual(['igv']);
    expect(glossaryTerms(G, REFS, 'zzzz')).toEqual([]);
    const g2 = { terms: [{ id: 'x', term: 'X', definition: 'D.', refs: ['heywood', 'nope-1999'] }] };
    expect(glossaryTerms(g2, REFS)[0].refs.map((r) => r.known)).toEqual([true, false]);
  });
});
