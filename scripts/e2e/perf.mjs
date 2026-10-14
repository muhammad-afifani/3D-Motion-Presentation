/**
 * perf.mjs — tabel performa per scene (1–11) dari overlay debug: fps, draw calls, triangles, geometries, textures.
 * PERINGATAN: tanpa GPU, Chromium memakai SwiftShader (rendering software). Angka fps di lingkungan itu BUKAN fps
 * GPU; draw calls / triangles / geometries / textures tetap bermakna (tidak bergantung GPU).
 * Jalankan: npm run e2e:perf   (opsi: E2E_QUALITY=auto|high|low, E2E_SECONDS=4)
 */
import { loadPlaywright, startPreview, launchers, goScene } from './lib.mjs';

const SECONDS = Number(process.env.E2E_SECONDS ?? 4);
const QUALITY = process.env.E2E_QUALITY ?? 'high';
const pw = await loadPlaywright();
const srv = await startPreview();
try {
  const chromium = (await launchers(pw)).find((x) => x.name === 'chromium' && x.browser);
  if (!chromium) throw new Error('Chromium tidak tersedia');
  const page = await chromium.browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(srv.url);
  await page.waitForFunction(() => window.__etelDebug?.scene() != null, null, { timeout: 30000 });
  await page.evaluate((q) => window.__etelDebug.setQuality?.(q), QUALITY);
  const rows = [];
  let gpu = null, software = null;
  for (let n = 1; n <= 11; n++) {
    await goScene(page, n, 1500);
    const samples = [];
    for (let i = 0; i < SECONDS * 2; i++) { await page.waitForTimeout(500); samples.push(await page.evaluate(() => ({ fps: window.__etelDebug.fps(), s: window.__etelDebug.stats(), q: window.__etelDebug.quality?.() ?? null }))); }
    const last = samples.at(-1);
    const fpsVals = samples.map((x) => x.fps).filter((x) => x != null);
    gpu ??= last.s.gpu; software ??= last.s.software;
    rows.push({ scene: n, fps: fpsVals.length ? fpsVals.reduce((a, b) => a + b, 0) / fpsVals.length : null, calls: last.s.calls, triangles: last.s.triangles, geometries: last.s.geometries, textures: last.s.textures, pixelRatio: last.s.pixelRatio, bloom: last.s.bloom, tier: last.q?.tier ?? null, has3d: last.s.count > 0 });
  }
  await chromium.browser.close();
  const label = software ? 'software rendering (SwiftShader), bukan GPU' : `GPU: ${gpu ?? 'tidak diketahui'}`;
  console.log(`\nPerforma per scene · Chromium · quality ${QUALITY} · ${label}\n`);
  console.log('| Scene | fps* | Draw calls | Triangles | Geometries | Textures | Pixel ratio | Bloom | Tier |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) console.log(r.has3d
    ? `| ${r.scene} | ${r.fps?.toFixed(1) ?? '–'} | ${r.calls} | ${r.triangles} | ${r.geometries} | ${r.textures} | ${r.pixelRatio} | ${r.bloom ? 'on' : 'off'} | ${r.tier ?? '–'} |`
    : `| ${r.scene} | ${r.fps?.toFixed(1) ?? '–'} | – (tanpa 3D) | – | – | – | – | – | – |`);
  console.log(`\n* fps: ${label}.`);
} finally {
  srv.stop();
}
