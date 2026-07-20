// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * SCALE2-02: automation lanes run in the dedicated Render worker service.
 * These tests pin both halves of the topology change:
 *  - the worker entrypoint boots the scheduler (leader lease included) and
 *    stops it exactly once on shutdown;
 *  - the web process no longer starts the scheduler unless explicitly opted
 *    in, and the deploy manifests actually declare the worker service.
 */

const startOpsAutomationScheduler = vi.hoisted(() => vi.fn());
const validateEnv = vi.hoisted(() => vi.fn(() => ({})));

vi.mock("../utils/opsAutomationScheduler", () => ({ startOpsAutomationScheduler }));
vi.mock("../config/env", () => ({ validateEnv }));
vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  attachRequestMeta: (meta: Record<string, unknown>) => meta,
}));

const repoRoot = join(__dirname, "..", "..");

afterEach(() => {
  vi.clearAllMocks();
});

describe("worker entrypoint", () => {
  it("boots the scheduler through validateEnv and stops it exactly once", async () => {
    const stopScheduler = vi.fn();
    startOpsAutomationScheduler.mockReturnValue(stopScheduler);

    const { startWorker } = await import("../worker");
    const handle = startWorker();

    expect(validateEnv).toHaveBeenCalled();
    expect(startOpsAutomationScheduler).toHaveBeenCalledTimes(1);
    expect(stopScheduler).not.toHaveBeenCalled();

    await handle.stop();
    await handle.stop();
    expect(stopScheduler).toHaveBeenCalledTimes(1);
  });
});

describe("web process scheduler contract", () => {
  const indexSource = readFileSync(join(repoRoot, "server", "index.ts"), "utf8");

  it("starts the scheduler only behind the explicit web opt-in flag", () => {
    expect(indexSource).toContain("BLUEPRINT_RUN_OPS_AUTOMATION_IN_WEB");
    expect(indexSource).toContain(
      "runOpsAutomationInWebProcess && !disableOpsAutomationScheduler",
    );
    // The old unconditional pattern must not come back: every call site of
    // startOpsAutomationScheduler() in index.ts is the gated ternary above.
    const callSites = indexSource.match(/startOpsAutomationScheduler\(\)/g) ?? [];
    expect(callSites.length).toBe(1);
    expect(indexSource).not.toMatch(
      /disableOpsAutomationScheduler\s*\?\s*\(\)\s*=>\s*undefined\s*:\s*startOpsAutomationScheduler\(\)/,
    );
  });
});

describe("deploy manifests", () => {
  it("declares the blueprint-webapp-worker Render service", () => {
    const renderYaml = readFileSync(join(repoRoot, "render.yaml"), "utf8");
    expect(renderYaml).toContain("type: worker");
    expect(renderYaml).toContain("name: blueprint-webapp-worker");
    expect(renderYaml).toContain("startCommand: npm run start:worker");
  });

  it("bundles and exposes the worker entrypoint", () => {
    const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
    expect(pkg.scripts["start:worker"]).toBe("NODE_ENV=production node dist/worker.js");
    expect(pkg.scripts.build).toContain("server/worker.ts");
  });
});
