import { describe, expect, it } from "vitest";
import fixture from "./fixtures/pipeline-policy-canary-publication.v4.json";
import { canonicalArtifactDigest } from "../utils/taskCandidateContract";
import { parsePipelinePolicyCanaryPublication } from "../utils/policyCanaryWebappSyncContract";
import { projectEvaluationReadyRun } from "../utils/evaluationReadyRunContract";
import { buildPolicyCanaryTerminalEmail } from "../utils/policyCanaryNotification";
import { controlsWarnings } from "../utils/policyCanaryControls";
import { controlsWarnings as clientWarnings } from "../../client/src/lib/policyCanaryControls";

const sha = `sha256:${"a".repeat(64)}`;
const artifact = (id: string) => ({ artifact_id: id, digest: sha, size_bytes: 12 });

function publication() {
  const value: any = structuredClone(fixture);
  const projection = value.policy_canary_result;
  const controls = Array.from({ length: 10 }, (_, cell) => ["zero_action_negative", "deterministic_scripted_positive"].map((id) => ({
    episode_id: `cell-${cell}-${id}`, cell_id: `cell-${cell}`, seed: 3000 + cell, control_id: id,
    terminal_state: "completed", control_passed: true, receipt_digest: sha,
    receipt: artifact(`receipt-${cell}-${id}`), cell_receipt: artifact(`cell-${cell}`),
    videos: Object.fromEntries(["external", "wrist", "overview"].map((camera) => [camera, artifact(`${camera}-${cell}-${id}`)])),
    artifacts: ["control_cell_archive", "frame_manifest", "state_trace", "action_trace"].map((role) => ({ ...artifact(`${role}-${cell}-${id}`), role })),
    score: { status: "scored", task_succeeded: id === "deterministic_scripted_positive", outcome: id === "zero_action_negative" ? "never_moved" : "placed", failed_criteria: [] },
    evidence_gaps: [],
  }))).flat();
  projection.episodes = Array.from({ length: 10 }, (_, cell) => ["pi05_droid", "groot_n17_droid"].map((candidate) => ({
    episode_id: `episode-${cell}-${candidate}`, candidate_id: candidate, cell_id: `cell-${cell}`, seed: 3000 + cell,
    terminal_state: "completed", candidate_policy_queried: true, actions_reached_robot: true,
    arm_moved: true, policy_outcome_interpretable: true, failure_taxonomy: null,
    evidence: { checkpoint_digest: sha, runtime_identity_digest: sha, reset_state_digest: sha,
      ...Object.fromEntries(["reset_state", "frame_manifest", "review_video", "policy_query_receipt", "action_sequence", "action_delivery_readback", "state_trace", "contact_force_trace", "task_object_trajectory", "score_receipt"].map((role) => [role, artifact(role)])), evidence_gaps: [] },
  }))).flat();
  const addition = { scene_controls_status: "controls_verified_development_only", warning: controlsWarnings.controls_verified_development_only,
    controls, controls_summary: { expected_count: 20, recorded_count: 20, completed_count: 20, passed_count: 20, verified_cell_count: 10 },
    controls_gate: { status: "passed", required_control_episode_count: 20, candidate_policies_loaded_during_controls: false } };
  Object.assign(projection, addition);
  Object.assign(value.result_delivery, addition);
  value.scene_controls_status = addition.scene_controls_status;
  value.warning = addition.warning;
  value.result_status = projection.result_status = value.result_delivery.result_status = "completed_unqualified";
  projection.counts.completed_learned_policy_rollout_count = 20;
  projection.counts.completed_diagnostic_control_rollout_count = 20;
  projection.blockers = [];
  const refs = controls.flatMap((control) => [control.receipt, control.cell_receipt, ...Object.values(control.videos), ...control.artifacts]);
  projection.report.controls_csv = artifact("controls-csv");
  value.result_delivery.artifacts = [...new Map([...refs, projection.report.controls_csv].map((ref) => [ref.artifact_id, ref])).values()];
  return reseal(value);
}
function reseal(value: any) {
  value.result_delivery.delivery_digest = canonicalArtifactDigest(value.result_delivery, "delivery_digest");
  value.policy_canary_result.result_delivery_digest = value.result_delivery.delivery_digest;
  value.policy_canary_result.projection_digest = canonicalArtifactDigest(value.policy_canary_result, "projection_digest");
  return value;
}

describe("per-cell control result contract", () => {
  it("accepts 20 delivered controls without upgrading diagnostic result claims", () => {
    const result = parsePipelinePolicyCanaryPublication(publication());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.publication.result_status).toBe("completed_unqualified");
    expect(result.publication.proof_boundary.simulation_is_physical_success).toBe(false);
    expect(result.publication.policy_canary_result.controls).toHaveLength(20);
    expect(controlsWarnings).toEqual(clientWarnings);
  });
  it.each(["missing", "duplicate", "seed", "score", "warning", "media", "delivery"])("rejects a re-signed %s mismatch", (fault) => {
    const value = publication();
    const p = value.policy_canary_result;
    if (fault === "missing") p.controls.pop();
    if (fault === "duplicate") p.controls[1] = p.controls[0];
    if (fault === "seed") p.controls[1].seed += 1;
    if (fault === "score") p.controls[1].score.task_succeeded = false;
    if (fault === "warning") p.warning = controlsWarnings.configured_controls_pending;
    if (fault === "media") delete p.controls[0].videos.wrist;
    if (fault === "delivery") value.result_delivery.artifacts = [];
    expect(parsePipelinePolicyCanaryPublication(reseal(value)).ok).toBe(false);
  });
  it("keeps run progress and terminal notification consistent with verified controls", () => {
    const source = publication();
    const record = { schema_version: "task_evaluation_policy_run_web_record.v1" as const, run_id: "run-1",
      source_launch_id: "launch-1", offering_digest: sha, owner_user_id: "owner", team_namespace: "team",
      state: "results_ready" as const, configuration_digest: sha, created_at_iso: "2026-09-05T00:00:00Z",
      updated_at_iso: "2026-09-05T01:00:00Z", run_kind: "internal_policy_canary", result_status: "completed_unqualified",
      policy_run_result_projection: source.policy_canary_result };
    expect(projectEvaluationReadyRun(record)).toMatchObject({ scene_controls_status: "controls_verified_development_only", warning: controlsWarnings.controls_verified_development_only });
    expect(buildPolicyCanaryTerminalEmail({ record, resultUrl: "https://tryblueprint.io/app/results/run-1" }).emailText).toContain(controlsWarnings.controls_verified_development_only);
  });
  it("continues accepting the original pending-controls historical fixture", () => {
    expect(parsePipelinePolicyCanaryPublication(reseal(structuredClone(fixture))).ok).toBe(true);
  });
});
