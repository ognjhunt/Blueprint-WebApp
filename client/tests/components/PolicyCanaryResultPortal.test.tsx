import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createArtifactTicket = vi.hoisted(() => vi.fn());

vi.mock("@/lib/taskEvaluationResults", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/taskEvaluationResults")>()),
  createTaskEvaluationResultArtifactTicket: createArtifactTicket,
}));

import { applyPolicyCanaryScoreCorrection, pairedCanaryComparison } from "@/lib/policyCanaryResultPortal";
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

const taskSuccessContract = {
  schema_version: "rigid_task_success_contract.v1" as const,
  scope: { site_id: "scene-839873", task_id: "relocation" },
  provenance: { author_source: "site_robot_team" as const, author_id: "team-1", confirmation_status: "confirmed" as const, confirmed_by_team_id: "team-1", proposal_digest: null },
  criteria: {
    destination_containment: { mode: "required" as const, position_bounds_world_m: { minimum: [0.41, -0.21, 0.72] as [number, number, number], maximum: [0.56, -0.06, 0.79] as [number, number, number] } },
    orientation: { mode: "ignored" as const, reference_xyzw: [0, 0, 0, 1] as [number, number, number, number], tolerance_rad: 0.35 },
    support: { height_mode: "required" as const, height_interval_m: [0.72, 0.79] as [number, number], contact_mode: "required" as const },
    terminal_task_contact: { mode: "cleared" as const },
    gripper_state: { mode: "ignored" as const, threshold_m: null },
    settling: { mode: "required" as const, window_samples: 8, position_tolerance_m: 0.01, orientation_tolerance_rad: 0.08 },
    safety: { mode: "required" as const },
    motion: { movement_epsilon_m: 0.002, minimum_translation_m: 0.08, minimum_lift_m: null },
    temporal_invariants: { schema_version: "rigid_task_event_ledger_expectation.v1" as const, no_drop: { mode: "ignored" as const, minimum_fall_m: 0.02 }, maximum_task_contact_force_n: null, forbidden_contact_classes: [], containment_excursions: "forbidden" as const, workspace_excursions: "ignored" as const, maximum_retries: null, maximum_regrasps: null },
  },
  contract_digest: sha("8"),
};

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
        provider: "resend",
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
        task_success_contract: taskSuccessContract,
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

/** Drawers render closed; open one the way a reader would before inspecting it. */
function openDrawer(name: RegExp | string) {
  const details = screen.getByText(name, { selector: "summary" }).closest("details")!;
  expect(details.open).toBe(false);
  details.open = true;
  return details;
}

const viewer = () => screen.getByRole("group", { name: /Scenario viewer/ });
const episodeCard = (policy: string) => screen.getByRole("region", { name: `${policy} episode` });

