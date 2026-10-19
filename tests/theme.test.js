// Bagian B: tema Dark / Light. Pilihan tema (etel:theme, default Dark, tanpa prefers-color-scheme), token CSS lengkap
// di kedua tema, tidak ada warna tetap di luar blok token, palet spesies satu sumber (species.js ↔ --sp-*), dan kontras
// WCAG AA tema terang (teks ≥ 4,5:1, garis grafik ≥ 3:1, area pita/jendela minimal sejelas tema gelap).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { THEME_KEY, readTheme, readThemeChoice, writeTheme, applyTheme, currentTheme, DEFAULT_THEME } from '../src/state/theme.js';
import { SPECIES_PALETTES, SPECIES_COLORS, SPECIES_VAR, SPECIES_CSS_VAR } from '../src/gfx/species.js';
import { CHART_TOKENS, CV } from '../src/charts/chartBase.js';
import { STR } from '../src/ui/strings.js';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(`${ROOT}${p}`, 'utf8');
const css = read('src/styles.css');

// ── pengurai blok token ──
function block(selector) {
  const i = css.indexOf(`${selector} {`);
  if (i < 0) throw new Error(`blok ${selector} tidak ada`);
  const j = css.indexOf('\n}', i);
  return { start: i, end: j + 2, text: css.slice(i, j + 2) };
}
const vars = (text) => Object.fromEntries([...text.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)].map((m) => [m[1], m[2].trim()]));
const B_DARK = block(':root'), B_SHARED = block(':root, .vp-scope'), B_LIGHT = block(':root[data-theme="light"], :root[data-theme="light"] .vp-scope');
const DARK = { ...vars(B_DARK.text), ...vars(B_SHARED.text) };
const LIGHT = { ...DARK, ...vars(B_LIGHT.text) };
const LIGHT_OWN = vars(B_LIGHT.text);

