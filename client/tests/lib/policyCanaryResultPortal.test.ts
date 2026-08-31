import { describe, expect, it } from "vitest";

import {
  buildAlignedCanaryCells,
  buildCanaryArtifactInventory,
  buildFailureAnalysis,
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
  it("filters and aligns both policies on the same cell and seed", () => {
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
    const rows = buildAlignedCanaryCells(episodes, ["policy-a", "policy-b"], {
      family: "canonical_anchor",
      seed: "101",
      outcome: "all",
      interpretability: "all",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ cellId: "cell-1", seed: 101, partition: "canonical" });
    expect(Object.keys(rows[0].episodesByCandidate).sort()).toEqual(["policy-a", "policy-b"]);
  });

  it("builds fixed failure cohorts and representative episode links", () => {
    const failures = buildFailureAnalysis([
      episode("policy-a", "cell-1", 101, {
        failure: { code: "collision", summary: "Collision with fixture" },
      }),
      episode("policy-b", "cell-1", 101, {
        action_delivery: { actions_reached_robot: false, arm_moved: false },
        failure: { code: "action_delivery_failed", summary: "No action readback" },
      }),
    ]);
    expect(failures.find((row) => row.cohort === "collision")).toMatchObject({ count: 1 });
    expect(failures.find((row) => row.cohort === "action_delivery")).toMatchObject({ count: 1 });
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
});
