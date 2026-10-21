// @vitest-environment node
import { createHmac, randomUUID } from "node:crypto";
import express from "express";
import { readFileSync, unlinkSync } from "node:fs";
import { createServer, request as httpRequest, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { canonicalArtifactDigest, stableJson } from "../utils/taskCandidateContract";
import { verifyProducerArtifact } from "../utils/producerCanonicalArtifact";

const state = vi.hoisted(() => ({
  collections: new Map<string, Map<string, Record<string, unknown>>>(),
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => {
  const reference = (collectionName: string, id: string) => ({
    get: async () => {
      const record = state.collections.get(collectionName)?.get(id);
      return { exists: Boolean(record), data: () => record && structuredClone(record) };
    },
    create: async (payload: Record<string, unknown>) => {
      const collection = state.collections.get(collectionName) || new Map();
      if (collection.has(id)) throw new Error("already exists");
      collection.set(id, structuredClone(payload));
      state.collections.set(collectionName, collection);
    },
    set: async (payload: Record<string, unknown>, options?: { merge?: boolean }) => {
      const collection = state.collections.get(collectionName) || new Map();
      collection.set(id, options?.merge
        ? { ...(collection.get(id) || {}), ...structuredClone(payload) }
        : structuredClone(payload));
      state.collections.set(collectionName, collection);
    },
  });
  return {
    dbAdmin: {
      collection: (name: string) => ({ doc: (id: string) => reference(name, id) }),
      runTransaction: async <T>(callback: (transaction: {
        get: (ref: ReturnType<typeof reference>) => ReturnType<ReturnType<typeof reference>["get"]>;
        create: (ref: ReturnType<typeof reference>, payload: Record<string, unknown>) => void;
        set: (ref: ReturnType<typeof reference>, payload: Record<string, unknown>, options?: { merge?: boolean }) => void;
      }) => Promise<T>) => callback({
        get: (ref) => ref.get(),
        create: (ref, payload) => { void ref.create(payload); },
        set: (ref, payload, options) => { void ref.set(payload, options); },
      }),
    },
  };
});

vi.mock("../utils/pipelineSyncSecurity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/pipelineSyncSecurity")>();
  return {
    ...actual,
    createPipelineSyncRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  };
});

function card(schemaVersion: string, id: string) {
  const value: Record<string, unknown> = { schema_version: schemaVersion, id };
  value.card_digest = canonicalArtifactDigest(value, "card_digest");
  return value;
}

function testbed(version = "v1", predecessor: string | null = null) {
  const siteCard = card("site_card.v1", "site-1");
  const taskCard = card("task_card.v1", "task-1");
  const scenarioCard = card("scenario_card.v1", "scenario-1");
  const evalCard = card("eval_card.v1", "eval-1");
  const ref = (name: string, digest: unknown) => ({
    uri: `testbed://testbed-1/${version}/${name}.json`,
    digest,
  });
  const value: Record<string, any> = {
    schema_version: "maintained_site_task_testbed.v1",
    testbed_id: "testbed-1",
    version,
    predecessor_testbed_digest: predecessor,
    supersedes: predecessor ? [predecessor] : [],
    source_capture_bundles: [{
      bundle_id: "intake-1",
      version: "camera_360_equirectangular",
      digest: `sha256:${"a".repeat(64)}`,
    }],
    artifact_references: {
      site_card: ref("site_card_1", siteCard.card_digest),
      task_cards: [ref("task_card_1", taskCard.card_digest)],
      scenario_cards: [ref("scenario_card_1", scenarioCard.card_digest)],
      eval_cards: [ref("eval_card_1", evalCard.card_digest)],
      evaluator: ref("evaluator", evalCard.card_digest),
      reset: ref("reset", taskCard.card_digest),
    },
    compiled_cards: {
      site_card: siteCard,
      task_cards: [taskCard],
      scenario_cards: [scenarioCard],
      eval_cards: [evalCard],
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
    evidence_inventory: [],
    validation_envelope: {
      capture_accepted: true,
      semantic_evidence: {
        semantic_object_inventory_is_collision_truth: false,
        collision_consistency_is_physics_qualification: false,
        physical_task_success_established: false,
      },
    },
    semantic_object_inventory: [{
      track_id: "track-tote-1",
      label: "tote",
      semantic_status: "qualified_metric_obb_candidate",
      center_world_m: [0.5, 0.25, 0.4],
      dimensions_m: [0.4, 0.3, 0.2],
      yaw_rad: 0,
      corners_world_m: [
        [0.3, 0.1, 0.3], [0.7, 0.1, 0.3], [0.7, 0.4, 0.3], [0.3, 0.4, 0.3],
        [0.3, 0.1, 0.5], [0.7, 0.1, 0.5], [0.7, 0.4, 0.5], [0.3, 0.4, 0.5],
      ],
      coordinate_frame: "analysis_splat_z_up_meters",
      semantic_oriented_box_result_digest: `sha256:${"d".repeat(64)}`,
      collision_consistency_status: "independent_collision_consistency_candidate",
      collision_validation_result_digest: `sha256:${"e".repeat(64)}`,
      collision_consistency_metrics: { occupied_overlap_fraction: 0.92 },
      next_experiment: "independently_qualify_collision_geometry",
      claim_ceiling: "metric_obb_candidate_from_observed_surface_support",
      collision_ready: false,
      physics_ready: false,
    }],
    known_unsupported_conditions: [
      "physical_task_success",
      "semantic_object_inventory_is_not_collision_truth",
    ],
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

function decisionRequest(value: ReturnType<typeof testbed>) {
  const request: Record<string, any> = {
    schema_version: "decision_evidence_request.v1",
    request_id: `request-${value.version}`,
    decision_id: `decision-${value.version}`,
    testbed_id: value.testbed_id,
    testbed_version: value.version,
    testbed_digest: value.testbed_digest,
    decision_question: "Can the exact robot reach the approved target?",
    candidates: [{ robot_id: "robot-1" }],
    claims: [{
      claim_id: "reach",
      claim_type: "reachability",
      subject: "robot-1:item-1:target-1",
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
    idempotency_key: `request-${value.version}`,
  };
  request.request_digest = canonicalArtifactDigest(request, "request_digest");
  return request;
}

function publication(value = testbed()) {
  return {
    schema_version: "site_task_testbed_publication.v1",
    capture_session_id: "capture-testbed-1",
    intake_id: "intake-1",
    approved_task_digest: value.approved_task_definition.digest,
    testbed_id: value.testbed_id,
    version: value.version,
    testbed_digest: value.testbed_digest,
    artifact_reference: {
      uri: `testbed://${value.testbed_id}/${value.version}/testbed.json`,
      digest: value.testbed_digest,
    },
    testbed: value,
    decision_evidence_request: decisionRequest(value),
    status: "testbed_ready",
    proof_boundary: value.proof_boundary,
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
  const { default: router } = await import("../routes/internal-capture-testbeds");
  const app = express();
  app.use(express.json());
  app.use("/internal", router);
  const server = createServer(app);
  const socketPath = join(tmpdir(), `blueprint-testbed-${randomUUID()}.sock`);
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
      path: "/internal/capture-testbeds",
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
  delete process.env.PIPELINE_SYNC_TOKEN;
});

describe("internal Pipeline maintained testbed publication", () => {
  it("accepts real Python compiler bytes without changing scientific digests", async () => {
    // Generated by the actual Pipeline compiler and v2 sync builder. Includes
    // integral Python floats, Unicode values and differently ordered keys.
    const body = JSON.parse(readFileSync(new URL("./fixtures/pipeline-testbed-publication-v2.json", import.meta.url), "utf8"));
    expect(canonicalArtifactDigest(body.testbed, "testbed_digest")).not.toBe(body.testbed_digest);
    expect(verifyProducerArtifact(body.testbed, "testbed_digest", body.testbed_canonical_json)).toBe(true);
    expect(verifyProducerArtifact(body.testbed, "testbed_digest", body.testbed_canonical_json + " ")).toBe(false);
    process.env.PIPELINE_SYNC_TOKEN = "pipeline-secret";
    state.collections.set("captureUploadSessions", new Map([[body.capture_session_id, {
      session_id: body.capture_session_id, request: { intake_id: body.intake_id },
      approved_task_definition: { approved_task_digest: body.approved_task_digest },
    }]]));
    const { server, socketPath } = await startServer();
    try {
      const first = await postSigned(socketPath, body);
      expect(first.status).toBe(201);
      expect(first.body.testbed_digest).toBe(body.testbed_digest);
      const retained = state.collections.get("captureUploadSessions")?.get(body.capture_session_id) as Record<string, any>;
      expect(retained.pipeline_site_task_testbed).toMatchObject({
        testbed_canonical_json: body.testbed_canonical_json,
        decision_request_canonical_json: body.decision_request_canonical_json,
        compiled_card_canonical_json: body.compiled_card_canonical_json,
      });
      expect((await postSigned(socketPath, body)).status).toBe(200);
      expect(state.collections.get("captureSiteTaskTestbeds")?.size).toBe(1);
      const wrongBytes = structuredClone(body);
      wrongBytes.testbed_canonical_json += " ";
      expect((await postSigned(socketPath, wrongBytes)).status).toBe(400);
      const wrongCard = structuredClone(body);
      delete wrongCard.compiled_card_canonical_json[body.testbed.compiled_cards.site_card.card_digest];
      const rejectedCard = await postSigned(socketPath, wrongCard);
      expect(rejectedCard.status).toBe(400);
      expect(rejectedCard.body.blockers).toContain("maintained_testbed_card_digest_mismatch");
      const wrongRequest = structuredClone(body);
      wrongRequest.decision_evidence_request.decision_question = "Different decision";
      expect((await postSigned(socketPath, wrongRequest)).status).toBe(409);
    } finally { await stopServer(server, socketPath); }
  });

  it("requires the approved real source binding for a job-scoped native publication", async () => {
    const body = JSON.parse(readFileSync(new URL("./fixtures/pipeline-testbed-publication-v2.json", import.meta.url), "utf8"));
    body.job_id = "job-source-1";
    body.brief_digest = `sha256:${"d".repeat(64)}`;
    const binding = {
      schema_version: "job_evidence_source_binding.v1", job_id: body.job_id,
      brief_digest: body.brief_digest, task_inventory_digest: `sha256:${"e".repeat(64)}`,
      capture_session_id: body.capture_session_id, intake_id: body.intake_id,
      source_capture_digest: body.testbed.source_capture_bundles[0].digest,
      command_request_id: "task-command-1", approved_task_digest: body.approved_task_digest,
    };
    process.env.PIPELINE_SYNC_TOKEN = "pipeline-secret";
    const session: Record<string, any> = {
      session_id: body.capture_session_id, request: { intake_id: body.intake_id },
      approved_task_definition: { approved_task_digest: body.approved_task_digest },
      latest_task_decision_command: { command_request_id: "task-command-1", pipeline_approval_status: "approved" },
    };
    state.collections.set("captureUploadSessions", new Map([[body.capture_session_id, session]]));
    const { server, socketPath } = await startServer();
    try {
      expect((await postSigned(socketPath, body)).status).toBe(409);
      expect(state.collections.get("captureSiteTaskTestbeds")?.size ?? 0).toBe(0);
      session.job_evidence_source_binding = { ...binding, source_capture_digest: `sha256:${"f".repeat(64)}` };
      expect((await postSigned(socketPath, body)).status).toBe(409);
      session.job_evidence_source_binding = binding;
      expect((await postSigned(socketPath, body)).status).toBe(201);
      const retained = state.collections.get("captureUploadSessions")?.get(body.capture_session_id) as Record<string, any>;
      expect(retained.pipeline_site_task_testbed).toMatchObject({ job_id: body.job_id, brief_digest: body.brief_digest });
    } finally { await stopServer(server, socketPath); }
  });

  it("enriches a legacy projection while preserving its immutable record", async () => {
    process.env.PIPELINE_SYNC_TOKEN = "pipeline-secret";
    state.collections.set("captureUploadSessions", new Map([["capture-testbed-1", {
      session_id: "capture-testbed-1", request: { intake_id: "intake-1" },
      approved_task_definition: { approved_task_digest: `sha256:${"b".repeat(64)}` },
    }]]));
    const legacy = publication();
    const bodyWithout = (value: Record<string, unknown>, key: string) => stableJson(
      Object.fromEntries(Object.entries(value).filter(([field]) => field !== key)),
    );
    const cards = legacy.testbed.compiled_cards;
    const allCards = [cards.site_card, ...cards.task_cards, ...cards.scenario_cards, ...cards.eval_cards];
    const upgraded = { ...legacy, schema_version: "site_task_testbed_publication.v2",
      testbed_canonical_json: bodyWithout(legacy.testbed, "testbed_digest"),
      decision_request_canonical_json: bodyWithout(legacy.decision_evidence_request, "request_digest"),
      compiled_card_canonical_json: Object.fromEntries(allCards.map(card => [card.card_digest, bodyWithout(card, "card_digest")])),
    };
    const { server, socketPath } = await startServer();
    try {
      expect((await postSigned(socketPath, legacy)).status).toBe(201);
      const historical = structuredClone([...state.collections.get("captureSiteTaskTestbeds")!.values()][0]);
      expect((await postSigned(socketPath, upgraded)).status).toBe(200);
      expect([...state.collections.get("captureSiteTaskTestbeds")!.values()][0]).toEqual(historical);
      const current = () => state.collections.get("captureUploadSessions")?.get("capture-testbed-1") as Record<string, any>;
      expect(current().pipeline_site_task_testbed.testbed_canonical_json).toBe(upgraded.testbed_canonical_json);
      // Replaying an old transport cannot erase retained producer bytes.
      expect((await postSigned(socketPath, legacy)).status).toBe(200);
      expect(current().pipeline_site_task_testbed.testbed_canonical_json).toBe(upgraded.testbed_canonical_json);
    } finally { await stopServer(server, socketPath); }
  });

  it("publishes an immutable digest-bound testbed and replays exactly", async () => {
    process.env.PIPELINE_SYNC_TOKEN = "pipeline-secret";
    state.collections.set("captureUploadSessions", new Map([["capture-testbed-1", {
      session_id: "capture-testbed-1",
      request: { intake_id: "intake-1" },
      approved_task_definition: { approved_task_digest: `sha256:${"b".repeat(64)}` },
    }]]));
    const body = publication();
    const { server, socketPath } = await startServer();
    try {
      const first = await postSigned(socketPath, body);
      expect(first.status).toBe(201);
      expect(first.body).toMatchObject({
        status: "testbed_ready",
        already_exists: false,
        testbed_digest: body.testbed_digest,
        request_digest: body.decision_evidence_request.request_digest,
      });
      expect(state.collections.get("captureUploadSessions")?.get("capture-testbed-1"))
        .toMatchObject({
          pipeline_testbed_state: "testbed_ready",
          pipeline_site_task_testbed: {
            testbed: {
              semantic_object_inventory: [{
                track_id: "track-tote-1",
                collision_ready: false,
                physics_ready: false,
              }],
              proof_boundary: {
                comparative_policy_ranking_verdict: "thesis_not_supported",
              },
            },
          },
        });
      expect(state.collections.get("captureSiteTaskTestbeds")?.size).toBe(1);

      const replay = await postSigned(socketPath, body);
      expect(replay.status).toBe(200);
      expect(replay.body).toMatchObject({ already_exists: true });
      expect(state.collections.get("captureSiteTaskTestbeds")?.size).toBe(1);
    } finally {
      await stopServer(server, socketPath);
    }
  });

  it("rejects tampering and a successor that skips the current digest", async () => {
    process.env.PIPELINE_SYNC_TOKEN = "pipeline-secret";
    const current = testbed();
    state.collections.set("captureUploadSessions", new Map([["capture-testbed-1", {
      session_id: "capture-testbed-1",
      request: { intake_id: "intake-1" },
      approved_task_definition: { approved_task_digest: `sha256:${"b".repeat(64)}` },
      pipeline_site_task_testbed: {
        testbed_id: current.testbed_id,
        version: current.version,
        testbed_digest: current.testbed_digest,
      },
    }]]));
    const tampered = publication();
    tampered.testbed.known_unsupported_conditions = [];
    const skipped = publication(testbed("v2", `sha256:${"f".repeat(64)}`));
    const { server, socketPath } = await startServer();
    try {
      const tamperResponse = await postSigned(socketPath, tampered);
      expect(tamperResponse.status).toBe(400);
      expect(tamperResponse.body.blockers).toContain("maintained_testbed_digest_mismatch");
      const secretBearing = publication();
      secretBearing.testbed.provider_receipt = { access_token: "must-not-store" };
      secretBearing.testbed.testbed_digest = canonicalArtifactDigest(
        secretBearing.testbed,
        "testbed_digest",
      );
      secretBearing.testbed_digest = secretBearing.testbed.testbed_digest;
      secretBearing.artifact_reference.digest = secretBearing.testbed.testbed_digest;
      const secretResponse = await postSigned(socketPath, secretBearing);
      expect(secretResponse.status).toBe(400);
      expect(secretResponse.body.blockers).toContain("maintained_testbed_secret_value_forbidden");

      const physicsUpgrade = publication();
      physicsUpgrade.testbed.semantic_object_inventory[0].physics_ready = true;
      physicsUpgrade.testbed.testbed_digest = canonicalArtifactDigest(
        physicsUpgrade.testbed,
        "testbed_digest",
      );
      physicsUpgrade.testbed_digest = physicsUpgrade.testbed.testbed_digest;
      physicsUpgrade.artifact_reference.digest = physicsUpgrade.testbed.testbed_digest;
      const physicsUpgradeResponse = await postSigned(socketPath, physicsUpgrade);
      expect(physicsUpgradeResponse.status).toBe(400);
      expect(physicsUpgradeResponse.body.issues).toContainEqual(expect.objectContaining({
        path: "testbed.semantic_object_inventory.0.physics_ready",
      }));

      const requestTamper = publication();
      requestTamper.decision_evidence_request.decision_question = "Tampered question";
      const requestTamperResponse = await postSigned(socketPath, requestTamper);
      expect(requestTamperResponse.status).toBe(409);
      expect(requestTamperResponse.body.error).toBe("Decision/Evidence Request binding mismatch");

      const credentialUri = publication();
      credentialUri.testbed.artifact_references.evaluator.uri =
        "https://user:password@example.test/evaluator.json";
      credentialUri.testbed.testbed_digest = canonicalArtifactDigest(
        credentialUri.testbed,
        "testbed_digest",
      );
      credentialUri.testbed_digest = credentialUri.testbed.testbed_digest;
      credentialUri.artifact_reference.digest = credentialUri.testbed.testbed_digest;
      const credentialResponse = await postSigned(socketPath, credentialUri);
      expect(credentialResponse.status).toBe(400);
      const predecessorResponse = await postSigned(socketPath, skipped);
      expect(predecessorResponse.status).toBe(409);
      expect(predecessorResponse.body.error).toBe("Testbed predecessor does not match the current version");
    } finally {
      await stopServer(server, socketPath);
    }
  });
});
