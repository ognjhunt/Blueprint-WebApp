import { defineConfig } from "vitest/config";

// Opt-in heavy tier: intentionally outside the ordinary Vitest include paths.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/reliability/capture-outbox-recovery-soak.test.ts"],
    pool: "forks",
    poolOptions: { forks: { execArgv: ["--expose-gc"] } },
    maxWorkers: 1,
    minWorkers: 1,
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 10_000,
  },
});
