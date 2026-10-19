// Settings ⚙ + "Hide working notes": nilai efektif, penyimpanan tahan galat, daftar putih catatan kerja (data-note),
// dan label kejujuran model yang TIDAK BOLEH ikut tersembunyi. Tampilan nyata diuji di smoke e2e.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { NOTES_KEY, readNotesChoice, writeNotesChoice, effectiveHide, createNotesStore } from '../src/state/notes.js';
import { STR } from '../src/ui/strings.js';
import { GLOBAL_KEYS } from '../src/ui/keys.js';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(`${ROOT}${p}`, 'utf8');
const css = read('src/styles.css');

function files(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) files(p, out); else if (f.endsWith('.js')) out.push(p);
  }
  return out;
}
const SRC = [...files(`${ROOT}src`)].filter((f) => !f.endsWith('strings.js'));

/** Storage palsu. */
const fake = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; };

describe('state/notes.js', () => {
  it('kunci etel:hideNotes; nilai efektif: tersimpan menang, tanpa pilihan hanya Present menyembunyikan', () => {
    expect(NOTES_KEY).toBe('etel:hideNotes');
    expect(effectiveHide(null, 'explore')).toBe(false);
    expect(effectiveHide(null, 'present')).toBe(true);
    expect(effectiveHide('show', 'present')).toBe(false);
    expect(effectiveHide('hide', 'explore')).toBe(true);
  });
  it('baca/tulis lewat try/catch: nilai asing diabaikan; storage yang melempar tidak merusak', () => {
    expect(readNotesChoice(fake({ [NOTES_KEY]: 'hide' }))).toBe('hide');
    expect(readNotesChoice(fake({ [NOTES_KEY]: 'banana' }))).toBeNull();
    expect(readNotesChoice(null)).toBeNull();
    const bad = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
    expect(readNotesChoice(bad)).toBeNull();
    expect(writeNotesChoice(bad, 'hide')).toBe(false);
    expect(writeNotesChoice(bad, null)).toBe(false);
    expect(writeNotesChoice(fake(), 'nope')).toBe(false);
    const s = fake();
    expect(writeNotesChoice(s, 'show')).toBe(true);
    expect(s._m.get(NOTES_KEY)).toBe('show');
    expect(writeNotesChoice(s, null)).toBe(true);
    expect(s._m.has(NOTES_KEY)).toBe(false);
  });
  it('store: pilihan diingat, pelanggan diberi tahu, "use the default" menghapus', () => {
    const s = fake();
    const st = createNotesStore(s);
    const seen = [];
    st.subscribe((c) => seen.push(c));
    expect(st.hide('explore')).toBe(false);
    expect(st.hide('present')).toBe(true);
    st.set('hide');
    expect(st.hide('explore')).toBe(true);
    expect(s._m.get(NOTES_KEY)).toBe('hide');
    st.set('hide'); // tanpa perubahan: tidak memberi tahu lagi
    st.set(null);
    expect(seen).toEqual(['hide', null]);
    expect(createNotesStore(fake({ [NOTES_KEY]: 'show' })).hide('present')).toBe(false); // diingat setelah muat ulang
  });
});

