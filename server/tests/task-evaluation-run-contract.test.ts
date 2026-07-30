// @vitest-environment node
import { describe, expect, it } from "vitest";

import { canonicalArtifactDigest } from "../utils/taskCandidateContract";
import { parseVerifiedTaskEvaluationRunPublication } from "../utils/taskEvaluationRunContract";

const sha = (character: string) => `sha256:${character.repeat(64)}`;

function evidencePlan() {
  const value: Record<string, any> = {
    schema_version: "evidence_plan.v1",
    plan_id: "plan-1",
    request_id: "request-1",
    decision_id: "decision-1",
    request_digest: sha("a"),
    testbed_id: "testbed-1",
    testbed_version: "1",
    testbed_digest: sha("b"),
    claim_plans: [{ claim_id: "reach", status: "planned" }],
    execution_order: ["step-reach"],
    stop_conditions: [],
    escalation_conditions: [],
    physical_evidence_requests: [],
    compiled_evaluation_run_specs: [],
    non_evaluation_run_steps: [],
    budget_status: { max_cost_usd: 0, projected_cost_usd: 0, within_budget: true },
    prohibited_claims: ["physical_task_success"],
    shared_dependency_warnings: [],
    router_policy: {
      deterministic: true,
      provider_identity_is_qualification: false,
      visual_realism_is_qualification: false,
      agreement_is_independence: false,
      uncalibrated_methods_are_debug_only: true,
      cross_domain_transfer_enabled: false,
      policy_ranking_thesis_verdict: "thesis_not_supported",
    },
  };
  value.plan_digest = canonicalArtifactDigest(value, "plan_digest");
  return value;
}

function decisionEnvelope(plan = evidencePlan()) {
  const value: Record<string, any> = {
    schema_version: "decision_envelope.v1",
    decision_id: plan.decision_id,
    request_id: plan.request_id,
    request_digest: plan.request_digest,
    plan_digest: plan.plan_digest,
    testbed_digest: plan.testbed_digest,
    decision_question: "Can the robot reach the target?",
    overall_outcome: "decision",
    per_claim_verdicts: [{
      claim_id: "reach",
      claim_type: "reachability",
      verdict: "supported",
      rationale: "qualified_evidence_satisfies_claim",
      accepted_result_digests: [sha("c")],
      claim_ceiling: {
        physical_success: false,
        deployment_readiness: false,
        safety_certification: false,
      },
    }],
    evidence_accepted: [sha("c")],
    evidence_rejected: [],
    validation_envelope: { exact_scope: true },
    unsupported_conditions: ["physical_task_success"],
    uncertainty: { maximum: 0.1, ranking_science_boundary: "thesis_not_supported" },
    severity_weighted_false_safe_risk: 0.01,
    false_reject_estimate: 0.02,
    evidence_coverage: 0.95,
    abstention_rate: 0,
    cross_method_disagreements: [],
    shared_dependency_warnings: [],
    claim_ceiling: {
      task_evaluation_run_decision: true,
      physical_success: false,
      deployment_readiness: false,
      safety_certification: false,
      generated_artifact_upgrades_raw_or_physical_claim: false,
    },
    decision_rationale: "claim_level_qualified_evidence_with_fail_closed_abstention",
    next_cheapest_experiment: "none_required",
    physical_evidence_still_required: [],
    input_run_result_testbed_digests: [plan.request_digest, plan.plan_digest, plan.testbed_digest, sha("c")],
    deployment_approval: false,
    safety_certification: false,
    raw_policy_values_persisted: false,
    raw_secret_values_persisted: false,
  };
  value.decision_envelope_digest = canonicalArtifactDigest(value, "decision_envelope_digest");
  return value;
}

function publication() {
  const plan = evidencePlan();
  const envelope = decisionEnvelope(plan);
  return {
    schema_version: "task_evaluation_run_publication.v1",
    capture_session_id: "capture-1",
    intake_id: "intake-1",
    run_id: "run-1",
    testbed_digest: plan.testbed_digest,
    request_digest: plan.request_digest,
    plan_digest: plan.plan_digest,
    state: "decided",
    evidence_plan: plan,
    decision_envelope: envelope,
    proof_boundary: {
      simulation_is_physical_success: false,
      deployment_or_safety_approved: false,
      comparative_policy_ranking_verdict: "thesis_not_supported",
    },
  };
}

describe("native Pipeline Task Evaluation Run publication", () => {
  it("accepts one exactly bound plan and Decision Envelope", () => {
    const result = parseVerifiedTaskEvaluationRunPublication(publication());
    expect(result).toMatchObject({ ok: true });
  });

  it("rejects digest tampering, state upgrades, and secret-bearing artifacts", () => {
    const tampered = publication();
    tampered.decision_envelope.next_cheapest_experiment = "changed";
    expect(parseVerifiedTaskEvaluationRunPublication(tampered)).toMatchObject({
      ok: false,
      blockers: ["decision_envelope_digest_mismatch"],
    });

    const upgraded = publication();
    upgraded.state = "abstained";
    expect(parseVerifiedTaskEvaluationRunPublication(upgraded)).toMatchObject({
      ok: false,
      blockers: ["run_publication_state_mismatch"],
    });

    const secret = publication();
    secret.decision_envelope.provider_access_token = "must-not-store";
    secret.decision_envelope.decision_envelope_digest = canonicalArtifactDigest(
      secret.decision_envelope,
      "decision_envelope_digest",
    );
    expect(parseVerifiedTaskEvaluationRunPublication(secret)).toMatchObject({
      ok: false,
      blockers: ["run_publication_secret_value_forbidden"],
    });
  });
});
