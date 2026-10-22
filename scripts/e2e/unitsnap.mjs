/**
 * unitsnap.mjs — snapshot teks per scene (lihat unitsnapLib.mjs) untuk membuktikan bahwa preset SI tidak mengubah apa pun.
 *   node scripts/e2e/unitsnap.mjs <keluaran.json>                  tulis snapshot (setelah `vite build`)
 *   node scripts/e2e/unitsnap.mjs --compare <golden.json> [--flag]  bandingkan; --flag = bendera UNITS_UI menyala dengan preset SI
 *   node scripts/e2e/unitsnap.mjs <keluaran.json> --units '<json etel:units>'   dump dengan pilihan satuan (tanpa banding)
 * Golden: tests/snapshots/units_si_text.json (dibuat dari main SEBELUM U2). npm run e2e:unitsnap membandingkannya.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadPlaywright, startPreview, launchers } from './lib.mjs';
import { snapshotAll, diffSnapshots } from './unitsnapLib.mjs';

const args = process.argv.slice(2);
const compare = args.includes('--compare') ? args[args.indexOf('--compare') + 1] : null;
const flag = args.includes('--flag');
const choice = args.includes('--units') ? args[args.indexOf('--units') + 1] : null;
const outPath = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--compare' && args[i - 1] !== '--units') ?? null;

const pw = await loadPlaywright();
const srv = await startPreview(Number(process.env.E2E_PORT ?? 4192));
const bs = await launchers(pw);
const browser = bs.find((x) => x.name === 'chromium' && x.browser).browser;
let snap = {};
try {
  snap = await snapshotAll(browser, srv.url.replace(/[?#].*$/, ''), { flag, choice });
} finally { srv.stop(); await browser.close(); }
const errKeys = Object.keys(snap).filter((k) => k.startsWith('errors|'));
if (errKeys.length) console.log('galat halaman:', errKeys.map((k) => `${k}: ${snap[k].join(' | ')}`).join(' ; '));
for (const k of errKeys) delete snap[k];
if (outPath) { mkdirSync(dirname(outPath), { recursive: true }); writeFileSync(outPath, `${JSON.stringify(snap, null, 1)}\n`); console.log(`snapshot: ${Object.keys(snap).length} keadaan → ${outPath}`); }
if (compare) {
  const diffs = diffSnapshots(JSON.parse(readFileSync(compare, 'utf8')), snap);
  if (diffs.length) { console.log(`BEDA (${diffs.length}):`); for (const d of diffs.slice(0, 60)) console.log(`  - ${d}`); process.exit(1); }
  console.log(`IDENTIK dengan golden: ${Object.keys(snap).length} keadaan${flag ? ' (bendera UNITS_UI menyala, preset SI)' : ''}`);
}
