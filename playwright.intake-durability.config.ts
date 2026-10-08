import { defineConfig } from "@playwright/test";
import path from "node:path";
const output = path.resolve(process.env.RELIABILITY_DURABILITY_OUTPUT || "output/reliability-program/intake-durability");
export default defineConfig({
    testDir: "./e2e", testMatch: "site-intake-durability.spec.ts", testIgnore: [],
    timeout: 90000, workers: 1, retries: 0, expect: { timeout: 12000 }, outputDir: path.join(output, "playwright"),
    reporter: [["line"], ["json", { outputFile: path.join(output, "results.json") }]],
    use: { baseURL: "http://127.0.0.1:4181", trace: "off", ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } } : {}) },
    // Own this port for the run. Start Firestore8080/Storage9199 separately with unique TMPDIR.
    // The launcher strips live credentials, binds loopback, and disables provider/mail dispatch.
    webServer: { command: "node scripts/qa/reliability-local-app.mjs", url: "http://127.0.0.1:4181/api/reliability/health", reuseExistingServer: false, timeout: 120000 },
});
