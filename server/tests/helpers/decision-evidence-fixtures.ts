import {
  DECISION_EVIDENCE_REQUEST_SCHEMA_VERSION,
  type DecisionEnvelope,
  type DecisionEvidenceRequest,
} from "../../utils/decisionEvidenceContract";

const digest = `sha256:${"a".repeat(64)}`;

export function validDecisionRequest(
  overrides: Partial<DecisionEvidenceRequest> = {},
): DecisionEvidenceRequest {
  return {
    schema_version: DECISION_EVIDENCE_REQUEST_SCHEMA_VERSION,
    request_id: "request-001",
    decision_id: "decision-001",
    testbed: {
      testbed_id: "testbed-001",
      version: "2026-07-29.1",
      digest_sha256: digest,
    },
    decision_question: "Should field time be allocated to candidate A for this task?",
    site_task: {
      site_id: "site-001",
      site_name: "Illustrative receiving cell",
      task_id: "task-001",
      task_description: "Move a rigid tote from staging to the target fixture.",
      conditions: ["dry floor", "day shift", "fixture revision 4"],
    },
    candidates: [
      {
        candidate_id: "candidate-a",
        kind: "policy",
        label: "Candidate A",
        reference: { external_id: "customer-policy-a" },
      },
    ],
    claims: [
      {
        claim_id: "reach-target",
        statement: "Candidate A can reach the target fixture.",
        threshold_ids: ["reach-rate"],
      },
    ],
    thresholds: [
      {
        threshold_id: "reach-rate",
        metric: "reach success rate",
        operator: "gte",
        value: 0.95,
        unit: "ratio",
      },
    ],
    false_safe: {
      severity: "high",
      consequence: "A false-safe would waste field time and could damage the fixture.",
    },
    confidence_requirement: {
      kind: "acceptable_risk",
      value: 0.05,
      unit: "probability",
      description: "No more than five percent accepted false-safe risk.",
    },
    constraints: {
      budget: { amount: 5000, currency: "USD", hard_cap: true },
      deadline: "2026-08-15T17:00:00-05:00",
      available_physical_evidence: [],
      allowed_site_changes: ["move staging marker within 10 cm"],
      physical_testing_possible: true,
      rights_privacy_provider_restrictions: ["no raw video leaves Blueprint storage"],
    },
    requested_audience: ["robot_team"],
    routing_authority: {
      system: "BlueprintCapturePipeline",
      method_selection: "pipeline_qualified_least_cost_sufficient_evidence",
      webapp_backend_selection_allowed: false,
    },
    idempotency: {
      key: "request-001-attempt-1",
      scope: "authenticated_owner_and_decision",
    },
    provenance: {
      source_system: "Blueprint-WebApp",
      source_route: "/app/runs/new",
      submitted_at_iso: "2026-07-29T12:00:00-05:00",
      request_contract_source: "pipeline_proposed_mirror",
    },
    owner: {
      user_id: "buyer-001",
      tenant_id: "tenant-001",
      authenticated_by: "firebase",
    },
    commercial: {
      engagement: "scoped_task_evaluation_run",
      quote_required: true,
      client_supplied_price: false,
    },
    ...overrides,
  };
}

export function validDecisionEnvelope(
  overrides: Partial<DecisionEnvelope> = {},
): DecisionEnvelope {
  return {
    schema_version: "blueprint.decision_envelope.v1",
    request_id: "request-001",
    decision_id: "decision-001",
    state: "decision_available",
    requested_decision: "Should field time be allocated to candidate A for this task?",
    testbed: {
      testbed_id: "testbed-001",
      version: "2026-07-29.1",
      digest_sha256: digest,
    },
    overall: {
      outcome: "partial",
      summary: "Candidate A can reach the fixture; onsite performance remains unresolved.",
      decided_claim_ids: ["reach-target"],
      unresolved_claim_ids: ["onsite-outperformance"],
      selected_candidate_ids: [],
    },
    claim_outcomes: [
      {
        claim_id: "reach-target",
        statement: "Candidate A can reach the target fixture.",
        outcome: "supported",
        conclusion: "Supported inside the stated geometry envelope.",
        evidence_ref_ids: ["geometry-001"],
        uncertainty: "Fixture compliance was not measured.",
        physical_evidence_required: false,
      },
      {
        claim_id: "onsite-outperformance",
        statement: "Candidate A will outperform candidate B onsite.",
        outcome: "inconclusive",
        conclusion: "The current evidence cannot support onsite ordering.",
        evidence_ref_ids: ["simulation-001"],
        uncertainty: "No qualified physical anchor is available.",
        physical_evidence_required: true,
      },
    ],
    evidence_methods: [
      {
        method_id: "geometry-check",
        evidence_class: "geometry",
        name: "Captured geometry reach check",
        selection_reason: "It was the least expensive qualified method for reachability.",
        qualification_profile_ref: {
          artifact_id: "method-profile-001",
          kind: "evidence_method_profile",
          uri: "gs://bucket/method-profile.json",
          version: "1.2.0",
          digest_sha256: digest,
          evidence_class: "geometry",
        },
        measured: ["target reach envelope"],
      },
    ],
    validation_envelope: {
      supported_conditions: ["fixture revision 4", "captured geometry bounds"],
      unsupported_conditions: ["wet floor", "fixture compliance", "production traffic"],
      method_profile_versions: ["geometry-reach@1.2.0"],
    },
    coverage: {
      evaluated_claim_ids: ["reach-target", "onsite-outperformance"],
      unresolved_claim_ids: ["onsite-outperformance"],
      summary: "One of two decision-relevant claims is resolved.",
    },
    uncertainty: {
      summary: "Onsite interaction dynamics remain unknown.",
      sources: ["missing physical anchor"],
    },
    disagreements: {
      summary: "Geometry and simulation agree on reach; no onsite comparator exists.",
      items: [],
      correlated_evidence_warning: "Both virtual methods reuse the same captured geometry.",
    },
    claim_ceiling: {
      level: "virtual_task_compatibility_only",
      summary: "The result supports reachability, not autonomous production safety.",
      prohibited_claims: ["safe for autonomous production deployment"],
    },
    next_cheapest_experiment: {
      description: "Run five instrumented supervised physical attempts.",
      rationale: "A physical anchor is the cheapest remaining way to test onsite ordering.",
      estimated_cost: "quoted after authorization",
      estimated_time: "one supervised shift",
      physical_required: true,
    },
    physical_evidence: {
      required: true,
      reasons: ["onsite ordering remains unresolved"],
      authoritative_join_ids: [],
    },
    consumption: { cost: "not reported", elapsed_time: "2h 14m" },
    artifacts: [
      {
        artifact_id: "geometry-001",
        kind: "normalized_evidence_result",
        uri: "gs://bucket/geometry-result.json",
        version: "1.0.0",
        digest_sha256: digest,
        evidence_class: "geometry",
      },
    ],
    permitted_evidence_uses: {
      evaluation: true,
      post_training: false,
      reason: "The geometry result may support evaluation but is not training-eligible.",
      qualifying_artifact_ids: ["geometry-001"],
      training_performed: false,
      policy_improved: false,
    },
    provenance: {
      pipeline_run_id: "pipeline-run-001",
      generated_at_iso: "2026-07-29T14:00:00-05:00",
      contract_source: "BlueprintCapturePipeline",
    },
    ...overrides,
  };
}
