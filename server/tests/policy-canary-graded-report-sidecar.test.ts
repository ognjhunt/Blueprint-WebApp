// @vitest-environment node
import { describe, expect, it } from "vitest";

import fixture from "./fixtures/policy-canary-graded-report-sidecar.json";
import {
  verifiedPolicyCanaryGradedReportSidecar,
  verifyPolicyCanaryGradedReportSidecar,
} from "../utils/policyCanaryGradedReportSidecar";
import type { PipelinePolicyCanaryPublication } from "../utils/policyCanaryWebappSyncContract";
import { canonicalArtifactDigest } from "../utils/taskCandidateContract";

// The fixture's sidecar was built by the Pipeline's grade_episode and
// summarize_candidate from the real deterministic scorer, so a pass here also
// proves the two runtimes agree on every digest.
function inputs() {
  const value = structuredClone(fixture) as Record<string, any>;
  return {
    publication: value.publication as unknown as PipelinePolicyCanaryPublication,
    sidecar: value.sidecar as Record<string, any>,
    recordId: value.record_id as string,
  };
}

function resign(sidecar: Record<string, any>) {
  for (const row of sidecar.episodes) {
    row.graded.report_digest = canonicalArtifactDigest(row.graded, "report_digest");
  }
  sidecar.sidecar_digest = canonicalArtifactDigest(sidecar, "sidecar_digest");
  return sidecar;
}

function verify(sidecar: unknown, overrides: Partial<Parameters<typeof verifyPolicyCanaryGradedReportSidecar>[0]> = {}) {
  const { publication, recordId } = inputs();
  return verifyPolicyCanaryGradedReportSidecar({
    payload: sidecar,
    publication,
    recordId,
    scoreCorrection: null,
    ...overrides,
  });
}

describe("policy canary graded report sidecar", () => {
  it("accepts a Pipeline-built report bound to its run", () => {
    const { sidecar } = inputs();
    expect(verifiedPolicyCanaryGradedReportSidecar(sidecar)).not.toBeNull();
    const result = verify(sidecar);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.sidecar.candidates.map((row) => row.ranking_permitted)).toEqual([false, false]);
  });

  it("refuses a report whose bytes or binding were changed", () => {
    const edited = inputs().sidecar;
    edited.candidates[0].mean_graded_score = 1;
    expect(verify(edited)).toEqual({ ok: false, code: "sidecar_source_binding_invalid" });
    expect(verifiedPolicyCanaryGradedReportSidecar(edited)).toBeNull();

    expect(verify(inputs().sidecar, { recordId: "another-record" }))
      .toEqual({ ok: false, code: "sidecar_source_binding_invalid" });
    expect(verify(inputs().sidecar, {
      scoreCorrection: { sidecar_digest: "sha256:" + "9".repeat(64), correction: { score_updates: [] } },
    })).toEqual({ ok: false, code: "sidecar_source_binding_invalid" });
  });

  it("refuses a report that skips or invents episodes", () => {
    const missing = inputs().sidecar;
    missing.episodes = missing.episodes.slice(1);
    expect(verify(resign(missing))).toEqual({ ok: false, code: "sidecar_episode_inventory_invalid" });
  });

  it("refuses credit for a step reached out of order", () => {
    const sidecar = inputs().sidecar;
    const untouched = sidecar.episodes.find((row: Record<string, any>) => row.graded.graded_score === 0);
    untouched.graded.subtasks.at(-1).achieved = true;
    untouched.graded.graded_score = 1 / untouched.graded.subtasks.length;
    expect(verify(resign(sidecar))).toEqual({ ok: false, code: "sidecar_summary_inconsistent" });
  });

  it("refuses a report that disagrees with the published score", () => {
    const sidecar = inputs().sidecar;
    const failed = sidecar.episodes.find((row: Record<string, any>) => row.graded.task_succeeded === false);
    failed.graded.task_succeeded = true;
    const summary = sidecar.candidates.find((row: Record<string, any>) => row.candidate_id === failed.candidate_id);
    summary.success_count += 1;
    expect(verify(resign(sidecar))).toEqual({ ok: false, code: "sidecar_contradicts_deterministic_score" });
  });

  it("follows a published score correction", () => {
    const sidecar = inputs().sidecar;
    const failed = sidecar.episodes.find((row: Record<string, any>) => row.graded.task_succeeded === false);
    const correction = {
      sidecar_digest: "sha256:" + "9".repeat(64),
      correction: {
        score_updates: [{
          candidate_id: failed.candidate_id,
          cell_id: failed.cell_id,
          seed: failed.seed,
          new_score: { task_succeeded: false },
        }],
      },
    };
    sidecar.source_binding.source_score_correction_sidecar_digest = correction.sidecar_digest;
    expect(verify(resign(sidecar), { scoreCorrection: correction })).toMatchObject({ ok: true });
    correction.correction.score_updates[0].new_score.task_succeeded = true;
    expect(verify(sidecar, { scoreCorrection: correction }))
      .toEqual({ ok: false, code: "sidecar_contradicts_deterministic_score" });
  });
});
