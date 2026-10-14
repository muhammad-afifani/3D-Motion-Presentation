import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

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
