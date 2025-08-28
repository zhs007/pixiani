// ESLint Flat config (ESLint 9+)
// Modern setup with TypeScript, React, a11y, hooks, unused-imports, vitest, and proper globals
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import unusedImports from 'eslint-plugin-unused-imports';
import vitest from 'eslint-plugin-vitest';
import globals from 'globals';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '.sessions/**'],
  },
  js.configs.recommended,
  {
    files: [
      'src/**/*.{ts,tsx,js,jsx}',
      'tests/**/*.{ts,tsx,js,jsx}',
      'editor/**/*.{ts,tsx,js,jsx}',
      'demo/**/*.{ts,tsx,js,jsx}',
      '*.config.ts',
      'vite.*.config.ts',
    ],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.es2021 },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      'unused-imports': unusedImports,
      vitest,
    },
    rules: {
  'no-console': ['error', { allow: ['warn', 'error'] }],
      'prefer-const': 'warn',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
  'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' },
      ],
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
    settings: { react: { version: 'detect' } },
  },
  {
    files: ['src/**/*.{ts,tsx}', 'editor/web/**/*.{ts,tsx,js,jsx}', 'demo/**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      globals: { ...globals.browser, ResizeObserver: 'readonly' },
    },
    rules: {
      'no-undef': 'off',
  'unused-imports/no-unused-imports': 'error',
  'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: [
      '**/*.config.ts',
      'vite.lib.config.ts',
      'editor/vite.config.ts',
      'demo/vite.config.ts',
      'editor/server.ts',
    ],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'no-undef': 'off',
  'unused-imports/no-unused-imports': 'error',
  'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly',
        console: 'readonly',
      },
    },
    rules: { 'no-undef': 'off' },
  },
];
