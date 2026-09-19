import { defineConfig } from "@playwright/test";
const port = 42931;
export default defineConfig({
  testDir: "./e2e", testMatch: "onboarding-p1.spec.ts", workers: 1,
  timeout: 60_000, expect: { timeout: 15_000 },
  outputDir: "output/qa/onboarding-p1/browser", reporter: [["list"]],
  use: { baseURL: `http://127.0.0.1:${port}`, trace: "retain-on-failure" },
  webServer: { command: "node scripts/qa/start-result-consumer-vite.mjs",
    env: { RESULT_CONSUMER_QA_PORT: String(port), RESULT_CONSUMER_QA_OUTPUT: "output/qa/onboarding-p1" },
    url: `http://127.0.0.1:${port}`, reuseExistingServer: false, timeout: 60_000 },
});
