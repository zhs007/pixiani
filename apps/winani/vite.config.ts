import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  root: '.',
  server: {
    open: true,
    port: 5175,
    fs: {
      allow: [workspaceRoot],
    },
  },
  preview: {
    port: 4175,
  },
});
