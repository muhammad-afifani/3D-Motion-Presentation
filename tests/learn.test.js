// M11 Step 01: content/learn.json (salinan persis seed), validateLearn, pemuat dengan fallback dynamic import,
// router kelompok Learn, state bahasa etel:lang, sumber pengantar baru di references.json.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateLearn, learnTotals, validateReferences, REFERENCE_TYPES } from '../src/state/content.js';
import { loadLearn } from '../src/state/learnStore.js';
import { parseHash, learnHash, LEARN_VIEWS, sceneHash, pageHash, PAGES } from '../src/state/route.js';
import { LANG_KEY, readLangChoice, resolveLang, writeLang, tr } from '../src/state/lang.js';
import { groupReferences } from '../src/state/basisView.js';

const ROOT = new URL('..', import.meta.url).pathname;
const readJson = (p) => JSON.parse(readFileSync(`${ROOT}${p}`, 'utf8'));
const learn = readJson('content/learn.json');
const refs = readJson('content/references.json');
const glossary = readJson('content/glossary.json');
const OPTS = { refIds: refs.references.map((r) => r.id), glossaryIds: glossary.terms.map((t) => t.id), parseRoute: parseHash };
const clone = () => JSON.parse(JSON.stringify(learn));

describe('content/learn.json', () => {
  it('salinan persis seed (isi tidak ditulis ulang)', () => {
    expect(readFileSync(`${ROOT}content/learn.json`, 'utf8')).toBe(readFileSync(`${ROOT}docs/m11_pack/seeds/learn.seed.json`, 'utf8'));
  });
  it('validateLearn lolos untuk seed; total dihitung dari file', () => {
    expect(validateLearn(learn, OPTS)).toEqual([]);
    expect(learnTotals(learn)).toEqual({ levels: 6, lessons: 21, minutes: 271 });
  });
  it('contoh rusak ditolak: pasangan kosong, ref tak dikenal, rute rusak, answer di luar rentang, id ganda, istilah tak dikenal', () => {
    const codes = (mut) => { const j = clone(); mut(j); return validateLearn(j, OPTS).map((e) => e.code); };
    expect(codes((j) => { j.landing.tagline.id = ''; })).toContain('pair');
    expect(codes((j) => { j.levels[1].lessons[0].body[0] = { en: 'x', id: ' ' }; })).toContain('pair');
    expect(codes((j) => { j.levels[1].lessons[0].refs = ['no-such-ref']; })).toContain('unknownRef');
    expect(codes((j) => { j.levels[1].lessons[0].tryIt.route = '#/scene/99'; })).toContain('route');
    expect(codes((j) => { j.levels[0].lessons[0].checks[0].answer = 9; })).toContain('answer');
    expect(codes((j) => { j.levels[0].lessons[1].id = j.levels[0].lessons[0].id; })).toContain('duplicate');
    expect(codes((j) => { j.levels[0].lessons[0].terms = ['not-a-term']; })).toContain('unknownTerm');
    expect(codes((j) => { j.charts[0].lessons = ['l9-9']; })).toContain('unknownLesson');
    expect(codes((j) => { j.version = 2; j.defaultLang = 'fr'; })).toEqual(expect.arrayContaining(['version', 'lang']));
  });
  it('pemuat: file valid → file; file tidak ada → fallback dynamic import; import gagal → data null tanpa throw', async () => {
    const ok = (body, type = 'application/json') => async () => ({ ok: true, headers: { get: () => type }, text: async () => body });
    const r1 = await loadLearn({ fetchFn: ok(JSON.stringify(learn)), importFn: async () => { throw new Error('tidak dipakai'); } });
    expect(r1.source).toBe('file');
    const r2 = await loadLearn({ fetchFn: async () => ({ ok: false }), importFn: async () => ({ default: learn }) });
    expect(r2.source).toBe('fallback');
    expect(r2.data.version).toBe(1);
    const r3 = await loadLearn({ fetchFn: ok('{ rusak'), importFn: async () => { throw new Error('chunk 404'); } });
    expect(r3.data).toBeNull();
    expect(r3.source).toBe('none');
    expect(r3.errors[0].code).toBe('parse');
    const r4 = await loadLearn({ fetchFn: async () => { throw new Error('offline'); }, importFn: async () => ({ default: learn }) });
    expect(r4.source).toBe('fallback');
  });
  it('fallback learn.json tidak diimpor statis (chunk terpisah)', () => {
    const src = readFileSync(`${ROOT}src/state/content.js`, 'utf8') + readFileSync(`${ROOT}src/main.js`, 'utf8');
    expect(src).not.toMatch(/^import .*learn\.json/m);
    expect(readFileSync(`${ROOT}src/state/learnStore.js`, 'utf8')).toMatch(/import\('\.\.\/\.\.\/content\/learn\.json'\)/);
  });
});

