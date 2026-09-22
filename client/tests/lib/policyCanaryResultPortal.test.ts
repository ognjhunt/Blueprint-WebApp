import { describe, expect, it } from "vitest";

import {
  buildAlignedCanaryCells,
  buildCanaryArtifactInventory,
  canaryEpisodeOutcome,
  canaryEpisodeProblem,
  canaryRunLabels,
  canaryUnscoredReason,
  canaryUnscoredReasons,
  formatCanaryPValue,
  pairedCanaryComparison,
  resolvedCanaryCandidates,
  wilson95,
} from "@/lib/policyCanaryResultPortal";
import type {
  TaskEvaluationResultArtifact,
  TaskEvaluationResultEpisode,
  TaskEvaluationResultSiteRecord,
} from "@/lib/taskEvaluationResults";

const sha = (character: string) => `sha256:${character.repeat(64)}`;
const artifact = (id: string, role: string): TaskEvaluationResultArtifact => ({
  artifact_id: id.repeat(32).slice(0, 32),
  role,
  relative_path: `${role}.json`,
  sha256: sha(id),
  size_bytes: 100,
  content_type: "application/json",
});

function episode(candidate: string, cell: string, seed: number, overrides: Partial<TaskEvaluationResultEpisode> = {}): TaskEvaluationResultEpisode {
  return {
    episode_id: `${candidate}-${cell}`,
    episode_kind: "learned_candidate",
    subject_id: candidate,
    policy_candidate_id: candidate,
    score: {
      status: "complete",
      task_succeeded: candidate === "policy-a",
      grader_authority: "deterministic_simulator_state",
      policy_outcome_interpretable: true,
    },
    variation: {
      cell_id: cell,
      family_id: cell === "cell-1" ? "canonical_anchor" : "pairwise_stress",
      partition: cell === "cell-1" ? "canonical" : "stress",
      seed,
    },
    evidence: {
      complete: true,
      frame_manifest: artifact("f", "frame_manifest"),
      episode_json: artifact("j", "episode_json"),
    },
    ...overrides,
  };
}

