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
const B_DARK = block(':root'), B_SHARED = block(':root, .vp-scope, .nox-species'), B_LIGHT = block(':root[data-theme="light"]');
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
    expect(main).toMatch(/getElementById\('model-badge'\)\.before\(langSlot, themeSwitch\.el\)/);
    expect(main).toMatch(/langSlot\.id = 'lang-slot'/);
    expect(main).toMatch(/writeTheme\(themeStore, theme\);\s*themeSwitch\.set\(theme\);\s*refreshChartTheme\(\);/);
  });
  it('aksesibel, teks dari strings.js, tidak ikut PNG', () => {
    expect(sw).toMatch(/setAttribute\('role', 'radiogroup'\)/);
    expect(sw).toMatch(/setAttribute\('aria-checked', String\(on\)\)/);
    expect(sw).toMatch(/el\.dataset\.snapSkip = ''/);
    expect(STR.theme).toMatchObject({ dark: 'Dark', light: 'Light' });
    expect(STR.theme.tip).toMatch(/charcoal/);
    expect(css).toMatch(/\.theme-switch__btn:focus-visible \{ outline: 2px solid var\(--focus-ring\)/);
  });
});

describe('token CSS: lengkap di kedua tema, tanpa warna tetap di luar blok token', () => {
  const SAME_BOTH = new Set(['--font-ui', '--font-num', '--laser-core', '--laser-red', '--laser-halo', '--laser-glow', '--spot-dim', '--c-pipe', '--sp-pm']);
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
  it('legenda partikel 3D memakai palet gelap (sama dengan partikel)', () => {
    expect(css).toMatch(/^:root, \.vp-scope, \.nox-species \{/m);
  });
});

describe('kontras WCAG AA tema terang', () => {
  const L = (k) => LIGHT[k];
  const BGS = ['--bg-0', '--bg-1', '--bg-2'].map(L);
  // kartu tembus pandang di atas viewport arang (gelap dan terang gradasi)
  const GLASS = ['--overlay-bg', '--label-bg', '--float-bg', '--status-bg', '--marker-bg'].flatMap((k) => ['--vp-lo', '--vp-hi', '--vp-fl-lo'].map((v) => over(L(k), L(v))));
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
