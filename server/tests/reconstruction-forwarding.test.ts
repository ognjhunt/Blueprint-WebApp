// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { canonicalArtifactDigest } from "../utils/taskCandidateContract";
import {
  forwardReconstructionAuthorizationToPipeline,
  forwardReconstructionExecutionToPipeline,
  forwardReconstructionPlanToPipeline,
  forwardTestbedCompilationToPipeline,
  inspectReconstructionInPipeline,
} from "../utils/reconstructionForwarding";

const captureDigest = `sha256:${"1".repeat(64)}`;
const contextDigest = `sha256:${"2".repeat(64)}`;

function artifacts() {
  const plan: Record<string, any> = {
    schema_version: "reconstruction_plan.v1",
    source_capture: {
      intake_id: "intake-1",
      capture_digest: captureDigest,
      capture_authority_profile: "monocular_video",
    },
    requested_claim_types: ["task_discovery"],
    required_representations: ["decoded_observation_frames"],
    selected_methods: [{
      representations: ["decoded_observation_frames"],
      method_id: "local-decoded-observation-index",
      method_version: "1",
      method_profile_digest: `sha256:${"3".repeat(64)}`,
      provider_identity: "local",
      adapter_reference: "local://decoded-observation-index-v1",
      expected_cost_usd: 0,
    }],
    missing_representations: [],
    estimated_cost_usd: 0,
    status: "planned",
    proof_boundary: {
      provider_availability_is_qualification: false,
      generated_completion_upgrades_metric_or_physics_claims: false,
      physical_task_success_established: false,
    },
  };
  plan.reconstruction_plan_digest = canonicalArtifactDigest(plan, "reconstruction_plan_digest");
  const planResult = {
    schema_version: "reconstruction_control_plane_plan_result.v1",
    plan_id: "reconstruction-1",
    state: "authorization_required",
    context_digest: contextDigest,
    reconstruction_plan: plan,
    authorization_candidates: [{
      method_id: "local-decoded-observation-index",
      method_profile_digest: `sha256:${"3".repeat(64)}`,
      adapter_reference: "local://decoded-observation-index-v1",
      execution_authorized: false,
    }],
    next_cheapest_experiments: [],
    proof_boundary: {
      plan_is_execution_authorization: false,
      derived_reconstruction_upgrades_raw_capture: false,
      physical_task_success_established: false,
      comparative_policy_ranking_verdict: "thesis_not_supported",
    },
  };
  const authorization: Record<string, any> = {
    schema_version: "reconstruction_execution_authorization.v1",
    plan_id: "reconstruction-1",
    reconstruction_plan_digest: plan.reconstruction_plan_digest,
    context_digest: contextDigest,
    authorized_adapter_references: ["local://decoded-observation-index-v1"],
    actor: { role: "customer", identity: "firebase:buyer-1" },
    idempotency_key: "authorize-reconstruction-1",
    live_provider_execution: false,
    paid_compute_authorized: false,
    physical_robot_run_authorized: false,
    proof_boundary: {
      authorization_is_method_qualification: false,
      simulation_is_physical_success: false,
      comparative_policy_ranking_verdict: "thesis_not_supported",
    },
  };
  authorization.authorization_digest = canonicalArtifactDigest(
    authorization,
    "authorization_digest",
  );
  const execution: Record<string, any> = {
    schema_version: "reconstruction_control_plane_execution_result.v1",
    plan_id: "reconstruction-1",
    state: "completed",
    reconstruction_plan_digest: plan.reconstruction_plan_digest,
    authorization_digest: authorization.authorization_digest,
    context_digest: contextDigest,
    results: [{ reconstruction_result_digest: `sha256:${"4".repeat(64)}` }],
    errors: [],
    missing_representations: [],
    next_cheapest_experiments: [],
    cost_usd: 0,
    proof_boundary: {
      execution_was_local_and_explicitly_authorized: true,
      derived_reconstruction_upgrades_raw_capture: false,
      physical_task_success_established: false,
      deployment_or_safety_approved: false,
      comparative_policy_ranking_verdict: "thesis_not_supported",
    },
    already_exists: false,
  };
  execution.execution_result_digest = canonicalArtifactDigest(
    execution,
    "execution_result_digest",
  );
  const inspection = {
    schema_version: "reconstruction_control_plane_inspection.v1",
    plan_id: "reconstruction-1",
    state: "completed",
    source_binding: {
      capture_session_id: "capture-session-1",
      intake_id: "intake-1",
      capture_digest: captureDigest,
      envelope_digest: `sha256:${"5".repeat(64)}`,
      qa_report_digest: `sha256:${"6".repeat(64)}`,
      object_manifest_digest: `sha256:${"7".repeat(64)}`,
      context_digest: contextDigest,
    },
    reconstruction_plan: plan,
    execution_authorization: authorization,
    execution_result: execution,
    proof_boundary: {
      inspection_recomputes_scientific_truth: false,
      physical_task_success_established: false,
      comparative_policy_ranking_verdict: "thesis_not_supported",
    },
  };
  const compilation = {
    schema_version: "site_task_testbed_compilation_response.v1",
    status: "testbed_ready",
    capture_session_id: "capture-session-1",
    intake_id: "intake-1",
    testbed_id: "testbed-1",
    version: "1",
    testbed_digest: `sha256:${"8".repeat(64)}`,
    already_exists: false,
    artifact_reference: {
      uri: "testbed://testbed-1/1/fixture.json",
      digest: `sha256:${"8".repeat(64)}`,
    },
    testbed: { approved_task_definition: { digest: `sha256:${"9".repeat(64)}` } },
    decision_evidence_request: { request_digest: `sha256:${"a".repeat(64)}` },
    decision_evidence_request_artifact: {},
    webapp_sync: { status: "succeeded" },
    proof_boundary: {
      appearance_is_collision_truth: false,
      generated_completion_is_observed_truth: false,
      simulation_is_physical_success: false,
      deployment_or_safety_approved: false,
      comparative_policy_ranking_verdict: "thesis_not_supported",
    },
  } as const;
  return { plan, planResult, authorization, execution, inspection, compilation };
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.RECONSTRUCTION_PIPELINE_BASE_URL;
  delete process.env.RECONSTRUCTION_FORWARD_TOKEN;
});

