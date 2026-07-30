// @vitest-environment node
import express from "express";
import { createServer, request as httpRequest, type Server } from "node:http";
import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import { canonicalArtifactDigest } from "../utils/taskCandidateContract";

const state = vi.hoisted(() => ({
  records: new Map<string, Record<string, unknown>>(),
  start: vi.fn(),
  authorize: vi.fn(),
  listParts: vi.fn(),
  finish: vi.fn(),
  fileInfo: vi.fn(),
  downloadGrant: vi.fn(),
  cancel: vi.fn(),
  deleteCapture: vi.fn(),
  forward: vi.fn(),
  planForward: vi.fn(),
  authorizationForward: vi.fn(),
  executionForward: vi.fn(),
  intakeForward: vi.fn(),
  lifecycleApply: vi.fn(),
  lifecycleEvidence: vi.fn(),
  lifecycleInspect: vi.fn(),
  reconstructionPlan: vi.fn(),
  reconstructionAuthorization: vi.fn(),
  reconstructionExecution: vi.fn(),
  reconstructionInspect: vi.fn(),
  testbedCompile: vi.fn(),
  beforeTransaction: null as (() => void) | null,
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {},
  dbAdmin: {
    runTransaction: async <T>(
      callback: (transaction: {
        get: (reference: { get: () => Promise<unknown> }) => Promise<unknown>;
        create: (
          reference: { create: (payload: Record<string, unknown>) => Promise<void> },
          payload: Record<string, unknown>,
        ) => void;
        set: (
          reference: {
            set: (
              payload: Record<string, unknown>,
              options?: { merge?: boolean },
            ) => Promise<void>;
          },
          payload: Record<string, unknown>,
          options?: { merge?: boolean },
        ) => void;
      }) => Promise<T>,
    ) => {
      state.beforeTransaction?.();
      return callback({
        get: (reference) => reference.get(),
        create: (reference, payload) => {
          void reference.create(payload);
        },
        set: (reference, payload, options) => {
          void reference.set(payload, options);
        },
      });
    },
    collection: () => ({
      where: (_field: string, _operator: string, value: string) => ({
        limit: () => ({
          get: async () => ({
            docs: [...state.records.entries()]
              .filter(([, record]) => record.owner_user_id === value)
              .map(([id, record]) => ({ id, data: () => structuredClone(record) })),
          }),
        }),
      }),
      doc: (id: string) => ({
        get: async () => ({
          exists: state.records.has(id),
          data: () => state.records.get(id),
        }),
        create: async (payload: Record<string, unknown>) => {
          if (state.records.has(id)) throw new Error("already exists");
          state.records.set(id, structuredClone(payload));
        },
        set: async (payload: Record<string, unknown>, options?: { merge?: boolean }) => {
          const next = options?.merge
            ? { ...(state.records.get(id) || {}), ...structuredClone(payload) }
            : structuredClone(payload);
          state.records.set(id, next);
        },
      }),
    }),
  },
}));

vi.mock("../utils/storage-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/storage-provider")>();
  return {
    ...actual,
    resolveStorageProviderName: () => "backblaze",
    startBackblazeResumableCapture: state.start,
    authorizeBackblazeCapturePart: state.authorize,
    listBackblazeCaptureParts: state.listParts,
    finishBackblazeResumableCapture: state.finish,
    getBackblazeCaptureFileInfo: state.fileInfo,
    createBackblazeCaptureDownloadGrant: state.downloadGrant,
    cancelBackblazeResumableCapture: state.cancel,
    deleteBackblazeCaptureFile: state.deleteCapture,
  };
});

vi.mock("../utils/taskCandidateForwarding", () => ({
  forwardTaskCandidateDecisionToPipeline: state.forward,
}));

vi.mock("../utils/captureUploadForwarding", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/captureUploadForwarding")>();
  return {
    ...actual,
    forwardCaptureUploadToPipeline: state.intakeForward,
  };
});

vi.mock("../utils/taskEvaluationRunForwarding", () => ({
  forwardTaskEvaluationRunPlanToPipeline: state.planForward,
  forwardTaskEvaluationRunAuthorizationToPipeline: state.authorizationForward,
  forwardTaskEvaluationRunExecutionToPipeline: state.executionForward,
}));

vi.mock("../utils/captureLifecycleForwarding", () => ({
  applyCompletedCaptureLifecycleToPipeline: state.lifecycleApply,
  recordCaptureExternalRevocationEvidenceInPipeline: state.lifecycleEvidence,
  inspectCompletedCaptureLifecycleInPipeline: state.lifecycleInspect,
}));

vi.mock("../utils/reconstructionForwarding", () => ({
  forwardReconstructionPlanToPipeline: state.reconstructionPlan,
  forwardReconstructionAuthorizationToPipeline: state.reconstructionAuthorization,
  forwardReconstructionExecutionToPipeline: state.reconstructionExecution,
  inspectReconstructionInPipeline: state.reconstructionInspect,
  forwardTestbedCompilationToPipeline: state.testbedCompile,
}));

async function startServer(firebaseUser: Record<string, unknown> = { uid: "buyer-123" }) {
  const { default: router } = await import("../routes/capture-uploads");
  const app = express();
  app.use(express.json());
  app.use((_, response, next) => {
    response.locals.firebaseUser = firebaseUser;
    next();
  });
  app.use("/capture-uploads", router);
  const server = createServer(app);
  const socketPath = join(tmpdir(), `blueprint-capture-upload-${randomUUID()}.sock`);
  await new Promise<void>((resolve) => server.listen(socketPath, resolve));
  return { server, socketPath };
}

async function stopServer(server: Server, socketPath: string) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  try {
    unlinkSync(socketPath);
  } catch {
    // Node may remove the Unix socket after close.
  }
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "capture_upload_session_request.v1",
    intake_id: "intake-360-1",
    idempotency_key: "buyer-123:intake-360-1",
    capture_authority_profile: "camera_360_equirectangular",
    source_type: "camera_360_equirectangular",
    scene_id: "scene-1",
    organization_id: "org-1",
    original_file: {
      original_filename: "warehouse-tour.mp4",
      size_bytes: 130 * 1024 * 1024,
      media_type: "video/mp4",
    },
    capture_device: { manufacturer: "Insta360", model: "X5" },
    timing_declaration: { clock: "media_pts", monotonic_time_available: false },
    coordinate_frame_declaration: { status: "not_available_from_video" },
    available_sensor_streams: [
      { stream_type: "retained_video", status: "available" },
      { stream_type: "camera_metadata", status: "available" },
    ],
    governance: {
      rights: "accepted",
      consent: "accepted",
      privacy: "cleared",
      retention: { max_days: 30 },
      revocation: { supported: true, historical_tombstone_retained: true },
      provider_constraints: { external_processing_allowed: false },
      allowed_uses: ["evaluation"],
    },
    requested_task_evaluation_run_audience: "design_partner",
    known_task_specification: null,
    calibration_board_dimensions: null,
    operator_notes: [],
    permitted_reconstruction_providers: ["local_only"],
    permitted_evidence_uses: ["captured_observation", "task_discovery"],
    ...overrides,
  };
}

function taskDiscovery() {
  const candidate: Record<string, unknown> = {
    description: "Move the blue tote from the table to the marked box.",
    observed_objects: [{
      object_id: "tote-1",
      label: "blue tote",
      observation_fact_ids: ["fact-tote"],
    }],
    target_regions: [{ region_id: "box-1", label: "marked box" }],
    required_robot_capabilities: ["rigid-object grasp"],
    likely_task_family: "rigid_object_pick_place",
    proposed_measurable_success_condition: {
      metric: "object_center_distance",
      operator: "<=",
      threshold: 0.05,
      units: "m",
    },
    required_site_reset: "Return the tote to the table marker.",
    supporting_frames: ["frame-10"],
    supporting_3d_regions: ["region-table", "box-1"],
    confidence: 0.94,
    coverage: { task_object: 0.8 },
    assumptions: ["The tote is movable."],
    missing_evidence: ["Rear grasp surface is occluded."],
    prohibited_claims: ["physical_task_success"],
    estimated_evaluation_cost_usd: 2.5,
    expected_customer_value: null,
    proposal_method: {
      method_id: "local-task-proposer",
      version: "1",
      implementation_digest: `sha256:${"c".repeat(64)}`,
      proposer_identity: "provider:model-a",
      origin: "model_provider",
    },
    approval_status: "approval_required",
  };
  candidate.task_candidate_id = "task-candidate-1";
  candidate.candidate_digest = canonicalArtifactDigest(candidate, "candidate_digest");
  const discovery: Record<string, unknown> = {
    schema_version: "task_candidate_discovery.v1",
    discovery_id: "discovery-1",
    source_capture: {
      intake_id: "intake-360-1",
      capture_digest: `sha256:${"a".repeat(64)}`,
      capture_authority_profile: "camera_360_equirectangular",
    },
    capture_qa_report_digest: `sha256:${"b".repeat(64)}`,
    scene_analysis: {
      observed_site_facts: [{
        fact_id: "fact-tote",
        description: "A blue tote is visible on the table.",
        confidence: 0.98,
        supporting_frames: ["frame-10"],
        supporting_3d_regions: ["region-table"],
        observation_status: "directly_observed",
        row_digest: `sha256:${"d".repeat(64)}`,
      }],
      inferred_objects_and_affordances: [],
      unsupported_or_occluded_regions: [],
      hazards: [],
      privacy_sensitive_areas: [],
    },
    proposal_method: candidate.proposal_method,
    task_candidates: [candidate],
    approval_state: "task_approval_required",
    claim_boundaries: {
      candidate_is_customer_intent: false,
      candidate_is_task_success_evidence: false,
      generated_or_inferred_content_upgrades_capture_authority: false,
    },
  };
  discovery.discovery_digest = canonicalArtifactDigest(discovery, "discovery_digest");
  return discovery;
}

function seededReviewSession() {
  return {
    schema_version: "capture_upload_session_record.v1",
    session_id: "capture-review-1",
    owner_user_id: "buyer-123",
    status: "uploaded_verification_pending",
    request: request(),
    request_fingerprint_sha256: `sha256:${"e".repeat(64)}`,
    part_size_bytes: 64 * 1024 * 1024,
    expected_part_count: 3,
    pipeline_task_discovery: taskDiscovery(),
    created_at_iso: "2026-07-29T20:00:00.000Z",
    updated_at_iso: "2026-07-29T20:01:00.000Z",
  };
}

