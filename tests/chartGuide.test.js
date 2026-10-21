// M11 Step 03: Chart guide dan tombol ⓘ. Pencocokan judul → id panduan (satu tempat), cakupan judul grafik di scene,
// kabel tombol di setiap pembuat grafik, asal klik ⓘ, dan label dua bahasa. Tampilan nyata diuji di smoke.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { STR, STR_SOURCE } from '../src/ui/strings.js';
import { isPair } from '../src/state/i18n.js';
import { guideIdForTitle, groupChartsByScene, GUIDE_LEVELS, setChartOrigin, chartOrigin, clearChartOrigin, backToChartHash } from '../src/state/chartGuide.js';
import { parseHash, learnHash } from '../src/state/route.js';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(`${ROOT}${p}`, 'utf8');
const learn = JSON.parse(read('content/learn.json'));
const charts = learn.charts;

/** Semua string di STR, termasuk hasil fungsi (argumen contoh). */
function allStrings() {
  const out = new Set();
  const walk = (x, depth = 0) => {
    if (depth > 12 || x == null) return;
    if (typeof x === 'string') out.add(x);
    else if (typeof x === 'function') for (const a of ['diesel', 'gas']) { try { const r = x(a, 18, 1, 1, 1, 1); if (typeof r === 'string') out.add(r); } catch { /* fungsi butuh argumen lain */ } }
    else if (typeof x === 'object') for (const v of Object.values(x)) walk(v, depth + 1);
  };
  walk(STR);
  return out;
}

