// Bagian C: bantuan ⓘ (content/help.json, validateHelp, helpStore, inventaris, kabel komponen, isi wajib).
// Tampilan nyata (kartu, posisi, tumpang tindih, Present, PNG) diuji di smoke e2e.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as thermo from '../src/model/thermo.js';
import { validateHelp, helpHasNumber, HELP_ID_RE } from '../src/state/content.js';
import { loadHelp } from '../src/state/helpStore.js';
import { HELP_IDS, HUD_HELP_IDS, CTL_HELP_IDS, UI_HELP_IDS, HELP_SKIPPED } from '../src/state/helpIds.js';
import { setSceneOrigin, sceneOrigin, backToSceneHash, clearSceneOrigin } from '../src/state/backToScene.js';
import { GLOBAL_KEYS } from '../src/ui/keys.js';
import { STR } from '../src/ui/strings.js';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(`${ROOT}${p}`, 'utf8');
const help = JSON.parse(read('content/help.json'));
const glossary = JSON.parse(read('content/glossary.json'));
const learn = JSON.parse(read('content/learn.json'));
const GLOSSARY_IDS = [...glossary.terms.map((t) => t.id), ...learn.terms.map((t) => t.id)];
const LESSON_IDS = learn.levels.flatMap((l) => l.lessons.map((x) => x.id));
const OPTS = { glossaryIds: GLOSSARY_IDS, lessonIds: LESSON_IDS };
const clone = () => JSON.parse(JSON.stringify(help));
const items = Object.entries(help.items);
const texts = (it) => ['what', 'how'].flatMap((k) => ['en', 'id'].map((l) => it[k][l]));

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out); else if (f.endsWith('.js')) out.push(p);
  }
  return out;
}

describe('validateHelp', () => {
  it('help.json lolos (id glossary dan pelajaran ada); draf: reviewed false', () => {
    expect(validateHelp(help, OPTS)).toEqual([]);
    expect(help.version).toBe(1);
    expect(help.reviewed).toBe(false);
  });
  it('contoh rusak ditolak: pasangan kosong, id tak dikenal, angka, kunci asing, glossary/lesson tak ada, bentuk id', () => {
    const codes = (mut) => { const j = clone(); mut(j); return validateHelp(j, OPTS).map((e) => e.code); };
    expect(codes((j) => { j.items['hud.pmax'].what.id = ''; })).toContain('pair');
    expect(codes((j) => { delete j.items['hud.pmax'].how; })).toContain('pair');
    expect(codes((j) => { j.items['hud.pmax'].how.en = 'It reaches 112 bar.'; })).toContain('noNumbers');
    expect(codes((j) => { j.items['hud.pmax'].how.id = 'Mencapai 5 bar.'; })).toContain('noNumbers');
    expect(codes((j) => { j.items['hud.pmax'].extra = 'x'; })).toContain('field');
    expect(codes((j) => { j.items['hud.pmax'].glossary = ['no-such-term']; })).toContain('unknownTerm');
    expect(codes((j) => { j.items['hud.pmax'].lesson = 'l9-9'; })).toContain('unknownLesson');
    expect(codes((j) => { j.items['bad id'] = j.items['hud.pmax']; })).toContain('refId');
    expect(codes((j) => { j.version = 2; delete j.reviewed; })).toEqual(expect.arrayContaining(['version', 'boolean']));
    expect(validateHelp(null)[0].code).toBe('notObject');
    expect(validateHelp({ version: 1, reviewed: true, items: {} }).map((e) => e.code)).toContain('array');
  });
  it('pengecualian angka: subskrip kimia, "Scene N", "key X" / "tombol X", dan "3D"; digit ASCII lain ditolak', () => {
    for (const ok of ['CO₂, NO₂, O₂, H₂S and T₃', 'Open Scene 6 or Scene 11', 'Press key F, key R, key ? or key 1', 'Tekan tombol 2 atau tombol H', 'The 3D view', 'mg/Nm³ and φ words']) expect(helpHasNumber(ok), ok).toBe(false);
    for (const bad of ['15 % O2', 'about 3 bar', 'Scene', 'O2', 'CO2 at 100', 'Pressing key 12', 'a 30D b']) {
      if (bad === 'Scene') continue;
      expect(helpHasNumber(bad), bad).toBe(true);
    }
  });
  it('bentuk id: kelompok.nama (hud, ctl, ui, nav, hdr)', () => {
    for (const id of HELP_IDS) expect(id, id).toMatch(HELP_ID_RE);
    expect(HELP_ID_RE.test('foo.bar')).toBe(false);
  });
});

