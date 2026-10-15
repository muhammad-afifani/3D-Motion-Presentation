// basis.js: setiap ekspor thermo.js punya dasar teori (atau tercatat sebagai helper), refs menunjuk id yang ada
// di content/references.json, dan references.json valid + dimuat lewat content loader.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as thermo from '../src/model/thermo.js';
import { BASIS, UTILITY, LEVELS, basisFor, needsVerification } from '../src/model/basis.js';
import { validateReferences, loadContent, fallbackContent, CONTENT_FILES, REFERENCE_TYPES } from '../src/state/content.js';

const ROOT = new URL('..', import.meta.url).pathname;
const refsJson = JSON.parse(readFileSync(join(ROOT, 'content/references.json'), 'utf8'));
const REF_IDS = new Set(refsJson.references.map((r) => r.id));
const exportsOfThermo = Object.keys(thermo);

function jsFiles(dir, out = []) {
  for (const f of readdirSync(join(ROOT, dir))) {
    const p = join(dir, f);
    if (statSync(join(ROOT, p)).isDirectory()) jsFiles(p, out);
    else if (/\.(js|mjs)$/.test(f)) out.push(p);
  }
  return out;
}
/** Empty refs are allowed only for calibrations (Site data), plain definitions, or entries that name a missing source. */
const DEFINITIONS = new Set(['massRateKgH', 'fuelPerKWh', 'phiFromQinPerKgAir', 'ghgPenalty']);

describe('basis.js: cakupan ekspor thermo.js', () => {
  it('setiap ekspor thermo.js ada di BASIS atau UTILITY (tidak keduanya)', () => {
    const missing = exportsOfThermo.filter((k) => !(k in BASIS) && !(k in UTILITY));
    const both = exportsOfThermo.filter((k) => k in BASIS && k in UTILITY);
    expect(missing, `tambahkan ke basis.js: ${missing.join(', ')}`).toEqual([]);
    expect(both).toEqual([]);
  });
  it('tidak ada entri yatim (nama bukan ekspor thermo.js)', () => {
    const orphans = [...Object.keys(BASIS), ...Object.keys(UTILITY)].filter((k) => !exportsOfThermo.includes(k));
    expect(orphans).toEqual([]);
  });
  it('setiap ekspor thermo.js yang dipakai di luar thermo.js punya entri BASIS atau UTILITY', () => {
    const files = [...jsFiles('src'), ...jsFiles('scripts')].filter((f) => !f.endsWith('model/thermo.js') && !f.endsWith('model/basis.js'));
    const src = files.map((f) => readFileSync(join(ROOT, f), 'utf8')).join('\n');
    const used = exportsOfThermo.filter((k) => new RegExp(`\\b${k}\\b`).test(src));
    expect(used.length).toBeGreaterThan(40);
    expect(used.filter((k) => !basisFor(k) && !(k in UTILITY))).toEqual([]);
  });
});

describe('basis.js: isi entri', () => {
  for (const [name, b] of Object.entries(BASIS)) {
    it(`${name}: level, derivation, refs valid`, () => {
      expect(LEVELS).toContain(b.level);
      expect(b.derivation.trim().length).toBeGreaterThan(10);
      expect(Array.isArray(b.assumptions) && Array.isArray(b.toVerify) && Array.isArray(b.refs)).toBe(true);
      expect(b.refs.filter((id) => !REF_IDS.has(id)), 'id tidak ada di content/references.json').toEqual([]);
      expect(new Set(b.refs).size).toBe(b.refs.length);
      if (!b.refs.length) expect(b.level === 'Site data' || b.toVerify.length > 0 || DEFINITIONS.has(name), `${name}: tanpa sumber harus Site data / toVerify / definisi`).toBe(true);
    });
  }
  it('jujur tentang kalibrasi: entri kalibrasi berlevel Site data dan menyebut "typical literature values"', () => {
    for (const k of ['calibrateTo', 'ENGINE_NOX_CALIB', 'calibrateDLN', 'calibrateEngineNOx']) {
      expect(BASIS[k].level, k).toBe('Site data');
    }
    for (const k of ['ENGINE_NOX_CALIB', 'calibrateDLN', 'calibrateEngineNOx', 'coDLN']) {
      expect(BASIS[k].assumptions.join(' '), k).toMatch(/typical literature values, not site data/);
    }
  });
  it('korelasi emisi berlabel indicative; kalimat kejujuran part-load dipertahankan', () => {
    for (const k of ['noxThermal', 'zeldovichRate', 'dlnEmissions', 'retardSweep']) expect(BASIS[k].assumptions.join(' '), k).toMatch(/Indicative/);
    const a = BASIS.loadSweep.assumptions.join(' ');
    expect(a).toMatch(/CO cliff once the IGV runs out/);
    expect(a).toMatch(/shifts and narrows/);
    expect(a).not.toMatch(/explod/i);
  });
  it('sumber yang belum ada di references.json tercatat sebagai toVerify (bukan dikarang)', () => {
    expect(needsVerification('chenFlynnFMEP')).toBe(true);
    expect(needsVerification('co2Specific')).toBe(true);
    expect(needsVerification('otto')).toBe(false);
  });
});

describe('content/references.json', () => {
  it('lolos validateReferences; semua jenis dikenal', () => {
    expect(validateReferences(refsJson)).toEqual([]);
    expect(refsJson.references.every((r) => REFERENCE_TYPES.includes(r.type))).toBe(true);
  });
  it('validateReferences menolak id ganda, jenis salah, flag bukan boolean', () => {
    const r = refsJson.references[0];
    const codes = (j) => validateReferences(j).map((x) => x.code);
    expect(codes({ version: 1, references: [r, { ...r }] })).toContain('duplicate');
    expect(codes({ version: 1, references: [{ ...r, type: 'blog' }] })).toContain('refType');
    expect(codes({ version: 1, references: [{ ...r, locatorVerified: 'ya' }] })).toContain('boolean');
    expect(codes({ version: 1, references: [{ ...r, id: 'Heywood 1' }] })).toContain('refId');
    expect(codes({ version: 2, references: [r] })).toContain('version');
    expect(codes(null)).toEqual(['notObject']);
  });
  it('id konsisten dengan seed (tidak ada sumber yang ditambah di luar daftar seed)', () => {
    const seed = JSON.parse(readFileSync(join(ROOT, 'docs/m9_pack/seeds/references.seed.json'), 'utf8'));
    expect(refsJson.references.map((r) => r.id)).toEqual(seed.references.map((r) => r.id));
  });
  it('dimuat lewat loader: fallback bawaan sama dengan file; JSON rusak → fallback + galat', async () => {
    expect(CONTENT_FILES.references).toBe('references.json');
    expect(fallbackContent('references')).toEqual(refsJson);
    const res = (body, type = 'application/json') => async () => ({ ok: true, headers: { get: () => type }, text: async () => body });
    const ok = await loadContent('references', { fetchFn: res(JSON.stringify(refsJson)), base: '/x/' });
    expect(ok.source).toBe('file'); expect(ok.errors).toEqual([]);
    const bad = await loadContent('references', { fetchFn: res('{rusak'), base: '/x/' });
    expect(bad.source).toBe('fallback'); expect(bad.errors[0].code).toBe('parse');
    const wrong = await loadContent('references', { fetchFn: res(JSON.stringify({ version: 1, references: [{ id: 'x' }] })), base: '/x/' });
    expect(wrong.source).toBe('fallback'); expect(wrong.errors.length).toBeGreaterThan(0);
  });
});