/** Judul grafik yang dibuat scene: baca `title: <jalur STR>` pada pemanggilan create*Chart, selesaikan alias `const S = STR.…`. */
function sceneChartTitles() {
  const titles = [];
  for (const f of readdirSync(`${ROOT}src/scenes`).filter((x) => x.endsWith('.js'))) {
    const src = read(`src/scenes/${f}`);
    const alias = new Map();
    for (const m of src.matchAll(/\b([A-Za-z_]\w*)\s*=\s*(STR(?:\.\w+)+)/g)) alias.set(m[1], m[2]);
    const resolve = (expr) => {
      const [head, ...rest] = expr.split('.');
      let obj = head === 'STR' ? STR : alias.has(head) ? alias.get(head).split('.').slice(1).reduce((o, k) => o?.[k], STR) : undefined;
      for (const k of rest) obj = obj?.[k];
      return obj;
    };
    for (const m of src.matchAll(/create(?:XY|MultiLine|Bar|Line)Chart\(/g)) {
      const t = /title:\s*([A-Za-z_][\w.]*)/.exec(src.slice(m.index, m.index + 600));
      if (!t) continue;
      titles.push({ file: f, expr: t[1], value: resolve(t[1]) });
    }
  }
  return titles;
}

describe('guideIdForTitle (un lugar)', () => {
  it('semua judul di seed → id panduan yang benar (judul berakhiran "…" adalah awalan)', () => {
    for (const c of charts) for (const t of c.titles) {
      const typed = t.endsWith('…') ? `${t.slice(0, -1)} (r = 18.0)` : t;
      expect(guideIdForTitle(typed, charts), t).toBe(c.id);
    }
  });
  it('judul waterfall yang dibentuk fungsi cocok dengan panduan waterfall', () => {
    const W = STR.scene2.waterfall;
    expect(guideIdForTitle(W.title('diesel', 18), charts)).toBe('waterfall');
    expect(guideIdForTitle(W.title('gas', 11.5), charts)).toBe('waterfall');
    expect(guideIdForTitle(W.braytonTitle, charts)).toBe('waterfall');
    expect(guideIdForTitle(STR.charts.waterfall.title, charts)).toBe('waterfall');
  });
  it('judul grafik berbahasa Indonesia (D3) menuju panduan yang sama dengan sisi English', () => {
    const pairs = [];
    const walk = (o) => { if (isPair(o)) { if (typeof o.en === 'string') pairs.push(o); } else if (o && typeof o === 'object') Object.values(o).forEach(walk); };
    walk(STR_SOURCE.charts); walk(STR_SOURCE.scene1); walk(STR_SOURCE.scene2); walk(STR_SOURCE.scene3); walk(STR_SOURCE.scene4); walk(STR_SOURCE.scene5); walk(STR_SOURCE.scene6); walk(STR_SOURCE.scene7); walk(STR_SOURCE.scene8);
    const checked = pairs.filter((p) => guideIdForTitle(p.en, charts) && p.en !== p.id);
    expect(checked.length).toBeGreaterThanOrEqual(16); // D3: 9 + D4: 7 (Scene 6 ×3, Scene 7 ×2, Scene 8 ×2)
    for (const p of checked) expect(guideIdForTitle(p.id, charts), `${p.en} | ${p.id}`).toBe(guideIdForTitle(p.en, charts));
    const W = STR_SOURCE.scene2.waterfall;
    for (const t of [W.title.id('diesel', 18), W.title.id('gas', 11.5), W.braytonTitle.id]) expect(guideIdForTitle(t, charts), t).toBe('waterfall');
  });
  it('spasi ekstra diabaikan; judul tak dikenal / kosong → null', () => {
    expect(guideIdForTitle('  NOx &   CO vs load ', charts)).toBe('partload');
    expect(guideIdForTitle('No such chart', charts)).toBeNull();
    expect(guideIdForTitle('', charts)).toBeNull();
    expect(guideIdForTitle('P-V', charts)).toBeNull();
    expect(guideIdForTitle('P-V diagram', undefined)).toBeNull();
  });
});

describe('cakupan: setiap grafik di scene punya panduan', () => {
  // Pengecualian eksplisit (disebut di laporan). Kosong = tidak ada.
  const EXCLUDED = new Set([]);
  it('judul yang dibuat scene (create*Chart) tertemu dan semuanya punya panduan', () => {
    const found = sceneChartTitles();
    expect(found.length).toBeGreaterThanOrEqual(12);
    const unresolved = found.filter((x) => typeof x.value !== 'string').map((x) => `${x.file}: ${x.expr}`);
    expect(unresolved).toEqual([]);
    const missing = found.filter((x) => !EXCLUDED.has(x.value) && !guideIdForTitle(x.value, charts)).map((x) => `${x.file}: "${x.value}"`);
    expect(missing).toEqual([]);
  });
  it('judul di dalam modul grafik (P-V, P-θ, P-v, T-s, flame, skematik, waterfall) punya panduan', () => {
    const own = [STR.charts.pv.title, STR.charts.cycle.pv.title, STR.charts.cycle.ts.title, STR.charts.flame.title, STR.charts.brayton.title, STR.charts.waterfall.title];
    for (const t of own) expect(guideIdForTitle(t, charts), t).not.toBeNull();
  });
  it('panel Limits (Scene 9) punya panduan', () => {
    expect(guideIdForTitle(STR.regulation.title, charts)).toBe('limits');
  });
  it('tidak ada panduan yatim: setiap judul seed tampil di STR (ujung "…" dicocokkan sebagai awalan)', () => {
    const all = [...allStrings()];
    const lost = [];
    for (const c of charts) for (const t of c.titles) {
      const ok = t.endsWith('…') ? all.some((s) => s.startsWith(t.slice(0, -1))) : all.includes(t);
      if (!ok) lost.push(`${c.id}: ${t}`);
    }
    expect(lost).toEqual([]);
  });
  it('setiap pembuat grafik di src/charts memakai createChartBase (otomatis dapat tombol ⓘ)', () => {
    const files = readdirSync(`${ROOT}src/charts`).filter((f) => f.endsWith('.js') && !['chartBase.js', 'legend.js'].includes(f));
    const without = files.filter((f) => !/createChartBase\(/.test(read(`src/charts/${f}`)));
    expect(without).toEqual([]);
    const base = read('src/charts/chartBase.js');
    expect(base).toMatch(/createGuideButton\(/);
    expect(base).toMatch(/guide\.dispose\(\)/);
    expect(read('src/ui/limitsTab.js')).toMatch(/createGuideButton\(/);
    expect(read('src/scenes/cycles.js')).toMatch(/guideHost: q\('\.cyc-guide-slot'\)/);
  });
  it('tingkat model per panduan: setiap panduan punya entri dan kuncinya sah', () => {
    expect(Object.keys(GUIDE_LEVELS).sort()).toEqual(charts.map((c) => c.id).sort());
    for (const keys of Object.values(GUIDE_LEVELS)) for (const k of keys) expect(Object.keys(STR.common.level)).toContain(k);
  });
});

describe('indeks dan asal klik ⓘ', () => {
  it('15 panduan, dikelompokkan per scene naik, urutan seed terjaga', () => {
    const g = groupChartsByScene(charts);
    expect(g.reduce((a, x) => a + x.charts.length, 0)).toBe(15);
    expect(g.map((x) => x.scene)).toEqual([1, 2, 3, 4, 6, 7, 8, 9]);
    expect(g.find((x) => x.scene === 6).charts.map((c) => c.id)).toEqual(['partload']);
  });
  it('Back to the chart hanya untuk panduan yang dibuka dari ⓘ, alamat scene saja', () => {
    clearChartOrigin();
    expect(backToChartHash('partload')).toBeNull();
    setChartOrigin('#/scene/6', 'partload');
    expect(backToChartHash('partload')).toBe('#/scene/6');
    expect(backToChartHash('pv')).toBeNull();
    setChartOrigin('#/scene/9/levers', 'levers');
    expect(backToChartHash('levers')).toBe('#/scene/9/levers');
    setChartOrigin('#/learn/charts', 'pv'); // bukan alamat scene → tidak diingat
    expect(chartOrigin()).toBeNull();
    clearChartOrigin();
  });
  it('alamat panduan dikenali router dan setiap route panduan valid', () => {
    expect(parseHash(learnHash('charts', 'partload'))).toEqual({ type: 'learn', view: 'charts', id: 'partload' });
    for (const c of charts) expect(parseHash(c.route), c.id).not.toBeNull();
  });
});

describe('tombol ⓘ: label dua bahasa, Present, PNG', () => {
  it('tooltip "How to read this chart" (EN) dan padanan ID', () => {
    expect(STR.bi.chartGuide.tip.en).toBe('How to read this chart');
    expect(STR.bi.chartGuide.tip.id).toMatch(/membaca/);
    expect(STR.bi.chartGuide.icon.en).toBe('ⓘ');
  });
  it('tersembunyi di Present (CSS), tidak ikut PNG (data-snap-skip), bukan tombol "?"', () => {
    expect(read('src/styles.css')).toMatch(/body\.mode-present \.chart__guide\s*\{\s*display:\s*none/);
    const btn = read('src/ui/chartGuideButton.js');
    expect(btn).toMatch(/dataset\.snapSkip = ''/);
    expect(btn).not.toMatch(/'\?'/);
  });
  it('teks baru tanpa frasa gaya mesin atau tanda pisah panjang', () => {
    const texts = [];
    const walk = (x) => { if (typeof x === 'string') texts.push(x); else if (x && typeof x === 'object') Object.values(x).forEach(walk); };
    walk(STR.bi.chartGuide);
    const banned = /delve|unlock|journey|seamless|in today's|it's not just|game-changer|robust|leverage|empower|dive into|landscape|embark|—|menyelami|mari kita|di era|tidak hanya/i;
    for (const t of texts) expect(t).not.toMatch(banned);
  });
});
