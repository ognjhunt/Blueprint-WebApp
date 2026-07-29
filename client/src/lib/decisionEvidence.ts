export const DECISION_REQUEST_SCHEMA_VERSION =
  "blueprint.decision_evidence_request.v1" as const;

export type DecisionRunState =
  | "draft"
  | "submitted"
  | "accepted"
  | "planning"
  | "awaiting_authorization"
  | "running"
  | "aggregating"
  | "decision_available"
  | "abstained"
  | "blocked"
  | "failed"
  | "superseded";

export type EvidenceArtifact = {
  artifact_id: string;
  kind: string;
  uri: string;
  version: string;
  digest_sha256: string;
  evidence_class:
    | "fixture"
    | "geometry"
    | "real_observation"
    | "traditional_simulation"
    | "world_model"
    | "provider_tool"
    | "physical";
};

export type DecisionEnvelope = {
  schema_version: "blueprint.decision_envelope.v1";
  request_id: string;
  decision_id: string;
  state: DecisionRunState;
  requested_decision: string;
  testbed: {
    testbed_id: string;
    version: string;
    digest_sha256: string;
    manifest_uri?: string;
  };
  overall: {
    outcome:
      | "bounded_positive"
      | "bounded_negative"
      | "partial"
      | "abstained"
      | "blocked"
      | "failed";
    summary: string;
    decided_claim_ids: string[];
    unresolved_claim_ids: string[];
    selected_candidate_ids: string[];
  };
  claim_outcomes: Array<{
    claim_id: string;
    statement: string;
    outcome: "supported" | "not_supported" | "inconclusive" | "unsupported";
    conclusion: string;
    evidence_ref_ids: string[];
    uncertainty: string;
    physical_evidence_required: boolean;
  }>;
  evidence_methods: Array<{
    method_id: string;
    evidence_class: EvidenceArtifact["evidence_class"];
    name: string;
    selection_reason: string;
    qualification_profile_ref: EvidenceArtifact;
    measured: string[];
  }>;
  validation_envelope: {
    supported_conditions: string[];
    unsupported_conditions: string[];
    method_profile_versions: string[];
  };
  coverage: {
    evaluated_claim_ids: string[];
    unresolved_claim_ids: string[];
    summary: string;
  };
  uncertainty: { summary: string; sources: string[] };
  disagreements: {
    summary: string;
    items: Array<{
      claim_id: string;
      description: string;
      evidence_ref_ids: string[];
    }>;
    correlated_evidence_warning?: string;
  };
  claim_ceiling: { level: string; summary: string; prohibited_claims: string[] };
  next_cheapest_experiment: {
    description: string;
    rationale: string;
    estimated_cost?: string;
    estimated_time?: string;
    physical_required: boolean;
  };
  physical_evidence: {
    required: boolean;
    reasons: string[];
    authoritative_join_ids: string[];
  };
  consumption?: { cost?: string; elapsed_time?: string };
  artifacts: EvidenceArtifact[];
  permitted_evidence_uses: {
    evaluation: boolean;
    post_training: boolean;
    reason: string;
    qualifying_artifact_ids: string[];
    training_performed: false;
    policy_improved: false;
  };
  supersession?: { superseded_by_decision_id: string; reason: string };
  provenance: {
    pipeline_run_id: string;
    generated_at_iso: string;
    contract_source: "BlueprintCapturePipeline";
  };
};

export type DecisionProjection =
  | { supported: true; envelope: DecisionEnvelope }
  | { supported: false; reason: string; raw_state: string | null };

export function splitLines(value: string) {
  return value
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function newContractId(prefix: string) {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  return `${prefix}-${random}`;
}
