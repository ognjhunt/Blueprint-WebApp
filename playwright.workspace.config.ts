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
  use: {
    baseURL: "http://127.0.0.1:5191",
    trace: "retain-on-failure",
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } }
      : {}),
  },
  webServer: {
    command:
      "npx vite preview --host 127.0.0.1 --port 5191 --strictPort --outDir ../dist/e2e-auth-public",
    url: "http://127.0.0.1:5191",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
