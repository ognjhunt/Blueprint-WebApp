// @vitest-environment node
import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import { forwardTaskCandidateDecisionToPipeline } from "../utils/taskCandidateForwarding";
import {
  canonicalArtifactDigest,
  parseVerifiedPipelineTaskDecisionResult,
} from "../utils/taskCandidateContract";

const token = "test-only-task-forward-token";

function command() {
  return {
    schema_version: "task_candidate_decision_command_record.v1",
    command_request_id: "task-command-1",
    requester_user_id: "buyer-123",
    actor: { role: "customer", identity: "firebase:buyer-123" },
    capture_session_id: "capture-session-1",
    intake_id: "intake-1",
    discovery_digest: `sha256:${"a".repeat(64)}`,
    task_candidate_id: "candidate-1",
    candidate_digest: `sha256:${"b".repeat(64)}`,
    action: "reject",
    rationale: "This task is not operationally relevant.",
    edited_task: null,
    request_fingerprint_sha256: `sha256:${"c".repeat(64)}`,
    idempotency_key: "reject-candidate-1",
    pipeline_approval_status: "pending_pipeline_validation",
    created_at_iso: "2026-07-29T20:00:00Z",
  };
}

function result(input = command()) {
  const decision: Record<string, unknown> = {
    schema_version: "task_candidate_decision.v1",
    discovery_id: "discovery-1",
    discovery_digest: input.discovery_digest,
    task_candidate_id: input.task_candidate_id,
    candidate_digest: input.candidate_digest,
    action: input.action,
    actor: input.actor,
    idempotency_key: input.idempotency_key,
    rationale: input.rationale,
    edited_task: input.edited_task,
    decision_id: "decision-1",
  };
  decision.decision_digest = canonicalArtifactDigest(decision, "decision_digest");
  return {
    schema_version: "task_candidate_decision_processing_result.v1",
    status: "processed",
    accepted: true,
    already_exists: false,
    capture_session_id: "capture-session-1",
    intake_id: "intake-1",
    command_request_id: input.command_request_id,
    submission_fingerprint_sha256: `sha256:${"d".repeat(64)}`,
    pipeline_approval_status: "rejected",
    pipeline_task_decision: decision,
    approved_task_definition: null,
    decision_evidence_request: null,
    processed_at_iso: "2026-07-29T20:01:00Z",
    proof_boundary: {
      webapp_command_is_pipeline_approval: false,
      pipeline_decision_recorded: true,
      approved_task_exists: false,
      decision_evidence_request_compiled: false,
      testbed_required_before_request_compilation: true,
      task_success_established: false,
      physical_success_established: false,
      comparative_policy_ranking_verdict: "thesis_not_supported",
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("task candidate decision forwarding", () => {
  it("signs the exact body and accepts only a digest-verified bound result", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(result()), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const forwarded = await forwardTaskCandidateDecisionToPipeline({
      captureSessionId: "capture-session-1",
      intakeId: "intake-1",
      discoveryId: "discovery-1",
      sourceCaptureDigest: `sha256:${"e".repeat(64)}`,
      command: command(),
      endpointUrl: "https://pipeline.invalid/api/live-pipeline/task-decisions",
      token,
      clientId: "webapp-test",
    });

    expect(forwarded).toMatchObject({ status: "forwarded", performed: true });
    const [, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    const body = String(init?.body);
    const canonical = [
      headers["x-blueprint-pipeline-timestamp"],
      "webapp-test",
      headers["x-blueprint-pipeline-nonce"],
      body,
    ].join(".");
    const expected = createHmac("sha256", token).update(canonical).digest("hex");
    expect(headers["x-blueprint-pipeline-signature"]).toBe(`sha256=${expected}`);
  });

  it("rejects a validly digested decision whose intent fields do not match the command", async () => {
    const wrong = result();
    wrong.pipeline_task_decision.rationale = "A different customer rationale.";
    wrong.pipeline_task_decision.decision_digest = canonicalArtifactDigest(
      wrong.pipeline_task_decision,
      "decision_digest",
    );
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(wrong), {
      status: 200,
      headers: { "content-type": "application/json" },
    })));

    const forwarded = await forwardTaskCandidateDecisionToPipeline({
      captureSessionId: "capture-session-1",
      intakeId: "intake-1",
      discoveryId: "discovery-1",
      sourceCaptureDigest: `sha256:${"e".repeat(64)}`,
      command: command(),
      endpointUrl: "https://pipeline.invalid/api/live-pipeline/task-decisions",
      token,
      clientId: "webapp-test",
    });

    expect(forwarded).toMatchObject({
      status: "failed",
      performed: false,
      blocker: "pipeline_task_decision_response_binding_mismatch",
    });
  });

  it("rejects a self-grading or cross-linked approved task even when its digest is valid", () => {
    const approvedDecision = result();
    approvedDecision.pipeline_approval_status = "approved";
    approvedDecision.pipeline_task_decision.action = "approve";
    approvedDecision.pipeline_task_decision.decision_digest = canonicalArtifactDigest(
      approvedDecision.pipeline_task_decision,
      "decision_digest",
    );
    const approvedTask: Record<string, any> = {
      schema_version: "approved_task_definition.v1",
      approved_task_id: "approved-task-1",
      source_capture: {
        intake_id: "intake-1",
        capture_digest: `sha256:${"e".repeat(64)}`,
        capture_authority_profile: "camera_360_equirectangular",
      },
      discovery_id: "different-discovery",
      discovery_digest: approvedDecision.pipeline_task_decision.discovery_digest,
      task_candidate_id: approvedDecision.pipeline_task_decision.task_candidate_id,
      candidate_digest: approvedDecision.pipeline_task_decision.candidate_digest,
      approval_decision_id: approvedDecision.pipeline_task_decision.decision_id,
      approval_decision_digest: approvedDecision.pipeline_task_decision.decision_digest,
      approval_actor: approvedDecision.pipeline_task_decision.actor,
      intent_source: "customer_approved_candidate",
      task: {
        description: "Move the rigid item into the tote.",
        task_family: "rigid_object_pick_place",
        measurable_success_conditions: [{
          metric: "object_center_distance",
          operator: "<=",
          threshold: 0.05,
          units: "m",
        }],
        reset_contract: { instructions: "Return item to table marker." },
      },
      proposer_identity: "provider:model-a",
      prohibited_evaluator_identities: [],
      approval_status: "approved",
    };
    approvedTask.approved_task_digest = canonicalArtifactDigest(
      approvedTask,
      "approved_task_digest",
    );
    approvedDecision.approved_task_definition = approvedTask as never;
    approvedDecision.proof_boundary.approved_task_exists = true;

    const parsed = parseVerifiedPipelineTaskDecisionResult(approvedDecision);
    expect(parsed).toEqual({
      ok: false,
      blockers: [
        "approved_task_decision_binding_mismatch",
        "approved_task_proposer_self_grading_boundary_missing",
      ],
    });
  });
});
