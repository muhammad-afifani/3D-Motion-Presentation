// M11 Step 02: progres Learn (etel:learnDone), data tampilan, kata pelajaran dan Glossary dua bahasa, pil "Back to lesson",
// state bahasa global (etel:lang), dan kabel main.js (halaman di atas pelajaran, Present, panah). DOM diuji di smoke e2e.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { LEARN_DONE_KEY, readDone, writeDone, createLearnProgress } from '../src/state/learnProgress.js';
import { lessonEntries, findLesson, levelStats, learnStats, firstUndone, lessonWords, glossaryText, basicWords, backPillVisible, backTarget } from '../src/state/learnView.js';
import { glossaryTerms } from '../src/state/glossaryView.js';
import { createLangStore } from '../src/state/langStore.js';
import { LANG_KEY, tr } from '../src/state/lang.js';
import { parseHash } from '../src/state/route.js';
import { STR } from '../src/ui/strings.js';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(`${ROOT}${p}`, 'utf8');
const readJson = (p) => JSON.parse(read(p));
const learn = readJson('content/learn.json');
const glossary = readJson('content/glossary.json');
const refs = readJson('content/references.json');
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), raw: m }; };
const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };

describe('progres Learn: etel:learnDone', () => {
  it('tandai, muat ulang (instance baru), batalkan, reset', () => {
    const st = mem();
    const a = createLearnProgress(st);
    expect(a.ids).toEqual([]);
    a.mark('l0-1', true); a.mark('l3-4', true); a.mark('l3-4', true);
    expect(JSON.parse(st.getItem(LEARN_DONE_KEY))).toEqual(['l0-1', 'l3-4']);
    const b = createLearnProgress(st); // "muat ulang"
    expect(b.has('l0-1')).toBe(true); expect(b.has('l3-4')).toBe(true); expect(b.has('l1-1')).toBe(false);
    b.mark('l0-1', false);
    expect(createLearnProgress(st).ids).toEqual(['l3-4']);
    let n = 0; b.subscribe(() => n++);
    b.reset();
    expect(n).toBe(1); expect(b.ids).toEqual([]); expect(st.getItem(LEARN_DONE_KEY)).toBeNull();
    expect(createLearnProgress(st).ids).toEqual([]);
  });
  it('storage kosong, rusak, atau melempar → semua belum selesai, tanpa galat; tanda tetap berlaku di sesi', () => {
    expect(createLearnProgress(null).ids).toEqual([]);
    const bad = mem(); bad.setItem(LEARN_DONE_KEY, '{rusak');
    expect(readDone(bad)).toEqual([]);
    bad.setItem(LEARN_DONE_KEY, JSON.stringify({ a: 1 })); expect(readDone(bad)).toEqual([]);
    bad.setItem(LEARN_DONE_KEY, JSON.stringify(['l0-1', 5, null, '', 'l0-1', 'x'.repeat(80)])); expect(readDone(bad)).toEqual(['l0-1']);
    const t = createLearnProgress(throwing);
    expect(t.ids).toEqual([]);
    expect(() => t.mark('l0-1', true)).not.toThrow();
    expect(t.has('l0-1')).toBe(true);
    expect(() => t.reset()).not.toThrow();
    expect(writeDone(throwing, ['a'])).toBe(false);
  });
  it('hanya id pelajaran yang dikenal yang dihitung', () => {
    const p = createLearnProgress(mem());
    p.mark('l0-1', true); p.mark('bukan-pelajaran', true);
    expect(p.count(lessonEntries(learn).map((e) => e.lesson.id))).toBe(1);
    expect(learnStats(learn, (id) => p.has(id)).done).toBe(1);
  });
});

describe('data tampilan Learn', () => {
  it('21 pelajaran berurutan; sebelumnya/berikutnya melintasi level; id tak dikenal → null', () => {
    const all = lessonEntries(learn);
    expect(all).toHaveLength(21);
    const f = findLesson(learn, 'l0-2');
    expect(f.prev.lesson.id).toBe('l0-1'); expect(f.next.lesson.id).toBe('l1-1'); expect(f.next.levelIndex).toBe(1);
    expect(findLesson(learn, 'l0-1').prev).toBeNull();
    expect(findLesson(learn, all.at(-1).lesson.id).next).toBeNull();
    expect(findLesson(learn, 'tidak-ada')).toBeNull();
  });
  it('statistik level dan pelajaran pertama yang belum selesai dihitung dari data', () => {
    const done = new Set(['l0-1', 'l0-2', 'l1-1']);
    const isDone = (id) => done.has(id);
    expect(levelStats(learn.levels[0], isDone)).toEqual({ lessons: 2, minutes: learn.levels[0].lessons.reduce((a, l) => a + l.minutes, 0), done: 2 });
    expect(firstUndone(learn, isDone).lesson.id).toBe('l1-2');
    expect(firstUndone(learn, () => true)).toBeNull();
    expect(learnStats(learn, () => false)).toEqual({ lessons: 21, minutes: 271, done: 0 });
  });
});

