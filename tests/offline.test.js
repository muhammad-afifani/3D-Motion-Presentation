// Paket offline (M8b): server Node/Python dengan MIME eksplisit + 404 jujur, skrip start, BACA-SAYA, package:offline.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync, execSync } from 'node:child_process';
import { createStaticServer, MIME } from '../scripts/offline/server.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const OFF = join(ROOT, 'scripts', 'offline');
const FILES = { 'index.html': '<!doctype html><html></html>', 'assets/a.js': 'export {}', 'assets/w.mjs': 'export {}', 'content/x.json': '{}', 'assets/s.css': 'a{}', 'assets/i.svg': '<svg/>', 'assets/p.png': 'x', 'assets/f.woff2': 'x' };
const EXPECT = { 'index.html': 'text/html', 'assets/a.js': 'text/javascript', 'assets/w.mjs': 'text/javascript', 'content/x.json': 'application/json', 'assets/s.css': 'text/css', 'assets/i.svg': 'image/svg+xml', 'assets/p.png': 'image/png', 'assets/f.woff2': 'font/woff2' };

function makeApp(dir) {
  for (const [f, body] of Object.entries(FILES)) { mkdirSync(join(dir, f, '..'), { recursive: true }); writeFileSync(join(dir, f), body); }
}
async function checkServer(base) {
  for (const [f, type] of Object.entries(EXPECT)) {
    const r = await fetch(`${base}/${f}`);
    expect(r.status, f).toBe(200);
    expect(r.headers.get('content-type'), f).toMatch(new RegExp(`^${type.replace('+', '\\+')}`));
  }
  const root = await fetch(`${base}/`);
  expect(root.headers.get('content-type')).toMatch(/^text\/html/);
  const miss = await fetch(`${base}/assets/nope.js`);
  expect(miss.status).toBe(404);
  expect(await miss.text()).not.toMatch(/<html/i);                // bukan index.html palsu (fallback SPA)
  const missJson = await fetch(`${base}/content/presenter.json`);
  expect(missJson.status).toBe(404);
}

describe('server.mjs (Node, tanpa dependensi)', () => {
  let srv, base, dir;
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'etel-srv-'));
    makeApp(join(dir, 'app'));
    writeFileSync(join(dir, 'secret.txt'), 'rahasia');
    srv = createStaticServer(join(dir, 'app'));
    await new Promise((r) => srv.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${srv.address().port}`;
  });
  afterAll(() => { srv?.close(); rmSync(dir, { recursive: true, force: true }); });
  it('MIME eksplisit (.js/.mjs → text/javascript, .json, .css, .html, .svg, .png, .woff2); 404 tanpa index.html palsu', async () => {
    await checkServer(base);
  });
  it('tidak bisa keluar dari folder app/ (path traversal → 403/404)', async () => {
    const r = await fetch(`${base}/%2e%2e/secret.txt`);
    expect([403, 404]).toContain(r.status);
    expect(await r.text()).not.toMatch(/rahasia/);
  });
  it('tabel MIME lengkap', () => {
    for (const [ext, t] of [['.js', 'text/javascript'], ['.mjs', 'text/javascript'], ['.json', 'application/json'], ['.css', 'text/css'], ['.html', 'text/html'], ['.svg', 'image/svg+xml'], ['.png', 'image/png'], ['.woff2', 'font/woff2']]) expect(MIME[ext]).toMatch(new RegExp(`^${t.replace('+', '\\+')}`));
  });
});

const hasPython = (() => { try { execSync('python3 --version', { stdio: 'ignore' }); return true; } catch { return false; } })();
describe.skipIf(!hasPython)('server.py (cadangan Python)', () => {
  let proc, base, dir;
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'etel-py-'));
    makeApp(join(dir, 'app'));
    cpSync(join(OFF, 'server.py'), join(dir, 'server.py'));
    const port = 18000 + Math.floor(Math.random() * 1000);
    proc = spawn('python3', [join(dir, 'server.py'), '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
    base = await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('server.py tidak siap')), 10000);
      proc.stdout.on('data', (b) => { const m = String(b).match(/http:\/\/localhost:(\d+)\//); if (m) { clearTimeout(t); res(`http://127.0.0.1:${m[1]}`); } });
    });
  }, 15000);
  afterAll(() => { proc?.kill(); rmSync(dir, { recursive: true, force: true }); });
  it('MIME eksplisit dan 404 jujur (bukan server polos)', async () => {
    await checkServer(base);
  });
});

describe('skrip start dan BACA-SAYA.txt', () => {
  const read = (f) => readFileSync(join(OFF, f), 'utf8');
  it('start.ps1: MIME eksplisit, 404, label belum diuji, dijalankan dengan ExecutionPolicy Bypass', () => {
    const s = read('start.ps1');
    for (const m of ["'.js' = 'text/javascript", "'.mjs' = 'text/javascript", "'.json' = 'application/json", "'.css' = 'text/css", "'.html' = 'text/html", "'.svg' = 'image/svg+xml", "'.png' = 'image/png", "'.woff2' = 'font/woff2"]) expect(s).toContain(m);
    expect(s).toMatch(/StatusCode = 404/);
    expect(s).toMatch(/BELUM DIUJI DI LINGKUNGAN PENGEMBANGAN/);
    expect(s).toMatch(/powershell -ExecutionPolicy Bypass -File start\.ps1/);
  });
  it('start.bat: Node → Python → PowerShell; start.sh: Node → Python', () => {
    const b = read('start.bat');
    expect(b.indexOf('node server.mjs --open')).toBeLessThan(b.indexOf('py -3 server.py'));
    expect(b).toMatch(/powershell -ExecutionPolicy Bypass -File "%~dp0start\.ps1"/);
    expect(b).toMatch(/\r\n/);                                         // CRLF untuk cmd.exe
    const sh = read('start.sh');
    expect(sh.indexOf('node server.mjs')).toBeLessThan(sh.indexOf('python3 server.py'));
  });
  it('BACA-SAYA.txt: 3 skenario, cara memastikan server jalan, peringatan uji sebelum hari-H', () => {
    const t = read('BACA-SAYA.txt');
    expect(t).toMatch(/SKENARIO 1 — Laptop punya Node\.js/);
    expect(t).toMatch(/SKENARIO 2 — Laptop punya Python 3/);
    expect(t).toMatch(/SKENARIO 3 — Hanya Windows PowerShell/);
    expect(t).toMatch(/CARA MEMASTIKAN SERVER JALAN/);
    expect(t).toMatch(/Uji paket ini DI LAPTOP PRESENTASI sebelum hari-H/);
    expect(t).toMatch(/file:\/\//);
  });
});

describe('npm run package:offline', () => {
  it('release/: app (base ./, presenter.html, content/*.json) + server + start + BACA-SAYA', () => {
    const out = mkdtempSync(join(tmpdir(), 'etel-rel-'));
    const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'package-offline.mjs'), '--out', out], { cwd: ROOT, encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
    for (const f of ['server.mjs', 'server.py', 'start.ps1', 'start.bat', 'start.sh', 'BACA-SAYA.txt', 'app/index.html', 'app/presenter.html', 'app/content/presenter.json', 'app/content/controls.json', 'app/content/closing.json']) expect(existsSync(join(out, f)), f).toBe(true);
    expect(readFileSync(join(out, 'app/index.html'), 'utf8')).toContain('src="./assets/');
    expect(JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts['package:offline']).toMatch(/package-offline\.mjs/);
    expect(readFileSync(join(ROOT, '.gitignore'), 'utf8')).toMatch(/^release\/$/m);
    rmSync(out, { recursive: true, force: true });
  }, 120000);
});
