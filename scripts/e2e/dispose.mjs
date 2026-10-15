/**
 * dispose.mjs — uji dispose antar-scene + smoke test per browser yang tersedia.
 * Siklus 1→11→1 (3×); setelah tiap siklus, jumlah listener window/document, ResizeObserver, Worker, konteks WebGL
 * aktif, dan subscriber store harus kembali ke baseline; setiap renderer yang dilepas harus menyisakan 0 geometry
 * dan 0 texture (renderer.info.memory); tanpa galat halaman / peringatan konteks WebGL.
 * Jalankan: npm run e2e   (build + skrip ini; butuh Playwright, lihat lib.mjs)
 */
import { loadPlaywright, startPreview, launchers, instrument, goScene } from './lib.mjs';

const CYCLES = Number(process.env.E2E_CYCLES ?? 3);
const pw = await loadPlaywright();
const srv = await startPreview();
const results = [];
let failed = false;
try {
  for (const { name, browser, error } of await launchers(pw)) {
    if (!browser) { results.push({ browser: name, status: 'not available', detail: error }); continue; }
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('console', (m) => { if (/too many active webgl|context lost/i.test(m.text()) && !/forceContextLoss/.test(m.text())) errs.push(`console: ${m.text()}`); });
    await page.addInitScript(instrument);
    await page.goto(srv.url);
    await page.waitForFunction(() => window.__etelDebug?.scene() != null, null, { timeout: 30000 });
    await goScene(page, 1, 1200);
    const probe = () => page.evaluate(() => ({ ...window.__etelProbe(), storeSubs: window.__etelDebug.storeSubs() }));
    const base = await probe();
    const order = [...Array.from({ length: 10 }, (_, i) => i + 2), ...Array.from({ length: 10 }, (_, i) => 10 - i)];
    const after = [];
    for (let c = 0; c < CYCLES; c++) {
      for (const n of order) await goScene(page, n, 250);
      await page.waitForTimeout(800);
      after.push(await probe());
    }
    const log = await page.evaluate(() => window.__etelDebug.disposeLog());
    const leaks = log.filter((x) => x.geometries || x.textures);
    const keys = ['listeners', 'resizeObservers', 'workers', 'webglActive', 'storeSubs'];
    const drift = after.map((a) => Object.fromEntries(keys.filter((k) => a[k] !== base[k]).map((k) => [k, `${base[k]}→${a[k]}`])));
    const ok = !errs.length && !leaks.length && drift.every((d) => !Object.keys(d).length);
    if (!ok) failed = true;
    results.push({ browser: name, status: ok ? 'PASS' : 'FAIL', baseline: base, afterCycles: after, disposed: log.length, leaks, drift, errors: errs.slice(0, 5) });
    await browser.close();
  }
} finally {
  srv.stop();
}
console.log(JSON.stringify(results, null, 1));
process.exit(failed ? 1 : 0);
