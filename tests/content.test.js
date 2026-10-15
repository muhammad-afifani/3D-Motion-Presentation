// Konten presenter Scene 10–11 (content/*.json): skema, tanpa angka bersatuan, loader (fallback & galat), build.
import { describe, it, expect } from 'vitest';
import { readFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateControls, validateClosing, loadContent, contentUrl, fallbackContent, CARD_FIELDS, MACHINES } from '../src/state/content.js';
import { isHighlighted, cardHtml } from '../src/scenes/controls.js';
import { visibleOptions } from '../src/scenes/closing.js';
import { closingInitialState, closingTogglePatch, ctrlInitialState } from '../src/state/store.js';
import { contentErrorText } from '../src/ui/contentBanner.js';
import { STR } from '../src/ui/strings.js';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (f) => readFileSync(join(ROOT, 'content', f), 'utf8');
const controls = JSON.parse(read('controls.json'));
const closing = JSON.parse(read('closing.json'));

/** Semua teks (nilai string) di JSON, rekursif. */
const texts = (o) => (typeof o === 'string' ? [o] : Array.isArray(o) ? o.flatMap(texts) : o && typeof o === 'object' ? Object.values(o).flatMap(texts) : []);
// angka + satuan emisi/termodinamika yang dilarang di konten presenter
const NUM_UNIT = /\d+(?:[.,]\d+)?\s*(?:ppm|g\/kWh|mg\/Nm³|mg\/Nm3|K\b|bar\b|%|°C|MW\b|kW\b|kJ)/i;

describe('content/controls.json', () => {
  it('skema valid; tujuh kartu; id unik', () => {
    expect(validateControls(controls)).toEqual([]);
    expect(controls.cards.map((c) => c.id)).toEqual(['dln', 'leanburn', 'egr', 'water', 'scr', 'oxcat', 'dpf']);
  });
  it('setiap kartu punya keempat bidang (turun, naik, η/CO₂, kebutuhan operasi), tidak kosong', () => {
    for (const c of controls.cards) for (const k of CARD_FIELDS) expect(texts(c[k]).join('').trim().length, `${c.id}.${k}`).toBeGreaterThan(0);
  });
  it('pemetaan mesin & scene terkait sesuai keputusan (water/steam → [3, 6])', () => {
    const m = Object.fromEntries(controls.cards.map((c) => [c.id, [c.appliesTo, c.relatedScenes]]));
    expect(m).toEqual({
      dln: [['turbine'], [6, 4]], leanburn: [['gas'], [8, 3]], egr: [['diesel', 'gas'], [4]], water: [['turbine'], [3, 6]],
      scr: [['diesel', 'gas', 'turbine'], [9]], oxcat: [['diesel', 'gas', 'turbine'], [6]], dpf: [['diesel'], [8]],
    });
    for (const c of controls.cards) expect(c.appliesTo.every((x) => MACHINES.includes(x))).toBe(true);
  });
  it('SCR & oxidation catalyst: kebutuhan operasi kualitatif (jendela suhu exhaust, besaran dari data unit)', () => {
    for (const id of ['scr', 'oxcat']) expect(controls.cards.find((c) => c.id === id).operation.join(' ')).toMatch(/jendela suhu exhaust tertentu, besaran dari data unit/);
  });
});

describe('content/closing.json', () => {
  it('skema valid: tiga poin + empat opsi dari slide S11', () => {
    expect(validateClosing(closing)).toEqual([]);
    expect(closing.points).toHaveLength(3);
    expect(closing.options.map((o) => o.id)).toEqual(['by-type', 'load-range', 'inventory', 'cems']);
  });
});

describe('konten: tanpa angka bersatuan, tanpa vendor', () => {
  for (const [name, j] of [['controls.json', controls], ['closing.json', closing]]) {
    it(`${name}: tidak ada pola angka + (ppm, g/kWh, mg/Nm³, K, bar, %, °C, MW, kW, kJ)`, () => {
      const bad = texts(j).filter((t) => NUM_UNIT.test(t));
      expect(bad).toEqual([]);
    });
  }
  it('pola pemeriksa mendeteksi pelanggaran yang jelas (uji pola)', () => {
    for (const t of ['15 ppm', '0,26 g/kWh', '51 mg/Nm³', '1830 K', '20 bar', '3 %', '25 °C', '6 MW', '50 kW', '172 kJ/kg']) expect(NUM_UNIT.test(t), t).toBe(true);
    for (const t of ['CO₂ naik', 'NOx turun', 'penalti η kecil', 'Scene 6']) expect(NUM_UNIT.test(t), t).toBe(false);
  });
});