describe("PolicyCanaryResultPortal", () => {
  beforeEach(() => {
    createArtifactTicket.mockReset().mockResolvedValue("/api/download/video");
  });

  it("leads with a plain verdict, the counts behind it, and downloads, then a scenario viewer", () => {
    const interpreted = result();
    interpreted.publication.result_delivery!.episodes[0].interpretation = {
      status: "completed",
      abstention_reason: null,
      episode_outcome: "appears_complete",
      summary: "The mug appears to reach the target after one recovery.",
      events: [],
      possible_missed_events: [],
      contract_considerations: ["A no-drop contract would change the deterministic outcome."],
      confidence: 0.82,
      deterministic_agreement: "disagrees",
      receipt: artifact("i", "episode_interpretation_receipt"),
      learned_interpretation_only: true,
      authoritative_task_success_unchanged: true,
      ranking_or_promotion_effect: "none",
    };
    render(<PolicyCanaryResultPortal result={interpreted} user={{ uid: "member-1" } as any} />);

    expect(screen.getByRole("heading", { name: "Policy A succeeded more often." })).toBeTruthy();
    expect(screen.getByText("On the 9 scenarios where both were scored, the gap is unlikely to be chance (sign test p ≈ 0.004).")).toBeTruthy();
    const counts = screen.getAllByRole("row").slice(1, 3).map((row) => row.textContent);
    expect(counts).toEqual(["Policy A101010", "Policy B1090"]);
    expect(screen.getByText("Policy B: 1 of 10 episodes wasn't scored — a camera or sensor problem.")).toBeTruthy();
    expect(screen.getByText("Control runs weren't delivered, so it isn't confirmed that the task can be completed in this scene.")).toBeTruthy();
    expect(screen.getByText(/no winner is declared, and this isn't evidence of real-world performance or safety/)).toBeTruthy();
    expect(screen.queryByText(/Success criteria weren't delivered/)).toBeNull();
    const primaryDownloads = screen.getByLabelText("Primary result downloads");
    for (const label of ["Summary CSV", "Episode CSV", "Full JSON", "Evidence manifest"]) {
      expect(within(primaryDownloads).getByRole("button", { name: label })).toBeTruthy();
    }

    // One row per scenario, in preregistered order, with both policies' outcomes.
    expect(screen.getByRole("heading", { name: "Episodes", level: 2 })).toBeTruthy();
    const firstRow = screen.getByRole("button", { name: "Baseline anchor 1" }).closest("tr")!;
    expect(within(firstRow).getByText("Completed")).toBeTruthy();
    expect(within(firstRow).getByText("Not scored")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Held-out composition" })).toBeTruthy();

    expect(screen.getByRole("heading", { name: "Baseline anchor 1", level: 3 })).toBeTruthy();
    expect(screen.getByText("Scenario 1 of 10 · seed 900")).toBeTruthy();
    expect(within(episodeCard("Policy B")).getByText("Not scored — a camera or sensor problem. Camera evidence was not interpretable.")).toBeTruthy();
    expect(within(episodeCard("Policy A")).getByText(/An AI review disagrees with this score/)).toBeTruthy();
    expect(within(episodeCard("Policy A")).getByText(/The mug appears to reach the target after one recovery\./)).toBeTruthy();
    expect(within(episodeCard("Policy A")).getByText("It doesn't change the score.")).toBeTruthy();
    expect(screen.getAllByText(/quick10\.00\.canonical_anchor/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Scenario 2 of 10 · seed 899")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Baseline anchor 2", level: 3 })).toBeTruthy();
    fireEvent.keyDown(viewer(), { key: "ArrowRight" });
    expect(screen.getByRole("heading", { name: "Placement and approach 1", level: 3 })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Held-out composition" }));
    expect(screen.getByRole("heading", { name: "Held-out composition", level: 3 })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Held-out composition" }).getAttribute("aria-current")).toBe("true");

    const wrist = screen.getByRole("tab", { name: "Wrist" });
    fireEvent.click(wrist);
    expect(wrist.getAttribute("aria-selected")).toBe("true");

    const scoring = screen.getByText("How this was scored", { selector: "summary" }).closest("details")!;
    expect(scoring.open).toBe(false);
    expect(within(scoring).getByText("Eventual placement")).toBeTruthy();
    const evidence = openDrawer("Run details and all files");
    expect(within(evidence).getByText("Published artifact inventory")).toBeTruthy();
    expect(within(evidence).getByText("scene-839873")).toBeTruthy();
    expect(within(evidence).getByText("Simple relocation · relocation")).toBeTruthy();
    expect(within(evidence).getByText("$0.379")).toBeTruthy();
    expect(within(evidence).getByText("vast · 49609705")).toBeTruthy();
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

    corrected.publication.policy_canary_result!.projection_digest = sha("p");
    const display = applyPolicyCanaryScoreCorrection(corrected);
    expect(display.publication.policy_canary_result!.counts.completed_learned_policy_rollout_count).toBe(12);
    const blockedBefore = corrected.publication.result_delivery!.episodes.find(episode => episode.score.policy_outcome_interpretable === false)!;
    const blockedAfter = display.publication.result_delivery!.episodes.find(episode => episode.episode_id === blockedBefore.episode_id)!;
    expect(blockedAfter.failure).toEqual(blockedBefore.failure);
    expect(blockedAfter.score.status).toBe(blockedBefore.score.status);
    expect(pairedCanaryComparison(applyPolicyCanaryScoreCorrection(corrected))).toMatchObject({
      comparablePairs: 9, bothSucceeded: 9, bothFailed: 0, deltaPoints: 0, pValue: null,
    });
    const stale = structuredClone(corrected);
    stale.score_correction!.source_binding.source_delivery_digest = sha("e");
    const rejected = applyPolicyCanaryScoreCorrection(stale);
    expect(rejected.score_correction).toBeUndefined();
    expect(rejected.publication).toEqual(stale.publication);
    render(<PolicyCanaryResultPortal result={corrected} user={{ uid: "member-1" } as any} />);

    expect(screen.getByText(/Scoring was corrected after publication\. The same fix applies to both policies/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "The policies tied." })).toBeTruthy();
    expect(screen.getByText("They had the same outcome on all 9 scenarios where both were scored.")).toBeTruthy();
    expect(screen.getByText(/no winner is declared/)).toBeTruthy();
    expect(within(episodeCard("Policy A")).getByText(/Task completed after an unsupported fall/)).toBeTruthy();
    expect(within(episodeCard("Policy A")).getByText("1 unsupported fall · recovery allowed")).toBeTruthy();
  });

  it("does not apply a correction bound to another delivery", () => {
    const value = result();
    value.score_correction = { correction: { source_run_id: "another-run" } } as any;
    render(<PolicyCanaryResultPortal result={value} user={null} />);
    expect(screen.getByText("A score correction didn't match this result, so the original scores are shown.")).toBeTruthy();
    expect(screen.queryByText(/Scoring was corrected after publication/)).toBeNull();
  });

  it("keeps registry criteria inspectable without claiming team confirmation", () => {
    const value = result();
    const contract = structuredClone(taskSuccessContract);
    contract.provenance = { ...contract.provenance, author_source: "compatibility_default", confirmed_by_team_id: null } as any;
    value.publication.policy_canary_result!.task_success_contract = contract as any;
    render(<PolicyCanaryResultPortal result={value} user={null} />);
    const scoring = openDrawer("How this was scored");
    expect(within(scoring).getByText(/registry default, not confirmed by your team/)).toBeTruthy();
    expect(within(scoring).queryByText(/confirmed by team/)).toBeNull();
    expect(screen.queryByText(/may be submitted unchanged/)).toBeNull();
  });

  it("explains an open/close task with its own criteria, not the rigid placement rules", () => {
    const value = result();
    value.publication.policy_canary_result!.task_success_contract = {
      schema_version: "articulated_task_success_contract.v1",
      scope: { site_id: "site-capture-drawer", task_id: "website-drawer-open" },
      provenance: { author_source: "task_owner", author_id: "owner", confirmation_status: "confirmed", confirmed_by_team_id: "team-1", proposal_digest: null },
      criteria: {
        target_joint: { joint_id: "task_part_joint", joint_ids: ["task_part_joint"] },
        opening: { mode: "required", success_interval: [0.18, 0.3], joint_hard_limits: [0, 0.3], reset_position: 0 },
        hold: { mode: "required", window_samples: 15, maximum_settled_target_speed: 0.02 },
        locked_joints: { mode: "required", joint_ids: ["drawer_0_fixed"], motion_tolerance: 0.01 },
        reset: { tolerance: 0.005 },
        motion: { movement_epsilon: 0.003 },
        assembly_root: { mode: "required" },
        safety: { mode: "required" },
        temporal_invariants: {
          schema_version: "articulated_task_event_ledger_expectation.v1",
          rebound_below_threshold_allowed: false,
          forbidden_collision_allowed: false,
          joint_limit_violation_allowed: false,
          assembly_root_excursion_allowed: false,
        },
      },
      contract_digest: sha("7"),
    } as any;
    render(<PolicyCanaryResultPortal result={value} user={null} />);
    expect(screen.queryByText(/Success criteria weren't delivered/)).toBeNull();
    const scoring = openDrawer("How this was scored");
    expect(within(scoring).getByText("Part opened")).toBeTruthy();
    expect(within(scoring).getByText("Held open")).toBeTruthy();
    expect(within(scoring).queryByText("Destination containment")).toBeNull();
    expect(within(scoring).getByText(/confirmed by team team-1/)).toBeTruthy();
  });

  it("loads video only on request and shows retry and playback states", async () => {
    createArtifactTicket
      .mockRejectedValueOnce(new Error("technical ticket detail"))
      .mockResolvedValueOnce("/api/download/video");
    render(<PolicyCanaryResultPortal result={result()} user={{ uid: "member-1" } as any} />);

    expect(screen.getAllByRole("button", { name: /^Load External camera video for/ })).toHaveLength(2);
    expect(createArtifactTicket).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", {
      name: "Load External camera video for Policy A",
    }));
    expect(await screen.findByText("The video could not be loaded. Try again.")).toBeTruthy();
    expect(screen.queryByText("technical ticket detail")).toBeNull();

    fireEvent.click(screen.getByRole("button", {
      name: "Retry External camera video for Policy A",
    }));
    await waitFor(() => expect(screen.getByLabelText(
      "External camera evidence for Policy A",
    )).toBeTruthy());
    fireEvent.loadedData(screen.getByLabelText("External camera evidence for Policy A"));
    expect(screen.queryByText("The video could not be loaded. Try again.")).toBeNull();
    expect(screen.getByRole("button", { name: "Load External camera video for Policy B" })).toBeTruthy();
  });

  it("recovers an expired or unreadable media response through a fresh authorized ticket", async () => {
    createArtifactTicket.mockResolvedValueOnce("/api/download/expired").mockResolvedValueOnce("/api/download/fresh");
    render(<PolicyCanaryResultPortal result={result()} user={{uid:"member-1"} as any} />);
    fireEvent.click(screen.getByRole("button",{name:"Load External camera video for Policy A"}));
    const video = await screen.findByLabelText("External camera evidence for Policy A");
    fireEvent.error(video);
    expect(screen.getByText(/media could not be read or its access expired/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"Retry External camera video for Policy A"}));
    await waitFor(() => expect(screen.getByLabelText("External camera evidence for Policy A").getAttribute("src")).toBe("/api/download/fresh"));
    fireEvent.loadedData(screen.getByLabelText("External camera evidence for Policy A"));
    expect(screen.queryByText(/media could not be read or its access expired/)).toBeNull();
    expect(createArtifactTicket).toHaveBeenCalledTimes(2);
  });

  it("does not claim capture provenance, complete media, or a paired result for pre-observation records", () => {
    const value = result();
    value.access_visibility = "unlisted_public";
    value.publication.result_status = "blocked";
    value.publication.policy_canary_result!.task_success_contract = undefined;
    value.publication.result_delivery!.episodes = [];
    value.publication.result_delivery!.artifacts = [];
    value.publication.policy_canary_result!.reproducibility = {};
    render(<PolicyCanaryResultPortal result={value} user={null} />);
    expect(screen.getByRole("heading",{name:"No episodes were delivered."})).toBeTruthy();
    expect(screen.getByText("Success criteria weren't delivered with this result, so it can't serve as an acceptance test.")).toBeTruthy();
    expect(screen.getByText("No policy episodes were delivered.")).toBeTruthy();
    expect(screen.getByText("Anyone with this link can view this result and its files.")).toBeTruthy();
    expect(within(screen.getByLabelText("Primary result downloads")).getByRole("button", { name: "Summary CSV unavailable" })).toBeTruthy();
    expect(screen.queryByText(/one captured scene|trail for every episode|files are hash-verified/)).toBeNull();
  });

  it("keeps an absent score and missing media visible as unknown evidence", () => {
    const value = result();
    const episode = value.publication.result_delivery!.episodes[0] as any;
    delete episode.score;
    episode.evidence = {};
    render(<PolicyCanaryResultPortal result={value} user={null} />);
    expect(screen.getByText("Policy A: 1 of 10 episodes wasn't scored — no score was recorded.")).toBeTruthy();
    const firstRow = screen.getByRole("button", { name: "Baseline anchor 1" }).closest("tr")!;
    expect(within(firstRow).getAllByText("Not scored")).toHaveLength(2);
    expect(within(episodeCard("Policy A")).getByText("Not scored — no score was recorded.")).toBeTruthy();
    expect(within(episodeCard("Policy A")).getByText("No external camera video was delivered.")).toBeTruthy();
    expect(within(episodeCard("Policy A")).getByText("No files were delivered for this episode.")).toBeTruthy();
  });

  it("shows both duplicate episode records instead of selecting the last outcome", () => {
    const value = result();
    const duplicate = structuredClone(value.publication.result_delivery!.episodes[0]);
    duplicate.episode_id = "conflicting-duplicate"; duplicate.score.task_succeeded = false;
    value.publication.result_delivery!.episodes.push(duplicate);
    render(<PolicyCanaryResultPortal result={value} user={null} />);
    const firstRow = screen.getByRole("button", { name: "Baseline anchor 1" }).closest("tr")!;
    expect(within(firstRow).getByText("Ambiguous")).toBeTruthy();
    const card = episodeCard("Policy A");
    expect(within(card).getByText("2 records exist for this scenario, so neither is used in the counts.")).toBeTruthy();
    expect(within(card).getByText("policy-a-cell-0 · Completed")).toBeTruthy();
    expect(within(card).getByText("conflicting-duplicate · Failed")).toBeTruthy();
    expect(screen.getByText("Policy A: 2 of 11 episodes weren't scored — duplicate records for one scenario.")).toBeTruthy();
  });

  it("marks scenarios whose variation was not applied at runtime", () => {
    const value = result();
    value.publication.policy_canary_result!.episodes = value.publication.result_delivery!.episodes.map((episode) => ({
      episode_id: episode.episode_id,
      runtime_coverage_gaps: episode.variation!.family_id === "bounded_physics" ? ["unapplied_scenario:bounded_physics"] : [],
    }));
    render(<PolicyCanaryResultPortal result={value} user={null} />);
    const physicsRow = screen.getByRole("button", { name: "Bounded physics variation" }).closest("tr")!;
    expect(within(physicsRow).getByText("variation not applied")).toBeTruthy();
    expect(screen.getAllByText("variation not applied")).toHaveLength(1);
    expect(screen.queryByText(/wasn't reported for this run/)).toBeNull();
  });

  it("says when runtime variation coverage was not reported", () => {
    render(<PolicyCanaryResultPortal result={result()} user={null} />);
    expect(screen.getByText("Whether each scenario's variation was actually applied wasn't reported for this run.")).toBeTruthy();
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

describe("control runs", () => {
  it("shows separate control outcomes and loads control videos only on demand", async () => {
    createArtifactTicket.mockReset().mockResolvedValue("/api/download/control-video");
    const value = result();
    const controls = Array.from({ length: 10 }, (_, cell) => (["zero_action_negative", "deterministic_scripted_positive"] as const).map((controlId) => {
      const ref = (role: string) => ({ artifact_id: `control-${cell}-${controlId}-${role}`, digest: sha("a"), size_bytes: 128 });
      return { episode_id: `control-${cell}-${controlId}`, cell_id: `cell-${cell}`, seed: 3000 + cell,
        control_id: controlId, terminal_state: "completed" as const, control_passed: true,
        receipt_digest: sha("a"), receipt: ref("receipt"), cell_receipt: ref("cell-receipt"),
        videos: { external: ref("external"), wrist: ref("wrist"), overview: ref("overview") },
        artifacts: ["control_cell_archive", "frame_manifest", "state_trace", "action_trace"].map((role) => ({ ...ref(role), role })),
        score: { status: "scored", task_succeeded: controlId === "deterministic_scripted_positive",
          outcome: controlId === "zero_action_negative" ? "never_moved" : "placed", failed_criteria: [] }, evidence_gaps: [],
      };
    })).flat();
    value.publication.scene_controls_status = "controls_verified_development_only";
    value.publication.policy_canary_result!.controls = controls;
    value.publication.policy_canary_result!.controls_summary = { expected_count: 20, recorded_count: 20, completed_count: 20, passed_count: 20, verified_cell_count: 10 };
    value.publication.result_delivery!.artifacts.push(artifact("a", "controls_csv", "text/csv"));
    render(<PolicyCanaryResultPortal result={value} user={null} />);
    expect(screen.queryByText(/Control runs (were skipped|weren't delivered|failed)/)).toBeNull();
    openDrawer("Control runs · all 20 passed");
    const section = screen.getByRole("region", { name: "Control runs" });
    expect(within(section).getAllByRole("row")).toHaveLength(21);
    expect(within(section).getByText(/do-nothing run that should\s+fail and a scripted run that should succeed/)).toBeTruthy();
    expect(createArtifactTicket).not.toHaveBeenCalled();
    fireEvent.click(within(section).getByRole("button", { name: "Load External camera video for Do-nothing run" }));
    await waitFor(() => expect(createArtifactTicket).toHaveBeenCalledWith(null, value.record_id, controls[0].videos.external.artifact_id, { signal: expect.any(AbortSignal) }));
    expect((await within(section).findByLabelText("External camera evidence for Do-nothing run")).getAttribute("src")).toBe("/api/download/control-video");
    fireEvent.click(within(section).getByRole("button", { name: "Inspect Scripted run for cell-1" }));
    expect(within(section).getByRole("heading", { name: "Scripted run · cell-1" })).toBeTruthy();
    expect(within(section).getByRole("button", { name: "Cell evidence ZIP" })).toBeTruthy();
    expect(within(section).getByRole("button", { name: "Controls CSV" })).toBeTruthy();
  });

  it("reports absent controls as an unverified setup, not as policy failures", () => {
    render(<PolicyCanaryResultPortal result={result()} user={null} />);
    expect(screen.getByText("Control runs weren't delivered, so it isn't confirmed that the task can be completed in this scene.")).toBeTruthy();
    expect(screen.queryByText(/Control runs ·/)).toBeNull();
    expect(screen.getAllByRole("row").slice(1, 3).map((row) => row.textContent)).toEqual(["Policy A101010", "Policy B1090"]);
  });

  it("says plainly when control runs were skipped", () => {
    const value = result();
    value.publication.scene_controls_status = "controls_omitted_by_user";
    render(<PolicyCanaryResultPortal result={value} user={null} />);
    expect(screen.getByText("Control runs were skipped, so it isn't confirmed that the task can be completed in this scene.")).toBeTruthy();
  });
});