// ── warna & kontras (WCAG 2.x) ──
function parse(c) {
  const h = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
  if (h) { const x = h[1].length === 3 ? h[1].split('').map((d) => d + d).join('') : h[1]; return [0, 2, 4].map((k) => parseInt(x.slice(k, k + 2), 16)).concat(1); }
  const m = /^rgba?\(([^)]+)\)$/.exec(c);
  if (m) { const p = m[1].split(',').map((v) => Number(v.trim())); return [p[0], p[1], p[2], p[3] ?? 1]; }
  throw new Error(`warna tidak dikenal: ${c}`);
}
/** Warna (boleh tembus pandang) di atas latar opak. */
const over = (fg, bg) => { const f = parse(fg), b = parse(bg); return `rgb(${[0, 1, 2].map((k) => Math.round(f[k] * f[3] + b[k] * (1 - f[3]))).join(',')})`; };
const lum = (c) => { const p = parse(c); const l = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * l(p[0]) + 0.7152 * l(p[1]) + 0.0722 * l(p[2]); };
const ratio = (fg, bg) => { const bgO = parse(bg)[3] < 1 ? over(bg, '#000000') : bg; const f = over(fg, bgO); const a = lum(f), b = lum(bgO); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
const hue = (c) => { const [r, g, b] = parse(c).map((v) => v / 255); const M = Math.max(r, g, b), m = Math.min(r, g, b), d = M - m; if (!d) return 0; const h = M === r ? ((g - b) / d) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };
const hueDiff = (a, b) => { const d = Math.abs(hue(a) - hue(b)) % 360; return Math.min(d, 360 - d); };

describe('pilihan tema: etel:theme, default Dark, tanpa prefers-color-scheme', () => {
  const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
  const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  it('baca/tulis aman', () => {
    expect(THEME_KEY).toBe('etel:theme');
    expect(DEFAULT_THEME).toBe('dark');
    const st = mem();
    expect(readThemeChoice(st)).toEqual({ theme: 'dark', stored: false });
    expect(writeTheme(st, 'light')).toBe(true);
    expect(readThemeChoice(st)).toEqual({ theme: 'light', stored: true });
    expect(writeTheme(st, 'sepia')).toBe(false);
    st.setItem(THEME_KEY, 'sepia');
    expect(readTheme(st)).toBe('dark');
    expect(readThemeChoice(throwing)).toEqual({ theme: 'dark', stored: false });
    expect(writeTheme(throwing, 'light')).toBe(false);
    expect(readTheme(null)).toBe('dark');
  });
  it('applyTheme memasang data-theme; nilai asing → dark', () => {
    const doc = { documentElement: { dataset: {} } };
    expect(applyTheme('light', doc)).toBe('light');
    expect(currentTheme(doc)).toBe('light');
    expect(applyTheme('x', doc)).toBe('dark');
    expect(doc.documentElement.dataset.theme).toBe('dark');
  });
  it('prefers-color-scheme tidak dipakai; head memasang tema sebelum CSS (anti-kedip) dan aman bila storage diblokir', () => {
    for (const f of ['src/state/theme.js', 'src/main.js', 'src/presenter.js', 'src/styles.css', 'index.html', 'presenter.html']) {
      const code = read(f).replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$|^\s*\*.*$/gm, '');
      expect(code, f).not.toMatch(/prefers-color-scheme/);
    }
    for (const f of ['index.html', 'presenter.html']) {
      const h = read(f);
      expect(h, f).toMatch(/<script>try\{if\(localStorage\.getItem\('etel:theme'\)==='light'\)document\.documentElement\.dataset\.theme='light'\}catch\(e\)\{\}<\/script>/);
      expect(h.indexOf('etel:theme'), f).toBeLessThan(h.indexOf('type="module"'));
    }
  });
  it('jendela presenter ikut tema hanya bila pilihan tersimpan terbaca; berubah lewat event storage', () => {
    const p = read('src/presenter.js');
    expect(p).toMatch(/applyTheme\(c\.stored \? c\.theme : 'dark'\)/);
    expect(p).toMatch(/addEventListener\('storage'/);
  });
});

describe('sakelar Dark/Light di header kanan', () => {
  const main = read('src/main.js'), sw = read('src/ui/themeSwitch.js');
  it('urutan [Explore (M)] … [slot EN/ID] [Dark/Light] [Model OK]; tersimpan; grafik digambar ulang', () => {
    expect(main).toMatch(/prepend\(exitPresent\.el\)/);
    expect(main).toMatch(/getElementById\('model-badge'\)\.before\(langSlot, themeSwitch\.el/);
    expect(main).toMatch(/langSlot\.id = 'lang-slot'/);
    expect(main).toMatch(/writeTheme\(themeStore, theme\);\s*themeSwitch\.set\(theme\);\s*refreshChartTheme\(\);/);
  });
  it('aksesibel, teks dari strings.js, tidak ikut PNG', () => {
    expect(sw).toMatch(/setAttribute\('role', 'radiogroup'\)/);
    expect(sw).toMatch(/setAttribute\('aria-checked', String\(on\)\)/);
    expect(sw).toMatch(/el\.dataset\.snapSkip = ''/);
    expect(STR.theme).toMatchObject({ dark: 'Dark', light: 'Light' });
    expect(STR.theme.tip).toMatch(/3D view/); // varian A: viewport ikut terang di Light
    expect(css).toMatch(/\.theme-switch__btn:focus-visible \{ outline: 2px solid var\(--focus-ring\)/);
  });
});

describe('token CSS: lengkap di kedua tema, tanpa warna tetap di luar blok token', () => {
  const SAME_BOTH = new Set(['--font-ui', '--font-num', '--laser-core', '--laser-red', '--laser-halo', '--laser-glow', '--spot-dim', '--c-pipe', '--sp-pm', '--vp-sp-pm']);
  it('setiap token warna gelap punya nilai terang', () => {
    const missing = Object.keys(DARK).filter((k) => !SAME_BOTH.has(k) && !(k in LIGHT_OWN));
    expect(missing).toEqual([]);
  });
  it('setiap token grafik (CHART_TOKENS) didefinisikan; CV merujuk variabel itu', () => {
    for (const t of CHART_TOKENS) { expect(DARK, t).toHaveProperty(`--c-${t}`); expect(LIGHT, t).toHaveProperty(`--c-${t}`); }
    expect(CV.text).toBe('var(--c-text)');
    expect(CV.pvFill).toBe('var(--c-pv-fill)');
  });
  it('styles.css: hex / rgb hanya di blok token', () => {
    const outside = css.slice(0, B_DARK.start) + css.slice(B_LIGHT.end);
    const between = css.slice(B_DARK.end, B_SHARED.start) + css.slice(B_SHARED.end, B_LIGHT.start);
    expect(`${outside}${between}`.match(/#[0-9a-f]{3,8}\b|rgba?\(/gi) ?? []).toEqual([]);
  });
  it('JS tampilan (charts, scenes, ui, main): tanpa literal warna (kecuali warna suhu model rgb(${…}) dan fallback chartBase)', () => {
    const files = [];
    const walk = (d) => { for (const f of readdirSync(join(ROOT, d))) { const p = `${d}/${f}`; if (statSync(join(ROOT, p)).isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } };
    ['src/charts', 'src/scenes', 'src/ui'].forEach(walk);
    files.push('src/main.js', 'src/presenter.js', 'src/gfx/snapshotPaint.js');
    const bad = [];
    for (const f of files) {
      const code = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      for (const m of code.matchAll(/'#[0-9a-fA-F]{3,8}'|"#[0-9a-fA-F]{3,8}"|:\s*#[0-9a-fA-F]{3,8}\b|['"`]rgba?\((?!\$\{)/g)) {
        const line = code.slice(code.lastIndexOf('\n', m.index) + 1, code.indexOf('\n', m.index));
        if (/const FALLBACK = /.test(line) || /\/rgba\?\\\(/.test(line)) continue;
        bad.push(`${f}: ${line.trim().slice(0, 100)}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('warna spesies: satu sumber (species.js) ↔ --sp-*', () => {
  it('variabel CSS = palet species.js (gelap, terang, ink terang)', () => {
    for (const [sp, v] of Object.entries(SPECIES_CSS_VAR)) {
      expect(vars(B_SHARED.text)[v], `${sp} dark`).toBe(SPECIES_PALETTES.dark[sp]);
      expect(LIGHT[v], `${sp} light`).toBe(SPECIES_PALETTES.light[sp]);
      expect(LIGHT[`${v}-ink`] ?? LIGHT[v], `${sp} ink`).toBe(SPECIES_PALETTES.lightInk[sp]);
    }
    expect(SPECIES_COLORS).toBe(SPECIES_PALETTES.dark); // 3D: viewport selalu arang
    expect(SPECIES_VAR.NOx).toBe('var(--sp-nox)');
  });
  it('hue sama di semua tema (±2°); terang lebih gelap atau sama', () => {
    for (const sp of Object.keys(SPECIES_CSS_VAR)) {
      const d = SPECIES_PALETTES.dark[sp], l = SPECIES_PALETTES.light[sp], k = SPECIES_PALETTES.lightInk[sp];
      expect(hueDiff(d, l), sp).toBeLessThanOrEqual(2);
      expect(hueDiff(d, k), sp).toBeLessThanOrEqual(2);
      expect(lum(l), sp).toBeLessThanOrEqual(lum(d) + 1e-9);
    }
  });
  it('kartu teks Scene 9 (tanpa visual 3D) ikut tema, bukan latar arang', () => {
    expect(css).toMatch(/\.pl-view\.pol-card \{ background: var\(--pol-card-bg\); \}/);
    expect(LIGHT_OWN['--pol-card-bg']).toBe('var(--bg-1)');
  });
  it('partikel 3D dan legendanya memakai palet tone viewport (gelap: dark, terang: lightInk)', () => {
    expect(css).toMatch(/\.nox-species \{ --sp-nox: var\(--vp-sp-nox\);/);
    for (const [sp, v] of Object.entries(SPECIES_CSS_VAR)) {
      expect(DARK[v.replace('--sp-', '--vp-sp-')], sp).toBe(SPECIES_PALETTES.dark[sp]);
      expect(LIGHT[v.replace('--sp-', '--vp-sp-')], sp).toBe(SPECIES_PALETTES.lightInk[sp]);
    }
  });
});

describe('kontras WCAG AA tema terang', () => {
  const VP_STOPS = ['--vp-hi', '--vp-lo', '--vp-lo-deep', '--vp-fl-hi', '--vp-fl-lo'];
  const L = (k) => LIGHT[k];
  const BGS = ['--bg-0', '--bg-1', '--bg-2'].map(L);
  // kartu tembus pandang di atas viewport arang (gelap dan terang gradasi)
  const GLASS = ['--overlay-bg', '--label-bg', '--float-bg', '--status-bg', '--marker-bg', '--vp-pill-bg', '--vp-tag-bg'].flatMap((k) => VP_STOPS.map((v) => over(L(k), L(v))));
  const TEXT = ['--text', '--muted', '--accent-hot', '--accent-cold', '--ok', '--fail', '--cold-text', '--info-text', '--mag-text', '--dir-lowers', '--dir-raises', '--float-fg', '--float-muted', '--c-text', '--c-title', '--c-note',
    ...Object.keys(LIGHT_OWN).filter((k) => k.endsWith('-ink'))];
  const report = [];
  it('teks ≥ 4,5:1 pada semua latar panel dan kartu di atas viewport', () => {
    const bad = [];
    for (const t of TEXT) for (const bg of [...BGS, ...GLASS]) { const r = ratio(L(t), bg); report.push(['text', t, r]); if (r < 4.5) bad.push(`${t} on ${bg}: ${r.toFixed(2)}`); }
    // teks di atas warna aksen / chip
    for (const [fg, bg] of [['--on-hot', '--accent-hot'], ['--within-fg', '--within-bg'], ['--accent-hot', over(L('--tint-hot'), L('--bg-0'))], ['--text', over(L('--tint-cold'), L('--bg-2'))], ['--text', L('--tip-bg')]]) {
      const r = ratio(L(fg), L(bg) ?? bg); report.push(['text', `${fg}/${bg}`, r]); if (r < 4.5) bad.push(`${fg} on ${bg}: ${r.toFixed(2)}`);
    }
    expect(bad).toEqual([]);
  });
  it('garis grafik ≥ 3:1 terhadap latar grafik (--bg-1); grid dikecualikan (dekoratif)', () => {
    const LINES = ['fg', 'ring', 'axis', 'guide', 'ghost', 'ref', 'dash', 'path', 'main', 'hot', 'cold', 'loss', 'ok', 'note', 'closing', 'gasx', 'compression', 'rejection', 'heat', 'expansion', 'diesel'].map((k) => `--c-${k}`)
      .concat(Object.values(SPECIES_CSS_VAR));
    const bad = [];
    for (const k of LINES) { const r = ratio(L(k), L('--bg-1')); report.push(['line', k, r]); if (r < 3) bad.push(`${k}: ${r.toFixed(2)}`); }
    expect(bad).toEqual([]);
  });
  it('area (pita fase, pita Arrhenius, jendela beban, pita CO, arsir kerja) minimal sejelas tema gelap', () => {
    const AREAS = ['band-intake', 'band-neutral', 'band-comb', 'band-comb-sw', 'band-exhaust', 'band-dln', 'band-engine', 'win-single', 'win-twin', 'co-band-single', 'co-band-twin', 'pv-fill'].map((k) => `--c-${k}`);
    const bad = [];
    for (const k of AREAS) {
      const rd = ratio(DARK[k], DARK['--bg-1']), rl = ratio(L(k), L('--bg-1'));
      report.push(['area', k, rl, rd]);
      if (rl < rd) bad.push(`${k}: light ${rl.toFixed(3)} < dark ${rd.toFixed(3)}`);
    }
    expect(bad).toEqual([]);
  });
  it('tema gelap tetap: teks utama ≥ 4,5:1', () => {
    for (const t of ['--text', '--muted', '--c-text', '--c-title']) for (const bg of ['--bg-0', '--bg-1', '--bg-2']) expect(ratio(DARK[t], DARK[bg]), `${t}/${bg}`).toBeGreaterThanOrEqual(4.5);
  });
  it('ringkasan kontras terendah (untuk laporan)', () => {
    const min = (kind) => report.filter((r) => r[0] === kind).sort((a, b) => a[2] - b[2])[0];
    const out = ['text', 'line', 'area'].map((k) => { const m = min(k); return m ? `${k}: ${m[1]} ${m[2].toFixed(2)}${m[3] ? ` (dark ${m[3].toFixed(2)})` : ''}` : ''; });
    if (process.env.THEME_REPORT) console.log(out.join('\n'));
    expect(out.every(Boolean)).toBe(true);
  });
});

// ── perbaikan bagian B: kaca di atas viewport, viewport tema terang varian A ──
describe('kotak di atas viewport: kaca tembus pandang + blur di tema terang, tanpa latar opak putih', () => {
  const alpha = (c) => parse(c)[3];
  const GLASS_TOKENS = ['--overlay-bg', '--label-bg', '--status-bg', '--marker-bg', '--float-bg', '--float-bg-hover', '--vp-pill-bg', '--vp-tag-bg'];
  it('token kaca tema terang: opasitas ≤ 0,6; blur aktif; tema gelap tanpa blur (tidak berubah)', () => {
    for (const k of GLASS_TOKENS) expect(alpha(LIGHT_OWN[k]), k).toBeLessThanOrEqual(0.6);
    expect(LIGHT_OWN['--glass-blur']).toMatch(/^blur\(\d+px\)/);
    expect(DARK['--glass-blur']).toBe('none');
    expect(DARK['--overlay-bg']).toBe('rgba(11, 15, 22, 0.72)');
  });
  it('setiap kotak overlay viewport: latar dari token kaca dan backdrop-filter blur', () => {
    const OVERLAYS = { '.overlay--formula': '--overlay-bg', '.overlay--readout': '--overlay-bg', '.temp-legend': '--overlay-bg', '.label3d': '--label-bg', '.overlay--status': '--status-bg', '.nox-species': '--overlay-bg', '.overlay--note': '--label-bg', '.f-toggle': '--float-bg', '.temp-legend__marker': '--marker-bg' };
    const glassRule = css.slice(css.indexOf('/* ── Kaca di atas viewport 3D'));
    for (const [sel, tok] of Object.entries(OVERLAYS)) {
      const rules = [...css.matchAll(new RegExp(`(^|\\n)${sel.replace('.', '\\.')}\\s*\\{([^}]*)\\}`, 'g'))].map((m) => m[2]).join(';');
      expect(rules, sel).toMatch(new RegExp(`background: var\\(${tok}\\)`));
      expect(glassRule, sel).toContain(sel);
    }
    expect(glassRule).toMatch(/backdrop-filter: var\(--glass-blur\)/);
    expect(glassRule).toMatch(/\.overlay \.pill, :is\(\.scene__view, \.cyc-view, \.fl-view, \.gt-view, \.pl-view\) \.pill \{ background: var\(--vp-pill-bg\); \}/);
    expect(glassRule).toMatch(/\.cyc-level \{ background: var\(--vp-tag-bg\); \}/);
    expect(css).toMatch(/\.gauge \{[^}]*background: var\(--vp-track-bg\)/);
  });
  it('teks di kaca ≥ 4,5:1 terhadap latar viewport; bingkai skala suhu ≥ 3:1', () => {
    const stops = ['--vp-hi', '--vp-lo', '--vp-lo-deep', '--vp-fl-hi', '--vp-fl-lo'].map((k) => LIGHT[k]);
    for (const g of ['--overlay-bg', '--label-bg', '--status-bg', '--float-bg', '--vp-pill-bg']) for (const st of stops) {
      const bg = over(LIGHT[g], st);
      for (const t of ['--text', '--muted', '--accent-hot', '--accent-cold', '--float-fg', '--float-muted', '--cold-text', '--c-text']) expect(ratio(LIGHT[t], bg), `${t} on ${g}/${st}`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(LIGHT['--legend-frame'], bg), `frame ${g}/${st}`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('latar viewport tema terang: varian A (abu-krem terang); C ditolak; tema gelap tidak berubah', () => {
  const STOPS = ['--vp-hi', '--vp-lo', '--vp-lo-deep', '--vp-fl-hi', '--vp-fl-lo'];
  it('varian A: luminans relatif 0,45–0,70 (≈ #cfc9bb, 0,58); tone light', () => {
    for (const k of STOPS) { const l = lum(LIGHT_OWN[k]); expect(l, k).toBeGreaterThanOrEqual(0.45); expect(l, k).toBeLessThanOrEqual(0.7); }
    expect(Math.abs(lum(LIGHT_OWN['--vp-lo']) - lum('#cfc9bb'))).toBeLessThan(0.06);
    expect(LIGHT_OWN['--vp-tone']).toBe('light');
    expect(DARK['--vp-tone']).toBe('dark');
    expect([DARK['--vp-hi'], DARK['--vp-lo'], DARK['--vp-lo-deep'], DARK['--vp-fl-hi'], DARK['--vp-fl-lo']]).toEqual(['#1a2540', '#0d121c', '#0b0f16', '#1a2133', '#07090e']);
  });
  it('warna partikel spesies ≥ 3:1 terhadap setiap titik gradasi latar viewport terang', () => {
    for (const k of STOPS) for (const [sp, c] of Object.entries(SPECIES_PALETTES.lightInk)) expect(ratio(c, LIGHT_OWN[k]), `${sp} on ${k}`).toBeGreaterThanOrEqual(3);
  });
  it('varian C (abu sedang ≈ #8d887c) tercatat gagal: tidak ada palet spesies yang ≥ 3:1 dan teks aksen < 4,5:1', () => {
    const C = '#8d887c';
    for (const pal of ['dark', 'light', 'lightInk']) expect(Math.max(...Object.entries(SPECIES_PALETTES[pal]).filter(([sp]) => sp !== 'PM').map(([, c]) => ratio(c, C))), pal).toBeLessThan(3);
    expect(ratio(LIGHT['--accent-hot'], over(LIGHT['--overlay-bg'], C))).toBeLessThan(4.5);
  });
  it('tone viewport: bloom lemah dan blending normal di latar terang', async () => {
    const { TONE_PARAMS, glowBlending, speciesColors3D } = await import('../src/gfx/viewportTone.js');
    const THREE = await import('three');
    expect(TONE_PARAMS.light.bloomStrength).toBeLessThan(TONE_PARAMS.dark.bloomStrength / 2);
    expect(glowBlending('light')).toBe(THREE.NormalBlending);
    expect(glowBlending('dark')).toBe(THREE.AdditiveBlending);
    expect(speciesColors3D('light')).toBe(SPECIES_PALETTES.lightInk);
    expect(speciesColors3D('dark')).toBe(SPECIES_PALETTES.dark);
  });
  it('main.js memasang ulang scene bila tone viewport berubah saat ganti tema', () => {
    expect(read('src/main.js')).toMatch(/if \(viewportTone\(\) !== toneBefore\) \{ if \(index >= 0\) goTo\(index, true\); learnHost\.retheme\(\); \}/);
  });
});

// ── M11 Step 01: teks hero landing langsung di atas latar viewport ──
describe('landing: teks hero AA terhadap latar viewport di kedua tema; kartu dan tautan memakai token', () => {
  const resolve = (T, k) => { let v = T[k]; for (let i = 0; i < 5 && /^var\(/.test(v ?? ''); i++) v = T[v.slice(4, -1)]; return v; };
  const STOPS = ['--vp-hi', '--vp-lo', '--vp-lo-deep', '--vp-fl-hi', '--vp-fl-lo'];
  it('--hero-text / --hero-muted / --hero-accent ≥ 4,5:1 terhadap setiap titik gradasi viewport', () => {
    for (const [name, T] of [['dark', DARK], ['light', LIGHT]]) for (const k of ['--hero-text', '--hero-muted', '--hero-accent']) for (const st of STOPS) {
      expect(ratio(resolve(T, k), resolve(T, st)), `${name} ${k} on ${st}`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('CSS landing: teks hero memakai token hero; tanpa warna tetap (blok token saja)', () => {
    expect(css).toMatch(/\.landing__intro \{[^}]*color: var\(--hero-text\)/);
    expect(css).toMatch(/\.landing__kicker \{[^}]*color: var\(--hero-accent\)/);
    expect(css).toMatch(/\.landing__hero \{[^}]*var\(--vp-hi\)[^}]*var\(--vp-lo-deep\)/);
  });
});

// ── M11 Step 02: halaman Learn (daftar level, pelajaran, soal, pil Back to lesson) memakai token tema, AA di kedua tema ──
describe('Learn Step 02: teks AA pada latar halaman Learn dan komponennya (Dark dan Light)', () => {
  for (const [name, T] of [['dark', DARK], ['light', LIGHT]]) {
    it(`${name}: pasangan teks/latar ≥ 4,5:1`, () => {
      const bg = (k) => T[k];
      const pairs = [
        ['--text', over(T['--tint-cold-faint'], bg('--bg-0')), 'tujuan pelajaran / Try it di atas latar halaman'],
        ['--text', over(T['--tint-cold-faint'], bg('--bg-1')), 'Try it di dalam kartu'],
        ['--text', over(T['--ok-bg'], bg('--bg-1')), 'opsi soal benar'],
        ['--text', over(T['--fail-bg'], bg('--bg-1')), 'opsi soal salah'],
        ['--ok', bg('--bg-1'), 'umpan balik benar, tanda selesai'],
        ['--fail', bg('--bg-1'), 'umpan balik salah'],
        ['--fail', bg('--bg-2'), 'tombol Yes, reset'],
        ['--text', over(T['--ok-bg'], bg('--bg-2')), 'tombol Mark as done (aktif)'],
        ['--accent-cold', over(T['--tint-cold-soft'], over(T['--topbar-bg'], bg('--bg-0'))), 'pil Back to lesson di header'],
        ['--accent-cold', bg('--bg-1'), 'judul level, tautan'],
        ['--accent-hot', bg('--bg-1'), 'meta kartu / Try it'],
        ['--muted', bg('--bg-1'), 'menit, meta, remah roti'],
        ['--muted', bg('--bg-0'), 'remah roti di atas latar halaman'],
      ];
      const bad = pairs.map(([fg, b, what]) => [what, ratio(T[fg], b)]).filter(([, r]) => r < 4.5).map(([w, r]) => `${w}: ${r.toFixed(2)}`);
      expect(bad).toEqual([]);
    });
  }
  it('CSS Step 02: kelas baru memakai token; tidak ada warna tetap (sudah dijaga tes blok token)', () => {
    const blk = css.slice(css.indexOf('/* ── M11 Step 02:'));
    expect(blk.length).toBeGreaterThan(1000);
    expect(blk).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    expect(blk).toMatch(/\.back-pill \{[^}]*color: var\(--accent-cold\)/);
    expect(blk).toMatch(/\.reading\.lesson-page \{[^}]*70ch/);
    expect(blk).toMatch(/\.reading \.lesson__p \{[^}]*font-size: 17px/);
  });
});
