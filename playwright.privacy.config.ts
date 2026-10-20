import { defineConfig } from "@playwright/test";

// Loopback frontend only. Specs mock APIs; no Firebase/backend or provider jobs.
export default defineConfig({
  testDir: "./e2e",
  testMatch: ["account-deletion.spec.ts", "cookie-consent.spec.ts", "privacy-pages.spec.ts"],
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  outputDir: "output/qa/privacy",
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5197",
    trace: "retain-on-failure",
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } }
      : {}),
  },
  webServer: {
    command: "BLUEPRINT_E2E=1 VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH=1 VITE_ENABLE_ANALYTICS=1 VITE_GA_MEASUREMENT_ID=G-PRIVACYAUDIT npx vite --host 127.0.0.1 --port 5197 --strictPort",
    url: "http://127.0.0.1:5197",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
