import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  server: {
    open: true,
    port: 5174,
  },
  preview: {
    port: 4174,
  },
});
