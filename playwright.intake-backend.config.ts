import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testMatch: "site-intake-backend-reliability.spec.ts",
  testIgnore: [],
  webServer: {
    command: "node scripts/qa/reliability-local-app.mjs",
    url: "http://127.0.0.1:4181/api/reliability/health",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  use: { ...base.use, baseURL: "http://127.0.0.1:4181" },
});
