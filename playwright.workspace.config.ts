import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: ["workspace-design.spec.ts", "workspace-account-setup.spec.ts"],
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 15000 },
  outputDir: "output/qa/workspaces",
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:5191", trace: "retain-on-failure" },
  webServer: {
    command:
      "VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH=1 npx vite --host 127.0.0.1 --port 5191 --strictPort",
    url: "http://127.0.0.1:5191",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
