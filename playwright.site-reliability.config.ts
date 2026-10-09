import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["site-private-link-reliability.spec.ts", "site-intake-first.spec.ts"],
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  outputDir: "work/site-reliability/browser",
  reporter: [["list"], ["json", { outputFile: "work/site-reliability/results.json" }]],
  use: {
    baseURL: "http://127.0.0.1:42874",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
      args: ["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"],
    },
  },
  webServer: {
    command: "node scripts/qa/start-site-reliability-vite.mjs",
    url: "http://127.0.0.1:42874",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
