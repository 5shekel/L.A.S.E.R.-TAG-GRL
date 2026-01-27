import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  // Custom domain uses root path, fallback to relative for local dev
  base: process.env.GITHUB_PAGES ? '/' : './',
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