describe('router kelompok Learn (alamat lama tidak berubah)', () => {
  it('alamat baru', () => {
    expect(LEARN_VIEWS).toEqual(['landing', 'learn', 'charts', 'about']);
    expect(parseHash('#/about')).toEqual({ type: 'learn', view: 'about', id: null });
    expect(parseHash('#/learn')).toEqual({ type: 'learn', view: 'learn', id: null });
    expect(parseHash('#/learn/l2-1')).toEqual({ type: 'learn', view: 'learn', id: 'l2-1' });
    expect(parseHash('#/learn/charts')).toEqual({ type: 'learn', view: 'charts', id: null });
    expect(parseHash('#/learn/charts/pv')).toEqual({ type: 'learn', view: 'charts', id: 'pv' });
    for (const [v, id] of [['landing', null], ['about', null], ['learn', null], ['learn', 'l0-1'], ['charts', null], ['charts', 'pv']]) expect(parseHash(learnHash(v, id))).toEqual({ type: 'learn', view: v, id });
    for (const h of ['#/learn/a/b', '#/about/x', '#/learnx', '#/start']) expect(parseHash(h), h).toBeNull();
  });
  it('alamat lama tetap', () => {
    expect(parseHash(sceneHash(6))).toEqual({ type: 'scene', n: 6, tab: null });
    for (const p of PAGES) expect(parseHash(pageHash(p))).toEqual({ type: 'page', page: p, id: null });
  });
  it('main.js: mode Present + alamat tanpa hash → Scene 1 (bukan landing); panah tidak ke landing', () => {
    const main = readFileSync(`${ROOT}src/main.js`, 'utf8');
    expect(main).toMatch(/route0\?\.type === 'learn' && route0\.view === 'landing' && mode === 'present'/);
    expect(main).toMatch(/startN = .*1/);
  });
});

describe('bahasa: etel:lang, kunjungan pertama = bahasa browser bila diawali id, selain itu English (D1)', () => {
  const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
  const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  it('baca/tulis aman; kunjungan pertama dari bahasa browser', () => {
    expect(LANG_KEY).toBe('etel:lang');
    const st = mem();
    expect(readLangChoice(st)).toEqual({ lang: null, stored: false });
    expect(resolveLang(readLangChoice(st), 'id-ID')).toBe('id');
    expect(resolveLang(readLangChoice(st), 'en-US')).toBe('en');
    expect(writeLang(st, 'en')).toBe(true);
    expect(resolveLang(readLangChoice(st), 'id-ID')).toBe('en');
    expect(writeLang(st, 'fr')).toBe(false);
    expect(readLangChoice(throwing)).toEqual({ lang: null, stored: false });
    expect(writeLang(throwing, 'id')).toBe(false);
    expect(resolveLang(readLangChoice(throwing), undefined)).toBe('en'); // bahasa browser tidak diketahui → English
    expect(tr({ en: 'A', id: 'B' }, 'id')).toBe('B');
    expect(tr({ en: 'A', id: '' }, 'id')).toBe('A');
  });
});

describe('references.json: 12 sumber pengantar (M11)', () => {
  it('tipe web, level intro, accessed; validator lama tetap lolos; tipe web dikelompokkan setelah report', () => {
    expect(validateReferences(refs)).toEqual([]);
    const seed = readJson('docs/m11_pack/seeds/references.add.seed.json').references;
    for (const r of seed) expect(refs.references.find((x) => x.id === r.id)).toEqual(r);
    expect(REFERENCE_TYPES.at(-1)).toBe('web');
    expect(REFERENCE_TYPES.indexOf('web')).toBe(REFERENCE_TYPES.indexOf('report') + 1);
    expect(groupReferences(refs).map((g) => g.type)).toContain('web');
    const bad = (patch) => validateReferences({ version: 1, references: [{ ...refs.references[0], ...patch }] }).map((e) => e.code);
    expect(bad({ level: 'advanced' })).toContain('refLevel');
    expect(bad({ accessed: '16 Oct 2026' })).toContain('date');
    expect(bad({ url: 'ftp://x' })).toContain('url');
  });
});
