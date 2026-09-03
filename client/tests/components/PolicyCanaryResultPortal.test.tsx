import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createArtifactTicket = vi.hoisted(() => vi.fn());

vi.mock("@/lib/taskEvaluationResults", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/taskEvaluationResults")>()),
  createTaskEvaluationResultArtifactTicket: createArtifactTicket,
}));

import { PolicyCanaryResultPortal } from "@/components/blueprint/app/PolicyCanaryResultPortal";
import { TaskEvaluationArtifactTicketError } from "@/lib/taskEvaluationResults";
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
  const families = [
    "canonical_anchor",
    "canonical_anchor",
    "placement_approach",
    "placement_approach",
    "illumination",
    "camera_sensor",
    "bounded_physics",
    "admitted_object_material_cousin",
    "pairwise_stress",
    "held_out_composition",
  ];
  const episodes = families.flatMap((family, cellIndex) => candidates.map((candidate, policyIndex) => {
    const blocked = cellIndex === 0 && policyIndex === 1;
    return {
      episode_id: `${candidate.candidate_id}-cell-${cellIndex}`,
      episode_kind: "learned_candidate" as const,
      subject_id: candidate.candidate_id,
      policy_candidate_id: candidate.candidate_id,
      score: {
        status: blocked ? "blocked" : "complete",
        task_succeeded: blocked ? null : policyIndex === 0,
        grader_authority: "deterministic_simulator_state",
        policy_outcome_interpretable: !blocked,
      },
      variation: {
        cell_id: `scene839873.quick10.${String(cellIndex).padStart(2, "0")}.${family}`,
        family_id: family,
        partition: cellIndex === 9 ? "held_out" : cellIndex < 2 ? "canonical" : "stress",
        seed: 900 - cellIndex,
      },
      failure: blocked
        ? { code: "camera_render_blocked", summary: "Camera evidence was not interpretable." }
        : null,
      evidence: {
        complete: !blocked,
        frame_manifest: artifact(policyIndex ? "b" : "a", "frame_manifest"),
        episode_json: artifact(policyIndex ? "d" : "c", "episode_json"),
        videos: {
          external: artifact(policyIndex ? "6" : "5", "review_video", "video/mp4"),
          wrist: artifact(policyIndex ? "8" : "7", "review_video", "video/mp4"),
          overview: artifact(policyIndex ? "2" : "1", "review_video", "video/mp4"),
        },
      },
      timeline: [{
        time_seconds: 0,
        action: `action-${policyIndex}`,
        joint_pose: `joint-${policyIndex}`,
        task_object_pose: `object-${policyIndex}`,
        contact_state: policyIndex ? "open" : "maintained",
        force_newtons: policyIndex ? 0 : 4.2,
        scoring_state: policyIndex ? "miss" : "progress",
      }],
      video_timebase_offsets_seconds: { external: 0, wrist: 0, overview: 0 },
    };
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
        summary: { episode_count: 20, learned_candidate_episode_count: 20, control_episode_count: 0, successful_episode_count: 10, interpretable_episode_count: 19 },
        episodes,
        artifacts: [
          artifact("3", "summary_csv", "text/csv"),
          artifact("4", "episode_csv", "text/csv"),
          artifact("9", "full_json_report"),
          evidenceManifest,
        ],
        proof_boundary: { review_video_is_authoritative_evidence: false, simulation_is_physical_success: false, cross_team_leaderboard_authorized: false },
        delivery_digest: sha("d"),
      },
      policy_canary_result: {
        schema_version: "task_evaluation_policy_canary_result_projection.v1",
        matrix_digest: sha("m"),
        counts: {
          policy_count: 2,
          episodes_per_policy: 10,
          learned_policy_rollout_count: 20,
          completed_learned_policy_rollout_count: 12,
        },
        candidate_results: candidates.map((candidate, index) => ({
          ...candidate,
          episodes_completed: 10,
          interpretable_episode_count: index ? 9 : 10,
          success_count: index ? 0 : 10,
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
          official_total_usd: 0.379,
          started_at_iso: "2026-08-31T12:00:00.000Z",
          completed_at_iso: "2026-08-31T12:30:00.000Z",
          duration_seconds: 1800,
          provider: "vast",
          provider_instance_ids: [49_609_705],
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
  beforeEach(() => {
    createArtifactTicket.mockReset().mockResolvedValue("/api/download/video");
  });

  it("leads with the Quick-10 summary, primary downloads, and ordered cell navigator", () => {
    render(<PolicyCanaryResultPortal result={result()} user={{ uid: "member-1" } as any} />);

    expect(screen.getByRole("heading", {
      name: "10 scenario cells · 2 policies · 20 episodes",
    })).toBeTruthy();
    expect(screen.getByText("20/20 episode records")).toBeTruthy();
    expect(screen.getByText("12 completed · 8 blocked")).toBeTruthy();
    const primaryDownloads = screen.getByLabelText("Primary result downloads");
    for (const label of ["Summary CSV", "Episode CSV", "Full JSON", "Evidence manifest"]) {
      expect(within(primaryDownloads).getByRole("button", { name: label })).toBeTruthy();
    }

    expect(screen.getAllByText(/No winner/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Cell 1 of 10 · Episodes 1–2 of 20")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Baseline anchor 1" })).toBeTruthy();
    expect(screen.getAllByText(/quick10\.00\.canonical_anchor/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Blocked").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Uninterpretable").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Cell 2 of 10 · Episodes 3–4 of 20")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Baseline anchor 2" })).toBeTruthy();
    const navigator = screen.getByRole("group", { name: /Scenario cell navigator/ });
    fireEvent.keyDown(navigator, { key: "ArrowRight" });
    expect(screen.getByText("Cell 3 of 10 · Episodes 5–6 of 20")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Placement and approach 1" })).toBeTruthy();

    const wrist = screen.getByRole("tab", { name: "Wrist camera" });
    fireEvent.click(wrist);
    expect(wrist.getAttribute("aria-selected")).toBe("true");

    const evidence = screen.getByText("Evidence and provenance").closest("details");
    expect(evidence).toBeTruthy();
    expect((evidence as HTMLDetailsElement).open).toBe(false);
    expect(within(evidence!).getByText("Complete artifact inventory")).toBeTruthy();
    expect(within(evidence!).getByText("$0.379")).toBeTruthy();
    expect(within(evidence!).getByText("vast · 49609705")).toBeTruthy();
  });

  it("applies the verified score sidecar while preserving the unqualified boundary", () => {
    const corrected = result();
    const episodes = corrected.publication.result_delivery!.episodes;
    corrected.score_correction = {
      schema_version: "task_evaluation_policy_canary_score_correction_sidecar.v1",
      correction: {
        schema_version: "task_evaluation_policy_canary_score_correction.v1",
        correction_id: "eef8610610decc0915dae0e7",
        correction_digest: sha("q"),
        source_run_id: corrected.publication.run_id,
        source_result_status: "completed_unqualified",
        corrected_result_status: "completed_unqualified",
        episode_count: 20,
        score_updates: episodes.map((episode, index) => ({
          candidate_id: episode.policy_candidate_id!,
          cell_id: episode.variation!.cell_id,
          seed: episode.variation!.seed!,
          old_score_digest: sha("o"),
          new_score_digest: sha("n"),
          new_score: {
            status: "scored",
            outcome: "pushed_and_settled",
            task_succeeded: true,
            failed_criteria: [],
            failure_reason_plain_english: null,
            measurements: {
              maximum_translation_m: 0.18,
              maximum_lift_m: 0,
              settle_destination_inside: true,
              settle_support_height_ok: true,
              native_safety_ok: true,
            },
            task_success_contract: {
              criteria: { temporal_invariants: { no_drop: { mode: "ignored" } } },
            },
            event_ledger: {
              drop_events: index === 0 ? [{ step_index: 24, fall_m: 0.04 }] : [],
              peak_task_contact_force_n: 6.4,
            },
          },
        })),
      },
      source_binding: {
        source_projection_digest: sha("p"),
        source_delivery_digest: sha("d"),
      },
      audit: {
        original_publication_preserved: true,
        original_score_receipts_preserved: true,
        corrected_result_status: "completed_unqualified",
        winner_declared: false,
      },
      sidecar_digest: sha("s"),
    };

    render(<PolicyCanaryResultPortal result={corrected} user={{ uid: "member-1" } as any} />);

    expect(screen.getByText("Deterministic score correction applied; original preserved")).toBeTruthy();
    expect(screen.getByText("Task completed after recovery")).toBeTruthy();
    expect(screen.getByText("1 observed · recovery allowed")).toBeTruthy();
    expect(screen.getAllByText(/No winner/i).length).toBeGreaterThan(0);
    expect(screen.getByText("No corrected episode failed a task criterion.")).toBeTruthy();
  });

  it("shows explicit video load, retry, and ready states", async () => {
    createArtifactTicket
      .mockRejectedValueOnce(new Error("technical ticket detail"))
      .mockResolvedValueOnce("/api/download/video");
    render(<PolicyCanaryResultPortal result={result()} user={{ uid: "member-1" } as any} />);

    expect(screen.getAllByText("Not loaded")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", {
      name: "Load External camera video for Policy A",
    }));
    expect(await screen.findByText("Load failed")).toBeTruthy();
    expect(screen.getByText("The video could not be loaded. Try again.")).toBeTruthy();
    expect(screen.queryByText("technical ticket detail")).toBeNull();

    fireEvent.click(screen.getByRole("button", {
      name: "Retry External camera video for Policy A",
    }));
    await waitFor(() => expect(screen.getByLabelText(
      "External camera evidence for Policy A",
    )).toBeTruthy());
    expect(screen.getByText("Ready")).toBeTruthy();
  });

  it("shows the actionable retry window when video authorization is throttled", async () => {
    createArtifactTicket.mockRejectedValueOnce(
      new TaskEvaluationArtifactTicketError(
        "Playback is temporarily rate-limited. Retry in 42 seconds.",
        { status: 429, retryAfterSeconds: 42 },
      ),
    );
    render(<PolicyCanaryResultPortal result={result()} user={{ uid: "member-1" } as any} />);

    fireEvent.click(screen.getByRole("button", {
      name: "Load External camera video for Policy A",
    }));

    expect(await screen.findByText(
      "Playback is temporarily rate-limited. Retry in 42 seconds.",
    )).toBeTruthy();
  });
});