describe('catatan kerja: hanya yang ada di daftar putih bertanda data-note', () => {
  const marks = SRC.filter((f) => !f.endsWith('state/notes.js')).flatMap((f) => read(f.replace(ROOT, '')).split('\n').map((l, i) => ({ file: f.replace(`${ROOT}src/`, ''), line: l, i }))).filter((x) => /markNote\(/.test(x.line) && !/export function markNote|import \{ markNote|\* Tandai/.test(x.line));
  // [berkas, potongan teks pada baris penanda] — catatan kerja yang disepakati
  const ALLOWED = [
    ['ui/learnPage.js', 'learn-page__draft'], ['ui/lessonPage.js', 'learn-page__draft'], ['ui/chartGuidePage.js', 'learn-page__draft'],
    ['ui/helpPopover.js', 'help-card__draft'],
    ['ui/readingParts.js', 'L.toVerify'],
    ['ui/referencesPage.js', 'R.banner(unchecked'], ['ui/referencesPage.js', 'R.unchecked'],
    ['ui/basisCard.js', 'K.locatorUnchecked'], ['ui/basisCard.js', 'K.note'],
    ['ui/glossaryPage.js', 'G.fromLearn'],
    ['ui/formationTab.js', 'F.introNote'],
  ];
  it('setiap penanda berada di daftar putih; setiap entri daftar putih terpasang', () => {
    const unknown = marks.filter((m) => !ALLOWED.some(([f, t]) => m.file === f && m.line.includes(t))).map((m) => `${m.file}:${m.i + 1} ${m.line.trim().slice(0, 90)}`);
    expect(unknown).toEqual([]);
    const missing = ALLOWED.filter(([f, t]) => !marks.some((m) => m.file === f && m.line.includes(t))).map(([f, t]) => `${f} ${t}`);
    expect(missing).toEqual([]);
  });
  it('tidak ada data-note / dataset.note tertulis langsung di luar markNote (satu pintu)', () => {
    const raw = SRC.filter((f) => !f.endsWith('state/notes.js')).filter((f) => /data-note|dataset\.note|setAttribute\('data-note'/.test(readFileSync(f, 'utf8')));
    expect(raw.map((f) => f.replace(ROOT, ''))).toEqual([]);
  });
  it('hanya satu aturan penyembunyi: body.hide-notes [data-note]; tidak ada display:none global pada label kejujuran', () => {
    expect((css.match(/hide-notes \[data-note\]/g) ?? []).length).toBe(1);
    expect((css.match(/^body\.hide-notes/gm) ?? []).length).toBe(1);
    expect(css).toMatch(/body\.hide-notes \[data-note\] \{ display: none !important; \}/);
    expect(css).not.toMatch(/hide-notes[^{]*\.(chart__level|hud__sub|reg__banner|level|bcard__chip(?!--warn))/);
  });
  it('teks catatan: banner draf, Draft, to verify, locator not verified, from Learn ada di strings', () => {
    expect(STR.bi.help.draft.en).toBe('Draft');
    expect(STR.bi.lesson.toVerify.en).toBe('to verify');
    expect(STR.basis.card.locatorUnchecked).toBe('locator not verified');
    expect(STR.bi.glossary.fromLearn.en).toBe('from Learn');
    expect(STR.scene9.formationTab.introNote).toMatch(/^Draft/);
    expect(STR.scene9.formationTab.intro).not.toMatch(/draft/i); // sisipan draf sudah dipisah
  });
});

describe('label kejujuran model TIDAK bisa disembunyikan', () => {
  const src = (p) => read(p);
  // Setiap baris yang merender label ini tidak boleh memanggil markNote (satu pintu penyembunyi)
  const HONESTY = [
    ['charts/chartBase.js', /levelText|chart__level/],
    ['ui/hud.js', /STR\.basis\.tag|hud__sub|hud__note/],
    ['ui/regHeader.js', /R\.banner/],
    ['ui/regulationsPage.js', /R\.banner|P\.unverified|P\.verified/],
    ['ui/limitsTab.js', /R\.statusTip|R\.title|margin/i],
    ['ui/basisCard.js', /K\.toVerify|K\.knownIssue|K\.level|K\.derivation|K\.assumptions/],
    ['ui/assumptions.js', /A\.issues|A\.basis/],
    ['scenes/partload.js', /C\.basis|regLine|STR\.basis/],
    ['scenes/nox.js', /C\.basis|basis/],
  ];
  it('baris yang merender indicative, tag Basis, basis O₂ / volume, banner "Transcribed…", chip "not verified" regulasi, Known deviations tidak memakai markNote', () => {
    const bad = [];
    for (const [f, re] of HONESTY) {
      src(`src/${f}`).split('\n').forEach((l, i) => { if (re.test(l) && /markNote\(/.test(l) && !/^import|^\s*\*|\/\//.test(l.trim())) bad.push(`${f}:${i + 1}`); });
    }
    expect(bad).toEqual([]);
  });
  it('teks kejujuran ada di strings dan tidak sama dengan teks catatan kerja', () => {
    expect(STR.regulation.banner).toMatch(/^Transcribed from the published tables/);
    expect(STR.common.indicative).toBe('indicative');
    expect(STR.basis.tag).toBe('Basis');
    const notes = [STR.bi.help.draft.en, STR.bi.lesson.toVerify.en, STR.basis.card.locatorUnchecked, STR.bi.glossary.fromLearn.en, STR.scene9.formationTab.introNote];
    for (const n of notes) {
      expect(n).not.toMatch(/indicative|Transcribed from the published tables|O₂|volume basis/i);
      expect(n).not.toBe(STR.regulation.banner);
    }
    expect(STR.basis.card.toVerify).toBe('Source to verify'); // tetap tampil (bukan catatan kerja)
    expect(STR.basis.card.locatorChecked).toBe('locator checked'); // tetap tampil
  });
  it('banner regulasi dan chip regulasi tidak diberi penanda di sumber (hanya banner galat konten / draf yang boleh)', () => {
    for (const f of ['ui/regulationsPage.js', 'ui/regHeader.js', 'ui/limitsTab.js', 'ui/chartGuideButton.js', 'charts/chartBase.js', 'ui/hud.js']) {
      expect(src(`src/${f}`), f).not.toMatch(/markNote|data-note/);
    }
  });
  it('penyembunyi hanya membaca atribut data-note (tidak menyentuh class label kejujuran)', () => {
    const main = read('src/main.js');
    expect(main).toMatch(/classList\.toggle\('hide-notes', notesStore\.hide\(mode\)\)/);
    expect(read('src/state/notes.js')).toMatch(/dataset\.note = ''/);
  });
});

describe('panel Settings', () => {
  const panel = read('src/ui/settingsPanel.js');
  it('popover non-modal: Esc di fase capture, klik luar, aria, data-snap-skip, menutup kartu bantuan', () => {
    expect(panel).toMatch(/setAttribute\('role', 'dialog'\)/);
    expect(panel).not.toMatch(/aria-modal/);
    expect(panel).toMatch(/aria-expanded/);
    expect(panel).toMatch(/aria-controls/);
    expect(panel).toMatch(/aria-labelledby/);
    expect(panel).toMatch(/window\.addEventListener\('keydown', onKey, true\)/);
    expect(panel).toMatch(/pointerdown/);
    expect(panel).toMatch(/stopImmediatePropagation/);
    expect(panel).toMatch(/dataset\.snapSkip = ''/);
    expect(panel).toMatch(/closeHelp\(false\)/);
  });
  it('seksi disusun dari daftar SECTIONS (siap ditambah satuan); sakelar bahasa dan tema tidak ada di panel', () => {
    expect(panel).toMatch(/export const SECTIONS = \[/);
    expect(panel).toMatch(/id: 'display'/);
    expect(panel).not.toMatch(/langStore\.set|writeTheme|applyTheme/);
  });
  it('tersembunyi di Present (CSS dan ditutup main.js), tanpa tombol cepat baru, hanya token tema', () => {
    expect(css).toMatch(/body\.mode-present \.settings-btn, body\.mode-present \.settings-card \{ display: none; \}/);
    expect(read('src/main.js')).toMatch(/settings\.close\(\); \/\/ ⚙ juga tersembunyi di Present/);
    expect(GLOBAL_KEYS).toEqual(['f', 'r', '1', '2', '3', '4', 'h', '?', 'g', 'm', 'p', 's', 'q', 'b', 'k']);
    expect(panel).not.toMatch(/e\.key === '[a-z?,]'/);
    const block = css.slice(css.indexOf('Settings ⚙ dan'));
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });
  it('teks dua bahasa lengkap; teks panel menyebut tombol M untuk kembali ke Explore; label kejujuran tetap disebut', () => {
    for (const [k, v] of Object.entries(STR.bi.settings)) { expect(typeof v.en, k).toBe('string'); expect(v.id.length, k).toBeGreaterThan(0); }
    expect(STR.bi.settings.hideNotes.en).toBe('Hide working notes');
    expect(STR.bi.settings.presentHint.en).toMatch(/key M/);
    expect(STR.bi.settings.presentHint.id).toMatch(/tombol M/);
    expect(STR.bi.settings.hideNotesDesc.en).toMatch(/indicative/);
    expect(STR.bi.settings.hideNotesDesc.en).toMatch(/O₂ and volume basis/);
    expect(STR.bi.settings.hideNotesDesc.id).toMatch(/basis O₂ dan volume/);
  });
});
