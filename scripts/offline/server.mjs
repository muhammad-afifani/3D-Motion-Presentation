#!/usr/bin/env node
/**
 * server.mjs — server statis kecil untuk paket presentasi offline (Node ≥ 18, TANPA dependensi).
 * Menyajikan folder app/ di http://localhost:<port>/ dengan MIME type eksplisit (ES module dan Web Worker
 * gagal bila .js disajikan sebagai text/plain). File yang tidak ada → 404 (bukan index.html palsu).
 *
 *   node server.mjs            → port 8080 (pindah ke port berikutnya bila terpakai)
 *   node server.mjs --open     → sekaligus membuka browser
 *   node server.mjs --port 9000 --root app
 */
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { resolve, join, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

export const MIME = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
});

/** Server statis untuk folder `root`. @returns {import('node:http').Server} */
export function createStaticServer(root) {
  const base = resolve(root);
  return createServer((req, res) => {
    let path;
    try { path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname); } catch { path = null; }
    const send = (code, text) => { res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(text); };
    if (path == null || path.includes('\0')) return send(400, 'Bad request');
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, 'Method not allowed');
    let file = resolve(join(base, path));
    if (file !== base && !file.startsWith(base + sep)) return send(403, 'Forbidden');
    let st = null;
    try { st = statSync(file); } catch { /* tidak ada */ }
    if (st?.isDirectory()) { file = join(file, 'index.html'); try { st = statSync(file); } catch { st = null; } }
    if (!st?.isFile()) return send(404, `Not found: ${path}`);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-store', // content/*.json bisa diedit lalu reload
    });
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).pipe(res);
  });
}

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try { spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).unref(); } catch { /* buka manual */ }
}

async function main() {
  const args = process.argv.slice(2);
  const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const root = resolve(fileURLToPath(new URL('.', import.meta.url)), arg('--root', 'app'));
  let port = Number(arg('--port', 8080));
  for (let i = 0; i < 20; i++, port++) {
    const srv = createStaticServer(root);
    const ok = await new Promise((r) => { srv.once('error', () => r(false)); srv.listen(port, '127.0.0.1', () => r(true)); });
    if (!ok) continue;
    const url = `http://localhost:${port}/`;
    console.log(`Server presentasi berjalan: ${url}`);
    console.log('Biarkan jendela ini terbuka selama presentasi. Tekan Ctrl+C untuk berhenti.');
    if (args.includes('--open')) openBrowser(url);
    return;
  }
  console.error('Tidak menemukan port kosong (8080–8099).');
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
