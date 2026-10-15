/**
 * lib.mjs — utilitas skrip e2e (Playwright). Playwright BUKAN dependensi proyek: dipakai bila terpasang
 * (lokal `npm i --no-save playwright` atau global). Server: `vite preview` pada build yang sudah ada (dist/).
 */
import { spawn, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function loadPlaywright() {
  const tries = [];
  if (process.env.PLAYWRIGHT_MODULE) tries.push(process.env.PLAYWRIGHT_MODULE);
  tries.push('playwright');
  try { tries.push(pathToFileURL(join(execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(), 'playwright', 'index.mjs')).href); } catch { /* tanpa npm global */ }
  for (const t of tries) {
    try { return await import(t); } catch { /* coba berikutnya */ }
  }
  throw new Error('Playwright tidak ditemukan. Pasang dulu: npm i --no-save playwright && npx playwright install chromium (atau set PLAYWRIGHT_MODULE).');
}

/** Jalankan `vite preview` (base Pages) dan tunggu siap. @returns {{url:string, stop:()=>void}} */
export async function startPreview(port = 4179) {
  if (!existsSync('dist/index.html')) throw new Error('dist/ belum ada: jalankan npm run build dulu.');
  const proc = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let base = null;
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('vite preview tidak siap')), 20000);
    proc.stdout.on('data', (b) => {
      const m = String(b).replace(/\x1b\[[0-9;]*m/g, '').match(/Local:\s+(http:\/\/\S+)/);
      if (m) { base = m[1]; clearTimeout(t); res(); }
    });
    proc.on('exit', (c) => rej(new Error(`vite preview keluar (${c})`)));
  });
  return { url: base, stop: () => proc.kill() };
}

/** Peluncur browser yang tersedia. Chromium memakai SwiftShader bila tanpa GPU (rendering software). */
export async function launchers(pw) {
  const list = [];
  for (const name of ['chromium', 'firefox', 'webkit']) {
    const type = pw[name];
    try {
      const b = await type.launch(name === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
      list.push({ name, browser: b });
    } catch (err) {
      list.push({ name, browser: null, error: String(err.message ?? err).split('\n')[0] });
    }
  }
  return list;
}

/** Instrumentasi halaman (sebelum skrip aplikasi): listener window/document, ResizeObserver, Worker, konteks WebGL. */
export function instrument() {
  const L = new Map();
  const key = (t) => (t === window ? 'window' : t === document ? 'document' : null);
  const add = EventTarget.prototype.addEventListener, rem = EventTarget.prototype.removeEventListener;
  const id = (type, fn, opt) => `${type}|${typeof opt === 'boolean' ? opt : !!opt?.capture}`;
  EventTarget.prototype.addEventListener = function (type, fn, opt) {
    const k = key(this);
    if (k && fn) { const m = L.get(k) ?? L.set(k, new Map()).get(k); const s = m.get(id(type, fn, opt)) ?? m.set(id(type, fn, opt), new Set()).get(id(type, fn, opt)); s.add(fn); }
    return add.call(this, type, fn, opt);
  };
  EventTarget.prototype.removeEventListener = function (type, fn, opt) {
    const k = key(this);
    if (k) L.get(k)?.get(id(type, fn, opt))?.delete(fn);
    return rem.call(this, type, fn, opt);
  };
  let ro = 0, workers = 0;
  const ctxs = [];   // konteks WebGL yang dibuat (aktif = belum isContextLost)
  const RO = window.ResizeObserver;
  window.ResizeObserver = class extends RO {
    constructor(cb) { super(cb); this._n = new Set(); }
    observe(el, o) { if (!this._n.has(el)) { this._n.add(el); ro++; } return super.observe(el, o); }
    unobserve(el) { if (this._n.delete(el)) ro--; return super.unobserve(el); }
    disconnect() { ro -= this._n.size; this._n.clear(); return super.disconnect(); }
  };
  const W = window.Worker;
  window.Worker = class extends W { constructor(...a) { super(...a); workers++; } terminate() { workers--; return super.terminate(); } };
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...a) {
    const had = this._etelCtx;
    const c = gc.call(this, type, ...a);
    if (c && !had && /webgl/.test(type)) { this._etelCtx = true; ctxs.push(c); }
    return c;
  };
  window.__etelProbe = () => {
    let listeners = 0;
    for (const m of L.values()) for (const s of m.values()) listeners += s.size;
    return { listeners, resizeObservers: ro, workers, webglActive: ctxs.filter((c) => !c.isContextLost()).length, webglCreated: ctxs.length };
  };
}

/** Pindah ke scene n lewat kait debug dan tunggu sampai terpasang. */
export async function goScene(page, n, settleMs = 600) {
  await page.evaluate((x) => window.__etelDebug.goToScene(x), n);
  await page.waitForFunction((x) => window.__etelDebug.scene() === x && !window.__etelDebug.loading(), n, { timeout: 30000 });
  await page.waitForTimeout(settleMs);
}
