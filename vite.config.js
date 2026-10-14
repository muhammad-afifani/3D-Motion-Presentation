import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { defineConfig } from 'vite';

/**
 * Konten presenter (content/*.json, Scene 10–11): disajikan apa adanya saat `npm run dev` dan disalin ke
 * dist/content/ saat build, sehingga bisa diedit di dist/ tanpa build ulang. Fallback bawaan di-import dari
 * file yang sama (src/state/content.js).
 */
export function contentPlugin(dir = resolve(process.cwd(), 'content')) {
  const files = () => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : []);
  return {
    name: 'presenter-content',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = req.url?.match(/\/content\/([\w.-]+\.json)(?:\?.*)?$/);
        const f = m && join(dir, m[1]);
        if (!f || !existsSync(f)) return next();
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(readFileSync(f));
      });
    },
    generateBundle() {
      for (const f of files()) this.emitFile({ type: 'asset', fileName: `content/${f}`, source: readFileSync(join(dir, f), 'utf8') });
    },
  };
}

/**
 * Nama repo GitHub untuk base path GitHub Pages (https://<owner>.github.io/<repo>/).
 * CI: GITHUB_REPOSITORY = "owner/repo". Lokal: dibaca dari `git remote get-url origin`.
 */
function repoName() {
  const gh = process.env.GITHUB_REPOSITORY;
  if (gh) return gh.split('/')[1];
  try {
    const url = execSync('git remote get-url origin', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return url.match(/[/:]([^/]+?)(?:\.git)?\/?$/)?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Base path:
 *   - `npm run dev`                  → '/'
 *   - `npm run build` / `preview`    → '/<repo>/' (GitHub Pages)
 *   - mode offline (build:offline / preview:offline) → './' (relatif; disajikan server statis lokal di root)
 */
export default defineConfig(({ command, mode, isPreview }) => {
  let base = '/';
  if (command === 'build' || isPreview) {
    const repo = repoName();
    base = mode === 'offline' || !repo ? './' : `/${repo}/`;
  }
  return {
    base,
    plugins: [contentPlugin()],
    build: {
      target: 'es2020',
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: { manualChunks: (id) => (id.includes('node_modules/three') ? 'three' : undefined) },
      },
    },
    worker: { format: 'es' },
    test: {
      include: ['tests/**/*.test.js'],
      environment: 'node',
    },
  };
});
