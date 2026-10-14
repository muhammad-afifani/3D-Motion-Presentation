// Mode presenter (M8a): sinkronisasi BroadcastChannel (tiruan), timer, presenter.json (loader & isi bawaan).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { openChannel, createMainLink, createPresenterLink, CHANNEL_NAME } from '../src/state/presenterSync.js';
import { createTimer, timerView } from '../src/state/presenterTimer.js';
import { validatePresenter, loadContent, fallbackContent, presenterNotes, CONTENT_FILES } from '../src/state/content.js';
import { SCENE_LIST, SCENE_NUMBERS, nextSceneNumber } from '../src/state/scenes.js';
import { nextPreviewHtml } from '../src/ui/presenterView.js';
import { contentErrorText } from '../src/ui/contentBanner.js';
import { clock } from '../src/ui/format.js';
import { STR } from '../src/ui/strings.js';

const ROOT = new URL('..', import.meta.url).pathname;
const raw = readFileSync(`${ROOT}content/presenter.json`, 'utf8');
const presenter = JSON.parse(raw);

/** BroadcastChannel tiruan: pesan dikirim (salinan) ke instance lain dengan nama sama, tidak ke pengirim. */
class MockChannel {
  static bus = new Map();
  constructor(name) { this.name = name; this.ls = new Set(); this.closed = false; (MockChannel.bus.get(name) ?? MockChannel.bus.set(name, new Set()).get(name)).add(this); }
  postMessage(m) {
    if (this.closed) throw new Error('InvalidStateError');
    for (const c of MockChannel.bus.get(this.name)) if (c !== this && !c.closed) queueMicrotask(() => c.ls.forEach((fn) => fn({ data: structuredClone(m) })));
  }
  addEventListener(t, fn) { if (t === 'message') this.ls.add(fn); }
  removeEventListener(t, fn) { this.ls.delete(fn); }
  close() { this.closed = true; MockChannel.bus.get(this.name).delete(this); }
}
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('sinkronisasi BroadcastChannel (tiruan)', () => {
  function setup() {
    MockChannel.bus.clear();
    const st = { scene: 1, total: 11, playing: true, frozen: false };
    const navs = [], gotos = [], conn = [];
    const main = createMainLink(openChannel(CHANNEL_NAME, MockChannel), {
      getState: () => ({ ...st }), onNav: (d) => { navs.push(d); st.scene += d; main.post(); }, onGoto: (n) => { gotos.push(n); st.scene = n; main.post(); }, onPresenter: (c) => conn.push(c),
    });
    return { st, navs, gotos, conn, main };
  }
  it('presenter mengirim hello saat dibuka → menerima state awal', async () => {
    const { conn } = setup();
    const got = [];
    createPresenterLink(openChannel(CHANNEL_NAME, MockChannel), { onState: (m) => got.push(m) });
    await flush(); await flush();
    expect(got).toEqual([{ type: 'state', scene: 1, total: 11, playing: true, frozen: false }]);
    expect(conn).toEqual([true]);
  });
  it('Next/Prev dan goto dari presenter memindah scene utama; state baru dikirim balik', async () => {
    const { navs, gotos } = setup();
    const got = [];
    const p = createPresenterLink(openChannel(CHANNEL_NAME, MockChannel), { onState: (m) => got.push(m.scene) });
    await flush(); await flush();
    p.nav(1); await flush(); await flush();
    p.nav(-5); await flush(); await flush();      // dir dinormalisasi ke −1
    p.goto(6); await flush(); await flush();
    expect(navs).toEqual([1, -1]);
    expect(gotos).toEqual([6]);
    expect(got).toEqual([1, 2, 1, 6]);
  });
  it('perubahan scene di jendela utama (post) sampai ke semua jendela presenter', async () => {
    const { st, main } = setup();
    const a = [], b = [];
    createPresenterLink(openChannel(CHANNEL_NAME, MockChannel), { onState: (m) => a.push(m.scene) });
    createPresenterLink(openChannel(CHANNEL_NAME, MockChannel), { onState: (m) => b.push(m.scene) });
    await flush(); await flush();
    st.scene = 4; st.playing = false; main.post(); await flush();
    expect(a.at(-1)).toBe(4);
    expect(b.at(-1)).toBe(4);
  });
  it('pesan asing / rusak diabaikan; bye melapor presenter tertutup', async () => {
    const { navs, gotos, conn } = setup();
    const raw = openChannel(CHANNEL_NAME, MockChannel);
    for (const m of [null, 'teks', { type: 'nav', dir: 3 }, { type: 'goto', n: 'x' }, { foo: 1 }]) raw.postMessage(m);
    await flush();
    expect(navs).toEqual([]);
    expect(gotos).toEqual([]);
    const p = createPresenterLink(openChannel(CHANNEL_NAME, MockChannel), { onState: () => {} });
    await flush(); await flush();
    p.dispose(); await flush();
    expect(conn).toEqual([true, false]);
  });
  it('openChannel: null bila BroadcastChannel tidak ada atau melempar (→ panel di halaman)', () => {
    expect(openChannel(CHANNEL_NAME, null)).toBeNull();
    expect(openChannel(CHANNEL_NAME, class { constructor() { throw new Error('x'); } })).toBeNull();
  });
});

