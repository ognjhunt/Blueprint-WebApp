import { defineConfig } from "@playwright/test";
import path from "node:path";
const port = 42879;
// A second, fake-signed-in frontend: footage waits for a saved job (owner
// decision 2026-10-18), so the start form sends a video only for a signed-in
// site account, and the transport cases run there.
const sitePort = 42880;
const output = path.resolve(process.env.RELIABILITY_INTAKE_OUTPUT || "output/reliability-program/intake/browser");
export default defineConfig({
  testDir: "./e2e", testMatch: "reliability-program-intake.spec.ts", workers: 1, fullyParallel: false,
  retries: 0, timeout: 45000, expect: { timeout: 12000 }, outputDir: output,
  reporter: [["list"], ["json", { outputFile: path.join(output, "results.json") }]],
  use: { baseURL: `http://127.0.0.1:${port}`, trace: "on",
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { launchOptions: {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}} : {}) },
  webServer: [{
    // Frontend only, no dotenv files (existing result-consumer Vite config),
    // no inherited provider credentials; every API is intercepted by the spec.
    command: `env -i PATH="$PATH" HOME="$HOME" RESULT_CONSUMER_QA_OUTPUT="${output}" VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH=0 node node_modules/vite/bin/vite.js --config vite.result-consumer.config.ts --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`, reuseExistingServer: false, timeout: 90000,
  }, {
    // The same frontend with the dev-only operator QA account signed in. Still
    // no credentials: the account is local, and every API is intercepted.
    // Its own output, so the two dev servers never share a Vite cache.
    command: `env -i PATH="$PATH" HOME="$HOME" RESULT_CONSUMER_QA_OUTPUT="${output}/site-account" VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH=1 node node_modules/vite/bin/vite.js --config vite.result-consumer.config.ts --host 127.0.0.1 --port ${sitePort} --strictPort`,
    url: `http://127.0.0.1:${sitePort}`, reuseExistingServer: false, timeout: 90000,
  }],
});