describe("policy canary result portal data", () => {
  it("aligns both policies on the same cell and seed", () => {
    const episodes = [
      episode("policy-a", "cell-1", 101),
      episode("policy-b", "cell-1", 101),
      episode("policy-a", "cell-2", 202),
      episode("policy-b", "cell-2", 202, {
        score: {
          status: "unqualified",
          task_succeeded: null,
          grader_authority: "deterministic_simulator_state",
          policy_outcome_interpretable: false,
        },
      }),
    ];
    const rows = buildAlignedCanaryCells(episodes, ["policy-a", "policy-b"]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ cellId: "cell-1", seed: 101, partition: "canonical" });
    expect(Object.keys(rows[0].episodesByCandidate).sort()).toEqual(["policy-a", "policy-b"]);
    expect(Object.keys(rows[1].episodesByCandidate).sort()).toEqual(["policy-a", "policy-b"]);
    expect(canaryEpisodeOutcome(rows[1].episodesByCandidate["policy-b"])).toEqual({ label: "Not scored", tone: "neutral" });
  });

  it("keeps Quick-10 cells in preregistered numeric order instead of seed order", () => {
    const episodes = [
      episode("policy-a", "scene839873.quick10.09.held_out_composition", 1),
      episode("policy-b", "scene839873.quick10.09.held_out_composition", 1),
      episode("policy-a", "scene839873.quick10.00.canonical_anchor", 999),
      episode("policy-b", "scene839873.quick10.00.canonical_anchor", 999),
      episode("policy-a", "scene839873.quick10.01.canonical_anchor", 2),
      episode("policy-b", "scene839873.quick10.01.canonical_anchor", 2),
    ];
    const rows = buildAlignedCanaryCells(episodes, ["policy-a", "policy-b"]);

    expect(rows.map((row) => row.cellId)).toEqual([
      "scene839873.quick10.00.canonical_anchor",
      "scene839873.quick10.01.canonical_anchor",
      "scene839873.quick10.09.held_out_composition",
    ]);
  });

  it("classifies collision and action delivery problems", () => {
    expect(canaryEpisodeProblem(episode("policy-a", "cell-1", 101, {
      failure: { code: "collision", summary: "Collision with fixture" },
    }))).toBe("collision");
    expect(canaryEpisodeProblem(episode("policy-b", "cell-1", 101, {
      action_delivery: { actions_reached_robot: false, arm_moved: false },
      failure: { code: "action_delivery_failed", summary: "No action readback" },
    }))).toBe("action_delivery");
  });

  it("keeps a typed action execution failure out of the no-motion reason", () => {
    const rejected = episode("policy-a", "cell-1", 101, {
      score: { status: "not_scored", task_succeeded: null, grader_authority: "deterministic_simulator_state", policy_outcome_interpretable: false },
      action_delivery: { actions_reached_robot: true, arm_moved: false },
      failure: { code: "DroidActionExecutionError", summary: "DroidActionExecutionError" },
    });
    const still = episode("policy-b", "cell-1", 101, {
      score: { status: "not_scored", task_succeeded: null, grader_authority: "deterministic_simulator_state", policy_outcome_interpretable: false },
      action_delivery: { actions_reached_robot: true, arm_moved: false },
    });
    expect(canaryEpisodeProblem(rejected)).toBe("action_delivery");
    expect(canaryUnscoredReason(rejected)).toBe("the policy's actions couldn't be executed");
    expect(canaryEpisodeProblem(still)).toBe("no_motion");
    expect(canaryUnscoredReason(still)).toBe("the robot didn't move");
  });

  it("never gives a scored-outcome phrase as the reason an episode is unscored", () => {
    const unknownFailure = episode("policy-a", "cell-1", 101, {
      score: { status: "blocked", task_succeeded: null, grader_authority: "deterministic_simulator_state", policy_outcome_interpretable: false },
      failure: { code: "scene_reset_failed" },
    });
    expect(canaryEpisodeProblem(unknownFailure)).toBe("task_miss");
    expect(canaryUnscoredReason(unknownFailure)).toBe("scene reset failed");
    const noScore = episode("policy-a", "cell-1", 101);
    delete (noScore as Partial<TaskEvaluationResultEpisode>).score;
    expect(canaryUnscoredReason(noScore)).toBe("no score was recorded");
    expect(canaryEpisodeOutcome(noScore).label).toBe("Not scored");
  });

  it("deduplicates the complete artifact inventory across report and episode references", () => {
    const shared = artifact("e", "evidence_manifest");
    const result = {
      record_id: "result-1",
      organization_id: "team-1",
      access_visibility: "organization_members",
      publication: {
        schema_version: "task_evaluation_run_publication.v4",
        run_id: "run-1",
        run_kind: "internal_policy_canary",
        proof_boundary: {},
        result_delivery: {
          schema_version: "task_evaluation_result_delivery.v2",
          run_id: "run-1",
          result_status: "completed_unqualified",
          status: "ready",
          claim_ceiling: "diagnostic_policy_execution",
          stages: [],
          blockers: [],
          summary: { episode_count: 1, learned_candidate_episode_count: 1, control_episode_count: 0, successful_episode_count: 1 },
          episodes: [episode("policy-a", "cell-1", 101)],
          artifacts: [shared, artifact("s", "summary_csv")],
          proof_boundary: { review_video_is_authoritative_evidence: false, simulation_is_physical_success: false, cross_team_leaderboard_authorized: false },
          delivery_digest: sha("d"),
        },
        policy_canary_result: {
          reproducibility: { evidence_manifest: shared },
          winner_declared: false,
          official_ranking_contribution: false,
        },
      },
    } as unknown as TaskEvaluationResultSiteRecord;

    const inventory = buildCanaryArtifactInventory(result);
    expect(inventory.filter((row) => row.artifact_id === shared.artifact_id)).toHaveLength(1);
    expect(inventory.map((row) => row.role)).toEqual(expect.arrayContaining([
      "evidence_manifest", "summary_csv", "frame_manifest", "episode_json",
    ]));
  });

  it("computes a bounded Wilson interval only with a meaningful denominator", () => {
    expect(wilson95(7, 10)).toMatchObject({ lower: expect.any(Number), upper: expect.any(Number) });
    expect(wilson95(0, 0)).toBeNull();
  });

  it("recovers candidate identities from Pipeline v2 delivery metadata", () => {
    const result = {
      publication: {
        schema_version: "task_evaluation_run_publication.v4",
        run_id: "run-1",
        proof_boundary: {},
        result_delivery: {
          candidate_results: [
            {
              candidate_id: "pi05_droid",
              display_name: "pi0.5-DROID Polaris joint-position",
              checkpoint_digest: sha("a"),
            },
            {
              candidate_id: "groot_n17_droid",
              display_name: "GR00T N1.7 DROID",
              checkpoint_digest: sha("b"),
            },
          ],
        },
      },
    } as unknown as TaskEvaluationResultSiteRecord;

    expect(resolvedCanaryCandidates(result)).toEqual([
      {
        candidate_id: "pi05_droid",
        display_name: "pi0.5-DROID Polaris joint-position",
        checkpoint_digest: sha("a"),
      },
      {
        candidate_id: "groot_n17_droid",
        display_name: "GR00T N1.7 DROID",
        checkpoint_digest: sha("b"),
      },
    ]);
  });
  it("keeps duplicate ambiguity and the other policy visible", () => {
    const rows = buildAlignedCanaryCells([
      episode("policy-a", "cell-1", 101),
      episode("policy-a", "cell-1", 101, {episode_id:"duplicate", score:{status:"scored",task_succeeded:false,policy_outcome_interpretable:true,grader_authority:"deterministic_simulator_state"}}),
      episode("policy-b", "cell-1", 101),
    ], ["policy-a","policy-b"]);
    expect(rows).toHaveLength(1);
    expect(rows[0].duplicateEpisodesByCandidate["policy-a"]).toHaveLength(2);
    expect(rows[0].episodesByCandidate["policy-a"]).toBeUndefined();
    expect(rows[0].episodesByCandidate["policy-b"]?.score.task_succeeded).toBe(false);
  });

  it("names the bound scene and task without inventing either", () => {
    const record = (publication: Record<string, unknown>) => ({ publication } as unknown as TaskEvaluationResultSiteRecord);
    const scope = { site_id: "interiorgs-841757", task_id: "scene-841757-book-to-marked-area" };
    expect(canaryRunLabels(record({ policy_canary_result: { task_success_contract: { scope } } })))
      .toEqual({ scene: "interiorgs-841757", task: "scene-841757-book-to-marked-area", taskLabel: null });
    expect(canaryRunLabels(record({
      scene: { id: "scene-a", revision_digest: sha("a") },
      task: { id: "task-a", label: "Place the book in the marked area" },
      policy_canary_result: { task_success_contract: { scope } },
    }))).toEqual({ scene: "scene-a", task: "task-a", taskLabel: "Place the book in the marked area" });
    expect(canaryRunLabels(record({ result_delivery: { reproducibility: {} } })))
      .toEqual({ scene: null, task: null, taskLabel: null });
  });

  it("states the paired outcome plainly and never as a winner", () => {
    const record = (episodes: TaskEvaluationResultEpisode[]) => ({
      record_id: "result-1",
      publication: {
        run_id: "run-1",
        policy_candidates: [
          { candidate_id: "policy-a", display_name: "Policy A", checkpoint_digest: sha("a") },
          { candidate_id: "policy-b", display_name: "Policy B", checkpoint_digest: sha("b") },
        ],
        result_delivery: { episodes },
      },
    } as unknown as TaskEvaluationResultSiteRecord);
    const scored = (candidate: string, cell: number, succeeded: boolean) => episode(candidate, `cell-${cell}`, cell, {
      score: { status: "scored", task_succeeded: succeeded, grader_authority: "deterministic_simulator_state", policy_outcome_interpretable: true },
    });
    const cells = [0, 1, 2, 3, 4, 5, 6, 7, 8];

    expect(pairedCanaryComparison(record([]))).toMatchObject({ headline: "No episodes were delivered.", verdict: "" });
    expect(pairedCanaryComparison(record(cells.flatMap((cell) => [scored("policy-a", cell, false), scored("policy-b", cell, false)]))))
      .toMatchObject({ headline: "Neither policy completed the task.", leader: null });
    const leading = pairedCanaryComparison(record(cells.flatMap((cell) => [scored("policy-a", cell, true), scored("policy-b", cell, false)])))!;
    expect(leading).toMatchObject({ headline: "Policy A succeeded more often.", comparablePairs: 9, leaderOnlyWins: 9, laggardOnlyWins: 0 });
    expect(leading.verdict).toBe("On the 9 scenarios where both were scored, the gap is unlikely to be chance (sign test p ≈ 0.004).");
    expect(leading.verdict).not.toMatch(/winner|wins/i);
    expect(pairedCanaryComparison(record([scored("policy-a", 0, true), scored("policy-b", 0, false), scored("policy-a", 1, true), scored("policy-b", 1, true)]))!.verdict)
      .toBe("With only 2 scenarios where both were scored, the gap could be chance (sign test p ≈ 1.00).");
    expect(pairedCanaryComparison(record([scored("policy-a", 0, true), scored("policy-b", 0, true)])))
      .toMatchObject({ headline: "The policies tied.", verdict: "They had the same outcome on all 1 scenario where both were scored." });
  });

  it("formats small p-values without rounding them to zero", () => {
    expect(formatCanaryPValue(0.0004)).toBe("p < 0.001");
    expect(formatCanaryPValue(0.0039)).toBe("p ≈ 0.004");
    expect(formatCanaryPValue(0.0625)).toBe("p ≈ 0.06");
  });

  it("groups the reasons a candidate's records are left out of its scored count", () => {
    const blocked = (cell: number) => episode("policy-a", `cell-${cell}`, cell, {
      score: { status: "not_scored", task_succeeded: null, grader_authority: "deterministic_simulator_state", policy_outcome_interpretable: false },
      failure: { code: "DroidActionExecutionError", summary: "DroidActionExecutionError" },
    });
    const record = {
      publication: {
        result_delivery: { episodes: [
          blocked(1), blocked(2),
          episode("policy-a", "cell-3", 3),
          episode("policy-a", "cell-4", 4), episode("policy-a", "cell-4", 4, { episode_id: "duplicate" }),
          episode("policy-b", "cell-1", 1),
        ] },
      },
    } as unknown as TaskEvaluationResultSiteRecord;
    expect(canaryUnscoredReasons(record, "policy-a")).toEqual([
      { reason: "duplicate records for one scenario", count: 2 },
      { reason: "the policy's actions couldn't be executed", count: 2 },
    ]);
    expect(canaryUnscoredReasons(record, "policy-b")).toEqual([]);
  });
});
