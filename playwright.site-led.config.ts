import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "site-led-public.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  outputDir: "output/site-led-review/browser-results",
  use: { baseURL: "http://127.0.0.1:5188", headless: true, trace: "retain-on-failure" },
  webServer: {
    command: "node_modules/.bin/vite --host 127.0.0.1 --port 5188 --strictPort",
    url: "http://127.0.0.1:5188",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
