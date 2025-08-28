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
      name: 'PixiAnim',
      // The base name for the output files.
      fileName: 'pixi-animation-library',
    },
    // Configure Rollup options for more control over the build.
    rollupOptions: {
      // Externalize dependencies that should not be bundled with the library.
      // 'pixi.js' should be a peer dependency for any project using this library.
      external: ['pixi.js'],
      output: {
        // Provide global variable names for externalized dependencies in the UMD build.
        globals: {
          'pixi.js': 'PIXI',
        },
      },
    },
    // Specify the output directory for the built library.
    outDir: 'dist/lib',
    // Clear the output directory before building.
    emptyOutDir: true,
  },
  // Use the dts plugin to generate TypeScript declaration files.
  plugins: [
    dts({
      // The output directory for the declaration files.
      outDir: 'dist/lib/types',
      // The root directory of the source files to include in the declaration.
      entryRoot: 'src',
    }),
  ],
});
