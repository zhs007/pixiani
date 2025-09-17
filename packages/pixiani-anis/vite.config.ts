import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

// https://vitejs.dev/guide/build.html#library-mode
export default defineConfig({
  build: {
    // Configure the library build.
    lib: {
      // The entry point for the library.
      entry: resolve(__dirname, 'src/index.ts'),
      // The name for the UMD global variable.
      name: 'PixianiAnis',
      // The base name for the output files.
      fileName: 'index',
    },
    // Configure Rollup options for more control over the build.
    rollupOptions: {
      // Externalize dependencies that should not be bundled with the library.
      // 'pixi.js' should be a peer dependency for any project using this library.
      external: ['pixi.js', '@pixi-animation-library/pixiani-engine'],
      output: {
        // Provide global variable names for externalized dependencies in the UMD build.
        globals: {
          'pixi.js': 'PIXI',
          '@pixi-animation-library/pixiani-engine': 'PixianiEngine',
        },
      },
    },
    // Specify the output directory for the built library.
    outDir: 'dist',
    // Clear the output directory before building.
    emptyOutDir: true,
  },
  // Use the dts plugin to generate TypeScript declaration files.
  plugins: [
    dts({
      outDir: 'dist',
      entryRoot: 'src',
    }),
  ],
});
