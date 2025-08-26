import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Demo client root (contains index.html)
  root: resolve(__dirname),

  // Expose project assets
  publicDir: resolve(__dirname, '../assets'),

  resolve: {
    alias: {
      'pixi-animation-library': resolve(__dirname, '../src/index.ts'),
    },
  },

  build: {
    outDir: resolve(__dirname, '../dist/demo'),
    emptyOutDir: true,
  },
});
