// M9 Step 05a: content/emission_formation.json — salinan seed, skema, jumlah kartu per equipment, refs valid, English,
// subskrip reaksi, tautan #/references/<id>. Kartu tidak memuat angka model.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateFormation, loadContent, fallbackContent, CONTENT_FILES, FORMATION_MODELED } from '../src/state/content.js';
import { formationCards, chemTokens, referenceHref } from '../src/state/formationView.js';
import { EQUIPMENT, EQUIPMENT_ORDER } from '../src/state/regulations.js';
import { ID_WORDS } from './language.test.js';
import { isReferencesHash, referenceIdFromHash } from '../src/state/basisView.js';

const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const form = read('content/emission_formation.json');
const refs = read('content/references.json');
const REF_IDS = new Set(refs.references.map((r) => r.id));

describe('content/emission_formation.json', () => {
  it('sama dengan seed (termasuk koreksi CO turbin = semi-empirical) dan lolos validasi', () => {
    expect(form).toEqual(read('docs/m9_pack/seeds/emission_formation.seed.json'));
    expect(validateFormation(form)).toEqual([]);
    expect(form.equipment.turbine.params.CO.modeled).toBe('semi-empirical');
  });
  it('semua refs (formation dan levers) ada di references.json', () => {
    const bad = [];
    for (const [ek, ev] of Object.entries(form.equipment)) for (const [pk, pv] of Object.entries(ev.params)) {
      for (const id of pv.formation.refs) if (!REF_IDS.has(id)) bad.push(`${ek}.${pk}: ${id}`);
      for (const l of pv.levers) for (const id of l.refs ?? []) if (!REF_IDS.has(id)) bad.push(`${ek}.${pk}.${l.id}: ${id}`);
    }
    expect(bad).toEqual([]);
  });
  it('berbahasa English (tanpa kata Indonesia umum di luar nama regulasi)', () => {
    const re = new RegExp(`(?<![\\p{L}\\p{N}_])(${ID_WORDS.join('|')})(?![\\p{L}\\p{N}_])`, 'iu');
    // id sumber (mis. lieuwen-yang) bukan teks tampilan: dibuang dulu
    const texts = JSON.stringify(form.equipment, (k, v) => (k === 'refs' ? undefined : v)).replace(/Permen LHK? [0-9/]+/g, ' ');
    expect(texts.match(re)?.[0] ?? null).toBe(null);
  });
  it('validasi menolak modeled / direction yang tidak dikenal; loader fallback bila rusak', async () => {
    const j = structuredClone(form);
    j.equipment.diesel.params.NOx.modeled = 'guessed';
    j.equipment.diesel.params.NOx.drivers[0].direction = 'sideways';
    const codes = validateFormation(j).map((x) => x.code);
    expect(codes).toContain('formModeled'); expect(codes).toContain('formDirection');
    expect(CONTENT_FILES.formation).toBe('emission_formation.json');
    expect(fallbackContent('formation')).toEqual(form);
    const res = (body) => async () => ({ ok: true, headers: { get: () => 'application/json' }, text: async () => body });
    const r = await loadContent('formation', { fetchFn: res('{'), base: '/' });
    expect(r.source).toBe('fallback'); expect(r.errors[0].code).toBe('parse');
    expect(FORMATION_MODELED).toContain('semi-empirical');
  });
});

describe('kartu Formation per equipment', () => {
  it('jumlah kartu = jumlah parameter di JSON untuk setiap equipment', () => {
    for (const k of EQUIPMENT_ORDER) {
      const v = formationCards(form, k, refs);
      expect(v.cards.length, k).toBe(Object.keys(form.equipment[EQUIPMENT[k].formation].params).length);
    }
    expect(formationCards(form, 'dieselEngine', refs).cards.map((c) => c.param)).toEqual(['NOx', 'CO', 'PM', 'SO2', 'CO2']);
    expect(formationCards(form, 'gasTurbine', refs).cards.length).toBe(6);
  });
  it('sumber: tautan #/references/<id>; id yang hilang → known:false ("source to verify")', () => {
    const c = formationCards(form, 'dieselEngine', refs).cards[0];
    expect(c.refs.every((r) => r.known && r.href === `#/references/${r.id}`)).toBe(true);
    const cut = { references: refs.references.filter((r) => r.id !== 'heywood') };
    const miss = formationCards(form, 'dieselEngine', cut).cards[0].refs.find((r) => r.id === 'heywood');
    expect(miss).toEqual({ id: 'heywood', known: false });
    expect(referenceHref('a b')).toBe('#/references/a%20b');
  });
  it('subskrip reaksi: N2 → N₂, CO2 → CO₂; koefisien tetap biasa; <=> → ⇌', () => {
    expect(chemTokens('O + N2 <=> NO + N')).toEqual([{ t: 'O + N', sub: false }, { t: '2', sub: true }, { t: ' ⇌ NO + N', sub: false }]);
    expect(chemTokens('2 NO + O2')).toEqual([{ t: '2 NO + O', sub: false }, { t: '2', sub: true }]);
    expect(chemTokens('CH4').map((x) => x.sub)).toEqual([false, true]);
    expect(chemTokens('C12H23').filter((x) => x.sub).map((x) => x.t)).toEqual(['12', '23']);
  });
  it('nama mekanisme juga bersubskrip (N2O route → N₂O)', () => {
    const c = formationCards(form, 'gasTurbine', refs).cards.find((x) => x.param === 'NOx');
    expect(c.reactionsName.some((t) => t.sub && t.t === '2')).toBe(true);
  });
  it('kartu tidak membawa angka model (hanya teks konten)', () => {
    const c = formationCards(form, 'gasEngine', refs).cards.find((x) => x.param === 'NOx');
    expect(Object.keys(c)).toEqual(['param', 'modeled', 'summary', 'reactionsName', 'rateNote', 'reactions', 'refs', 'drivers', 'levers']);
  });
});

describe('alamat #/references/<id> (tautan sumber kartu Formation)', () => {
  it('dikenali sebagai halaman References dan id dapat dibaca', () => {
    expect(isReferencesHash('#/references/heywood')).toBe(true);
    expect(isReferencesHash('#/references')).toBe(true);
    expect(isReferencesHash('#/regulations')).toBe(false);
    expect(referenceIdFromHash('#/references/zeldovich-1946')).toBe('zeldovich-1946');
    expect(referenceIdFromHash('#/references/a%20b')).toBe('a b');
    expect(referenceIdFromHash('#/references')).toBe(null);
  });
  it('setiap tautan sumber kartu memakai bentuk #/references/<id> yang dikenali halaman References', () => {
    for (const k of EQUIPMENT_ORDER) for (const c of formationCards(form, k, refs).cards) {
      for (const r of [...c.refs, ...c.levers.flatMap((l) => l.refs)]) {
        expect(isReferencesHash(r.href)).toBe(true);
        expect(referenceIdFromHash(r.href)).toBe(r.id);
      }
    }
  });
});
