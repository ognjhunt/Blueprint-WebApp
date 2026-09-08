import { defineConfig } from "@playwright/test";
import path from "node:path";

const port = Number(process.env.RESULT_CONSUMER_QA_PORT || 42873);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid local result-consumer QA port");
const output = path.resolve(process.env.RESULT_CONSUMER_QA_OUTPUT || "output/qa/result-consumer");
const baseURL = `http://127.0.0.1:${port}`;
// The dedicated configuration is explicitly local and all API calls are fixtures.
process.env.VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH = "1";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "policy-canary-result-ux.spec.ts",
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  outputDir: path.join(output, "browser"),
  reporter: [["list"], ["json", { outputFile: path.join(output, "playwright-results.json") }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } } : {}),
  },
  webServer: {
    command: "node scripts/qa/start-result-consumer-vite.mjs",
    env: { RESULT_CONSUMER_QA_PORT: String(port), RESULT_CONSUMER_QA_OUTPUT: output },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
