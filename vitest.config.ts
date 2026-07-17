/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

const __dirname = import.meta.dirname;

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: "./client/tests/setup.ts",
    css: true,
    // WEB-03: the core-flow integration tests (inbound-request, pipeline-routes,
    // headless-hosted-session-smoke) do real per-request crypto + field-encryption +
    // growth-event I/O. Each passes in ~14-35s in isolation, but under parallel CPU
    // contention they crossed the old 60s cap and reddened CI (documented since
    // ~2026-06-25). Give them headroom so contention-induced slowness no longer
    // trips a spurious timeout. Deeper follow-up: mock the heavy per-request crypto.
    testTimeout: 120000,
    hookTimeout: 120000,
    include: [
      "client/tests/**/*.{test,spec}.{ts,tsx,js,jsx}",
      "client/src/lib/**/*.{test,spec}.{ts,tsx,js,jsx}",
      "server/tests/**/*.{test,spec}.{ts,tsx,js,jsx}",
      "scripts/**/*.{test,spec}.{ts,tsx,js,jsx}",
      "ops/paperclip/plugins/blueprint-automation/src/**/*.{test,spec}.{ts,tsx,js,jsx}",
    ],
    exclude: [
      "e2e/**",
      "node_modules/**",
      "dist/**",
      "paperclip-desktop/**",
      ".claude/**",
      ".worktrees/**",
      "coverage/**",
      "test-results/**",
      // Firebase rules emulator suite: needs live emulators, runs via
      // `npm run test:rules` (vitest.rules.config.ts), not the default lane.
      "tests/rules/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
      exclude: [
        "e2e/**",
        "node_modules/**",
        "dist/**",
        "paperclip-desktop/**",
        ".claude/**",
        ".worktrees/**",
        "coverage/**",
        "test-results/**",
        "tests/rules/**",
        "scripts/launch-preflight.mjs",
        "scripts/launch-smoke.mjs",
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
});
