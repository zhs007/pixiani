import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Expose project assets
  publicDir: resolve(__dirname, '../../assets'),

  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