describe('timer presenter', () => {
  it('start/pause/reset; waktu scene mulai nol saat scene berganti', () => {
    let t = 0;
    const tm = createTimer(() => t);
    tm.markScene(1);
    tm.start(); t = 60000;
    tm.markScene(2); t = 90000;
    expect(tm.total()).toBe(90000);
    expect(tm.sceneElapsed()).toBe(30000);
    tm.pause(); t = 200000;
    expect(tm.total()).toBe(90000);
    tm.toggle(); t = 210000;
    expect(tm.total()).toBe(100000);
    tm.reset();
    expect([tm.total(), tm.sceneElapsed(), tm.running]).toEqual([0, 0, true]);
  });
  it('target per scene opsional: lewat target ditandai', () => {
    let t = 0;
    const tm = createTimer(() => t);
    tm.markScene(3); tm.start(); t = 5 * 60000;
    expect(timerView(tm, 4)).toMatchObject({ over: true, targetMs: 240000, remaining: -60000 });
    expect(timerView(tm, undefined)).toMatchObject({ over: false, targetMs: null, remaining: null });
  });
  it('format jam', () => {
    expect(clock(75000)).toBe('01:15');
    expect(clock(3723000)).toBe('1:02:03');
    expect(clock(-5)).toBe('00:00');
  });
});

describe('content/presenter.json bawaan', () => {
  const texts = (o) => (typeof o === 'string' ? [o] : Array.isArray(o) ? o.flatMap(texts) : o && typeof o === 'object' ? Object.values(o).flatMap(texts) : []);
  const NUM_UNIT = /\d+(?:[.,]\d+)?\s*(?:ppm|g\/kWh|mg\/Nm³|mg\/Nm3|K\b|bar\b|%|°C|MW\b|kW\b|kJ)/i;
  it('valid; satu entri per scene aplikasi (1–11)', () => {
    expect(validatePresenter(presenter, [...SCENE_NUMBERS])).toEqual([]);
    expect(presenter.scenes.map((s) => s.number)).toEqual([...SCENE_NUMBERS]);
    expect(CONTENT_FILES.presenter).toBe('presenter.json');
    expect(fallbackContent('presenter')).toEqual(presenter);
  });
  it('tidak ada pola angka bersatuan (ppm, g/kWh, mg/Nm³, K, bar, %, °C, MW, kW, kJ) dan tanpa digit di teks', () => {
    expect(texts(presenter).filter((t) => NUM_UNIT.test(t))).toEqual([]);
    expect(texts(presenter).filter((t) => /\d/.test(t))).toEqual([]);   // tanpa angka model sama sekali
  });
  it('nama mesin/perangkat netral: tanpa vendor, merek, atau tipe', () => {
    const VENDOR = /\b(siemens|solar|taurus|titan|mars|centaur|saturn|caterpillar|cat\b|wartsila|wärtsilä|cummins|man\b|ge\b|general electric|baker|nuovo|rolls|mitsubishi|kawasaki|waukesha|jenbacher|mtu|ariel|dresser)/i;
    expect(texts(presenter).filter((t) => VENDOR.test(t))).toEqual([]);
  });
  it('Scene 0 digabung ke catatan Scene 1 dengan awalan "Pembuka"', () => {
    const s1 = presenterNotes(presenter, 1);
    expect(s1.notes.filter((t) => t.startsWith('Pembuka')).length).toBeGreaterThanOrEqual(1);
    expect(s1.notes[0].startsWith('Pembuka')).toBe(true);
  });
});

