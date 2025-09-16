import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

// https://vitejs.dev/guide/build.html#library-mode
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'PixianiCore',
      fileName: 'index',
    },
    rollupOptions: {
      external: [
        'pixi.js',
        '@pixi-animation-library/pixiani-engine',
        '@pixi-animation-library/pixiani-anis',
      ],
      output: {
        globals: {
          'pixi.js': 'PIXI',
          '@pixi-animation-library/pixiani-engine': 'PixianiEngine',
          '@pixi-animation-library/pixiani-anis': 'PixianiAnis',
        },
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
  plugins: [
    dts({
      outDir: 'dist',
      entryRoot: 'src',
    }),
  ],
});
