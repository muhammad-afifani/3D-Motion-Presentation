import { defineConfig } from 'vite';

// base './' → dist/ bisa dibuka offline dan di-deploy ke subpath GitHub Pages.
export default defineConfig({
  base: './',
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
});
