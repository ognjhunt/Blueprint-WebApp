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
const startStripeWebhookQueueProcessor = vi.hoisted(() => vi.fn());
const startTaskEvaluationLaunchForwardWorker = vi.hoisted(() => vi.fn());
const startCompanyPolicyCandidateOutboxWorker = vi.hoisted(() => vi.fn());
const validateEnv = vi.hoisted(() => vi.fn(() => ({})));

vi.mock("../utils/opsAutomationScheduler", () => ({ startOpsAutomationScheduler }));
vi.mock("../utils/stripeWebhookQueue", () => ({ startStripeWebhookQueueProcessor }));
vi.mock("../utils/taskEvaluationLaunchForwardWorker", () => ({
  startTaskEvaluationLaunchForwardWorker,
}));
vi.mock("../utils/companyPolicyCandidateOutboxWorker", () => ({
  startCompanyPolicyCandidateOutboxWorker,
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
  it("boots the scheduler through validateEnv and stops it exactly once", async () => {
    const stopScheduler = vi.fn();
    const stopQueueProcessor = vi.fn();
    const stopLaunchForwarder = vi.fn();
    const stopCompanyPolicyOutbox = vi.fn();
    startOpsAutomationScheduler.mockReturnValue(stopScheduler);
    startStripeWebhookQueueProcessor.mockReturnValue(stopQueueProcessor);
    startTaskEvaluationLaunchForwardWorker.mockReturnValue(stopLaunchForwarder);
    startCompanyPolicyCandidateOutboxWorker.mockReturnValue(stopCompanyPolicyOutbox);

    const { startWorker } = await import("../worker");
    const handle = startWorker();

    expect(validateEnv).toHaveBeenCalled();
    expect(startOpsAutomationScheduler).toHaveBeenCalledTimes(1);
    expect(startStripeWebhookQueueProcessor).toHaveBeenCalledTimes(1);
    expect(startTaskEvaluationLaunchForwardWorker).toHaveBeenCalledTimes(1);
    expect(startCompanyPolicyCandidateOutboxWorker).toHaveBeenCalledTimes(1);
    expect(stopScheduler).not.toHaveBeenCalled();

    await handle.stop();
    await handle.stop();
    expect(stopScheduler).toHaveBeenCalledTimes(1);
    expect(stopQueueProcessor).toHaveBeenCalledTimes(1);
    expect(stopLaunchForwarder).toHaveBeenCalledTimes(1);
    expect(stopCompanyPolicyOutbox).toHaveBeenCalledTimes(1);
  });

  it("can run the Task Evaluation launch forwarder without unrelated workers", async () => {
    process.env.BLUEPRINT_TASK_EVALUATION_LAUNCH_FORWARD_ONLY_WORKER = "true";
    const stopLaunchForwarder = vi.fn();
    const stopCompanyPolicyOutbox = vi.fn();
    startTaskEvaluationLaunchForwardWorker.mockReturnValue(stopLaunchForwarder);
    startCompanyPolicyCandidateOutboxWorker.mockReturnValue(stopCompanyPolicyOutbox);

    const { startWorker } = await import("../worker");
    const handle = startWorker();

    expect(startTaskEvaluationLaunchForwardWorker).toHaveBeenCalledTimes(1);
    expect(startCompanyPolicyCandidateOutboxWorker).toHaveBeenCalledTimes(1);
    expect(startOpsAutomationScheduler).not.toHaveBeenCalled();
    expect(startStripeWebhookQueueProcessor).not.toHaveBeenCalled();

    await handle.stop();
    expect(stopLaunchForwarder).toHaveBeenCalledTimes(1);
    expect(stopCompanyPolicyOutbox).toHaveBeenCalledTimes(1);
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
