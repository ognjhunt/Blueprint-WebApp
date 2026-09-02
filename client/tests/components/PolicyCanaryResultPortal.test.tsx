import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PolicyCanaryResultPortal } from "@/components/blueprint/app/PolicyCanaryResultPortal";
import type { TaskEvaluationResultSiteRecord } from "@/lib/taskEvaluationResults";

const sha = (character: string) => `sha256:${character.repeat(64)}`;
const artifact = (character: string, role: string, contentType = "application/json") => ({
  artifact_id: character.repeat(32).slice(0, 32),
  role,
  relative_path: `${role}.json`,
  sha256: sha(character),
  size_bytes: 128,
  content_type: contentType,
  retention_status: "retained" as const,
  access_mode: "authenticated_ticket" as const,
});

function result(): TaskEvaluationResultSiteRecord {
  const candidates = [
    { candidate_id: "policy-a", display_name: "Policy A", checkpoint_digest: sha("a") },
    { candidate_id: "policy-b", display_name: "Policy B", checkpoint_digest: sha("b") },
  ];
  const episodes = candidates.map((candidate, index) => ({
    episode_id: `${candidate.candidate_id}-cell-1`,
    episode_kind: "learned_candidate" as const,
    subject_id: candidate.candidate_id,
    policy_candidate_id: candidate.candidate_id,
    score: {
      status: index ? "failed" : "complete",
      task_succeeded: index === 0,
      grader_authority: "deterministic_simulator_state",
      policy_outcome_interpretable: true,
    },
    variation: { cell_id: "cell-1", family_id: "canonical_anchor", partition: "canonical", seed: 101 },
    evidence: {
      complete: true,
      frame_manifest: artifact(index ? "g" : "f", "frame_manifest"),
      episode_json: index
        ? artifact("k", "episode_json")
        : {
          artifact_id: "j".repeat(32),
          digest: sha("j"),
          size_bytes: 128,
        } as any,
      videos: {},
    },
    timeline: [{
      time_seconds: 0,
      action: `action-${index}`,
      joint_pose: `joint-${index}`,
      task_object_pose: `object-${index}`,
      contact_state: index ? "open" : "maintained",
      force_newtons: index ? 0 : 4.2,
      scoring_state: index ? "miss" : "progress",
    }],
    video_timebase_offsets_seconds: { external: 0 },
  }));
  const evidenceManifest = artifact("e", "evidence_manifest");
  return {
    schema_version: "task_evaluation_result_site_record.v1",
    record_id: "result-1",
    organization_id: "team-1",
    access_visibility: "organization_members",
    publication: {
      schema_version: "task_evaluation_run_publication.v4",
      run_id: "run-1",
      run_kind: "internal_policy_canary",
      claim_ceiling: "diagnostic_policy_execution",
      result_status: "completed_unqualified",
      scene_controls_status: "configured_controls_pending",
      warning: "Controls pending — results are unqualified.",
      source_launch_id: "scene-launch-1",
      offering_digest: sha("o"),
      request_digest: sha("r"),
      configuration_digest: sha("c"),
      scene: { id: "scene-839873", revision_digest: sha("s") },
      task: { id: "relocation", label: "Simple relocation" },
      robot: { preset_id: "franka", display_name: "Franka" },
      policy_candidates: candidates,
      submitted_by: { actor_id: "member-1", actor_role: "team_member" },
      team_namespace: "team-1",
      access_visibility: "organization_members",
      started_at_iso: "2026-08-31T12:00:00.000Z",
      completed_at_iso: "2026-08-31T12:30:00.000Z",
      duration_seconds: 1800,
      notification_delivery: {
        status: "accepted",
        provider: "sendgrid",
        message_id: "sg-1",
        attempts: 1,
        accepted_at_iso: "2026-08-31T12:31:00.000Z",
        delivered_at_iso: null,
        failure_reason: null,
      },
      result_delivery: {
        schema_version: "task_evaluation_result_delivery.v2",
        run_id: "run-1",
        result_status: "completed_unqualified",
        status: "ready",
        claim_ceiling: "diagnostic_policy_execution",
        stages: [],
        blockers: [],
        summary: { episode_count: 2, learned_candidate_episode_count: 2, control_episode_count: 0, successful_episode_count: 1, interpretable_episode_count: 2 },
        episodes,
        artifacts: [artifact("u", "summary_csv", "text/csv"), evidenceManifest],
        proof_boundary: { review_video_is_authoritative_evidence: false, simulation_is_physical_success: false, cross_team_leaderboard_authorized: false },
        delivery_digest: sha("d"),
      },
      policy_canary_result: {
        schema_version: "task_evaluation_policy_canary_result_projection.v1",
        matrix_digest: sha("m"),
        candidate_results: candidates.map((candidate, index) => ({
          ...candidate,
          episodes_completed: 1,
          interpretable_episode_count: 1,
          success_count: index ? 0 : 1,
          success_rate: index ? 0 : 1,
          progress_score: index ? 0.3 : 0.8,
          mean_destination_error: index ? 0.4 : 0.1,
          contact_maintenance_rate: index ? 0 : 1,
          collision_rate: 0,
          action_delivery_rate: 1,
        })),
        coverage_gaps: [],
        failure_analysis: [],
        reproducibility: {
          runtime_container_digest: sha("t"),
          scoring_version: "deterministic-v1",
          evidence_manifest: evidenceManifest,
          billing_receipt: artifact("l", "billing_receipt"),
          teardown_receipt: artifact("n", "teardown_receipt"),
          provider_zero_receipt: artifact("z", "provider_zero_receipt"),
        },
        winner_declared: false,
        official_ranking_contribution: false,
      },
      proof_boundary: { result_is_unqualified: true, winner_declared: false },
    },
  };
}

describe("PolicyCanaryResultPortal", () => {
  it("renders the no-winner boundary, paired cell, timeline, and artifact inventory", () => {
    render(<PolicyCanaryResultPortal result={result()} user={{ uid: "member-1" } as any} />);

    expect(screen.getAllByText(/No winner/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/cell-1/).length).toBeGreaterThan(0);
    expect(screen.getByText("action-0")).toBeTruthy();
    expect(screen.getByText("action-1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Seek paired evidence to 0.000 seconds" }));
    expect(screen.getByText("Selected playhead 0.000s")).toBeTruthy();
    const inventory = screen.getByText("Complete artifact inventory").closest("details");
    expect(inventory).toBeTruthy();
    expect(within(inventory!).getByText("summary csv")).toBeTruthy();
    expect(within(inventory!).getByText("provider zero receipt")).toBeTruthy();
    expect(screen.getByText(/Diagnostic only/)).toBeTruthy();
  });
});
