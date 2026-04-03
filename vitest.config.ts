/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

const __dirname = import.meta.dirname;

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './client/tests/setup.ts',
    css: true,
    testTimeout: 60000,
    hookTimeout: 60000,
    include: [
      'client/tests/**/*.{test,spec}.{ts,tsx,js,jsx}',
      'server/tests/**/*.{test,spec}.{ts,tsx,js,jsx}',
      'scripts/**/*.{test,spec}.{ts,tsx,js,jsx}',
      'ops/paperclip/plugins/blueprint-automation/src/**/*.{test,spec}.{ts,tsx,js,jsx}',
    ],
    exclude: [
      'e2e/**',
      'node_modules/**',
      'dist/**',
      '.claude/**',
      '.worktrees/**',
      'coverage/**',
      'test-results/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'e2e/**',
        'node_modules/**',
        'dist/**',
        '.claude/**',
        '.worktrees/**',
        'coverage/**',
        'test-results/**',
        'scripts/launch-preflight.mjs',
        'scripts/launch-smoke.mjs',
      ],
      thresholds: {
        lines: 25.5,
        functions: 35,
        statements: 25.5,
        branches: 50,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
    },
  },
})