function pipelineDecisionResult(discovery: Record<string, any>) {
  const candidate = discovery.task_candidates[0] as Record<string, any>;
  const decision: Record<string, unknown> = {
    schema_version: "task_candidate_decision.v1",
    discovery_id: discovery.discovery_id,
    discovery_digest: discovery.discovery_digest,
    task_candidate_id: candidate.task_candidate_id,
    candidate_digest: candidate.candidate_digest,
    action: "approve",
    actor: { role: "customer", identity: "firebase:buyer-123" },
    idempotency_key: "approve-task-candidate-1",
    rationale: "This is the exact task we want evaluated.",
    edited_task: null,
    decision_id: "task-decision-1",
  };
  decision.decision_digest = canonicalArtifactDigest(decision, "decision_digest");
  const approved: Record<string, unknown> = {
    schema_version: "approved_task_definition.v1",
    approved_task_id: "approved-task-1",
    source_capture: discovery.source_capture,
    discovery_id: discovery.discovery_id,
    discovery_digest: discovery.discovery_digest,
    task_candidate_id: candidate.task_candidate_id,
    candidate_digest: candidate.candidate_digest,
    approval_decision_id: decision.decision_id,
    approval_decision_digest: decision.decision_digest,
    approval_actor: decision.actor,
    intent_source: "customer_approved_candidate",
    task: {
      description: candidate.description,
      task_family: candidate.likely_task_family,
      measurable_success_conditions: [candidate.proposed_measurable_success_condition],
      reset_contract: { instructions: candidate.required_site_reset },
      task_objects: candidate.observed_objects,
      target_regions: candidate.target_regions,
      required_robot_capabilities: candidate.required_robot_capabilities,
    },
    proposer_identity: discovery.proposal_method.proposer_identity,
    prohibited_evaluator_identities: [discovery.proposal_method.proposer_identity],
    approval_status: "approved",
  };
  approved.approved_task_digest = canonicalArtifactDigest(
    approved,
    "approved_task_digest",
  );
  return {
    schema_version: "task_candidate_decision_processing_result.v1",
    status: "processed",
    accepted: true,
    already_exists: false,
    capture_session_id: "capture-review-1",
    intake_id: "intake-360-1",
    command_request_id: "task-command-placeholder",
    submission_fingerprint_sha256: `sha256:${"f".repeat(64)}`,
    pipeline_approval_status: "approved",
    pipeline_task_decision: decision,
    approved_task_definition: approved,
    decision_evidence_request: null,
    processed_at_iso: "2026-07-29T22:00:00Z",
    proof_boundary: {
      webapp_command_is_pipeline_approval: false,
      pipeline_decision_recorded: true,
      approved_task_exists: true,
      decision_evidence_request_compiled: false,
      testbed_required_before_request_compilation: true,
      task_success_established: false,
      physical_success_established: false,
      comparative_policy_ranking_verdict: "thesis_not_supported",
    },
  };
}

function maintainedTestbedFixture() {
  const makeCard = (schemaVersion: string, id: string) => {
    const value: Record<string, unknown> = { schema_version: schemaVersion, id };
    value.card_digest = canonicalArtifactDigest(value, "card_digest");
    return value;
  };
  const site = makeCard("site_card.v1", "site-1");
  const task = makeCard("task_card.v1", "task-1");
  const scenario = makeCard("scenario_card.v1", "scenario-1");
  const evaluation = makeCard("eval_card.v1", "eval-1");
  const ref = (name: string, digest: unknown) => ({
    uri: `testbed://testbed-1/v1/${name}.json`,
    digest,
  });
  const value: Record<string, any> = {
    schema_version: "maintained_site_task_testbed.v1",
    testbed_id: "testbed-1",
    version: "v1",
    predecessor_testbed_digest: null,
    supersedes: [],
    source_capture_bundles: [{
      bundle_id: "intake-360-1",
      digest: `sha256:${"a".repeat(64)}`,
    }],
    artifact_references: {
      site_card: ref("site_card", site.card_digest),
      task_cards: [ref("task_card", task.card_digest)],
      scenario_cards: [ref("scenario_card", scenario.card_digest)],
      eval_cards: [ref("eval_card", evaluation.card_digest)],
      evaluator: ref("evaluator", evaluation.card_digest),
      reset: ref("reset", task.card_digest),
    },
    compiled_cards: {
      site_card: site,
      task_cards: [task],
      scenario_cards: [scenario],
      eval_cards: [evaluation],
    },
    approved_task_definition: {
      approved_task_id: "approved-task-1",
      digest: `sha256:${"b".repeat(64)}`,
      approval_decision_digest: `sha256:${"c".repeat(64)}`,
    },
    task_distribution: { task_family: "rigid_object_pick_place" },
    supported_condition_ranges: { scene: "captured" },
    robot_sensor_controller_bindings: { robot_id: "robot-1" },
    governance: { privacy: "cleared" },
    evidence_inventory: [{ evidence_id: "raw_capture", authority: "camera_360_equirectangular" }],
    validation_envelope: { capture_accepted: true },
    known_unsupported_conditions: ["physical_task_success"],
    invalidation_triggers: ["layout_changed"],
    physical_outcome_history_refs: [],
    lifecycle_state: "active",
    proof_boundary: {
      appearance_is_collision_truth: false,
      generated_completion_is_observed_truth: false,
      simulation_is_physical_success: false,
      deployment_or_safety_approved: false,
      comparative_policy_ranking_verdict: "thesis_not_supported",
    },
  };
  value.testbed_digest = canonicalArtifactDigest(value, "testbed_digest");
  return value;
}

function taskEvaluationRunPublication(testbedDigest: string) {
  const plan: Record<string, any> = {
    schema_version: "evidence_plan.v1",
    plan_id: "plan-owner-1",
    request_id: "request-owner-1",
    decision_id: "decision-owner-1",
    request_digest: `sha256:${"8".repeat(64)}`,
    testbed_id: "testbed-1",
    testbed_version: "v1",
    testbed_digest: testbedDigest,
    claim_plans: [{ claim_id: "reach", status: "planned" }],
    execution_order: ["step-reach"],
    physical_evidence_requests: [{ claim_id: "physical", description: "Run one instrumented robot attempt." }],
    budget_status: { projected_cost_usd: 0, within_budget: true },
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
  plan.plan_digest = canonicalArtifactDigest(plan, "plan_digest");
  const envelope: Record<string, any> = {
    schema_version: "decision_envelope.v1",
    decision_id: plan.decision_id,
    request_id: plan.request_id,
    request_digest: plan.request_digest,
    plan_digest: plan.plan_digest,
    testbed_digest: plan.testbed_digest,
    decision_question: "Can the robot reach, see, and move the item?",
    overall_outcome: "partial_decision",
    per_claim_verdicts: [{
      claim_id: "reach",
      claim_type: "reachability",
      verdict: "supported",
      rationale: "qualified_analytic_evidence",
      accepted_result_digests: [`sha256:${"9".repeat(64)}`],
      claim_ceiling: { physical_success: false, deployment_readiness: false, safety_certification: false },
    }],
    evidence_accepted: [`sha256:${"9".repeat(64)}`],
    evidence_rejected: [],
    validation_envelope: { exact_scope: true },
    unsupported_conditions: ["physical_task_success"],
    uncertainty: { maximum: 0.4, ranking_science_boundary: "thesis_not_supported" },
    cross_method_disagreements: [],
    shared_dependency_warnings: [],
    claim_ceiling: {
      physical_success: false,
      deployment_readiness: false,
      safety_certification: false,
      generated_artifact_upgrades_raw_or_physical_claim: false,
    },
    next_cheapest_experiment: "capture_robot_base_measurement",
    physical_evidence_still_required: [{ claim_id: "physical", description: "Run one instrumented robot attempt." }],
    deployment_approval: false,
    safety_certification: false,
    raw_policy_values_persisted: false,
    raw_secret_values_persisted: false,
  };
  envelope.decision_envelope_digest = canonicalArtifactDigest(envelope, "decision_envelope_digest");
  return {
    schema_version: "task_evaluation_run_publication.v1",
    capture_session_id: "capture-run-owner-1",
    intake_id: "intake-360-1",
    run_id: "run-owner-1",
    testbed_digest: testbedDigest,
    request_digest: plan.request_digest,
    plan_digest: plan.plan_digest,
    state: "partially_decided",
    evidence_plan: plan,
    decision_envelope: envelope,
    proof_boundary: {
      simulation_is_physical_success: false,
      deployment_or_safety_approved: false,
      comparative_policy_ranking_verdict: "thesis_not_supported",
    },
  };
}

function decisionEvidenceRequest(testbed: ReturnType<typeof maintainedTestbedFixture>) {
  const value: Record<string, any> = {
    schema_version: "decision_evidence_request.v1",
    request_id: "request-testbed-owner-1",
    decision_id: "decision-testbed-owner-1",
    testbed_id: testbed.testbed_id,
    testbed_version: testbed.version,
    testbed_digest: testbed.testbed_digest,
    decision_question: "Can the exact robot reach the approved target?",
    candidates: [{ robot_id: "fixture-arm" }],
    claims: [{
      claim_id: "reach",
      claim_type: "reachability",
      subject: "fixture-arm:item-1:tote-1",
      measurable_threshold: { operator: ">=", value: 0.9, units: "fraction" },
      false_safe_consequence: "moderate",
      acceptable_false_safe_risk: 0.05,
      desired_confidence_or_coverage: { minimum_coverage: 0.9 },
      permitted_abstention_behavior: { allowed: true },
    }],
    budget: { max_cost_usd: 0 },
    deadline: "2026-07-30T00:00:00Z",
    available_physical_evidence: [],
    permitted_evidence_methods: ["analytic_geometry_kinematics"],
    restrictions: { external_processing_allowed: false },
    requested_result_audience: "design_partner",
    provenance: { caller_identity: "pipeline:testbed-compiler" },
    idempotency_key: "request-testbed-owner-1",
  };
  value.request_digest = canonicalArtifactDigest(value, "request_digest");
  return value;
}

function runPreparation(
  sessionId: string,
  intakeId: string,
  runId: string,
  request: ReturnType<typeof decisionEvidenceRequest>,
  testbed: ReturnType<typeof maintainedTestbedFixture>,
  authorizationCandidates: Array<Record<string, unknown>> = [],
) {
  const plan: Record<string, any> = {
    schema_version: "evidence_plan.v1",
    plan_id: "plan-owner-1",
    request_id: request.request_id,
    decision_id: request.decision_id,
    request_digest: request.request_digest,
    testbed_id: testbed.testbed_id,
    testbed_version: testbed.version,
    testbed_digest: testbed.testbed_digest,
    claim_plans: [{ claim_id: "reach", selected_methods: [] }],
    execution_order: [],
    physical_evidence_requests: [],
    budget_status: { projected_cost_usd: 0, within_budget: true },
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
  plan.plan_digest = canonicalArtifactDigest(plan, "plan_digest");
  return {
    schema_version: "task_evaluation_run_preparation.v1",
    run_id: runId,
    capture_session_id: sessionId,
    intake_id: intakeId,
    state: "authorization_required",
    request,
    evidence_plan: plan,
    method_catalog: {
      catalog_id: "local-beta-methods",
      version: "1",
      catalog_digest: `sha256:${"7".repeat(64)}`,
      pipeline_owned: true,
    },
    authorization_candidates: authorizationCandidates,
    execution_started: false,
    proof_boundary: {
      state_is_scientific_verdict: false,
      simulation_is_physical_success: false,
      deployment_or_safety_approved: false,
      comparative_policy_ranking_verdict: "thesis_not_supported",
    },
  };
}

function runAuthorization(
  runId: string,
  planDigest: string,
  adapterReferences: string[],
  actor: Record<string, unknown>,
  idempotencyKey: string,
) {
  const value: Record<string, any> = {
    schema_version: "task_evaluation_run_execution_authorization.v1",
    run_id: runId,
    plan_digest: planDigest,
    authorized_adapter_references: [...adapterReferences].sort(),
    actor,
    idempotency_key: idempotencyKey,
    live_provider_execution: false,
    paid_compute_authorized: false,
    physical_robot_run_authorized: false,
    proof_boundary: {
      authorization_is_method_qualification: false,
      simulation_is_physical_success: false,
      comparative_policy_ranking_verdict: "thesis_not_supported",
    },
  };
  value.authorization_digest = canonicalArtifactDigest(value, "authorization_digest");
  return value;
}

function captureQaPublication(sessionId: string) {
  const report: Record<string, any> = {
    schema_version: "capture_qa_report.v1",
    intake_id: "intake-360-1",
    envelope_digest: `sha256:${"a".repeat(64)}`,
    capture_authority_profile: "camera_360_equirectangular",
    status: "recapture_required",
    state: "rejected_or_recapture_required",
    checks: [{
      check_id: "robot_placement_area_covered",
      status: "fail",
      evidence_source: "local_analyzer",
      measurement: false,
      threshold: true,
      claim_impact: ["robot_placement"],
      recapture_code: "robot_placement_area_missing",
      recapture_instruction: "Capture the robot placement area and access path.",
    }],
    recapture_plan: [{
      code: "robot_placement_area_missing",
      instruction: "Capture the robot placement area and access path.",
      reason: "The proposed placement area is outside captured coverage.",
    }],
    missing_evidence: ["scale_anchor_verified"],
    required_analysis: [],
    next_cheapest_experiment: {
      kind: "targeted_recapture",
      instruction: "Capture the robot placement area and access path.",
    },
    quality_observations_digest: `sha256:${"b".repeat(64)}`,
    quality_analysis_errors: [],
    claim_ceiling: {
      capture_admitted: false,
      physical_task_success: false,
      deployment_readiness: false,
      safety_certification: false,
    },
    prohibited_claims: ["physical_task_success", "deployment_readiness", "safety_certification"],
    comparative_policy_ranking_verdict: "thesis_not_supported",
  };
  report.qa_report_digest = canonicalArtifactDigest(report, "qa_report_digest");
  return {
    schema_version: "capture_qa_publication.v1",
    capture_session_id: sessionId,
    intake_id: report.intake_id,
    capture_authority_profile: report.capture_authority_profile,
    envelope_digest: report.envelope_digest,
    qa_report_digest: report.qa_report_digest,
    status: report.status,
    state: report.state,
    report,
    proof_boundary: {
      qa_is_task_success: false,
      qa_is_physical_success: false,
      deployment_or_safety_approved: false,
      comparative_policy_ranking_verdict: "thesis_not_supported",
    },
  };
}

function runExecutionResult(preparation: Record<string, any>) {
  const plan = preparation.evidence_plan as Record<string, any>;
  const envelope: Record<string, any> = {
    schema_version: "decision_envelope.v1",
    decision_id: plan.decision_id,
    request_id: plan.request_id,
    request_digest: plan.request_digest,
    plan_digest: plan.plan_digest,
    testbed_digest: plan.testbed_digest,
    decision_question: "Can the specified robot reach the item?",
    overall_outcome: "partial_decision",
    per_claim_verdicts: [{
      claim_id: "reach",
      claim_type: "reachability",
      verdict: "supported",
      rationale: "qualified_local_analytic_evidence",
      accepted_result_digests: [`sha256:${"9".repeat(64)}`],
      claim_ceiling: {
        physical_success: false,
        deployment_readiness: false,
        safety_certification: false,
      },
    }],
    evidence_accepted: [`sha256:${"9".repeat(64)}`],
    evidence_rejected: [],
    validation_envelope: { exact_testbed_only: true },
    unsupported_conditions: ["physical_task_success"],
    uncertainty: { maximum: 0.4, ranking_science_boundary: "thesis_not_supported" },
    cross_method_disagreements: [],
    shared_dependency_warnings: [],
    claim_ceiling: {
      deployment_readiness: false,
      safety_certification: false,
      generated_artifact_upgrades_raw_or_physical_claim: false,
    },
    next_cheapest_experiment: "run_one_instrumented_physical_attempt",
    physical_evidence_still_required: [{
      claim_id: "physical-success",
      description: "Run one instrumented physical attempt.",
    }],
    deployment_approval: false,
    safety_certification: false,
    raw_policy_values_persisted: false,
    raw_secret_values_persisted: false,
  };
  envelope.decision_envelope_digest = canonicalArtifactDigest(
    envelope,
    "decision_envelope_digest",
  );
  const result = {
    schema_version: "task_evaluation_run_execution_result.v1",
    run_id: preparation.run_id,
    state: "partially_decided",
    already_exists: false,
    execution_manifest: { status: "complete" },
    evidence_results: [],
    decision_envelope: envelope,
    webapp_sync: { status: "forwarded", performed: true },
  };
  const publication = {
    schema_version: "task_evaluation_run_publication.v1",
    capture_session_id: preparation.capture_session_id,
    intake_id: preparation.intake_id,
    run_id: preparation.run_id,
    testbed_digest: plan.testbed_digest,
    request_digest: plan.request_digest,
    plan_digest: plan.plan_digest,
    state: "partially_decided",
    evidence_plan: plan,
    decision_envelope: envelope,
    proof_boundary: {
      simulation_is_physical_success: false,
      deployment_or_safety_approved: false,
      comparative_policy_ranking_verdict: "thesis_not_supported",
    },
  };
  return { result, publication };
}

async function postJson(socketPath: string, requestPath: string, body: unknown) {
  const payload = JSON.stringify(body);
  return new Promise<{ status: number; cacheControl?: string; json: () => Promise<unknown> }>((resolve, reject) => {
    const request = httpRequest({
      socketPath,
      path: requestPath,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => {
        const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        resolve({
          status: response.statusCode || 0,
          cacheControl: response.headers["cache-control"],
          json: async () => data,
        });
      });
    });
    request.on("error", reject);
    request.end(payload);
  });
}

async function getJson(socketPath: string, requestPath: string) {
  return new Promise<{ status: number; json: () => Promise<unknown> }>((resolve, reject) => {
    const request = httpRequest({ socketPath, path: requestPath, method: "GET" }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => {
        const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        resolve({ status: response.statusCode || 0, json: async () => data });
      });
    });
    request.on("error", reject);
    request.end();
  });
}

