import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
/** The site's answer, end to end: real handlers, Firebase emulators, a scripted video model. */
export default defineConfig({
  ...base,
  testMatch: "site-answer-journey.spec.ts",
  testIgnore: [],
  // One server, one emulator project: the journeys share it in turn.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  webServer: {
    command: "node scripts/qa/answer-journey-local-app.mjs",
    url: "http://127.0.0.1:4183/api/reliability/health",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  use: { ...base.use, baseURL: "http://127.0.0.1:4183" },
});
