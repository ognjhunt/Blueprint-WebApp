import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:42973";
const output = process.env.DESCRIPTION_INTAKE_QA_OUTPUT || "/tmp/blueprint-description-intake-qa";
export default defineConfig({
  testDir: "./e2e", testMatch: ["description-first-intake.spec.ts", "contact.spec.ts", "onboarding-p1.spec.ts"], workers: 1,
  outputDir: `${output}/browser`, reporter: "list",
  use: { baseURL, serviceWorkers: "block", trace: "retain-on-failure",
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } } : {}),
  },
  // Existing isolated Vite config reads no repo dotenv and serves no backend.
  webServer: { command: "npx vite --config vite.result-consumer.config.ts --host 127.0.0.1 --port 42973 --strictPort",
    env: { RESULT_CONSUMER_QA_OUTPUT: output, VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH: "0" },
    url: baseURL, reuseExistingServer: false, timeout: 60_000 },
});
