import { defineConfig, searchForWorkspaceRoot } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import fastifyVite from '@fastify/vite/plugin';

export default defineConfig({
  // Editor client root (contains index.html)
  root: resolve(__dirname, 'web'),

  server: {
    fs: {
      // Allow reading files from the workspace root so we can access
      // editor/sessions and project assets during dev
      allow: [
        searchForWorkspaceRoot(process.cwd()),
        // Also allow the out-of-tree sessions folder
        resolve(__dirname, '../../.sessions'),
      ],
    },
  },

  // Expose project assets folder
  publicDir: resolve(__dirname, '../../assets'),

  plugins: [
    react(),
    // Bridge Vite to Fastify via @fastify/vite
    fastifyVite({
      spa: true,
      clientModule: '/main.tsx',
    }),
  ],

  resolve: {
    alias: {
      // Map package names to source during dev so session-generated animations can import them
      '@pixi-animation-library/pixiani-engine': resolve(__dirname, '../../packages/pixiani-engine/src'),
      '@pixi-animation-library/pixiani-anis': resolve(__dirname, '../../packages/pixiani-anis/src'),
    },
  },

  optimizeDeps: {
    exclude: [],
  },

  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
});
