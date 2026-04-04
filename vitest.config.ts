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
    include: [
      'client/tests/**/*.{test,spec}.{ts,tsx,js,jsx}',
      'server/tests/**/*.{test,spec}.{ts,tsx,js,jsx}',
    ],
    // Keep Vitest focused on repo-owned app suites. The Paperclip workspace
    // mounts skill checkouts under `.agents`, which can contain their own test
    // trees and nested node_modules that are unrelated to Blueprint-WebApp.
    exclude: ['**/e2e/**', '**/dist/**', '**/.claude/**', '**/.agents/**', '**/node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        '**/e2e/**',
        '**/dist/**',
        '**/.claude/**',
        '**/.agents/**',
        '**/node_modules/**',
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
