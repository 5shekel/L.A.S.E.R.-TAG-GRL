import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  // Use repository name for GitHub Pages, or './' for local/other hosting
  base: process.env.GITHUB_PAGES ? '/L.A.S.E.R.-TAG-GRL/' : './',
  server: {
    port: 3000,
    open: true,
    // Required for camera access on localhost
    https: false,
    host: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false  // Smaller builds for production
  },
  optimizeDeps: {
    include: ['tweakpane', '@tweakpane/plugin-essentials', 'gl-matrix']
  }
});
