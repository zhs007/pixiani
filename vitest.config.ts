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
