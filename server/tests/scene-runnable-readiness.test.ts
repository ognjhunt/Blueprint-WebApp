// @vitest-environment node
/**
 * Scene exists is not scene runnable, and the default is closed.
 */
import { describe, expect, it } from "vitest";

import { sceneRunnableReadiness } from "../utils/sceneRunnableReadiness";
import type { EvaluationReadinessSummary } from "../types/inbound-request";

function summary(partial: Partial<EvaluationReadinessSummary>): EvaluationReadinessSummary {
  return partial as EvaluationReadinessSummary;
}

describe("an unverified scene is not runnable supply", () => {
  it("refuses when there is no readiness summary at all", () => {
    // The reconstructed-but-unchecked case: a world manifest exists, nothing
    // has established that an evaluation can run against it.
    const verdict = sceneRunnableReadiness(undefined);
    expect(verdict.runnable).toBe(false);
    expect(verdict.reason).toMatch(/unverified/i);
  });

  it("refuses a summary that only says a scene was reconstructed", () => {
    // No execution proof, no launchable flag: partial readiness is not runnable.
    const verdict = sceneRunnableReadiness(
      summary({ benchmark_coverage_status: "ready", benchmark_task_count: 4 }),
    );
    expect(verdict.runnable).toBe(false);
  });

  it("refuses a scene that runs but has no benchmark task to score", () => {
    const verdict = sceneRunnableReadiness(
      summary({ runtime_launchable: true, benchmark_coverage_status: "missing" }),
    );
    expect(verdict.runnable).toBe(false);
    expect(verdict.reason).toMatch(/nothing for an evaluation to score/i);
  });
});

describe("a scene an internal check has proven runnable is supply", () => {
  it("accepts a simulator that has stepped the scene, with tasks defined", () => {
    const verdict = sceneRunnableReadiness(
      summary({
        robot_eval_preflight_summary: { simulator_execution_proven: true, episode_count: 20 },
      }),
    );
    expect(verdict.runnable).toBe(true);
    expect(verdict.reason).toMatch(/simulator steps this scene/i);
  });

  it("accepts an owner-GPU execution proof the same way", () => {
    const verdict = sceneRunnableReadiness(
      summary({
        benchmark_coverage_status: "ready",
        robot_eval_preflight_summary: { owner_gpu_simulator_execution_proven: true },
      }),
    );
    expect(verdict.runnable).toBe(true);
  });

  it("accepts a runtime-launchable scene with benchmark coverage", () => {
    const verdict = sceneRunnableReadiness(
      summary({ runtime_launchable: true, benchmark_coverage_status: "ready" }),
    );
    expect(verdict.runnable).toBe(true);
    expect(verdict.reason).toMatch(/runtime reports this scene launchable/i);
  });
});

describe("a current negative outranks a stale proof", () => {
  it("refuses when the runtime explicitly will not launch, even with execution proof", () => {
    // A scene that used to step and no longer launches is not runnable today.
    const verdict = sceneRunnableReadiness(
      summary({
        runtime_launchable: false,
        benchmark_coverage_status: "ready",
        robot_eval_preflight_summary: { simulator_execution_proven: true, episode_count: 20 },
      }),
    );
    expect(verdict.runnable).toBe(false);
    expect(verdict.reason).toMatch(/not launchable/i);
  });
});