describe('kata pelajaran dan Glossary dua bahasa', () => {
  it('setiap id di glossary.json punya definisi ID (gagal bila ada yang hilang)', () => {
    const missing = glossary.terms.filter((t) => !learn.glossaryId?.[t.id]?.definition?.trim()).map((t) => t.id);
    expect(missing).toEqual([]);
  });
  it('glossaryText: EN = glossary.json; ID = glossaryId (nama bila ada, selain itu nama asli)', () => {
    const g = glossary.terms.find((t) => learn.glossaryId[t.id].term);
    const g2 = glossary.terms.find((t) => !learn.glossaryId[t.id].term);
    expect(glossaryText(learn, g, 'en')).toEqual({ term: g.term, definition: g.definition });
    expect(glossaryText(learn, g, 'id')).toEqual({ term: learn.glossaryId[g.id].term, definition: learn.glossaryId[g.id].definition });
    expect(glossaryText(learn, g2, 'id').term).toBe(g2.term);
    expect(glossaryText(null, g, 'id')).toEqual({ term: g.term, definition: g.definition }); // learn.json gagal dimuat → English
  });
  it('glossaryTerms: bahasa ID memakai definisi ID, EN tidak berubah, jumlah sama, urut abjad menurut bahasa', () => {
    const en = glossaryTerms(glossary, refs, '', { learn, lang: 'en' });
    const id = glossaryTerms(glossary, refs, '', { learn, lang: 'id' });
    expect(id).toHaveLength(en.length);
    expect(glossaryTerms(glossary, refs, '')).toEqual(en); // tanpa opsi = perilaku lama
    for (const t of id) expect(t.definition).toBe(learn.glossaryId[t.id].definition);
    const names = id.map((t) => t.term);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'id', { sensitivity: 'base' })));
    expect(glossaryTerms(glossary, refs, 'zzzz-tidak-ada', { learn, lang: 'id' })).toEqual([]);
  });
  it('kotak kata pelajaran: learn.terms dua bahasa, glossary.json English / definisi ID; id asing → known:false', () => {
    const lesson = lessonEntries(learn).find((e) => e.lesson.terms.some((id) => learn.terms.some((t) => t.id === id)) && e.lesson.terms.some((id) => glossary.terms.some((t) => t.id === id))).lesson;
    for (const lang of ['en', 'id']) {
      const words = lessonWords(learn, glossary, lesson, lang);
      expect(words).toHaveLength(lesson.terms.length);
      for (const w of words) { expect(w.known, w.id).toBe(true); expect(w.term.length).toBeGreaterThan(0); expect(w.definition.length).toBeGreaterThan(0); }
      const own = words.find((w) => w.from === 'learn'), t = learn.terms.find((x) => x.id === own.id);
      expect(own.term).toBe(t.term[lang]); expect(own.definition).toBe(t.definition[lang]);
      const gw = words.find((w) => w.from === 'glossary');
      expect(gw.definition).toBe(lang === 'id' ? learn.glossaryId[gw.id].definition : glossary.terms.find((x) => x.id === gw.id).definition);
    }
    expect(lessonWords(learn, glossary, { terms: ['nope'] }, 'en')[0]).toMatchObject({ id: 'nope', known: false });
    // setiap pelajaran: semua kata ditemukan
    for (const e of lessonEntries(learn)) expect(lessonWords(learn, glossary, e.lesson, 'id').filter((w) => !w.known)).toEqual([]);
  });
  it('Basic words (learn.terms): dua bahasa, tersaring, sumber dicocokkan ke references.json', () => {
    const en = basicWords(learn, refs, 'en'), id = basicWords(learn, refs, 'id');
    expect(en).toHaveLength(learn.terms.length); expect(id).toHaveLength(learn.terms.length);
    expect(id.every((w) => w.refs.every((r) => r.known))).toBe(true);
    const one = en[0];
    expect(basicWords(learn, refs, 'en', one.term.slice(0, 4)).some((w) => w.id === one.id)).toBe(true);
    expect(basicWords(learn, refs, 'en', 'zzzz-tidak-ada')).toEqual([]);
    expect(basicWords(null, refs, 'en')).toEqual([]);
  });
});

