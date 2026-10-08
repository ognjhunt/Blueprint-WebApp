import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({ resolve: { alias: { "@": path.join(import.meta.dirname, "client/src") } }, test: { environment: "node", include: [process.env.RELIABILITY_WORKER_ONLY === "1" ? "server/tests/reliability-program-worker-resume.browser.ts" : "server/tests/reliability-program-journeys.browser.ts"],
  testTimeout: 90_000, hookTimeout: 120_000, maxWorkers: 1, minWorkers: 1 } });