describe('pemuat help.json (state/helpStore.js)', () => {
  const ok = (body, type = 'application/json') => async () => ({ ok: true, headers: { get: () => type }, text: async () => body });
  it('file valid → file; tidak ada → fallback dynamic import; rusak dan import gagal → data null tanpa throw', async () => {
    const r1 = await loadHelp({ fetchFn: ok(JSON.stringify(help)), importFn: async () => { throw new Error('tidak dipakai'); } });
    expect(r1.source).toBe('file');
    const r2 = await loadHelp({ fetchFn: async () => ({ ok: false }), importFn: async () => ({ default: help }) });
    expect(r2.source).toBe('fallback');
    expect(Object.keys(r2.data.items).length).toBe(HELP_IDS.length);
    const r3 = await loadHelp({ fetchFn: ok('{ rusak'), importFn: async () => { throw new Error('chunk 404'); } });
    expect(r3.data).toBeNull();
    expect(r3.errors[0].code).toBe('parse');
    const r4 = await loadHelp({ fetchFn: async () => { throw new Error('offline'); }, importFn: async () => ({ default: help }) });
    expect(r4.source).toBe('fallback');
  });
  it('help.json tidak diimpor statis (chunk terpisah)', () => {
    expect(read('src/state/helpStore.js')).toMatch(/import\('\.\.\/\.\.\/content\/help\.json'\)/);
    const staticImports = ['src/state/content.js', 'src/main.js', 'src/ui/helpButton.js', 'src/ui/helpPopover.js'].map(read).join('\n');
    expect(staticImports).not.toMatch(/^import .*help\.json/m);
  });
});

