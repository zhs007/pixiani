import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    // Set the root to the 'demo' directory.
    // This means Vite's dev server will serve `demo/index.html` as the entry point.
    root: 'demo',

    // Make the project's root `assets` directory available at the `/` URL path.
    // So, an image at `assets/sprite/sprite1.png` can be accessed via `/sprite/sprite1.png` in the browser.
    publicDir: '../assets',

    // Configure path aliases for cleaner imports in the demo code.
    resolve: {
        alias: {
            // Allows us to do `import { ... } from 'pixi-animation-library'`
            'pixi-animation-library': resolve(__dirname, 'src/index.ts'),
        }
    },

    // Configure the build process.
    build: {
        // Output the built demo files to `dist/demo` at the project root.
        outDir: '../dist/demo',
        // Empty the output directory before building.
        emptyOutDir: true,
    },

    // Vitest configuration is now part of the main Vite config.
    // Note: The paths here are relative to the project root, not the `vite.config.ts` file's location.
    test: {
        environment: 'jsdom',
        // Look for test files in the root `tests` directory.
        include: ['tests/**/*.test.ts'],
        // Test coverage configuration.
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            // Enforce coverage thresholds.
            thresholds: {
                lines: 90,
                functions: 90,
                branches: 90,
                statements: 90,
            },
            // Include all source files for an accurate coverage report.
            include: ['src/**/*.ts'],
            // Exclude files that don't need to be covered.
            exclude: [
                'src/core/types.ts',
                '**/tests/**',
                '**/*.config.ts',
                '**/node_modules/**',
                '**/dist/**'
            ],
        },
    },
});