describe('loader presenter.json (sama dengan konten lain)', () => {
  const res = (body, { ok = true, type = 'application/json' } = {}) => async () => ({ ok, headers: { get: () => type }, text: async () => body });
  it('file valid → source file', async () => {
    const r = await loadContent('presenter', { fetchFn: res(raw), base: '/x/' });
    expect([r.source, r.errors]).toEqual(['file', []]);
  });
  it('JSON rusak → isi bawaan + galat dengan nama file', async () => {
    const r = await loadContent('presenter', { fetchFn: res('{rusak'), base: '/x/' });
    expect(r.source).toBe('fallback');
    expect(r.data).toEqual(presenter);
    expect(contentErrorText(r)).toMatch(/content\/presenter\.json tidak valid: \(json\)/);
  });
  it('skema salah → galat menyebut bidang', async () => {
    const bad = { version: 1, scenes: [{ number: 1, keyMessage: 'a', notes: ['b'], targetMin: -2 }, { number: 1, keyMessage: '', notes: [] }, { number: 42, keyMessage: 'c', notes: ['d'] }] };
    const r = await loadContent('presenter', { fetchFn: res(JSON.stringify(bad)), base: '/x/' });
    const fields = r.errors.map((e) => e.field);
    expect(fields).toEqual(['scenes[0].targetMin', 'scenes[1].number', 'scenes[1].keyMessage', 'scenes[1].notes', 'scenes[2].number']);
    expect(contentErrorText(r)).toMatch(/scenes\[0\]\.targetMin \(harus angka menit/);
  });
  it('404, tanpa server, atau fallback SPA (HTML) → isi bawaan TANPA galat', async () => {
    for (const fetchFn of [res('', { ok: false }), async () => { throw new TypeError('Failed to fetch'); }, res('<!doctype html><html>', { type: 'text/html' })]) {
      const r = await loadContent('presenter', { fetchFn, base: './' });
      expect([r.source, r.errors]).toEqual(['fallback', []]);
    }
  });
});

describe('pratinjau scene berikutnya (teks) & registry', () => {
  it('registry: 11 scene berurutan; nextSceneNumber', () => {
    expect(SCENE_LIST.map((x) => x.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(nextSceneNumber(6)).toBe(7);
    expect(nextSceneNumber(11)).toBeNull();
  });
  it('berisi nomor, judul, pesan kunci, dan catatan pertama; scene terakhir → pesan akhir', () => {
    const h = nextPreviewHtml(presenter, 5);
    expect(h).toContain(STR.presenter.nextLine(6, STR.scene6.title));
    expect(h).toContain(presenterNotes(presenter, 6).keyMessage);
    expect(h).toContain(presenterNotes(presenter, 6).notes[0]);
    expect(nextPreviewHtml(presenter, 11)).toContain(STR.presenter.end);
  });
  it('main.js memakai registry yang sama dengan jendela presenter', () => {
    const m = readFileSync(`${ROOT}src/main.js`, 'utf8');
    expect(m).toMatch(/SCENE_LIST\.map/);
    expect(m).toMatch(/presenter\.html/);
  });
});
