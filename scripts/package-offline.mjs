/**
 * package-offline.mjs — paket presentasi offline: release/app (build base './') + server Node/Python/PowerShell
 * + start.bat/start.sh + BACA-SAYA.txt. Jalankan: npm run package:offline   (opsi: --out <folder>)
 */
import { build } from 'vite';
import { cpSync, mkdirSync, rmSync, chmodSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const outArg = process.argv.indexOf('--out');
const OUT = resolve(outArg >= 0 ? process.argv[outArg + 1] : join(ROOT, 'release'));
export const RELEASE_FILES = ['server.mjs', 'server.py', 'start.ps1', 'start.bat', 'start.sh', 'BACA-SAYA.txt'];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
await build({ root: ROOT, mode: 'offline', logLevel: 'warn', build: { outDir: join(OUT, 'app'), emptyOutDir: true } });
for (const f of RELEASE_FILES) cpSync(join(ROOT, 'scripts', 'offline', f), join(OUT, f));
for (const f of ['start.sh', 'server.mjs', 'server.py']) chmodSync(join(OUT, f), 0o755);
console.log(`Paket offline siap: ${OUT}`);
console.log(`Isi: ${readdirSync(OUT).join(', ')}`);
console.log('Coba: cd release && node server.mjs --open   (lihat release/BACA-SAYA.txt)');