describe('cakupan inventaris', () => {
  it('daftar id: unik; setiap id "ya" punya item di help.json; tidak ada item yatim', () => {
    expect(new Set(HELP_IDS).size).toBe(HELP_IDS.length);
    const have = new Set(Object.keys(help.items));
    expect(HELP_IDS.filter((id) => !have.has(id))).toEqual([]);
    expect([...have].filter((id) => !HELP_IDS.includes(id))).toEqual([]);
    expect(HUD_HELP_IDS.length + CTL_HELP_IDS.length + UI_HELP_IDS.length).toBe(HELP_IDS.length);
  });
  it('setiap id dipasang di sumber (help: \'id\' atau createHelpButton(\'id\')); gagal dan menyebut id yang tidak terpasang', () => {
    const src = [...walk(`${ROOT}src/scenes`), ...walk(`${ROOT}src/ui`), ...walk(`${ROOT}src/charts`), `${ROOT}src/main.js`]
      .filter((f) => !f.endsWith('helpIds.js')).map((f) => readFileSync(f, 'utf8')).join('\n');
    const unwired = HELP_IDS.filter((id) => !new RegExp(`['"]${id.replace('.', '\\.')}['"]`).test(src));
    expect(unwired).toEqual([]);
  });
  it('setiap id yang dipasang di sumber ada di inventaris (tidak ada id liar)', () => {
    const src = [...walk(`${ROOT}src/scenes`), ...walk(`${ROOT}src/ui`), ...walk(`${ROOT}src/charts`), `${ROOT}src/main.js`]
      .filter((f) => !f.endsWith('helpIds.js')).map((f) => readFileSync(f, 'utf8')).join('\n');
    const used = [...src.matchAll(/(?:help: |createHelpButton\()\s*'((?:hud|ctl|ui|nav|hdr)\.[A-Za-z0-9]+)'/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(150);
    expect(used.filter((id) => !HELP_IDS.includes(id))).toEqual([]);
  });
  it('elemen yang sengaja tidak diberi bantuan tercatat dengan alasan', () => {
    expect(HELP_SKIPPED.length).toBeGreaterThanOrEqual(8);
    for (const s of HELP_SKIPPED) { expect(s.what.length).toBeGreaterThan(3); expect(s.why.length).toBeGreaterThan(10); }
  });
});

describe('isi: aturan bahasa dan kejujuran model', () => {
  const BANNED = /delve|unlock|journey|seamless|in today's|it's not just|game-changer|robust|leverage|empower|dive into|landscape|embark|—|menyelami|mari kita|di era|tidak hanya/i;
  const EN_ID_WORDS = /(?<![\p{L}\p{N}_])(yang|dan|dengan|untuk|tidak|adalah|atau|pada|dari|bahan bakar|emisi|beban|tekanan|suhu|hanya|bukan|karena|lebih|semua|setiap|tetapi|sudah|belum|bisa|harus|kurva|titik|nyala|campuran|mesin|turbin|kompresor|siklus|efisiensi|daya|kecepatan|pembakaran|tampilan)(?![\p{L}\p{N}_])/iu;
  it('pasangan en dan id lengkap; sisi en tanpa kata Indonesia; sisi id berbahasa Indonesia', () => {
    for (const [id, it] of items) {
      for (const k of ['what', 'how']) {
        expect(it[k].en.trim().length, `${id}.${k}.en`).toBeGreaterThan(8);
        expect(it[k].id.trim().length, `${id}.${k}.id`).toBeGreaterThan(8);
        expect(EN_ID_WORDS.test(it[k].en), `${id}.${k}.en`).toBe(false);
        expect(it[k].id, `${id}.${k}.id`).not.toBe(it[k].en);
      }
    }
  });
  // kartu kelompok (banyak bagian) boleh lebih panjang; yang lain: how paling banyak tiga kalimat
  const HOW_LONG = new Set(['ui.s9tabs', 'ui.statusChip', 'hdr.switches', 'hdr.status', 'nav.keys']);
  it('gaya: tanpa frasa gaya mesin atau tanda pisah panjang; what satu kalimat; how paling banyak tiga kalimat (kartu kelompok lebih panjang)', () => {
    const sentences = (t) => t.split(/(?<=[.?!])\s+(?=[A-ZΑ-Ωⓘ])/).length;
    const long = [];
    for (const [id, it] of items) {
      for (const t of texts(it)) expect(BANNED.test(t), `${id}: ${t}`).toBe(false);
      for (const l of ['en', 'id']) if (sentences(it.what[l]) !== 1) long.push(`${id}.what.${l}`);
      for (const l of ['en', 'id']) if (sentences(it.how[l]) > (HOW_LONG.has(id) ? 7 : 3)) long.push(`${id}.how.${l}`);
    }
    expect(long).toEqual([]);
  });
  it('tanpa nama fungsi atau konstanta kode, tanpa vendor', () => {
    const names = Object.keys(thermo).filter((k) => k.length > 6 && (/[a-z][A-Z]|_/.test(k)));
    const all = items.flatMap(([, it]) => texts(it)).join('\n');
    for (const n of names) expect(new RegExp(`\\b${n}\\b`).test(all), n).toBe(false);
    expect(all).not.toMatch(/ENGINE_NOX_CALIB|calibrateTo|complianceCheck|toRegulationBasis|[a-z]+[A-Z][A-Za-z]+\(/);
    expect(all).not.toMatch(/\b(Siemens|GE|Solar Turbines|Caterpillar|Wärtsilä|Wartsila|Cummins|MAN|Rolls|Baker Hughes|Mitsubishi)\b/);
  });
  it('item bersama antar-scene tidak menyebut scene tertentu (kecuali yang memang milik Scene 9)', () => {
    const SCENE_OK = new Set(['ctl.load']);
    for (const [id, it] of items) if (!SCENE_OK.has(id)) for (const t of texts(it)) expect(/\bScene \d/.test(t), `${id}: ${t}`).toBe(false);
  });
  it('tidak ada klaim "compliant" / "lulus" / "CO meledak"', () => {
    for (const [id, it] of items) for (const t of texts(it)) {
      expect(/\bcompliant\b|\blulus\b|explod|meledak|\bpasses? the limit/i.test(t), `${id}: ${t}`).toBe(false);
    }
  });
  const must = (id, ...res) => it(`wajib: ${id}`, () => {
    const t = help.items[id];
    const en = `${t.what.en} ${t.how.en}`, idt = `${t.what.id} ${t.how.id}`;
    for (const re of res) { expect(en, `${id} en ${re}`).toMatch(re[0] ?? re); if (re[1]) expect(idt, `${id} id ${re[1]}`).toMatch(re[1]); }
  });
  // NOx dan kalibrasi: indicative; dikalibrasi ke nilai tipikal literatur, bukan data unit atau prediksi vendor; basis O₂ dan volume di samping angka
  for (const id of ['hud.noxG', 'hud.noxPpm', 'hud.noxMg', 'hud.noxCalib', 'ctl.calibration', 'ui.calibration']) {
    must(id, [/indicative/i, /indikatif/i], [/typical literature values/, /tipikal literatur/], [/not (?:to )?unit (?:data|data)|not unit data/, /bukan data unit/], [/vendor prediction/, /prediksi vendor/]);
  }
  for (const id of ['hud.noxPpm', 'hud.noxMg']) must(id, [/O₂/, /O₂/], [/volume basis/, /basis volume/]);
  // chip dan status: perbandingan nilai model dengan limit pada basis regulasi, bukan pernyataan memenuhi syarat; margin kecil diberi keterangan
  for (const id of ['ui.statusChip', 'hud.limitStatus']) must(id, [/compares the model value with the limit on the regulation basis/i, /membandingkan nilai model dengan limit pada basis regulasi/i], [/not a test result/i, /bukan hasil uji/], [/not a statement that a unit complies/, /bukan pernyataan bahwa unit memenuhi syarat/], [/margin/i, /[Mm]argin/], [/uncertainty/, /ketidakpastian/]);
  // site data dan Permit/OEM CO
  for (const id of ['ui.siteData', 'ui.limitOverride']) must(id, [/no CO limit/, /tidak punya limit CO/], [/permit or OEM/, /izin atau OEM/], [/user (?:input|override)/, /(?:isian|override) pengguna|Ini isian pengguna/]);
  must('ui.siteData', [/takes priority/, /diutamakan/], [/marked as site data/, /ditandai sebagai data unit/]);
  must('hud.limitCo', [/no CO limit/, /tidak punya limit CO/], [/user input/, /isian pengguna/]);
  // part-load: single-shaft tebing CO setelah IGV habis; twin-shaft jendela operasi bergeser dan menyempit
  for (const id of ['hud.coPpm', 'hud.loadWindow', 'ctl.strategy']) must(id, [/shifts and narrows/, /bergeser dan menyempit/], [/cliff/, /tebing/]);
  // bahan bakar: komposisi tidak mengubah NOx/CO; sulfur hanya SO₂
  for (const id of ['ctl.fuelComposition', 'ctl.h2s', 'ctl.sulfur']) must(id, [/NOx(?: or | and )CO/, /NOx (?:atau|dan) CO/]);
  must('ctl.sulfur', [/only SO₂/, /hanya SO₂/]);
  must('ctl.fuelComposition', [/does not change NOx or CO/, /tidak mengubah NOx atau CO/]);
  // penalti bahan bakar: skenario ilustrasi, bukan efek alat tertentu
  for (const id of ['ctl.fuelPenalty', 'hud.fuelPenalty']) must(id, [/illustrative scenario/, /skenario ilustrasi/], [/not the effect of a specific device/, /bukan efek alat tertentu/]);
  // beban bukan tuas terpisah di Scene 9
  must('ctl.load', [/Scene 9 load is not a separate lever/, /Scene 9 beban bukan tuas yang terpisah/]);
  must('ui.s9tabs', [/Load is not a separate lever/, /Beban bukan tuas terpisah/]);
  // asumsi dan tingkat model
  must('ui.assumptions', [/assumptions/i, /asumsi/i]);
  must('ui.basisCard', [/level/i, /tingkat/i], [/assumptions/i, /asumsi/i]);
});

describe('komponen: kabel, aksesibilitas, Present, PNG, tombol cepat', () => {
  const btn = read('src/ui/helpButton.js'), pop = read('src/ui/helpPopover.js'), css = read('src/styles.css');
  it('tombol: data-snap-skip, aria-expanded, Spasi/Enter tidak sampai ke tombol cepat; tidak ada tombol cepat baru', () => {
    expect(btn).toMatch(/dataset\.snapSkip = ''/);
    expect(btn).toMatch(/aria-expanded/);
    expect(btn).toMatch(/e\.key === ' ' \|\| e\.key === 'Enter'\) e\.stopPropagation/);
    expect(GLOBAL_KEYS).toEqual(['f', 'r', '1', '2', '3', '4', 'h', '?', 'g', 'm', 'p', 's', 'q', 'b', 'k']);
    expect(btn + pop).not.toMatch(/addEventListener\('keydown'[^]*key === '[a-z?]'\)/);
  });
  it('kartu: role dialog, aria-labelledby ke kalimat what, aria-controls/aria-describedby, data-snap-skip, Esc di fase capture, klik luar', () => {
    expect(pop).toMatch(/setAttribute\('role', 'dialog'\)/);
    expect(pop).toMatch(/aria-labelledby/);
    expect(pop).toMatch(/aria-controls/);
    expect(pop).toMatch(/aria-describedby/);
    expect(pop).toMatch(/dataset\.snapSkip = ''/);
    expect(pop).toMatch(/addEventListener|\[f\]\('keydown', onKey, true\)/);
    expect(pop).toMatch(/\[f\]\('keydown', onKey, true\)/);
    expect(pop).toMatch(/pointerdown/);
    expect(pop).toMatch(/stopImmediatePropagation/);
    expect(pop).not.toMatch(/h3|<h2/); // kartu tanpa judul
  });
  it('hanya satu kartu: membuka kartu lain menutup yang pertama; kartu ditutup saat pindah scene / halaman / Present', () => {
    expect(pop).toMatch(/if \(isOpen\(\)\) closeHelp\(false\)/);
    const main = read('src/main.js');
    expect((main.match(/closeHelp\(false\)/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(main).toMatch(/closeHelp\(false\); \/\/ kartu bantuan milik scene lama/);
  });
  it('CSS: tampilan 18 px, area klik 24×24 px, hilang di Present, token tema saja', () => {
    expect(css).toMatch(/\.help-btn \{[^}]*width: 24px; height: 24px/);
    expect(css).toMatch(/\.help-btn__dot \{[^}]*width: 18px; height: 18px/);
    expect(css).toMatch(/body\.mode-present \.help-btn \{ display: none; \}/);
    const block = css.slice(css.indexOf('Bagian C: bantuan'));
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });
  it('pabrik hud / slider / segmented / button menerima opsi help; kartu memuat tautan Glossary dan Lesson', () => {
    expect(read('src/ui/hud.js')).toMatch(/it\.help/);
    const c = read('src/ui/controls.js');
    expect((c.match(/o\.help/g) ?? []).length).toBeGreaterThanOrEqual(6);
    expect(pop).toMatch(/G\.glossary/);
    expect(pop).toMatch(/G\.lesson/);
    expect(pop).toMatch(/setSceneOrigin/);
  });
  it('bahasa: label dua bahasa lengkap', () => {
    for (const [k, v] of Object.entries(STR.bi.help)) {
      expect(typeof v.en, k).toBe(typeof v.id);
    }
    expect(STR.bi.help.backToScene.en).toBe('← Back to the scene');
    expect(STR.bi.help.draft.en).toBe('Draft');
  });
});

describe('asal klik "Read more → Lesson" (state/backToScene.js)', () => {
  it('Back to the scene hanya untuk pelajaran yang dibuka dari kartu, alamat scene saja', () => {
    clearSceneOrigin();
    expect(backToSceneHash('l4-3')).toBeNull();
    setSceneOrigin('#/scene/6', 'l3-4');
    expect(backToSceneHash('l3-4')).toBe('#/scene/6');
    expect(backToSceneHash('l1-1')).toBeNull();
    setSceneOrigin('#/scene/9/levers', 'l4-3');
    expect(backToSceneHash('l4-3')).toBe('#/scene/9/levers');
    setSceneOrigin('#/learn/l1-1', 'l1-1'); // bukan alamat scene → tidak diingat
    expect(sceneOrigin()).toBeNull();
    clearSceneOrigin();
  });
  it('halaman pelajaran menampilkan tombol bila ada backHash; learnHost membersihkan asal saat halaman lain dibuka', () => {
    expect(read('src/ui/lessonPage.js')).toMatch(/o\.backHash/);
    const host = read('src/ui/learnHost.js');
    expect(host).toMatch(/clearSceneOrigin\(\)/);
    expect(host).toMatch(/backHash: backToSceneHash\(viewId\)/);
  });
});
