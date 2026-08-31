// @vitest-environment node
import { createHmac, randomUUID } from "node:crypto";
import express from "express";
import { unlinkSync } from "node:fs";
import { createServer, request as httpRequest, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { canonicalArtifactDigest } from "../utils/taskCandidateContract";
import canaryPublicationFixture from "./fixtures/pipeline-policy-canary-publication.v4.json";
import canaryBlockedFixture from "./fixtures/pipeline-policy-canary-preprovider-blocked.v1.json";
import configuredOfferingFixture from "./fixtures/pipeline-configured-scene-offering.v1.json";

const state = vi.hoisted(() => ({
  collections: new Map<string, Map<string, Record<string, any>>>(),
  sendEmail: vi.fn(),
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => {
  type Reference = {
    collectionName: string;
    id: string;
    get: () => Promise<ReturnType<typeof read>>;
    set: (payload: Record<string, unknown>, options?: { merge?: boolean }) => Promise<void>;
  };
  const reference = (collectionName: string, id: string): Reference => ({
    collectionName,
    id,
    get: async () => read({ collectionName, id } as Reference),
    set: async (payload, options) => write(
      { collectionName, id } as Reference,
      payload,
      options?.merge,
    ),
  });
  const read = (ref: Reference) => {
    const record = state.collections.get(ref.collectionName)?.get(ref.id);
    return { exists: Boolean(record), data: () => record && structuredClone(record) };
  };
  const write = (ref: Reference, payload: Record<string, unknown>, merge = false) => {
    const collection = state.collections.get(ref.collectionName) || new Map();
    collection.set(ref.id, merge
      ? { ...(collection.get(ref.id) || {}), ...structuredClone(payload) }
      : structuredClone(payload));
    state.collections.set(ref.collectionName, collection);
  };
  return {
    dbAdmin: {
      collection: (name: string) => ({
        doc: (id: string) => reference(name, id),
        where: (field: string, operator: string, value: unknown) => ({
          limit: (limit: number) => ({
            get: async () => ({
              docs: [...(state.collections.get(name)?.entries() || [])]
                .filter(([, record]) => operator === "==" && record[field] === value)
                .slice(0, limit)
                .map(([id, record]) => ({ id, data: () => structuredClone(record) })),
            }),
          }),
        }),
      }),
      runTransaction: async <T>(callback: (transaction: {
        get: (ref: Reference) => Promise<ReturnType<typeof read>>;
        create: (ref: Reference, payload: Record<string, unknown>) => void;
        set: (ref: Reference, payload: Record<string, unknown>, options?: { merge?: boolean }) => void;
      }) => Promise<T>) => callback({
        get: async (ref) => read(ref),
        create: (ref, payload) => {
          if (state.collections.get(ref.collectionName)?.has(ref.id)) throw new Error("already exists");
          write(ref, payload);
        },
        set: (ref, payload, options) => write(ref, payload, options?.merge),
      }),
    },
  };
});

vi.mock("../utils/email", () => ({ sendEmail: state.sendEmail }));

vi.mock("../utils/pipelineSyncSecurity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/pipelineSyncSecurity")>();
  return {
    ...actual,
    createPipelineSyncRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  };
});

const sha = (character: string) => `sha256:${character.repeat(64)}`;

function policyCanaryPublication() {
  const value = structuredClone(canaryPublicationFixture) as Record<string, any>;
  value.result_delivery.delivery_digest = canonicalArtifactDigest(
    value.result_delivery,
    "delivery_digest",
  );
  value.policy_canary_result.result_delivery_digest = value.result_delivery.delivery_digest;
  value.policy_canary_result.projection_digest = canonicalArtifactDigest(
    value.policy_canary_result,
    "projection_digest",
  );
  return value;
}

function policyCanaryPreproviderBlocked() {
  const value = structuredClone(canaryBlockedFixture) as Record<string, any>;
  value.payload_digest = canonicalArtifactDigest(value, "payload_digest");
  return value;
}

function configuredOfferingRecord(params: {
  configurationRunId: string;
  teamNamespace?: string;
}) {
  const offering = structuredClone(configuredOfferingFixture) as Record<string, any>;
  offering.status = "configured_controls_pending";
  offering.configuration_run_id = params.configurationRunId;
  offering.team_namespace = params.teamNamespace || "team-1";
  offering.evaluation_admission = {
    zero_action_required: true,
    scripted_positive_required: true,
    learned_policy_evaluation_admitted: false,
  };
  offering.offering_digest = canonicalArtifactDigest(offering, "offering_digest");
  return {
    configured_scene_offering_state: offering.status,
    configured_scene_offering_digest: offering.offering_digest,
    configured_scene_offering_team_namespace: offering.team_namespace,
    configured_scene_offering: offering,
  };
}

function publication() {
  const plan: Record<string, any> = {
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
    physical_evidence_requests: [],
    budget_status: { max_cost_usd: 0, projected_cost_usd: 0, within_budget: true },
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
    decision_question: "Can the robot reach the target?",
    overall_outcome: "decision",
    per_claim_verdicts: [{
      claim_id: "reach",
      claim_type: "reachability",
      verdict: "supported",
      rationale: "qualified_evidence_satisfies_claim",
      accepted_result_digests: [sha("c")],
      claim_ceiling: { physical_success: false, deployment_readiness: false, safety_certification: false },
    }],
    evidence_accepted: [sha("c")],
    evidence_rejected: [],
    validation_envelope: { exact_scope: true },
    unsupported_conditions: ["physical_task_success"],
    uncertainty: { maximum: 0.1, ranking_science_boundary: "thesis_not_supported" },
    cross_method_disagreements: [],
    shared_dependency_warnings: [],
    claim_ceiling: {
      physical_success: false,
      deployment_readiness: false,
      safety_certification: false,
      generated_artifact_upgrades_raw_or_physical_claim: false,
    },
    next_cheapest_experiment: "none_required",
    physical_evidence_still_required: [],
    deployment_approval: false,
    safety_certification: false,
    raw_policy_values_persisted: false,
    raw_secret_values_persisted: false,
  };
  envelope.decision_envelope_digest = canonicalArtifactDigest(envelope, "decision_envelope_digest");
  return {
    schema_version: "task_evaluation_run_publication.v1",
    capture_session_id: "capture-run-1",
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

function publicationV2(status: "blocked" | "ready") {
  const value = publication() as Record<string, any>;
  const artifact = {
    artifact_id: "1".repeat(32),
    role: "review_package",
    relative_path: "artifacts/result_delivery/review_pack.zip",
    sha256: sha("e"),
    size_bytes: 123,
    content_type: "application/zip",
  };
  const delivery: Record<string, any> = {
    schema_version: "task_evaluation_result_delivery.v1",
    run_id: value.run_id,
    state: value.state,
    status,
    claim_class: "development_only",
    decision_envelope_digest: value.decision_envelope.decision_envelope_digest,
    ...(status === "ready" ? { episode_evidence_index_digest: sha("d") } : {}),
    stages: [
      { stage: "validate", status: status === "ready" ? "complete" : "blocked" },
      { stage: "seal", status: status === "ready" ? "complete" : "waiting" },
      { stage: "project", status: status === "ready" ? "complete" : "waiting" },
      { stage: "package", status: status === "ready" ? "complete" : "waiting" },
      { stage: "publish", status: status === "ready" ? "ready" : "waiting" },
    ],
    blockers: status === "ready" ? [] : ["episode_evidence_index_missing"],
    summary: {
      episode_count: 0,
      learned_candidate_episode_count: 0,
      control_episode_count: 0,
      successful_episode_count: 0,
    },
    episodes: [],
    artifacts: status === "ready" ? [artifact] : [],
    proof_boundary: {
      review_video_is_authoritative_evidence: false,
      simulation_is_physical_success: false,
      cross_team_leaderboard_authorized: false,
    },
  };
  delivery.delivery_digest = canonicalArtifactDigest(delivery, "delivery_digest");
  return { ...value, schema_version: "task_evaluation_run_publication.v2", result_delivery: delivery };
}

function publicationV3() {
  const value = publicationV2("ready") as Record<string, any>;
  const familyMetrics = Object.fromEntries([
    "canonical_anchor", "placement_approach", "illumination", "camera_sensor",
    "bounded_physics", "pairwise", "held_out",
  ].map((family) => [family, {
    attempted: family === "placement_approach" || family === "pairwise" || family === "held_out" ? 2 : 1,
    succeeded: family === "placement_approach" || family === "pairwise" || family === "held_out" ? 2 : 1,
    success_rate: 1,
    degradation_from_canonical: 0,
  }]));
  const candidateResult = (candidateId: string) => ({
    candidate_id: candidateId,
    episodes_completed: 10,
    family_metrics: familyMetrics,
    failures: [],
    contacts: { contact_count: 10, violation_count: 0 },
    evidence: {
      lossless_frame_manifest_count: 10,
      review_video_count: 10,
      typed_media_gap_count: 0,
    },
  });
  const policyResult: Record<string, any> = {
    schema_version: "task_evaluation_policy_run_result_projection.v1",
    run_id: value.run_id,
    source_launch_id: "evaluation-launch-001",
    offering_digest: sha("8"),
    configuration_digest: sha("9"),
    plan_digest: value.plan_digest,
    embodiment_id: "franka_panda_robotiq_2f85_v1",
    candidate_ids: ["pi05_droid", "groot_n17_droid"],
    state: value.state,
    matrix: {
      scored_cell_count: 10,
      candidate_episode_count: 20,
      control_episode_count: 20,
      expected_episode_count: 40,
      completed_episode_count: 40,
      identical_candidate_cells_and_seeds: true,
      controls_complete: true,
    },
    candidate_results: [candidateResult("pi05_droid"), candidateResult("groot_n17_droid")],
    paired_comparison: {
      matched_episode_pairs: 10,
      decision: "tie",
      deterministic_non_policy_scoring: true,
    },
    result_delivery_digest: value.result_delivery.delivery_digest,
    blockers: [],
    proof_boundary: {
      simulation_is_physical_success: false,
      review_video_is_authoritative_evidence: false,
      policy_can_grade_itself: false,
      cross_team_leaderboard_authorized: false,
    },
    projection_digest: "",
  };
  policyResult.projection_digest = canonicalArtifactDigest(policyResult, "projection_digest");
  return {
    ...value,
    schema_version: "task_evaluation_run_publication.v3",
    policy_run_result: policyResult,
  };
}

function signedBody(body: Record<string, unknown>) {
  const rawBody = JSON.stringify(body);
  const timestamp = new Date().toISOString();
  const signature = createHmac("sha256", "pipeline-secret")
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return {
    rawBody,
    headers: {
      "content-type": "application/json",
      "x-blueprint-pipeline-timestamp": timestamp,
      "x-blueprint-pipeline-signature": `sha256=${signature}`,
    },
  };
}

async function startServer() {
  const { default: router } = await import("../routes/internal-capture-task-evaluation-runs");
  const app = express();
  app.use(express.json());
  app.use("/internal", router);
  const server = createServer(app);
  const socketPath = join(tmpdir(), `blueprint-task-run-${randomUUID()}.sock`);
  await new Promise<void>((resolve) => server.listen(socketPath, resolve));
  return { server, socketPath };
}

async function stopServer(server: Server, socketPath: string) {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  try { unlinkSync(socketPath); } catch { /* Node may remove it. */ }
}

async function postSigned(socketPath: string, body: Record<string, unknown>) {
  const signed = signedBody(body);
  return new Promise<{ status: number; body: Record<string, any> }>((resolve, reject) => {
    const request = httpRequest({
      socketPath,
      path: "/internal/capture-task-evaluation-runs",
      method: "POST",
      headers: { ...signed.headers, "content-length": Buffer.byteLength(signed.rawBody) },
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => resolve({
        status: response.statusCode || 0,
        body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
      }));
    });
    request.on("error", reject);
    request.end(signed.rawBody);
  });
}

afterEach(() => {
  state.collections.clear();
  state.sendEmail.mockReset();
  delete process.env.PIPELINE_SYNC_TOKEN;
  delete process.env.BLUEPRINT_TRANSACTIONAL_EMAIL_NOTIFICATIONS_ENABLED;
});

describe("internal Pipeline Task Evaluation Run publication", () => {
  it("stores one immutable run and replays the exact native envelope", async () => {
    process.env.PIPELINE_SYNC_TOKEN = "pipeline-secret";
    state.collections.set("captureUploadSessions", new Map([["capture-run-1", {
      request: { intake_id: "intake-1" },
      pipeline_site_task_testbed: { testbed_digest: sha("b") },
    }]]));
    const body = publication();
    const { server, socketPath } = await startServer();
    try {
      const first = await postSigned(socketPath, body);
      expect(first.status).toBe(201);
      expect(first.body).toMatchObject({
        status: "decided",
        already_exists: false,
        run_id: "run-1",
        plan_digest: body.plan_digest,
        decision_envelope_digest: body.decision_envelope.decision_envelope_digest,
      });
      expect(state.collections.get("captureTaskEvaluationRuns")?.size).toBe(1);
      expect(state.collections.get("captureUploadSessions")?.get("capture-run-1"))
        .toMatchObject({ pipeline_run_state: "decided" });

      const replay = await postSigned(socketPath, body);
      expect(replay.status).toBe(200);
      expect(replay.body).toMatchObject({ already_exists: true });
      expect(state.collections.get("captureTaskEvaluationRuns")?.size).toBe(1);
    } finally {
      await stopServer(server, socketPath);
    }
  });

  it("rejects a stale testbed binding and a digest-tampered envelope", async () => {
    process.env.PIPELINE_SYNC_TOKEN = "pipeline-secret";
    state.collections.set("captureUploadSessions", new Map([["capture-run-1", {
      request: { intake_id: "intake-1" },
      pipeline_site_task_testbed: { testbed_digest: sha("f") },
    }]]));
    const { server, socketPath } = await startServer();
    try {
      expect((await postSigned(socketPath, publication())).status).toBe(409);
      const tampered = publication();
      tampered.decision_envelope.next_cheapest_experiment = "changed";
      expect((await postSigned(socketPath, tampered)).status).toBe(400);
      expect(state.collections.get("captureTaskEvaluationRuns")?.size || 0).toBe(0);
    } finally {
      await stopServer(server, socketPath);
    }
  });

  it("derives team access from the capture and accepts only a blocked-to-ready evidence upgrade", async () => {
    process.env.PIPELINE_SYNC_TOKEN = "pipeline-secret";
    state.collections.set("captureUploadSessions", new Map([["capture-run-1", {
      owner_user_id: "buyer-1",
      organization_id: "team-1",
      organization_binding_status: "firebase_tenant_verified",
      request: { intake_id: "intake-1" },
      pipeline_site_task_testbed: { testbed_digest: sha("b") },
    }]]));
    const { server, socketPath } = await startServer();
    try {
      const blocked = await postSigned(socketPath, publicationV2("blocked"));
      expect(blocked.status).toBe(201);
      const readyBody = publicationV2("ready");
      const ready = await postSigned(socketPath, readyBody);
      expect(ready.status).toBe(200);
      expect(ready.body.result_delivery_digest).toBe(readyBody.result_delivery.delivery_digest);
      const record = [...(state.collections.get("captureTaskEvaluationRuns")?.values() || [])][0];
      expect(record).toMatchObject({
        schema_version: "capture_task_evaluation_run_record.v2",
        owner_user_id: "buyer-1",
        organization_id: "team-1",
        access_visibility: "organization_members",
        publication: { result_delivery: { status: "ready" } },
      });
      const changed = publicationV2("ready");
      changed.result_delivery.artifacts[0].sha256 = sha("f");
      changed.result_delivery.delivery_digest = canonicalArtifactDigest(changed.result_delivery, "delivery_digest");
      expect((await postSigned(socketPath, changed)).status).toBe(409);
    } finally {
      await stopServer(server, socketPath);
    }
  });

  it("binds a v3 policy result to its team run and emits an idempotent safe portal receipt", async () => {
    process.env.PIPELINE_SYNC_TOKEN = "pipeline-secret";
    state.collections.set("captureUploadSessions", new Map([["capture-run-1", {
      owner_user_id: "buyer-1",
      organization_id: "team-1",
      organization_binding_status: "firebase_tenant_verified",
      request: { intake_id: "intake-1" },
      pipeline_site_task_testbed: { testbed_digest: sha("b") },
    }]]));
    state.collections.set("taskEvaluationPolicyRuns", new Map([["run-1", {
      schema_version: "task_evaluation_policy_run_web_record.v1",
      run_id: "run-1",
      source_launch_id: "evaluation-launch-001",
      offering_digest: sha("8"),
      configuration_digest: sha("9"),
      notification_source_event_id: sha("9"),
      team_namespace: "team-1",
      notification_recipient_user_id: "buyer-1",
      state: "aggregating",
    }]]));
    const body = publicationV3();
    const { server, socketPath } = await startServer();
    try {
      const first = await postSigned(socketPath, body);
      expect(first.status).toBe(201);
      expect(first.body).toMatchObject({
        status: "decided",
        result_delivery_digest: body.result_delivery.delivery_digest,
        policy_run_projection_digest: body.policy_run_result.projection_digest,
      });
      const stored = state.collections.get("taskEvaluationPolicyRuns")?.get("run-1");
      expect(stored).toMatchObject({
        state: "results_ready",
        result_record_id: expect.stringMatching(/^capture-run-/),
        policy_run_result: {
          paired_comparison: { decision: "tie" },
          projection_digest: body.policy_run_result.projection_digest,
        },
      });
      expect(JSON.stringify(stored)).not.toContain("s3://");

      const replay = await postSigned(socketPath, body);
      expect(replay.status).toBe(200);
      expect(replay.body.already_exists).toBe(true);
      const notifications = state.collections.get("transactionalNotifications");
      expect(notifications?.size).toBe(3);
      expect(JSON.stringify([...(notifications?.values() || [])])).toContain("/app/results/capture-run-");
    } finally {
      await stopServer(server, socketPath);
    }
  });

  it("stores a v4 canary publication and returns one exactly-once accepted notification receipt", async () => {
    process.env.PIPELINE_SYNC_TOKEN = "pipeline-secret";
    process.env.BLUEPRINT_TRANSACTIONAL_EMAIL_NOTIFICATIONS_ENABLED = "1";
    state.sendEmail.mockResolvedValue({
      sent: true,
      provider: "sendgrid",
      messageId: "message-canary-1",
    });
    const body = policyCanaryPublication();
    const offeringRecord = configuredOfferingRecord({
      configurationRunId: body.intake_id,
    });
    state.collections.set("taskEvaluationLaunches", new Map([[
      body.capture_session_id,
      offeringRecord,
    ]]));
    state.collections.set("taskEvaluationPolicyRuns", new Map([[body.run_id, {
      schema_version: "task_evaluation_policy_run_web_record.v2",
      run_id: body.run_id,
      run_kind: "internal_policy_canary",
      request_digest: body.request_digest,
      pipeline_configuration_digest: body.configuration_digest,
      owner_user_id: "buyer-1",
      team_namespace: "team-1",
      source_launch_id: body.capture_session_id,
      offering_digest: offeringRecord.configured_scene_offering_digest,
      notification_recipient_user_id: "buyer-1",
      notification: { email: "buyer@example.com" },
      scene: { id: "839873" },
      task: { id: "simple-relocation", label: "simple relocation" },
      robot: { display_name: "Franka Panda + Robotiq" },
      policy_candidates: [
        { candidate_id: "pi05_droid", display_name: "PI 0.5 DROID" },
        { candidate_id: "groot_n17_droid", display_name: "GR00T N1.7 DROID" },
      ],
      episode_plan: { episodes_per_policy: 10 },
      state: "aggregating",
    }]]));
    const { server, socketPath } = await startServer();
    try {
      const first = await postSigned(socketPath, body);
      expect(first.status).toBe(201);
      expect(first.body).toMatchObject({
        schema_version: "capture_task_evaluation_policy_canary_publication_receipt.v1",
        status: "blocked",
        already_exists: false,
        capture_session_id: body.capture_session_id,
        intake_id: body.intake_id,
        run_id: body.run_id,
        request_digest: body.request_digest,
        configuration_digest: body.configuration_digest,
        result_delivery_digest: body.result_delivery.delivery_digest,
        policy_canary_projection_digest: body.policy_canary_result.projection_digest,
        notification_delivery: {
          terminal_state: "blocked",
          status: "accepted",
          attempts: 1,
          provider: "sendgrid",
          message_id: "message-canary-1",
          delivered_at: null,
          run_result_digest: body.policy_canary_result.projection_digest,
        },
      });
      expect(state.collections.get("captureTaskEvaluationRuns")?.size).toBe(1);
      expect(state.collections.get("taskEvaluationPolicyRuns")?.get(body.run_id))
        .toMatchObject({
          state: "blocked",
          result_record_id: expect.stringMatching(/^capture-run-/),
          delivery_digest: body.result_delivery.delivery_digest,
          notification_delivery: { status: "accepted", attempts: 1 },
        });

      const replay = await postSigned(socketPath, body);
      expect(replay.status).toBe(200);
      expect(replay.body).toMatchObject({
        already_exists: true,
        notification_delivery: { status: "accepted", attempts: 1 },
      });
      expect(state.sendEmail).toHaveBeenCalledTimes(1);

      const conflict = structuredClone(body);
      conflict.policy_canary_result.blockers.push("different_terminal_fact");
      conflict.policy_canary_result.projection_digest = canonicalArtifactDigest(
        conflict.policy_canary_result,
        "projection_digest",
      );
      expect((await postSigned(socketPath, conflict)).status).toBe(409);
    } finally {
      await stopServer(server, socketPath);
    }
  });

  it("persists a pre-provider blocker, binds its owner/team, and refuses replay conflicts", async () => {
    process.env.PIPELINE_SYNC_TOKEN = "pipeline-secret";
    process.env.BLUEPRINT_TRANSACTIONAL_EMAIL_NOTIFICATIONS_ENABLED = "1";
    state.sendEmail.mockResolvedValue({
      sent: true,
      provider: "smtp",
      messageId: "message-blocked-1",
    });
    const body = policyCanaryPreproviderBlocked();
    const offeringRecord = configuredOfferingRecord({
      configurationRunId: body.intake_id,
    });
    state.collections.set("taskEvaluationLaunches", new Map([[
      body.capture_session_id,
      offeringRecord,
    ]]));
    state.collections.set("taskEvaluationPolicyRuns", new Map([["scene-839873-canary-1", {
      schema_version: "task_evaluation_policy_run_web_record.v2",
      run_id: "scene-839873-canary-1",
      run_kind: "internal_policy_canary",
      request_digest: body.request_digest,
      owner_user_id: "buyer-1",
      team_namespace: "team-1",
      source_launch_id: body.capture_session_id,
      offering_digest: offeringRecord.configured_scene_offering_digest,
      notification_recipient_user_id: "buyer-1",
      notification: { email: "buyer@example.com" },
      scene: { id: "839873" },
      task: { id: "simple-relocation", label: "simple relocation" },
      robot: { display_name: "Franka Panda + Robotiq" },
      policy_candidates: [
        { candidate_id: "pi05_droid", display_name: "PI 0.5 DROID" },
        { candidate_id: "groot_n17_droid", display_name: "GR00T N1.7 DROID" },
      ],
      episode_plan: { episodes_per_policy: 10 },
      state: "preparing",
    }]]));
    const { server, socketPath } = await startServer();
    try {
      const first = await postSigned(socketPath, body);
      expect(first.status).toBe(201);
      expect(first.body).toMatchObject({
        schema_version: "capture_task_evaluation_policy_canary_blocked_receipt.v1",
        status: "blocked",
        already_exists: false,
        activation_id: body.activation_id,
        capture_session_id: body.capture_session_id,
        intake_id: body.intake_id,
        run_id: "scene-839873-canary-1",
        request_digest: body.request_digest,
        payload_digest: body.payload_digest,
        notification_delivery: {
          terminal_state: "blocked",
          status: "accepted",
          attempts: 1,
          provider: "smtp",
          message_id: "message-blocked-1",
          run_result_digest: body.payload_digest,
        },
      });
      expect(state.collections.get("taskEvaluationPolicyRuns")?.get("scene-839873-canary-1"))
        .toMatchObject({
          state: "blocked",
          phase: "pre_provider_blocked",
          preprovider_blocked: { payload_digest: body.payload_digest },
          notification_delivery: { status: "accepted", attempts: 1 },
        });
      const replay = await postSigned(socketPath, body);
      expect(replay.status).toBe(200);
      expect(replay.body).toMatchObject({ already_exists: true });
      expect(state.sendEmail).toHaveBeenCalledTimes(1);

      const conflict = structuredClone(body);
      conflict.blockers = ["different_preprovider_fact"];
      conflict.payload_digest = canonicalArtifactDigest(conflict, "payload_digest");
      expect((await postSigned(socketPath, conflict)).status).toBe(409);
    } finally {
      await stopServer(server, socketPath);
    }
  });

  it("refuses a signed canary blocker whose policy run belongs to another team", async () => {
    process.env.PIPELINE_SYNC_TOKEN = "pipeline-secret";
    const body = policyCanaryPreproviderBlocked();
    const offeringRecord = configuredOfferingRecord({
      configurationRunId: body.intake_id,
    });
    state.collections.set("taskEvaluationLaunches", new Map([[
      body.capture_session_id,
      offeringRecord,
    ]]));
    state.collections.set("taskEvaluationPolicyRuns", new Map([["scene-839873-canary-1", {
      run_id: "scene-839873-canary-1",
      run_kind: "internal_policy_canary",
      request_digest: body.request_digest,
      owner_user_id: "buyer-2",
      team_namespace: "team-2",
      source_launch_id: body.capture_session_id,
      offering_digest: offeringRecord.configured_scene_offering_digest,
      state: "preparing",
    }]]));
    const { server, socketPath } = await startServer();
    try {
      const response = await postSigned(socketPath, body);
      expect(response.status).toBe(409);
      expect(response.body.error).toBe("Policy canary owner or team binding mismatch");
      expect(state.collections.get("captureTaskEvaluationRuns")?.size || 0).toBe(0);
      expect(state.sendEmail).not.toHaveBeenCalled();

      state.collections.get("taskEvaluationPolicyRuns")?.set(
        "scene-839873-canary-1",
        {
          run_id: "scene-839873-canary-1",
          run_kind: "internal_policy_canary",
          request_digest: body.request_digest,
          owner_user_id: "buyer-1",
          team_namespace: "team-1",
          source_launch_id: body.capture_session_id,
          offering_digest: offeringRecord.configured_scene_offering_digest,
          state: "preparing",
        },
      );
      state.collections.get("taskEvaluationLaunches")?.set(
        body.capture_session_id,
        configuredOfferingRecord({ configurationRunId: "different-configuration-run" }),
      );
      const mismatch = await postSigned(socketPath, body);
      expect(mismatch.status).toBe(409);
      expect(mismatch.body.error).toBe("Configured scene configuration-run binding mismatch");
      expect(state.sendEmail).not.toHaveBeenCalled();
    } finally {
      await stopServer(server, socketPath);
    }
  });
});
