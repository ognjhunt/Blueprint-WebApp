// @vitest-environment node
/**
 * The readiness snapshot names missing result-artifact configuration as a
 * warning. It must not become a blocker: the deploy health gate reads the
 * same snapshot, and result videos are not a reason to keep a fix from
 * replacing a running service.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const NAMES = ["TASK_EVALUATION_RESULT_ARTIFACT_URL_TEMPLATE", "TASK_EVALUATION_RUN_EXECUTE_URL", "TASK_EVALUATION_LAUNCH_URL",
  "ROBOT_EVAL_JOB_REQUEST_FORWARD_URL", "ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN", "TASK_EVALUATION_RUN_FORWARD_TOKEN",
  "TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET"];

afterEach(() => { vi.unstubAllEnvs(); });

describe("result artifact readiness", () => {
  it("warns with the exact missing items when nothing is configured", async () => {
    for (const name of NAMES) vi.stubEnv(name, "");
    const { buildLaunchReadinessSnapshot } = await import("../utils/launch-readiness");
    const snapshot = buildLaunchReadinessSnapshot();
    const check = (snapshot.dependencies.launchChecks as Record<string, any>).resultArtifacts;
    expect(check).toMatchObject({ required: false, ready: false });
    const warning = snapshot.warnings.find(line => line.startsWith("resultArtifacts:"));
    expect(warning).toMatch(/ROBOT_EVAL_JOB_REQUEST_FORWARD_URL/);
    expect(warning).toMatch(/ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN/);
    expect(warning).toMatch(/TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET/);
    expect(snapshot.blockers.join("\n")).not.toMatch(/resultArtifacts/);
    expect(snapshot.checks).not.toHaveProperty("resultArtifacts");
  });

  it("is ready from the canonical job-request URL, token and ticket secret without leaking the host", async () => {
    for (const name of NAMES) vi.stubEnv(name, "");
    vi.stubEnv("ROBOT_EVAL_JOB_REQUEST_FORWARD_URL", "https://pipeline.internal.example/api/live-pipeline/job-requests");
    vi.stubEnv("ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN", "fixture-token-value");
    vi.stubEnv("TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET", "fixture-secret-value");
    const { buildLaunchReadinessSnapshot } = await import("../utils/launch-readiness");
    const check = (buildLaunchReadinessSnapshot().dependencies.launchChecks as Record<string, any>).resultArtifacts;
    expect(check.ready).toBe(true);
    expect(JSON.stringify(check)).not.toMatch(/pipeline\.internal\.example|fixture-token-value|fixture-secret-value/);
  });
});