describe('pil "← Back to lesson"', () => {
  const state = { lessonId: 'l3-4', n: 6 };
  it('terlihat hanya di Explore, scene tujuan, halaman Learn tertutup', () => {
    expect(backPillVisible(state, { mode: 'explore', learnOpen: false, sceneNumber: 6 })).toBe(true);
    expect(backPillVisible(state, { mode: 'present', learnOpen: false, sceneNumber: 6 })).toBe(false);
    expect(backPillVisible(state, { mode: 'explore', learnOpen: true, sceneNumber: 6 })).toBe(false);
    expect(backPillVisible(state, { mode: 'explore', learnOpen: false, sceneNumber: 7 })).toBe(false);
    expect(backPillVisible(null, { mode: 'explore', learnOpen: false, sceneNumber: 6 })).toBe(false);
  });
  it('target hanya dari rute scene (halaman penuh kembali lewat Close); tab Scene 9 tidak mengubah target', () => {
    expect(backTarget('l3-4', parseHash('#/scene/6'))).toEqual({ lessonId: 'l3-4', n: 6 });
    expect(backTarget('l4-1', parseHash('#/scene/9/levers'))).toEqual({ lessonId: 'l4-1', n: 9 });
    expect(backTarget('l5-1', parseHash('#/regulations'))).toBeNull();
    expect(backTarget('l5-1', null)).toBeNull();
    // semua rute Try it di learn.json terklasifikasi tanpa galat
    for (const e of lessonEntries(learn)) { const r = parseHash(e.lesson.tryIt.route); expect(r, e.lesson.id).not.toBeNull(); const t = backTarget(e.lesson.id, r); expect(t === null || t.n >= 1).toBe(true); }
  });
  it('alur l3-4 → Try it → scene → kembali ke #/learn/l3-4 (rute dan tautan)', () => {
    const lesson = findLesson(learn, 'l3-4').entry.lesson;
    const target = backTarget('l3-4', parseHash(lesson.tryIt.route));
    expect(target).not.toBeNull();
    expect(parseHash(`#/learn/${target.lessonId}`)).toEqual({ type: 'learn', view: 'learn', id: 'l3-4' });
  });
});

describe('state bahasa global (etel:lang)', () => {
  it('kunjungan pertama (D1): English, kecuali bahasa browser diawali "id"; pilihan pengguna diingat dan diutamakan', () => {
    const st = mem();
    const a = createLangStore(st, 'en-US');
    expect(a.lang).toBe('en'); expect(a.stored).toBe(false);
    expect(createLangStore(mem(), 'id-ID').lang).toBe('id');
    expect(createLangStore(mem(), 'id').lang).toBe('id');
    expect(createLangStore(mem(), 'in').lang).toBe('id'); // kode lama
    expect(createLangStore(mem(), 'fr-FR').lang).toBe('en');
    expect(createLangStore(mem(), undefined).lang).toBe('en');
    const seen = []; a.subscribe((l) => seen.push(l));
    expect(a.set('id')).toBe(true);
    expect(seen).toEqual(['id']); expect(st.getItem(LANG_KEY)).toBe('id');
    expect(createLangStore(st, 'en-US').lang).toBe('id'); // muat ulang: pilihan tersimpan menang atas bahasa browser
    st.setItem(LANG_KEY, 'en');
    expect(createLangStore(st, 'id-ID').lang).toBe('en');
    expect(a.set('fr')).toBe(false);
  });
  it('storage melempar: tetap bekerja di sesi; tanpa pilihan → bahasa browser / English', () => {
    const t = createLangStore(throwing, 'en-GB');
    expect(t.lang).toBe('en');
    expect(() => t.set('id')).not.toThrow(); expect(t.lang).toBe('id');
    expect(createLangStore(throwing, 'id-ID').lang).toBe('id');
  });
  it('pemilih tr(): string, fungsi dengan argumen, sisi id kosong → English', () => {
    expect(tr(STR.bi.lesson.markDone, 'en')).toBe('Mark as done');
    expect(tr(STR.bi.lesson.markDone, 'id')).not.toBe('Mark as done');
    expect(tr(STR.bi.learn.progress, 'en', 3, 21)).toBe('3 of 21 done');
    expect(tr(STR.bi.learn.progress, 'id', 3, 21)).toBe('3 dari 21 selesai');
    expect(tr({ en: 'A', id: '' }, 'id')).toBe('A');
  });
});