describe('validator: pesan galat dengan nama bidang', () => {
  it('controls: bidang hilang / mesin salah / scene tidak ada', () => {
    const bad = JSON.parse(JSON.stringify(controls));
    delete bad.cards[0].raises;
    bad.cards[1].appliesTo = ['ship'];
    bad.cards[2].relatedScenes = [42];
    bad.cards[3].id = bad.cards[0].id;
    expect(validateControls(bad)).toEqual([
      { field: 'cards[0].raises', code: 'textList' },
      { field: 'cards[1].appliesTo', code: 'machines' },
      { field: 'cards[2].relatedScenes', code: 'scenes' },
      { field: 'cards[3].id', code: 'duplicate' },
    ]);
    expect(validateControls([])).toEqual([{ field: '(root)', code: 'notObject' }]);
  });
  it('closing: bukan tiga poin / opsi tanpa teks', () => {
    expect(validateClosing({ version: 1, points: ['a'], options: [{ id: 'x' }] })).toEqual([
      { field: 'points', code: 'threePoints' }, { field: 'options[0].text', code: 'text' },
    ]);
  });
});

describe('loader: fallback & galat (tidak pernah throw)', () => {
  const resp = (status, text) => async () => ({ ok: status === 200, status, text: async () => text });
  it('file valid → dipakai (source file)', async () => {
    const r = await loadContent('controls', { fetchFn: resp(200, read('controls.json')), base: '/' });
    expect(r.source).toBe('file'); expect(r.errors).toEqual([]);
  });
  it('404 atau fetch gagal (tanpa server / file://) → fallback bawaan TANPA galat', async () => {
    for (const fetchFn of [resp(404, ''), async () => { throw new TypeError('Failed to fetch'); }]) {
      const r = await loadContent('closing', { fetchFn, base: './' });
      expect(r.source).toBe('fallback'); expect(r.errors).toEqual([]); expect(r.data).toBe(fallbackContent('closing'));
    }
  });
  it('fallback SPA (server mengembalikan index.html 200 untuk file yang tidak ada) → fallback TANPA galat', async () => {
    const html = async () => ({ ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => '<!doctype html><html></html>' });
    const htmlNoType = async () => ({ ok: true, status: 200, text: async () => '<!doctype html>' });
    for (const fetchFn of [html, htmlNoType]) {
      const r = await loadContent('closing', { fetchFn, base: '/' });
      expect(r.source).toBe('fallback'); expect(r.errors).toEqual([]);
    }
  });
  it('JSON rusak → fallback + galat (nama file, bidang)', async () => {
    const r = await loadContent('controls', { fetchFn: resp(200, '{ "version": 1, "cards": [ }'), base: '/' });
    expect(r.source).toBe('fallback'); expect(r.file).toBe('controls.json');
    expect(r.errors[0]).toMatchObject({ field: '(json)', code: 'parse' });
  });
  it('skema salah → fallback + galat per bidang', async () => {
    const r = await loadContent('closing', { fetchFn: resp(200, JSON.stringify({ version: 2, points: [], options: [] })), base: '/' });
    expect(r.source).toBe('fallback');
    expect(r.errors.map((e) => e.field)).toEqual(['version', 'points', 'options']);
  });
  it('fallback bawaan = file sumber (satu sumber)', () => {
    expect(fallbackContent('controls')).toEqual(controls);
    expect(fallbackContent('closing')).toEqual(closing);
  });
});

describe('path fetch per base', () => {
  it('Pages /3D-Motion-Presentation/ dan offline ./ menunjuk ke dist/content/', () => {
    expect(contentUrl('controls.json', '/3D-Motion-Presentation/')).toBe('/3D-Motion-Presentation/content/controls.json');
    expect(contentUrl('controls.json', './')).toBe('./content/controls.json');
    expect(new URL(contentUrl('closing.json', './'), 'http://localhost:4173/index.html').pathname).toBe('/content/closing.json');
    expect(new URL(contentUrl('closing.json', '/3D-Motion-Presentation/'), 'https://x.github.io/3D-Motion-Presentation/').pathname).toBe('/3D-Motion-Presentation/content/closing.json');
  });
});

