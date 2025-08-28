import { defineConfig, searchForWorkspaceRoot } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import fastifyVite from '@fastify/vite/plugin';

export default defineConfig({
  // Editor client root (contains index.html)
  root: resolve(__dirname, 'web'),

  server: {
    middlewareMode: true,
    fs: {
      // Allow reading files from the workspace root so we can access
      // editor/sessions and project assets during dev
      allow: [
        searchForWorkspaceRoot(process.cwd()),
        // Also allow the out-of-tree sessions folder
        resolve(__dirname, '../.sessions'),
      ],
    },
  },

  // Expose project assets folder
  publicDir: resolve(__dirname, '../assets'),

  resolve: {
    alias: {
      // Allow importing the library directly from source in dev
      'pixi-animation-library': resolve(__dirname, '../src/index.ts'),
    },
  },

  plugins: [fastifyVite() as any, react()],

  build: {
    outDir: resolve(__dirname, '../dist/editor'),
    emptyOutDir: true,
  },
});
