import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // Ensure tests in sessions resolve the workspace core pkg consistently
      '@pixi-animation-library/pixiani-core': resolve(
        __dirname,
        './packages/pixiani-core/src/index.ts',
      ),
    },
  },
  test: {
    environment: 'node',
    // Discover both repo tests and session-staged tests
    include: [
      '**/tests/**/*.test.ts',
      '**/tests/**/*.spec.ts',
      '.sessions/**/tests/**/*.test.ts',
      '.sessions/**/tests/**/*.spec.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
    ],
    // Inline pixi for transformation when needed by session tests
    deps: {
      inline: ['pixi.js'],
    },
    // Use setup from core package if present; optional in sessions
    setupFiles: [
      resolve(__dirname, './packages/pixiani-core/tests/setup/staging-mock-pixi.ts'),
    ],
  },
});
