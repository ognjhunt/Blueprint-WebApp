// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The background loops run in the dedicated Render worker service: the worker
 * entrypoint starts each of them and stops each exactly once on shutdown, the
 * web process runs no automation scheduler, and the deploy manifests declare
 * the worker service.
 */

const startTaskEvaluationLaunchForwardWorker = vi.hoisted(() => vi.fn());
const validateEnv = vi.hoisted(() => vi.fn(() => ({})));
const stopWebsiteDeletions = vi.hoisted(() => vi.fn());
const startWebsiteCaptureDeletionWorker = vi.hoisted(() => vi.fn(() => stopWebsiteDeletions));
vi.mock("../utils/websiteCaptureDeletion", () => ({ startWebsiteCaptureDeletionWorker }));
const stopWebsiteJobWindowSweep = vi.hoisted(() => vi.fn());
const startWebsiteJobWindowSweepWorker = vi.hoisted(() => vi.fn(() => stopWebsiteJobWindowSweep));
vi.mock("../utils/websiteJobWindowSweep", () => ({ startWebsiteJobWindowSweepWorker }));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, default: {} }));
vi.mock("../utils/taskEvaluationLaunchForwardWorker", () => ({
  startTaskEvaluationLaunchForwardWorker,
}));
vi.mock("../config/env", () => ({ validateEnv }));
vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  attachRequestMeta: (meta: Record<string, unknown>) => meta,
}));

const repoRoot = join(__dirname, "..", "..");

afterEach(() => {
  delete process.env.BLUEPRINT_TASK_EVALUATION_LAUNCH_FORWARD_ONLY_WORKER;
  vi.clearAllMocks();
});

describe("worker entrypoint", () => {
  it("shares the same shutdown promise for concurrent signals", async () => {
    startTaskEvaluationLaunchForwardWorker.mockReturnValue(vi.fn());
    const { startWorker } = await import("../worker");
    const handle = startWorker();
    const first = handle.stop();
    expect(handle.stop()).toBe(first);
    await first;
  });
  it("boots through validateEnv and stops each worker exactly once", async () => {
    const stopLaunchForwarder = vi.fn();
    startTaskEvaluationLaunchForwardWorker.mockReturnValue(stopLaunchForwarder);

    const { startWorker } = await import("../worker");
    const handle = startWorker();

    expect(validateEnv).toHaveBeenCalled();
    expect(startTaskEvaluationLaunchForwardWorker).toHaveBeenCalledTimes(1);

    await handle.stop();
    await handle.stop();
    expect(stopLaunchForwarder).toHaveBeenCalledTimes(1);
  });

  it("can run the Task Evaluation launch forwarder without unrelated workers", async () => {
    process.env.BLUEPRINT_TASK_EVALUATION_LAUNCH_FORWARD_ONLY_WORKER = "true";
    const stopLaunchForwarder = vi.fn();
    startTaskEvaluationLaunchForwardWorker.mockReturnValue(stopLaunchForwarder);

    const { startWorker } = await import("../worker");
    const handle = startWorker();

    expect(startTaskEvaluationLaunchForwardWorker).toHaveBeenCalledTimes(1);
    // Withdrawal storage deletion runs in the deployed launch-forward mode.
    expect(startWebsiteCaptureDeletionWorker).toHaveBeenCalledTimes(1);
    // So does the window sweep that ends a job the Pipeline went quiet on.
    expect(startWebsiteJobWindowSweepWorker).toHaveBeenCalledTimes(1);

    await handle.stop();
    expect(stopLaunchForwarder).toHaveBeenCalledTimes(1);
    expect(stopWebsiteDeletions).toHaveBeenCalledTimes(1);
    expect(stopWebsiteJobWindowSweep).toHaveBeenCalledTimes(1);
  });
});

describe("web process", () => {
  const indexSource = readFileSync(join(repoRoot, "server", "index.ts"), "utf8");

  it("runs no automation scheduler and delivers customer email through the outbox pump", () => {
    expect(indexSource).not.toContain("startOpsAutomationScheduler");
    expect(indexSource).toContain("startOutboxPump()");
  });
});

describe("deploy manifests", () => {
  it("declares the blueprint-webapp-worker Render service", () => {
    const renderYaml = readFileSync(join(repoRoot, "render.yaml"), "utf8");
    expect(renderYaml).toContain("type: worker");
    expect(renderYaml).toContain("name: blueprint-webapp-worker");
    expect(renderYaml).toContain("startCommand: NODE_ENV=production node dist/worker.js");
    const deploySource = readFileSync(join(repoRoot, ".github", "workflows", "deploy.yml"), "utf8");
    expect(deploySource).toContain("'background_worker', 'NODE_ENV=production node dist/worker.js'");
  });

  it("bundles and exposes the worker entrypoint", () => {
    const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
    expect(pkg.scripts["start:worker"]).toBe("NODE_ENV=production node dist/worker.js");
    expect(pkg.scripts.build).toContain("server/worker.ts");
  });
});