describe('kabel main.js dan komponen (DOM diuji di smoke)', () => {
  const main = read('src/main.js'), host = read('src/ui/learnHost.js'), list = read('src/ui/learnPage.js'), lesson = read('src/ui/lessonPage.js');
  it('halaman penuh dibuka di atas halaman Learn; Close kembali ke halaman di bawahnya (homeHash); alamat halaman langsung → landing', () => {
    expect(main).toMatch(/const homeHash = \(\) => \(learnHost\.open \? learnHash\(learnHost\.view, learnHost\.viewId\)/);
    expect(main).toMatch(/if \(r\.type === 'page'\) \{ closeOverlays\(r\.page\); return; \}/);
    expect(main).not.toMatch(/if \(learnHost\.open\) learnHost\.close\(\);\s*if \(r\.type === 'page'\)/);
    expect(main).toMatch(/route0\?\.type === 'page' && mode === 'explore'\) \{[^}]*learnHost\.show\('landing'/);
    expect(main).toMatch(/const OVERLAYS = \['regulations', 'formation', 'references', 'glossary', 'assumptions'\]/);
  });
  it('alamat Learn / Chart guide / About di Present pindah ke Explore; tanpa hash di Present tetap Scene 1', () => {
    expect(main).toMatch(/if \(mode === 'present'\) setMode\('explore'\); \/\/ Learn, Chart guide, About = materi Explore/);
    expect(main).toMatch(/route0\.view === 'landing' && mode === 'present'/);
    expect(main).toMatch(/if \(route0\?\.type === 'learn' && !presentLanding\) \{\s*if \(mode === 'present'\) setMode\('explore'\)/);
  });
  it('Try it: rute scene → pil; pil hilang di Present, saat Learn terbuka, dan saat pindah scene', () => {
    expect(main).toMatch(/onTry: \(lessonId, route\) => \{ pendingBack = backTarget\(lessonId, parseHash\(route\)\); \}/);
    expect(main).toMatch(/backPillVisible\(backLesson, \{ mode, learnOpen: learnHost\.open, sceneNumber:/);
    expect(main).toMatch(/exitPresent\.el\.hidden = mode !== 'present';\s*syncBack\(\);/);
    expect(read('src/ui/backLessonPill.js')).toMatch(/el\.dataset\.snapSkip = ''/);
    expect(read('src/ui/backLessonPill.js')).toMatch(/parent\.append\(el\)/);
    expect(main).toMatch(/createBackLessonPill\(document\.querySelector\('\.topbar__left'\)/); // header kiri, di bawah tag scene
  });
  it('Reset progress: konfirmasi di dalam halaman, bukan dialog browser', () => {
    for (const src of [list, lesson, host, main]) expect(src).not.toMatch(/\b(window\.)?(confirm|alert|prompt)\(/);
    expect(list).toMatch(/L\.resetAsk/); expect(list).toMatch(/learn-page__reset-yes/);
    expect(list).toMatch(/b\.disabled = all\.done === 0/);
  });
  it('soal: tanpa skor tersimpan; tidak ada penyimpanan jawaban', () => {
    expect(lesson).not.toMatch(/localStorage|setItem|progress\.mark\([^)]*check/);
    expect(STR.bi.lesson.noScore.en).toMatch(/Nothing is saved/);
  });
  it('Learn tidak punya loop render 3D: halaman Learn melewati mekanisme "halaman terbuka" (loop scene berhenti)', () => {
    expect(main).toMatch(/paused = page != null;\s*if \(!paused\) \{\s*current\?\.update/);
    expect(main).toMatch(/\.\.\.learnHost\.pages \}/);
  });
  it('pilihan bahasa tunggal: tidak ada percabangan lang tersebar di komponen halaman Learn', () => {
    for (const f of ['learnPage', 'lessonPage', 'learnHost', 'chartGuidePage', 'chartGuideButton', 'readingParts', 'glossaryPage', 'backLessonPill', 'aboutPage', 'landingPage']) {
      expect(read(`src/ui/${f}.js`), f).not.toMatch(/\blang\b\s*(===|!==|==|\?)|['"](id|en)['"]\s*===|\[\s*(o\.)?lang\s*\]/);
    }
  });
});