describe('build: dist/content identik dengan sumber (Pages & offline)', () => {
  const cases = [
    { mode: 'production', base: '/3D-Motion-Presentation/' },
    { mode: 'offline', base: './' },
  ];
  for (const c of cases) {
    it(`${c.mode}: content/*.json disalin identik; aset & BASE_URL memakai base ${c.base}`, async () => {
      const { build } = await import('vite');
      const out = mkdtempSync(join(tmpdir(), 'emlab-'));
      const prev = process.env.GITHUB_REPOSITORY;
      process.env.GITHUB_REPOSITORY = 'owner/3D-Motion-Presentation';
      try {
        await build({ root: ROOT, mode: c.mode, logLevel: 'silent', build: { outDir: out, emptyOutDir: true } });
      } finally {
        if (prev === undefined) delete process.env.GITHUB_REPOSITORY; else process.env.GITHUB_REPOSITORY = prev;
      }
      for (const f of ['controls.json', 'closing.json', 'presenter.json']) expect(readFileSync(join(out, 'content', f), 'utf8')).toBe(read(f));
      // jendela presenter (M8a): halaman kedua dengan base yang sama
      const pres = readFileSync(join(out, 'presenter.html'), 'utf8');
      expect(pres).toContain(`src="${c.base}assets/`);
      const html = readFileSync(join(out, 'index.html'), 'utf8');
      expect(html).toContain(`src="${c.base}assets/`);
      const js = readdirSync(join(out, 'assets')).filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(out, 'assets', f), 'utf8')).join('\n');
      expect(js).toContain(`"${c.base}"`);   // import.meta.env.BASE_URL → literal base (contentUrl memakai ini)
      expect(js).toContain('content/');       // loader content.js ikut dibundel (Scene 10–11)
      // ukuran bundle (M8b): total gzip js/css/html/json < 1,5 MB
      const all = [...readdirSync(join(out, 'assets')).map((f) => join(out, 'assets', f)), join(out, 'index.html'), join(out, 'presenter.html'), ...readdirSync(join(out, 'content')).map((f) => join(out, 'content', f))];
      const gz = all.filter((f) => /\.(js|css|html|json)$/.test(f)).reduce((n, f) => n + gzipSync(readFileSync(f)).length, 0);
      expect(gz).toBeLessThan(1.5 * 1024 * 1024);
      rmSync(out, { recursive: true, force: true });
    }, 120000);
  }
});

describe('Scene 10: kartu pengendali', () => {
  it('filter mesin menyorot kartu sesuai appliesTo', () => {
    expect(ctrlInitialState()).toEqual({ ctrlFilter: 'all' });
    const hit = (f) => controls.cards.filter((c) => isHighlighted(c, f)).map((c) => c.id);
    expect(hit('all')).toHaveLength(7);
    expect(hit('turbine')).toEqual(['dln', 'water', 'scr', 'oxcat']);
    expect(hit('diesel')).toEqual(['egr', 'scr', 'oxcat', 'dpf']);
    expect(hit('gas')).toEqual(['leanburn', 'egr', 'scr', 'oxcat']);
  });
  it('kartu memuat keempat label (strings.js), tautan scene terkait, dan teks konten di-escape', () => {
    const h = cardHtml(controls.cards[0]);
    for (const k of CARD_FIELDS) expect(h).toContain(STR.scene10.fields[k]);
    expect(h).toContain('data-scene="6"'); expect(h).toContain(STR.scene10.goScene(6));
    const x = cardHtml({ ...controls.cards[0], name: '<script>' });
    expect(x).toContain('&lt;script&gt;'); expect(x).not.toContain('<script>');
  });
});

describe('Scene 11: penutup', () => {
  it('opsi bisa disembunyikan / ditampilkan; tersimpan di store; default semua tampil', () => {
    let s = { ...closingInitialState() };
    expect(visibleOptions(closing, s).map((o) => o.id)).toEqual(['by-type', 'load-range', 'inventory', 'cems']);
    s = { ...s, ...closingTogglePatch(s, 'inventory') };
    expect(visibleOptions(closing, s).map((o) => o.id)).toEqual(['by-type', 'load-range', 'cems']);
    s = { ...s, ...closingTogglePatch(s, 'inventory') };
    expect(visibleOptions(closing, s)).toHaveLength(4);
  });
});

describe('banner galat konten', () => {
  it('menyebut nama file dan bidang; kosong bila tidak ada galat', () => {
    const t = contentErrorText({ file: 'controls.json', errors: [{ field: 'cards[0].raises', code: 'textList' }, { field: '(json)', code: 'parse', detail: 'Unexpected token' }] });
    expect(t).toBe('content/controls.json tidak valid: cards[0].raises (harus daftar teks tidak kosong); (json) (JSON tidak bisa dibaca: Unexpected token). Memakai isi bawaan; perbaiki file lalu reload.');
    expect(contentErrorText({ file: 'closing.json', errors: [] })).toBe('');
  });
  it('scene 10–11 tidak mengimpor thermo.js', () => {
    for (const p of ['../src/scenes/controls.js', '../src/scenes/closing.js', '../src/state/content.js']) {
      expect(readFileSync(new URL(p, import.meta.url), 'utf8')).not.toMatch(/model\/thermo/);
    }
  });
});
