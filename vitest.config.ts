import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      'pixi-animation-library': resolve(__dirname, './src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    // Inline pixi.js so it is transformed for the test environment
    deps: {
      inline: ['pixi.js'],
    },
    // Global setup for tests; will conditionally mock pixi.js only for session runs
    setupFiles: ['tests/setup/staging-mock-pixi.ts'],
    include: ['tests/**/*.test.ts', '.sessions/**/tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
      include: ['src/**/*.ts'],
      exclude: [
        'src/core/types.ts',
        '**/tests/**',
        '**/*.config.ts',
        '**/node_modules/**',
        '**/dist/**',
      ],
    },
  },
});