async function createSession(socketPath: string) {
  const response = await postJson(socketPath, "/capture-uploads", request());
  const body = (await response.json()) as Record<string, unknown>;
  expect(response.status).toBe(201);
  return body;
}

afterEach(() => {
  state.records.clear();
  state.start.mockReset();
  state.authorize.mockReset();
  state.listParts.mockReset();
  state.finish.mockReset();
  state.fileInfo.mockReset();
  state.downloadGrant.mockReset();
  state.cancel.mockReset();
  state.deleteCapture.mockReset();
  state.forward.mockReset();
  state.planForward.mockReset();
  state.authorizationForward.mockReset();
  state.executionForward.mockReset();
  state.intakeForward.mockReset();
  state.lifecycleApply.mockReset();
  state.lifecycleEvidence.mockReset();
  state.lifecycleInspect.mockReset();
  state.reconstructionPlan.mockReset();
  state.reconstructionAuthorization.mockReset();
  state.reconstructionExecution.mockReset();
  state.reconstructionInspect.mockReset();
  state.testbedCompile.mockReset();
  state.beforeTransaction = null;
  delete process.env.CAPTURE_UPLOAD_PART_SIZE_BYTES;
  delete process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_URL;
  delete process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN;
  delete process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_REQUIRED;
});

describe("resumable capture uploads", () => {
  it("revokes a completed capture across Pipeline, object storage, and WebApp with retry-safe evidence", async () => {
    const sessionId = "capture-lifecycle-owner-1";
    const captureDigest = `sha256:${"3".repeat(64)}`;
    const envelopeDigest = `sha256:${"2".repeat(64)}`;
    const tombstoneDigest = `sha256:${"4".repeat(64)}`;
    state.records.set(sessionId, {
      session_id: sessionId,
      owner_user_id: "buyer-123",
      status: "uploaded_verification_pending",
      request: request(),
      request_fingerprint_sha256: `sha256:${"1".repeat(64)}`,
      part_size_bytes: 64 * 1024 * 1024,
      expected_part_count: 3,
      provider_file_id: "b2-completed-file-1",
      object_path: `captures/buyer-123/intakes/${sessionId}/capture.mp4`,
      storage_uri: "b2://blueprint-private/capture.mp4",
      pipeline_capture_intake_receipt: {
        capture_session_id: sessionId,
        intake_id: "intake-360-1",
        capture_digest: captureDigest,
        envelope_digest: envelopeDigest,
      },
    });
    const tombstone = {
      schema_version: "capture_lifecycle_tombstone.v1",
      capture_digest: captureDigest,
      envelope_digest: envelopeDigest,
      action: "consent_revoked",
      tombstone_digest: tombstoneDigest,
      serve_allowed: false,
      future_processing_allowed: false,
      local_payload_deletion_complete: true,
      external_revocation_complete: false,
    };
    state.lifecycleApply.mockResolvedValue({
      status: "forwarded", performed: true, endpoint_configured: true, value: tombstone,
    });
    state.deleteCapture.mockResolvedValue({
      provider: "backblaze",
      fileId: "b2-completed-file-1",
      fileName: `captures/buyer-123/intakes/${sessionId}/capture.mp4`,
      deletedAtIso: "2026-07-30T12:00:00.000Z",
      alreadyAbsent: false,
    });
    state.lifecycleEvidence.mockImplementation(async (input: Record<string, any>) => ({
      status: "forwarded",
      performed: true,
      endpoint_configured: true,
      value: {
        schema_version: "capture_external_revocation_evidence.v1",
        tombstone_digest: tombstoneDigest,
        action: input.action,
        target_system: input.targetSystem,
        receipt_digest: input.receiptDigest,
        external_revocation_evidence_digest: `sha256:${(
          input.action.startsWith("sync") ? "5" : "6"
        ).repeat(64)}`,
      },
    }));
    state.lifecycleInspect.mockResolvedValue({
      status: "forwarded",
      performed: true,
      endpoint_configured: true,
      value: {
        schema_version: "capture_lifecycle_inspection.v1",
        state: "tombstoned",
        tombstone,
        provider_deletion_complete: true,
        external_revocation_complete: true,
        local_payload_deletion_complete: true,
        lifecycle_complete: true,
        serve_allowed: false,
        future_processing_allowed: false,
      },
    });
    const { server, socketPath } = await startServer();
    try {
      const command = {
        schema_version: "completed_capture_lifecycle_command.v1",
        action: "consent_revoked",
        idempotency_key: "revoke-capture-owner-1",
      };
      const response = await postJson(socketPath, `/capture-uploads/${sessionId}/lifecycle`, command);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        state: "revoked",
        local_payload_deletion_complete: true,
        object_store_deletion_complete: true,
        webapp_access_denied: true,
        external_revocation_complete: true,
        lifecycle_complete: true,
      });
      expect(state.deleteCapture).toHaveBeenCalledWith({
        fileId: "b2-completed-file-1",
        fileName: `captures/buyer-123/intakes/${sessionId}/capture.mp4`,
      });
      expect(state.lifecycleEvidence).toHaveBeenCalledTimes(2);
      expect(state.records.get(sessionId)).toMatchObject({
        status: "revoked",
        provider_file_id: null,
        object_path: null,
        storage_uri: null,
        capture_access: { serve_allowed: false, future_processing_allowed: false },
      });
      const ownerProjection = await getJson(socketPath, `/capture-uploads/${sessionId}`);
      expect(ownerProjection.status).toBe(200);
      await expect(ownerProjection.json()).resolves.toMatchObject({
        status: "revoked",
        upload_status: "revoked",
        storage_uri: null,
        completed_capture_lifecycle: {
          state: "revoked",
          lifecycle_complete: true,
        },
      });

      const replay = await postJson(socketPath, `/capture-uploads/${sessionId}/lifecycle`, command);
      expect(replay.status).toBe(200);
      expect(state.lifecycleApply).toHaveBeenCalledTimes(1);
      expect(state.deleteCapture).toHaveBeenCalledTimes(1);
      expect(state.lifecycleEvidence).toHaveBeenCalledTimes(2);
      expect(state.lifecycleInspect).toHaveBeenCalledTimes(2);
    } finally {
      await stopServer(server, socketPath);
    }
  });

  it("denies future access and preserves a retryable tombstone when object-store deletion fails", async () => {
    const sessionId = "capture-lifecycle-retry-1";
    const captureDigest = `sha256:${"a".repeat(64)}`;
    const envelopeDigest = `sha256:${"b".repeat(64)}`;
    state.records.set(sessionId, {
      session_id: sessionId,
      owner_user_id: "buyer-123",
      status: "uploaded_verification_pending",
      request: request(),
      request_fingerprint_sha256: `sha256:${"c".repeat(64)}`,
      part_size_bytes: 64 * 1024 * 1024,
      expected_part_count: 3,
      provider_file_id: "b2-completed-file-retry",
      object_path: `captures/buyer-123/intakes/${sessionId}/capture.mp4`,
      pipeline_capture_intake_receipt: {
        capture_session_id: sessionId,
        intake_id: "intake-360-1",
        capture_digest: captureDigest,
        envelope_digest: envelopeDigest,
      },
    });
    state.lifecycleApply.mockResolvedValue({
      status: "forwarded",
      performed: true,
      endpoint_configured: true,
      value: {
        schema_version: "capture_lifecycle_tombstone.v1",
        capture_digest: captureDigest,
        envelope_digest: envelopeDigest,
        action: "operator_deletion_request",
        tombstone_digest: `sha256:${"d".repeat(64)}`,
        serve_allowed: false,
        future_processing_allowed: false,
        local_payload_deletion_complete: true,
        external_revocation_complete: false,
      },
    });
    state.deleteCapture.mockRejectedValue(new Error("provider unavailable"));
    const { server, socketPath } = await startServer();
    try {
      const response = await postJson(socketPath, `/capture-uploads/${sessionId}/lifecycle`, {
        schema_version: "completed_capture_lifecycle_command.v1",
        action: "operator_deletion_request",
        idempotency_key: "delete-capture-retry-1",
      });
      expect(response.status).toBe(502);
      expect(state.records.get(sessionId)).toMatchObject({
        status: "revocation_in_progress",
        capture_access: { serve_allowed: false, future_processing_allowed: false },
        completed_capture_lifecycle: {
          status: "revocation_in_progress",
          blocker: "capture_object_store_deletion_failed",
          pipeline_tombstone: { local_payload_deletion_complete: true },
        },
      });
      expect(state.lifecycleEvidence).not.toHaveBeenCalled();
    } finally {
      await stopServer(server, socketPath);
    }
  });

  it("plans, authorizes, executes, and inspects only Pipeline-selected local reconstruction adapters", async () => {
    const sessionId = "capture-reconstruction-owner-1";
    const captureDigest = `sha256:${"7".repeat(64)}`;
    const qa = captureQaPublication(sessionId) as Record<string, any>;
    qa.report.status = "accepted";
    qa.report.state = "capture_accepted";
    qa.report.checks = [];
    qa.report.recapture_plan = [];
    qa.report.qa_report_digest = canonicalArtifactDigest(qa.report, "qa_report_digest");
    qa.status = "accepted";
    qa.state = "capture_accepted";
    qa.qa_report_digest = qa.report.qa_report_digest;
    state.records.set(sessionId, {
      session_id: sessionId,
      owner_user_id: "buyer-123",
      status: "uploaded_verification_pending",
      request: request(),
      request_fingerprint_sha256: `sha256:${"8".repeat(64)}`,
      part_size_bytes: 64 * 1024 * 1024,
      expected_part_count: 3,
      pipeline_capture_qa: qa,
      pipeline_capture_intake_receipt: {
        capture_session_id: sessionId,
        intake_id: "intake-360-1",
        capture_digest: captureDigest,
        envelope_digest: qa.envelope_digest,
      },
    });
    const reconstructionPlan: Record<string, any> = {
      schema_version: "reconstruction_plan.v1",
      source_capture: {
        intake_id: "intake-360-1",
        capture_digest: captureDigest,
        capture_authority_profile: "camera_360_equirectangular",
      },
      requested_claim_types: ["perception_visibility", "task_discovery"],
      required_representations: ["decoded_observation_frames"],
      selected_methods: [{
        representations: ["decoded_observation_frames"],
        method_id: "local-decoded-observation-index",
        method_version: "1",
        method_profile_digest: `sha256:${"9".repeat(64)}`,
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
    reconstructionPlan.reconstruction_plan_digest = canonicalArtifactDigest(
      reconstructionPlan,
      "reconstruction_plan_digest",
    );
    const planId = "reconstruction-owner-1";
    const contextDigest = `sha256:${"a".repeat(64)}`;
    const planResult = {
      schema_version: "reconstruction_control_plane_plan_result.v1",
      plan_id: planId,
      state: "authorization_required",
      context_digest: contextDigest,
      reconstruction_plan: reconstructionPlan,
      authorization_candidates: [{
        method_id: "local-decoded-observation-index",
        method_profile_digest: `sha256:${"9".repeat(64)}`,
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
    state.reconstructionPlan.mockResolvedValue({
      status: "forwarded", performed: true, endpoint_configured: true, value: planResult,
    });
    const authorization: Record<string, any> = {
      schema_version: "reconstruction_execution_authorization.v1",
      plan_id: planId,
      reconstruction_plan_digest: reconstructionPlan.reconstruction_plan_digest,
      context_digest: contextDigest,
      authorized_adapter_references: ["local://decoded-observation-index-v1"],
      actor: { role: "customer", identity: "firebase:buyer-123" },
      idempotency_key: "authorize-reconstruction-owner-1",
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
    state.reconstructionAuthorization.mockResolvedValue({
      status: "forwarded", performed: true, endpoint_configured: true, value: authorization,
    });
    const execution: Record<string, any> = {
      schema_version: "reconstruction_control_plane_execution_result.v1",
      plan_id: planId,
      state: "completed",
      reconstruction_plan_digest: reconstructionPlan.reconstruction_plan_digest,
      authorization_digest: authorization.authorization_digest,
      context_digest: contextDigest,
      results: [{
        schema_version: "reconstruction_result.v1",
        reconstruction_result_digest: `sha256:${"b".repeat(64)}`,
      }],
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
    state.reconstructionExecution.mockResolvedValue({
      status: "forwarded", performed: true, endpoint_configured: true, value: execution,
    });
    const inspection = {
      schema_version: "reconstruction_control_plane_inspection.v1",
      plan_id: planId,
      state: "completed",
      source_binding: {
        capture_session_id: sessionId,
        intake_id: "intake-360-1",
        capture_digest: captureDigest,
        envelope_digest: qa.envelope_digest,
        qa_report_digest: qa.qa_report_digest,
        object_manifest_digest: `sha256:${"c".repeat(64)}`,
        context_digest: contextDigest,
      },
      reconstruction_plan: reconstructionPlan,
      execution_authorization: authorization,
      execution_result: execution,
      proof_boundary: {
        inspection_recomputes_scientific_truth: false,
        physical_task_success_established: false,
        comparative_policy_ranking_verdict: "thesis_not_supported",
      },
    };
    state.reconstructionInspect.mockResolvedValue({
      status: "forwarded", performed: true, endpoint_configured: true, value: inspection,
    });

    const { server, socketPath } = await startServer();
    try {
      const planned = await postJson(socketPath, `/capture-uploads/${sessionId}/reconstructions/plan`, {
        schema_version: "capture_reconstruction_plan_command.v1",
        requested_claim_types: ["task_discovery", "perception_visibility"],
        idempotency_key: "plan-reconstruction-owner-1",
      });
      expect(planned.status).toBe(201);
      await expect(planned.json()).resolves.toMatchObject({
        status: "authorization_required",
        pipeline_plan: { plan_id: planId },
      });
      expect(state.reconstructionPlan).toHaveBeenCalledWith(expect.objectContaining({
        captureSessionId: sessionId,
        captureDigest,
        requestedClaimTypes: ["perception_visibility", "task_discovery"],
      }));

      const authorized = await postJson(
        socketPath,
        `/capture-uploads/${sessionId}/reconstructions/${planId}/authorize`,
        {
          schema_version: "capture_reconstruction_authorization_command.v1",
          reconstruction_plan_digest: reconstructionPlan.reconstruction_plan_digest,
          authorized_adapter_references: ["local://decoded-observation-index-v1"],
          idempotency_key: "authorize-reconstruction-owner-1",
        },
      );
      expect(authorized.status).toBe(200);
      expect(state.reconstructionAuthorization).toHaveBeenCalledWith(expect.objectContaining({
        actor: { role: "customer", identity: "firebase:buyer-123" },
      }));

      const executed = await postJson(
        socketPath,
        `/capture-uploads/${sessionId}/reconstructions/${planId}/execute`,
        {
          schema_version: "capture_reconstruction_execution_command.v1",
          idempotency_key: "execute-reconstruction-owner-1",
        },
      );
      expect(executed.status).toBe(200);
      await expect(executed.json()).resolves.toMatchObject({
        status: "completed",
        pipeline_execution: { execution_result_digest: execution.execution_result_digest },
      });

      const inspected = await getJson(
        socketPath,
        `/capture-uploads/${sessionId}/reconstructions/${planId}`,
      );
      expect(inspected.status).toBe(200);
      await expect(inspected.json()).resolves.toMatchObject({
        inspection: { plan_id: planId, state: "completed" },
      });
      const ownerProjection = await getJson(socketPath, `/capture-uploads/${sessionId}`);
      await expect(ownerProjection.json()).resolves.toMatchObject({
        reconstruction: {
          state: "completed",
          plan_id: planId,
          result_count: 1,
          cost_usd: 0,
          proof_boundary: {
            physical_task_success_established: false,
            comparative_policy_ranking_verdict: "thesis_not_supported",
          },
        },
      });
    } finally {
      await stopServer(server, socketPath);
    }
  });

  it("submits only robot and decision inputs while Pipeline owns testbed science", async () => {
    const sessionId = "testbed-compile-owner-1";
    const approvedTaskDigest = `sha256:${"d".repeat(64)}`;
    const reconstructionPlanDigest = `sha256:${"e".repeat(64)}`;
    const executionDigest = `sha256:${"f".repeat(64)}`;
    state.records.set(sessionId, {
      session_id: sessionId,
      owner_user_id: "buyer-123",
      status: "capture_accepted",
      request: request(),
      request_fingerprint_sha256: `sha256:${"1".repeat(64)}`,
      approved_task_definition: {
        schema_version: "approved_task_definition.v1",
        approval_status: "approved",
        approved_task_digest: approvedTaskDigest,
        task: {
          description: "Move the tote into the box.",
          task_family: "rigid_object_pick_place",
          measurable_success_conditions: [{
            metric: "object_center_distance",
            operator: "<=",
            threshold: 0.05,
            units: "m",
          }],
          task_objects: [{ object_id: "tote-1" }],
          target_regions: [{ region_id: "box-1" }],
        },
      },
      pipeline_reconstruction: {
        status: "completed",
        pipeline_plan: {
          plan_id: "reconstruction-testbed-1",
          reconstruction_plan: {
            reconstruction_plan_digest: reconstructionPlanDigest,
            requested_claim_types: ["perception_visibility", "reachability"],
          },
        },
        pipeline_execution: {
          state: "completed",
          execution_result_digest: executionDigest,
        },
      },
    });
    state.testbedCompile.mockResolvedValue({
      status: "forwarded",
      performed: true,
      endpoint_configured: true,
      value: {
        schema_version: "site_task_testbed_compilation_response.v1",
        status: "testbed_ready",
        capture_session_id: sessionId,
        intake_id: "intake-360-1",
        testbed_id: "testbed-scene-1",
        version: "1",
        testbed_digest: `sha256:${"9".repeat(64)}`,
        already_exists: false,
        artifact_reference: {
          uri: "testbed://testbed-scene-1/1/fixture.json",
          digest: `sha256:${"9".repeat(64)}`,
        },
        testbed: { approved_task_definition: { digest: approvedTaskDigest } },
        decision_evidence_request: { request_digest: `sha256:${"8".repeat(64)}` },
        decision_evidence_request_artifact: {},
        webapp_sync: { status: "succeeded" },
        proof_boundary: {
          appearance_is_collision_truth: false,
          generated_completion_is_observed_truth: false,
          simulation_is_physical_success: false,
          deployment_or_safety_approved: false,
          comparative_policy_ranking_verdict: "thesis_not_supported",
        },
      },
    });
    const { server, socketPath } = await startServer();
    try {
      const response = await postJson(
        socketPath,
        `/capture-uploads/${sessionId}/testbed/compile`,
        {
          schema_version: "capture_testbed_compilation_command.v1",
          testbed_id: "testbed-scene-1",
          version: "1",
          robot_binding: {
            robot_id: "fixture-arm",
            embodiment_version: "1",
            base_footprint: { shape: "circle", radius_m: 0.4 },
            sensors: { primary: "rgb-v1" },
            controller_id: "joint-position-v1",
            end_effector_id: "parallel-gripper-v1",
            reach_envelope: { minimum_m: 0.1, maximum_m: 1.0 },
          },
          false_safe_consequence: "moderate",
          acceptable_false_safe_risk: 0.05,
          minimum_coverage: 0.9,
          minimum_independent_methods: 1,
          max_cost_usd: 0,
          max_latency_seconds: 60,
          deadline: "2026-08-06T00:00:00Z",
          requested_result_audience: "design_partner",
          idempotency_key: "compile-testbed-owner-1",
        },
      );
      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toMatchObject({
        status: "testbed_ready",
        request_digest: `sha256:${"8".repeat(64)}`,
        proof_boundary: { comparative_policy_ranking_verdict: "thesis_not_supported" },
      });
      expect(state.testbedCompile).toHaveBeenCalledWith(expect.objectContaining({
        captureSessionId: sessionId,
        approvedTaskDigest,
        reconstructionExecutionResultDigest: executionDigest,
        robotBinding: expect.objectContaining({ robot_id: "fixture-arm" }),
        decisionRequestConstraints: expect.objectContaining({
          permitted_evidence_methods: expect.arrayContaining([
            "analytic_geometry_kinematics",
            "captured_real_observation",
          ]),
          restrictions: expect.objectContaining({
            webapp_provider_selection_allowed: false,
            live_robot_execution_allowed: false,
            paid_compute_authorized: false,
          }),
        }),
      }));
      const forwardedBody = state.testbedCompile.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(forwardedBody).not.toHaveProperty("simready_decision");
      expect(forwardedBody).not.toHaveProperty("robot_placement_result");
      expect(forwardedBody).not.toHaveProperty("supported_condition_ranges");
    } finally {
      await stopServer(server, socketPath);
    }
  });

  it("projects authoritative Capture QA and exact recapture instructions to the owner", async () => {
    const sessionId = "capture-qa-owner-1";
    const publication = captureQaPublication(sessionId);
    state.records.set(sessionId, {
      session_id: sessionId,
      owner_user_id: "buyer-123",
      status: "uploaded_verification_pending",
      request: request(),
      request_fingerprint_sha256: `sha256:${"a".repeat(64)}`,
      part_size_bytes: 64 * 1024 * 1024,
      expected_part_count: 3,
      pipeline_capture_qa: publication,
    });
    const { server, socketPath } = await startServer();
    try {
      const session = await getJson(socketPath, `/capture-uploads/${sessionId}`);
      expect(session.status).toBe(200);
      await expect(session.json()).resolves.toMatchObject({
        capture_qa: {
          state: "rejected_or_recapture_required",
          status: "recapture_required",
          qa_report_digest: publication.qa_report_digest,
          recapture_plan: [{ code: "robot_placement_area_missing" }],
        },
        claim_boundary: { capture_accepted: false },
      });
      const inspection = await getJson(socketPath, `/capture-uploads/${sessionId}/capture-qa`);
      expect(inspection.status).toBe(200);
      await expect(inspection.json()).resolves.toMatchObject({
        status: "recapture_required",
        state: "rejected_or_recapture_required",
        publication: { qa_report_digest: publication.qa_report_digest },
      });
    } finally {
      await stopServer(server, socketPath);
    }
  });

  it("lists only owner sessions and exposes no provider file ID or credential", async () => {
    state.records.set("owned", {
      session_id: "owned",
      owner_user_id: "buyer-123",
      status: "upload_pending",
      request: request(),
      request_fingerprint_sha256: `sha256:${"a".repeat(64)}`,
      provider_file_id: "private-provider-id",
      authorization_token: "must-not-leak",
      part_size_bytes: 64 * 1024 * 1024,
      expected_part_count: 3,
      created_at_iso: "2026-07-29T20:00:00.000Z",
      updated_at_iso: "2026-07-29T20:00:00.000Z",
    });
    state.records.set("other", {
      session_id: "other",
      owner_user_id: "different-user",
      status: "upload_pending",
      request: request({ intake_id: "other-intake" }),
      request_fingerprint_sha256: `sha256:${"b".repeat(64)}`,
      part_size_bytes: 64 * 1024 * 1024,
      expected_part_count: 3,
    });
    const { server, socketPath } = await startServer();
    try {
      const response = await getJson(socketPath, "/capture-uploads");
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        schema_version: "capture_upload_session_list.v1",
        sessions: [{ session_id: "owned", intake_id: "intake-360-1" }],
      });
      expect(JSON.stringify(body)).not.toContain("different-user");
      expect(JSON.stringify(body)).not.toContain("private-provider-id");
      expect(JSON.stringify(body)).not.toContain("must-not-leak");
    } finally {
      await stopServer(server, socketPath);
    }
  });

  it("projects a lightweight testbed status and exposes the exact artifact only to its owner", async () => {
    const testbed = maintainedTestbedFixture();
    const decisionRequest = decisionEvidenceRequest(testbed);
    state.records.set("capture-testbed-1", {
      session_id: "capture-testbed-1",
      owner_user_id: "buyer-123",
      status: "uploaded_verification_pending",
      request: request(),
      request_fingerprint_sha256: `sha256:${"e".repeat(64)}`,
      part_size_bytes: 64 * 1024 * 1024,
      expected_part_count: 3,
      pipeline_site_task_testbed: {
        capture_session_id: "capture-testbed-1",
        intake_id: "intake-360-1",
        approved_task_digest: testbed.approved_task_definition.digest,
        testbed_id: testbed.testbed_id,
        version: testbed.version,
        testbed_digest: testbed.testbed_digest,
        artifact_reference: {
          uri: "testbed://testbed-1/v1/testbed.json",
          digest: testbed.testbed_digest,
        },
        testbed,
        decision_evidence_request: decisionRequest,
      },
    });
    const { server, socketPath } = await startServer();
    try {
      const session = await getJson(socketPath, "/capture-uploads/capture-testbed-1");
      expect(session.status).toBe(200);
      await expect(session.json()).resolves.toMatchObject({
        site_task_testbed: {
          state: "testbed_ready",
          testbed_id: "testbed-1",
          version: "v1",
          testbed_digest: testbed.testbed_digest,
          known_unsupported_conditions: ["physical_task_success"],
          request_digest: decisionRequest.request_digest,
          proof_boundary: { comparative_policy_ranking_verdict: "thesis_not_supported" },
        },
      });
      const inspection = await getJson(
        socketPath,
        "/capture-uploads/capture-testbed-1/testbed",
      );
      expect(inspection.status).toBe(200);
      await expect(inspection.json()).resolves.toMatchObject({
        status: "testbed_ready",
        testbed: {
          testbed_digest: testbed.testbed_digest,
          compiled_cards: { site_card: { id: "site-1" } },
        },
        decision_evidence_request: {
          request_digest: decisionRequest.request_digest,
          testbed_digest: testbed.testbed_digest,
        },
      });
    } finally {
      await stopServer(server, socketPath);
    }

    const outsider = await startServer({ uid: "different-user" });
    try {
      const response = await getJson(
        outsider.socketPath,
        "/capture-uploads/capture-testbed-1/testbed",
      );
      expect(response.status).toBe(404);
    } finally {
      await stopServer(outsider.server, outsider.socketPath);
    }
  });

  it("projects and exposes only the exact owner-bound Pipeline Decision Envelope", async () => {
    const testbed = maintainedTestbedFixture();
    const publication = taskEvaluationRunPublication(testbed.testbed_digest);
    state.records.set("capture-run-owner-1", {
      session_id: "capture-run-owner-1",
      owner_user_id: "buyer-123",
      status: "uploaded_verification_pending",
      request: request(),
      request_fingerprint_sha256: `sha256:${"e".repeat(64)}`,
      part_size_bytes: 64 * 1024 * 1024,
      expected_part_count: 3,
      pipeline_site_task_testbed: {
        testbed_digest: testbed.testbed_digest,
      },
      pipeline_task_evaluation_run: {
        schema_version: "capture_task_evaluation_run_record.v1",
        publication,
      },
    });
    const { server, socketPath } = await startServer();
    try {
      const session = await getJson(socketPath, "/capture-uploads/capture-run-owner-1");
      expect(session.status).toBe(200);
      await expect(session.json()).resolves.toMatchObject({
        task_evaluation_run: {
          state: "partially_decided",
          run_id: "run-owner-1",
          decision_envelope_digest: publication.decision_envelope.decision_envelope_digest,
          next_cheapest_experiment: "capture_robot_base_measurement",
          proof_boundary: { comparative_policy_ranking_verdict: "thesis_not_supported" },
        },
      });
      const inspection = await getJson(
        socketPath,
        "/capture-uploads/capture-run-owner-1/task-evaluation-run",
      );
      expect(inspection.status).toBe(200);
      await expect(inspection.json()).resolves.toMatchObject({
        status: "partially_decided",
        publication: {
          plan_digest: publication.plan_digest,
          decision_envelope: {
            decision_envelope_digest: publication.decision_envelope.decision_envelope_digest,
            next_cheapest_experiment: "capture_robot_base_measurement",
          },
        },
      });
    } finally {
      await stopServer(server, socketPath);
    }

    const outsider = await startServer({ uid: "different-user" });
    try {
      const denied = await getJson(
        outsider.socketPath,
        "/capture-uploads/capture-run-owner-1/task-evaluation-run",
      );
      expect(denied.status).toBe(404);
    } finally {
      await stopServer(outsider.server, outsider.socketPath);
    }

    publication.decision_envelope.next_cheapest_experiment = "tampered";
    const owner = await startServer();
    try {
      const invalid = await getJson(
        owner.socketPath,
        "/capture-uploads/capture-run-owner-1/task-evaluation-run",
      );
      expect(invalid.status).toBe(409);
      await expect(invalid.json()).resolves.toMatchObject({
        blockers: ["decision_envelope_digest_mismatch"],
      });
    } finally {
      await stopServer(owner.server, owner.socketPath);
    }
  });

  it("requests a provider-neutral Pipeline-owned plan without selecting methods", async () => {
    const testbed = maintainedTestbedFixture();
    const decisionRequest = decisionEvidenceRequest(testbed);
    state.records.set("capture-plan-owner-1", {
      session_id: "capture-plan-owner-1",
      owner_user_id: "buyer-123",
      status: "uploaded_verification_pending",
      request: request(),
      request_fingerprint_sha256: `sha256:${"e".repeat(64)}`,
      part_size_bytes: 64 * 1024 * 1024,
      expected_part_count: 3,
      pipeline_site_task_testbed: {
        capture_session_id: "capture-plan-owner-1",
        intake_id: "intake-360-1",
        approved_task_digest: testbed.approved_task_definition.digest,
        testbed_id: testbed.testbed_id,
        version: testbed.version,
        testbed_digest: testbed.testbed_digest,
        testbed,
        decision_evidence_request: decisionRequest,
      },
    });
    state.planForward.mockImplementation(async (params: Record<string, any>) => ({
      status: "forwarded",
      performed: true,
      required: true,
      endpoint_configured: true,
      http_status: 200,
      preparation: runPreparation(
        params.captureSessionId,
        params.intakeId,
        params.runId,
        params.request,
        params.testbed,
      ),
    }));
    const { server, socketPath } = await startServer();
    try {
      const response = await postJson(
        socketPath,
        "/capture-uploads/capture-plan-owner-1/task-evaluation-runs/plan",
        {
          schema_version: "capture_task_evaluation_run_plan_command.v1",
          idempotency_key: "plan-owner-request-1",
        },
      );
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body).toMatchObject({
        status: "authorization_required",
        pipeline_preparation: {
          method_catalog: { pipeline_owned: true },
          execution_started: false,
        },
      });
      expect(state.planForward).toHaveBeenCalledTimes(1);
      const forwarded = state.planForward.mock.calls[0][0];
      expect(forwarded.request.request_digest).toBe(decisionRequest.request_digest);
      expect(forwarded.testbed.testbed_digest).toBe(testbed.testbed_digest);
      expect(forwarded).not.toHaveProperty("method_profiles");
      expect(forwarded).not.toHaveProperty("qualifications");

      const replay = await postJson(
        socketPath,
        "/capture-uploads/capture-plan-owner-1/task-evaluation-runs/plan",
        {
          schema_version: "capture_task_evaluation_run_plan_command.v1",
          idempotency_key: "plan-owner-request-1",
        },
      );
      expect(replay.status).toBe(200);
      await expect(replay.json()).resolves.toMatchObject({ already_exists: true });
      expect(state.planForward).toHaveBeenCalledTimes(1);
    } finally {
      await stopServer(server, socketPath);
    }
  });

  it("authorizes only Pipeline-selected adapters with an owner-bound idempotent command", async () => {
    const testbed = maintainedTestbedFixture();
    const decisionRequest = decisionEvidenceRequest(testbed);
    const adapterReference = "blueprint://local/analytic-reachability@1";
    const sessionId = "capture-authorize-owner-1";
    const publication = {
      capture_session_id: sessionId,
      intake_id: "intake-360-1",
      approved_task_digest: testbed.approved_task_definition.digest,
      testbed_id: testbed.testbed_id,
      version: testbed.version,
      testbed_digest: testbed.testbed_digest,
      testbed,
      decision_evidence_request: decisionRequest,
    };
    state.records.set(sessionId, {
      session_id: sessionId,
      owner_user_id: "buyer-123",
      status: "uploaded_verification_pending",
      request: request(),
      request_fingerprint_sha256: `sha256:${"e".repeat(64)}`,
      part_size_bytes: 64 * 1024 * 1024,
      expected_part_count: 3,
      pipeline_site_task_testbed: publication,
    });
    state.planForward.mockImplementation(async (params: Record<string, any>) => ({
      status: "forwarded",
      performed: true,
      required: true,
      endpoint_configured: true,
      http_status: 200,
      preparation: runPreparation(
        params.captureSessionId,
        params.intakeId,
        params.runId,
        params.request,
        params.testbed,
        [{
          adapter_reference: adapterReference,
          method_id: "analytic-reachability",
          method_version: "1",
          method_profile_digest: `sha256:${"6".repeat(64)}`,
          method_family: "analytic_geometry_kinematics",
          expected_cost_usd: 0,
          proof_tier: "analytic",
          execution_authorized: false,
        }],
      ),
    }));
    state.authorizationForward.mockImplementation(async (params: Record<string, any>) => ({
      status: "forwarded",
      performed: true,
      required: true,
      endpoint_configured: true,
      http_status: 200,
      authorization: runAuthorization(
        params.runId,
        params.planDigest,
        params.authorizedAdapterReferences,
        params.actor,
        params.idempotencyKey,
      ),
    }));
    state.executionForward.mockImplementation(async (params: Record<string, any>) => {
      const stored = state.records.get(sessionId) as Record<string, any>;
      const preparation = stored.pipeline_task_evaluation_run_plan.pipeline_preparation;
      const execution = runExecutionResult(preparation);
      expect(params).toMatchObject({
        runId: preparation.run_id,
        planDigest: preparation.evidence_plan.plan_digest,
        requestDigest: preparation.request.request_digest,
        testbedDigest: preparation.evidence_plan.testbed_digest,
      });
      state.records.set(sessionId, {
        ...stored,
        pipeline_task_evaluation_run: { publication: execution.publication },
      });
      return {
        status: "forwarded",
        performed: true,
        required: true,
        endpoint_configured: true,
        http_status: 200,
        result: execution.result,
      };
    });
    const { server, socketPath } = await startServer();
    try {
      const planned = await postJson(
        socketPath,
        `/capture-uploads/${sessionId}/task-evaluation-runs/plan`,
        {
          schema_version: "capture_task_evaluation_run_plan_command.v1",
          idempotency_key: "plan-authorize-owner-1",
        },
      );
      expect(planned.status).toBe(201);
      const plannedBody = await planned.json() as Record<string, any>;
      const runId = String(plannedBody.run_id);
      const planDigest = String(plannedBody.pipeline_preparation.evidence_plan.plan_digest);

      const currentSession = structuredClone(state.records.get(sessionId)!);
      const staleSession = structuredClone(currentSession) as Record<string, any>;
      staleSession.pipeline_site_task_testbed.testbed.testbed_digest = `sha256:${"0".repeat(64)}`;
      state.records.set(sessionId, staleSession);
      const stale = await postJson(
        socketPath,
        `/capture-uploads/${sessionId}/task-evaluation-runs/${runId}/authorize`,
        {
          schema_version: "capture_task_evaluation_run_authorization_command.v1",
          plan_digest: planDigest,
          authorized_adapter_references: [adapterReference],
          idempotency_key: "authorize-owner-1",
        },
      );
      expect(stale.status).toBe(409);
      expect(state.authorizationForward).not.toHaveBeenCalled();
      state.records.set(sessionId, currentSession);

      const unknown = await postJson(
        socketPath,
        `/capture-uploads/${sessionId}/task-evaluation-runs/${runId}/authorize`,
        {
          schema_version: "capture_task_evaluation_run_authorization_command.v1",
          plan_digest: planDigest,
          authorized_adapter_references: ["provider://caller-selected"],
          idempotency_key: "authorize-owner-1",
        },
      );
      expect(unknown.status).toBe(409);
      expect(state.authorizationForward).not.toHaveBeenCalled();

      const authorized = await postJson(
        socketPath,
        `/capture-uploads/${sessionId}/task-evaluation-runs/${runId}/authorize`,
        {
          schema_version: "capture_task_evaluation_run_authorization_command.v1",
          plan_digest: planDigest,
          authorized_adapter_references: [adapterReference],
          idempotency_key: "authorize-owner-1",
        },
      );
      expect(authorized.status).toBe(200);
      await expect(authorized.json()).resolves.toMatchObject({
        already_exists: false,
        status: "authorized",
        run_id: runId,
        pipeline_authorization: {
          actor: { role: "customer", identity: "firebase:buyer-123" },
          paid_compute_authorized: false,
          physical_robot_run_authorized: false,
        },
      });
      expect(state.authorizationForward).toHaveBeenCalledTimes(1);
      expect(state.authorizationForward.mock.calls[0][0]).toMatchObject({
        actor: { role: "customer", identity: "firebase:buyer-123" },
        authorizedAdapterReferences: [adapterReference],
      });
      const publicSession = await getJson(socketPath, `/capture-uploads/${sessionId}`);
      expect(publicSession.status).toBe(200);
      await expect(publicSession.json()).resolves.toMatchObject({
        task_evaluation_run_control: {
          state: "authorized",
          run_id: runId,
          plan_digest: planDigest,
          authorized_adapter_references: [adapterReference],
        },
      });

      const replay = await postJson(
        socketPath,
        `/capture-uploads/${sessionId}/task-evaluation-runs/${runId}/authorize`,
        {
          schema_version: "capture_task_evaluation_run_authorization_command.v1",
          plan_digest: planDigest,
          authorized_adapter_references: [adapterReference],
          idempotency_key: "authorize-owner-1",
        },
      );
      expect(replay.status).toBe(200);
      await expect(replay.json()).resolves.toMatchObject({ already_exists: true });
      expect(state.authorizationForward).toHaveBeenCalledTimes(1);

      const executed = await postJson(
        socketPath,
        `/capture-uploads/${sessionId}/task-evaluation-runs/${runId}/execute`,
        {
          schema_version: "capture_task_evaluation_run_execution_command.v1",
          idempotency_key: `execute-${runId}`,
        },
      );
      expect(executed.status).toBe(200);
      await expect(executed.json()).resolves.toMatchObject({
        already_exists: false,
        status: "partially_decided",
        run_id: runId,
      });
      expect(state.executionForward).toHaveBeenCalledTimes(1);

      const executionReplay = await postJson(
        socketPath,
        `/capture-uploads/${sessionId}/task-evaluation-runs/${runId}/execute`,
        {
          schema_version: "capture_task_evaluation_run_execution_command.v1",
          idempotency_key: `execute-${runId}`,
        },
      );
      expect(executionReplay.status).toBe(200);
      await expect(executionReplay.json()).resolves.toMatchObject({ already_exists: true });
      expect(state.executionForward).toHaveBeenCalledTimes(1);
    } finally {
      await stopServer(server, socketPath);
    }
  });

  it("creates an owner-scoped idempotent 360 upload without claiming capture acceptance", async () => {
    state.start.mockImplementation(async ({ objectPath }: { objectPath: string }) => ({
      provider: "backblaze",
      fileId: "b2-large-file-1",
      objectPath,
      bucketName: "blueprint-private",
      storageUri: `b2://blueprint-private/${objectPath}`,
    }));
    const { server, socketPath } = await startServer();
    try {
      const first = await createSession(socketPath);
      expect(first).toMatchObject({
        schema_version: "capture_upload_session.v1",
        status: "upload_pending",
        capture_authority_profile: "camera_360_equirectangular",
        expected_part_count: 3,
        claim_boundary: {
          capture_accepted: false,
          metric_scale_inherent: false,
          comparative_policy_ranking_verdict: "thesis_not_supported",
        },
      });
      const providerInput = state.start.mock.calls[0][0] as { objectPath: string };
      expect(providerInput.objectPath).toMatch(
        /^captures\/buyer-123\/intakes\/capture-upload-[0-9a-f]{32}\/capture-upload-[0-9a-f]{32}\.mp4$/,
      );
      expect(providerInput.objectPath).not.toContain("warehouse-tour");
      expect(JSON.stringify([...state.records.values()])).not.toContain("authorizationToken");

      const again = await postJson(socketPath, "/capture-uploads", request());
      await expect(again.json()).resolves.toMatchObject({ already_exists: true });
      expect(again.status).toBe(200);
      expect(state.start).toHaveBeenCalledTimes(1);

      const conflict = await postJson(
        socketPath,
        "/capture-uploads",
        request({ scene_id: "different-scene" }),
      );
      await expect(conflict.json()).resolves.toMatchObject({
        error: "Capture upload idempotency conflict",
      });
      expect(conflict.status).toBe(409);
    } finally {
      await stopServer(server, socketPath);
    }
  });

  it("fails closed on unsupported media, missing required streams, and org mismatch", async () => {
    const { server, socketPath } = await startServer({ uid: "buyer-123", tenantId: "org-real" });
    try {
      const response = await postJson(
        socketPath,
        "/capture-uploads",
        request({
          organization_id: "org-spoofed",
          original_file: {
            original_filename: "warehouse-tour.avi",
            size_bytes: 20 * 1024 * 1024,
            media_type: "video/x-msvideo",
          },
          available_sensor_streams: [
            { stream_type: "retained_video", status: "available" },
          ],
        }),
      );
      const body = (await response.json()) as { blockers: string[] };
      expect(response.status).toBe(422);
      expect(body.blockers).toEqual([
        "capture_file_extension_not_supported_for_profile",
        "capture_media_type_not_supported_for_profile",
        "organization_identity_mismatch",
        "required_stream_missing:camera_metadata",
      ]);
      expect(state.start).not.toHaveBeenCalled();
    } finally {
      await stopServer(server, socketPath);
    }
  });

  it("authorizes only an owned planned part and never persists its credential", async () => {
    state.start.mockImplementation(async ({ objectPath }: { objectPath: string }) => ({
      fileId: "b2-large-file-1",
      objectPath,
      bucketName: "blueprint-private",
      storageUri: `b2://blueprint-private/${objectPath}`,
    }));
    state.authorize.mockResolvedValue({
      fileId: "b2-large-file-1",
      uploadUrl: "https://upload.example/b2-part",
      authorizationToken: "part-only-secret",
      expiresAtIso: "2026-07-30T12:00:00.000Z",
    });
    const owner = await startServer();
    try {
      const created = await createSession(owner.socketPath);
      const sessionId = String(created.session_id);
      const response = await postJson(
        owner.socketPath,
        `/capture-uploads/${sessionId}/parts/1/authorize`,
        {},
      );
      await expect(response.json()).resolves.toMatchObject({
        part_number: 1,
        upload_url: "https://upload.example/b2-part",
        authorization_token: "part-only-secret",
      });
      expect(response.status).toBe(200);
      expect(response.cacheControl).toBe("no-store");
      expect(JSON.stringify([...state.records.values()])).not.toContain("part-only-secret");
    } finally {
      await stopServer(owner.server, owner.socketPath);
    }

    const stranger = await startServer({ uid: "different-user" });
    try {
      const sessionId = String([...state.records.values()][0]?.session_id);
      const denied = await postJson(
        stranger.socketPath,
        `/capture-uploads/${sessionId}/parts/1/authorize`,
        {},
      );
      expect(denied.status).toBe(404);
    } finally {
      await stopServer(stranger.server, stranger.socketPath);
    }
  });

  it("verifies provider-listed part order, size, and SHA-1 before finalization", async () => {
    process.env.CAPTURE_UPLOAD_PART_SIZE_BYTES = String(64 * 1024 * 1024);
    state.start.mockImplementation(async ({ objectPath }: { objectPath: string }) => ({
      fileId: "b2-large-file-1",
      objectPath,
      bucketName: "blueprint-private",
      storageUri: `b2://blueprint-private/${objectPath}`,
    }));
    const hashes = ["a".repeat(40), "b".repeat(40), "c".repeat(40)];
    state.listParts.mockResolvedValue([
      { partNumber: 1, contentLength: 64 * 1024 * 1024, contentSha1: hashes[0] },
      { partNumber: 2, contentLength: 64 * 1024 * 1024, contentSha1: hashes[1] },
      { partNumber: 3, contentLength: 2 * 1024 * 1024, contentSha1: hashes[2] },
    ]);
    state.finish.mockResolvedValue(undefined);
    const { server, socketPath } = await startServer();
    try {
      const created = await createSession(socketPath);
      const response = await postJson(
        socketPath,
        `/capture-uploads/${created.session_id}/complete`,
        {
          schema_version: "capture_upload_completion_request.v1",
          part_sha1_array: hashes,
        },
      );
      const body = (await response.json()) as Record<string, unknown>;
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        status: "uploaded_verification_pending",
        upload_validation: {
          status: "provider_parts_verified",
          part_count: 3,
          size_bytes: 130 * 1024 * 1024,
        },
        malware_content_validation: { status: "pending" },
        content_addressing: { status: "pending_server_sha256_verification" },
        claim_boundary: { capture_accepted: false },
      });
      expect(state.finish).toHaveBeenCalledWith({
        fileId: "b2-large-file-1",
        partSha1Array: hashes,
      });
    } finally {
      await stopServer(server, socketPath);
    }
  });

  it("hands completed bytes to Pipeline, persists only the bound receipt, and exact-replays", async () => {
    process.env.CAPTURE_UPLOAD_PART_SIZE_BYTES = String(64 * 1024 * 1024);
    process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_URL = "https://pipeline.example.test/capture-upload-intakes";
    process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN = "fixture-forward-token";
    state.start.mockImplementation(async ({ objectPath }: { objectPath: string }) => ({
      fileId: "b2-large-file-1",
      objectPath,
      bucketName: "blueprint-private",
      storageUri: `b2://blueprint-private/${objectPath}`,
    }));
    const hashes = ["a".repeat(40), "b".repeat(40), "c".repeat(40)];
    state.listParts.mockResolvedValue([
      { partNumber: 1, contentLength: 64 * 1024 * 1024, contentSha1: hashes[0] },
      { partNumber: 2, contentLength: 64 * 1024 * 1024, contentSha1: hashes[1] },
      { partNumber: 3, contentLength: 2 * 1024 * 1024, contentSha1: hashes[2] },
    ]);
    state.finish.mockResolvedValue(undefined);
    state.downloadGrant.mockResolvedValue({
      provider: "backblaze",
      url: "https://download.example.test/file/private/capture.mp4",
      authorizationToken: "ephemeral-download-secret",
      expiresAtIso: "2026-07-30T12:00:00.000Z",
    });
    const receipt = {
      schema_version: "capture_upload_intake_receipt.v1",
      capture_session_id: "",
      intake_id: "intake-360-1",
      request_digest: `sha256:${"1".repeat(64)}`,
      envelope_digest: `sha256:${"2".repeat(64)}`,
      capture_digest: `sha256:${"3".repeat(64)}`,
      size_bytes: 130 * 1024 * 1024,
      admission_status: "accepted",
      state: "capture_accepted",
      claim_ceiling: { physical_task_success: false },
      artifact_reference: {
        uri: "intakes/intake-360-1/fixture",
        envelope_digest: `sha256:${"2".repeat(64)}`,
      },
      malware_content_validation: { status: "passed", scanner: "clamdscan" },
      capture_qa_report: {},
      already_exists: false,
      proof_boundary: {
        server_sha256_verified: true,
        raw_input_content_addressed: true,
        capture_qa_completed: true,
        task_success_established: false,
        physical_task_success_established: false,
        deployment_or_safety_approved: false,
        comparative_policy_ranking_verdict: "thesis_not_supported",
      },
    };
    state.intakeForward.mockImplementation(async (params: Record<string, any>) => {
      const qa = captureQaPublication(params.captureSessionId) as Record<string, any>;
      qa.report.status = "accepted";
      qa.report.state = "capture_accepted";
      qa.report.checks = [];
      qa.report.recapture_plan = [];
      qa.report.qa_report_digest = canonicalArtifactDigest(
        qa.report,
        "qa_report_digest",
      );
      qa.status = "accepted";
      qa.state = "capture_accepted";
      qa.qa_report_digest = qa.report.qa_report_digest;
      return {
        status: "forwarded",
        performed: true,
        required: false,
        endpoint_configured: true,
        http_status: 200,
        receipt: {
          ...receipt,
          capture_session_id: params.captureSessionId,
          envelope_digest: qa.envelope_digest,
          artifact_reference: {
            ...receipt.artifact_reference,
            envelope_digest: qa.envelope_digest,
          },
          capture_qa_report: qa.report,
        },
        captureQaPublication: qa,
      };
    });
    const { server, socketPath } = await startServer();
    try {
      const created = await createSession(socketPath);
      const response = await postJson(
        socketPath,
        `/capture-uploads/${created.session_id}/complete`,
        {
          schema_version: "capture_upload_completion_request.v1",
          part_sha1_array: hashes,
        },
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        status: "capture_accepted",
        upload_status: "uploaded_verification_pending",
        pipeline_handoff: { status: "forwarded", performed: true },
        upload_validation: { status: "server_bytes_verified", server_size_verified: true },
        malware_content_validation: { status: "passed", scanner: "clamdscan" },
        content_addressing: {
          status: "passed",
          sha256: `sha256:${"3".repeat(64)}`,
          raw_input_content_addressed: true,
        },
        claim_boundary: { capture_accepted: true },
      });
      expect(state.downloadGrant).toHaveBeenCalledTimes(1);
      expect(state.intakeForward).toHaveBeenCalledWith(expect.objectContaining({
        captureSessionId: created.session_id,
        customerId: "buyer-123",
        organizationId: "org-1",
        request: expect.objectContaining({ intake_id: "intake-360-1" }),
        transfer: expect.objectContaining({ authorizationToken: "ephemeral-download-secret" }),
      }));
      const persisted = JSON.stringify([...state.records.values()]);
      expect(persisted).not.toContain("ephemeral-download-secret");
      expect(persisted).not.toContain("download.example.test");

      const replay = await postJson(
        socketPath,
        `/capture-uploads/${created.session_id}/process`,
        {},
      );
      expect(replay.status).toBe(200);
      await expect(replay.json()).resolves.toMatchObject({
        status: "capture_accepted",
        pipeline_handoff: { status: "forwarded" },
      });
      expect(state.downloadGrant).toHaveBeenCalledTimes(1);
      expect(state.intakeForward).toHaveBeenCalledTimes(1);
    } finally {
      await stopServer(server, socketPath);
    }
  });

  it("abstains from finalization when a provider part differs from the browser receipt", async () => {
    state.start.mockImplementation(async ({ objectPath }: { objectPath: string }) => ({
      fileId: "b2-large-file-1",
      objectPath,
      bucketName: "blueprint-private",
      storageUri: `b2://blueprint-private/${objectPath}`,
    }));
    state.listParts.mockResolvedValue([
      { partNumber: 1, contentLength: 64 * 1024 * 1024, contentSha1: "a".repeat(40) },
      { partNumber: 2, contentLength: 64 * 1024 * 1024, contentSha1: "x".repeat(40) },
      { partNumber: 3, contentLength: 2 * 1024 * 1024, contentSha1: "c".repeat(40) },
    ]);
    const { server, socketPath } = await startServer();
    try {
      const created = await createSession(socketPath);
      const response = await postJson(
        socketPath,
        `/capture-uploads/${created.session_id}/complete`,
        {
          schema_version: "capture_upload_completion_request.v1",
          part_sha1_array: ["a".repeat(40), "b".repeat(40), "c".repeat(40)],
        },
      );
      const body = (await response.json()) as { blockers: string[] };
      expect(response.status).toBe(422);
      expect(body.blockers).toContain("capture_part_sha1_mismatch:2");
      expect(state.finish).not.toHaveBeenCalled();
    } finally {
      await stopServer(server, socketPath);
    }
  });

  it("relays a digest-verified Pipeline discovery and records owner intent as pending", async () => {
    state.records.set("capture-review-1", seededReviewSession());
    const { server, socketPath } = await startServer();
    try {
      const reviewResponse = await getJson(
        socketPath,
        "/capture-uploads/capture-review-1/task-discovery",
      );
      const review = (await reviewResponse.json()) as Record<string, any>;
      expect(reviewResponse.status).toBe(200);
      expect(review).toMatchObject({
        schema_version: "capture_task_review.v1",
        status: "task_approval_required",
        discovery: {
          discovery_id: "discovery-1",
          task_candidates: [{
            task_candidate_id: "task-candidate-1",
            approval_status: "approval_required",
          }],
        },
        claim_boundary: {
          webapp_command_is_pipeline_approval: false,
          decision_evidence_request_compiled: false,
          task_success_established: false,
        },
      });
      const candidate = review.discovery.task_candidates[0];
      const command = {
        schema_version: "task_candidate_decision_command.v1",
        discovery_digest: review.discovery.discovery_digest,
        task_candidate_id: candidate.task_candidate_id,
        candidate_digest: candidate.candidate_digest,
        action: "approve",
        idempotency_key: "approve-task-candidate-1",
        rationale: "This is the exact task we want evaluated.",
        edited_task: null,
      };
      const decisionResponse = await postJson(
        socketPath,
        "/capture-uploads/capture-review-1/task-decisions",
        command,
      );
      const receipt = (await decisionResponse.json()) as Record<string, unknown>;
      expect(decisionResponse.status).toBe(202);
      expect(receipt).toMatchObject({
        schema_version: "task_candidate_decision_command_receipt.v1",
        action: "approve",
        pipeline_approval_status: "pending_pipeline_validation",
      });
      expect(receipt).toMatchObject({
        approved_task_definition: null,
        decision_evidence_request: null,
      });

      const refreshed = await getJson(
        socketPath,
        "/capture-uploads/capture-review-1/task-discovery",
      );
      await expect(refreshed.json()).resolves.toMatchObject({
        status: "decision_pending_pipeline_validation",
        latest_decision_command: { action: "approve" },
      });

      // An exact replay repairs a missing session projection from the durable
      // command without creating a second command.
      const storedSession = state.records.get("capture-review-1");
      expect(storedSession).toBeDefined();
      delete storedSession!.latest_task_decision_command;
      const replay = await postJson(
        socketPath,
        "/capture-uploads/capture-review-1/task-decisions",
        command,
      );
      expect(replay.status).toBe(200);
      await expect(replay.json()).resolves.toMatchObject({ already_exists: true });
      expect(state.records.get("capture-review-1")).toMatchObject({
        latest_task_decision_command: {
          action: "approve",
          pipeline_approval_status: "pending_pipeline_validation",
        },
      });

      const conflicting = await postJson(
        socketPath,
        "/capture-uploads/capture-review-1/task-decisions",
        {
          ...command,
          action: "reject",
          idempotency_key: "reject-while-approval-is-pending",
        },
      );
      expect(conflicting.status).toBe(409);
      await expect(conflicting.json()).resolves.toMatchObject({
        error: "A task decision command is already pending Pipeline validation",
      });
    } finally {
      await stopServer(server, socketPath);
    }
  });

  it("rejects stale candidate bindings and incomplete edited task thresholds", async () => {
    state.records.set("capture-review-1", seededReviewSession());
    const { server, socketPath } = await startServer();
    try {
      const discovery = taskDiscovery() as Record<string, any>;
      const candidate = discovery.task_candidates[0];
      const stale = await postJson(
        socketPath,
        "/capture-uploads/capture-review-1/task-decisions",
        {
          schema_version: "task_candidate_decision_command.v1",
          discovery_digest: discovery.discovery_digest,
          task_candidate_id: candidate.task_candidate_id,
          candidate_digest: `sha256:${"f".repeat(64)}`,
          action: "approve",
          idempotency_key: "stale-task-candidate-1",
          rationale: "Stale command should fail.",
          edited_task: null,
        },
      );
      expect(stale.status).toBe(409);

      const incompleteEdit = await postJson(
        socketPath,
        "/capture-uploads/capture-review-1/task-decisions",
        {
          schema_version: "task_candidate_decision_command.v1",
          discovery_digest: discovery.discovery_digest,
          task_candidate_id: candidate.task_candidate_id,
          candidate_digest: candidate.candidate_digest,
          action: "edit_and_approve",
          idempotency_key: "incomplete-edit-task-candidate-1",
          rationale: "Use a tighter threshold.",
          edited_task: {
            description: "Move the tote into the box.",
            task_family: "rigid_object_pick_place",
            measurable_success_conditions: [{
              metric: "object_center_distance",
              operator: "<=",
              threshold: 0.03,
            }],
            reset_contract: { instructions: "Return tote to table." },
          },
        },
      );
      expect(incompleteEdit.status).toBe(400);
    } finally {
      await stopServer(server, socketPath);
    }
  });

  it("stores a verified authoritative Pipeline approval without inventing a request", async () => {
    const reviewSession = seededReviewSession();
    const discovery = reviewSession.pipeline_task_discovery as Record<string, any>;
    state.records.set("capture-review-1", reviewSession);
    state.forward.mockImplementation(async (params: Record<string, any>) => {
      const result = pipelineDecisionResult(discovery);
      result.command_request_id = params.command.command_request_id;
      return {
        status: "forwarded",
        performed: true,
        required: true,
        endpoint_configured: true,
        http_status: 200,
        pipeline_result: result,
      };
    });
    const candidate = discovery.task_candidates[0];
    const { server, socketPath } = await startServer();
    try {
      const response = await postJson(
        socketPath,
        "/capture-uploads/capture-review-1/task-decisions",
        {
          schema_version: "task_candidate_decision_command.v1",
          discovery_digest: discovery.discovery_digest,
          task_candidate_id: candidate.task_candidate_id,
          candidate_digest: candidate.candidate_digest,
          action: "approve",
          idempotency_key: "approve-task-candidate-1",
          rationale: "This is the exact task we want evaluated.",
          edited_task: null,
        },
      );
      const receipt = (await response.json()) as Record<string, any>;
      expect(response.status).toBe(200);
      expect(receipt).toMatchObject({
        pipeline_approval_status: "approved",
        pipeline_task_decision: { action: "approve" },
        approved_task_definition: { approval_status: "approved" },
        decision_evidence_request: null,
        pipeline_result_proof_boundary: {
          decision_evidence_request_compiled: false,
          task_success_established: false,
          comparative_policy_ranking_verdict: "thesis_not_supported",
        },
      });
      const session = state.records.get("capture-review-1") as Record<string, any>;
      expect(session.latest_task_decision_command.pipeline_approval_status).toBe("approved");
      expect(session.decision_evidence_request).toBeNull();

      const review = await getJson(
        socketPath,
        "/capture-uploads/capture-review-1/task-discovery",
      );
      await expect(review.json()).resolves.toMatchObject({ status: "task_approved" });
    } finally {
      await stopServer(server, socketPath);
    }
  });

  it("keeps an exact-retryable pending command when Pipeline resolution persistence fails", async () => {
    const reviewSession = seededReviewSession();
    const discovery = reviewSession.pipeline_task_discovery as Record<string, any>;
    state.records.set("capture-review-1", reviewSession);
    state.forward.mockImplementation(async (params: Record<string, any>) => {
      const result = pipelineDecisionResult(discovery);
      result.command_request_id = params.command.command_request_id;
      return {
        status: "forwarded",
        performed: true,
        required: true,
        endpoint_configured: true,
        http_status: 200,
        pipeline_result: result,
      };
    });
    let transactionCount = 0;
    state.beforeTransaction = () => {
      transactionCount += 1;
      if (transactionCount === 2) throw new Error("simulated Firestore interruption");
    };
    const candidate = discovery.task_candidates[0];
    const { server, socketPath } = await startServer();
    try {
      const response = await postJson(
        socketPath,
        "/capture-uploads/capture-review-1/task-decisions",
        {
          schema_version: "task_candidate_decision_command.v1",
          discovery_digest: discovery.discovery_digest,
          task_candidate_id: candidate.task_candidate_id,
          candidate_digest: candidate.candidate_digest,
          action: "approve",
          idempotency_key: "approval-with-local-interruption",
          rationale: "This is the exact task we want evaluated.",
          edited_task: null,
        },
      );
      expect(response.status).toBe(202);
      await expect(response.json()).resolves.toMatchObject({
        pipeline_approval_status: "pending_pipeline_validation",
        pipeline_forward: {
          status: "forwarded",
          performed: true,
          blocker: "pipeline_task_decision_resolution_persistence_failed",
        },
      });
      expect(state.records.get("capture-review-1")).toMatchObject({
        latest_task_decision_command: {
          pipeline_approval_status: "pending_pipeline_validation",
        },
      });
    } finally {
      await stopServer(server, socketPath);
    }
  });

  it("rejects a task command when Pipeline replaces discovery before commit", async () => {
    state.records.set("capture-review-1", seededReviewSession());
    const original = taskDiscovery() as Record<string, any>;
    const candidate = original.task_candidates[0] as Record<string, unknown>;
    state.beforeTransaction = () => {
      const live = state.records.get("capture-review-1")!;
      const replacement = taskDiscovery() as Record<string, any>;
      replacement.discovery_id = "discovery-2";
      replacement.task_candidates[0].description = "Inspect the tote without moving it.";
      replacement.task_candidates[0].candidate_digest = canonicalArtifactDigest(
        replacement.task_candidates[0],
        "candidate_digest",
      );
      replacement.discovery_digest = canonicalArtifactDigest(replacement, "discovery_digest");
      live.pipeline_task_discovery = replacement;
      state.beforeTransaction = null;
    };
    const { server, socketPath } = await startServer();
    try {
      const response = await postJson(
        socketPath,
        "/capture-uploads/capture-review-1/task-decisions",
        {
          schema_version: "task_candidate_decision_command.v1",
          discovery_digest: original.discovery_digest,
          task_candidate_id: candidate.task_candidate_id,
          candidate_digest: candidate.candidate_digest,
          action: "approve",
          idempotency_key: "approval-raced-by-new-discovery",
          rationale: "This was correct for the discovery I reviewed.",
          edited_task: null,
        },
      );
      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toMatchObject({
        error: "Task discovery changed before command commit",
      });
      expect(
        [...state.records.values()].filter(
          (record) => record.schema_version === "task_candidate_decision_command_record.v1",
        ),
      ).toHaveLength(0);
    } finally {
      await stopServer(server, socketPath);
    }
  });

  it("fails closed instead of displaying a tampered or cross-owner discovery", async () => {
    const record = seededReviewSession();
    const discovery = record.pipeline_task_discovery as Record<string, any>;
    discovery.task_candidates[0].description = "Tampered after Pipeline digest";
    state.records.set("capture-review-1", record);
    const owner = await startServer();
    try {
      const invalid = await getJson(
        owner.socketPath,
        "/capture-uploads/capture-review-1/task-discovery",
      );
      expect(invalid.status).toBe(409);
      const invalidBody = (await invalid.json()) as { blockers: string[] };
      expect(invalidBody.blockers).toContain("task_discovery_digest_mismatch");
      expect(invalidBody.blockers).toContain(
        "task_candidate_digest_mismatch:task-candidate-1",
      );
    } finally {
      await stopServer(owner.server, owner.socketPath);
    }

    const stranger = await startServer({ uid: "different-user" });
    try {
      const denied = await getJson(
        stranger.socketPath,
        "/capture-uploads/capture-review-1/task-discovery",
      );
      expect(denied.status).toBe(404);
    } finally {
      await stopServer(stranger.server, stranger.socketPath);
    }
  });
});