describe("reconstruction forwarding", () => {
  it("validates exact source, plan, authorization, execution, and inspection bindings", async () => {
    process.env.RECONSTRUCTION_PIPELINE_BASE_URL = "https://pipeline.example/api/live-pipeline";
    process.env.RECONSTRUCTION_FORWARD_TOKEN = "reconstruction-secret";
    const value = artifacts();
    const fetch = vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("/reconstructions/plan")) return Response.json(value.planResult);
      if (url.endsWith("/authorize")) return Response.json(value.authorization);
      if (url.endsWith("/execute")) return Response.json(value.execution);
      if (url.endsWith("/testbeds/compile")) return Response.json(value.compilation);
      expect(init.method).toBe("GET");
      return Response.json(value.inspection);
    });
    vi.stubGlobal("fetch", fetch);

    const planned = await forwardReconstructionPlanToPipeline({
      captureSessionId: "capture-session-1",
      intakeId: "intake-1",
      captureDigest,
      requestedClaimTypes: ["task_discovery"],
      idempotencyKey: "plan-reconstruction-1",
    });
    expect(planned.status).toBe("forwarded");
    const authorized = await forwardReconstructionAuthorizationToPipeline({
      planId: "reconstruction-1",
      reconstructionPlanDigest: value.plan.reconstruction_plan_digest,
      authorizedAdapterReferences: ["local://decoded-observation-index-v1"],
      actor: { role: "customer", identity: "firebase:buyer-1" },
      idempotencyKey: "authorize-reconstruction-1",
    });
    expect(authorized.status).toBe("forwarded");
    const executed = await forwardReconstructionExecutionToPipeline({
      planId: "reconstruction-1",
      reconstructionPlanDigest: value.plan.reconstruction_plan_digest,
      authorizationDigest: value.authorization.authorization_digest,
    });
    expect(executed.status).toBe("forwarded");
    const inspected = await inspectReconstructionInPipeline({
      planId: "reconstruction-1",
      captureSessionId: "capture-session-1",
      intakeId: "intake-1",
      captureDigest,
    });
    expect(inspected.status).toBe("forwarded");
    const compiled = await forwardTestbedCompilationToPipeline({
      captureSessionId: "capture-session-1",
      intakeId: "intake-1",
      testbedId: "testbed-1",
      version: "1",
      approvedTaskDigest: `sha256:${"9".repeat(64)}`,
      reconstructionPlanId: "reconstruction-1",
      reconstructionExecutionResultDigest: value.execution.execution_result_digest,
      robotBinding: { robot_id: "fixture-arm" },
      decisionRequestConstraints: { claims: [] },
    });
    expect(compiled.status).toBe("forwarded");
    const compileCall = fetch.mock.calls.find(([url]) => String(url).endsWith("/testbeds/compile"));
    const compileBody = JSON.parse(String((compileCall?.[1] as RequestInit | undefined)?.body));
    expect(compileBody).toMatchObject({
      schema_version: "site_task_testbed_compilation_submission.v2",
      robot_binding: { robot_id: "fixture-arm" },
    });
    expect(compileBody).not.toHaveProperty("simready_decision");
    expect(compileBody).not.toHaveProperty("robot_placement_result");
    expect(fetch).toHaveBeenCalledTimes(5);
  });

  it("rejects a validly shaped plan bound to another capture digest", async () => {
    process.env.RECONSTRUCTION_PIPELINE_BASE_URL = "https://pipeline.example/api/live-pipeline";
    process.env.RECONSTRUCTION_FORWARD_TOKEN = "reconstruction-secret";
    const value = artifacts();
    value.plan.source_capture.capture_digest = `sha256:${"8".repeat(64)}`;
    value.plan.reconstruction_plan_digest = canonicalArtifactDigest(
      value.plan,
      "reconstruction_plan_digest",
    );
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(value.planResult)));

    const result = await forwardReconstructionPlanToPipeline({
      captureSessionId: "capture-session-1",
      intakeId: "intake-1",
      captureDigest,
      requestedClaimTypes: ["task_discovery"],
      idempotencyKey: "plan-reconstruction-2",
    });
    expect(result).toMatchObject({
      status: "failed",
      performed: false,
      blocker: "pipeline_reconstruction_plan_binding_mismatch",
    });
  });
});
