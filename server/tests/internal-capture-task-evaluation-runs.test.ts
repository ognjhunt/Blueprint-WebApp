// @vitest-environment node
import { createHmac, randomUUID } from "node:crypto";
import express from "express";
import { unlinkSync } from "node:fs";
import { createServer, request as httpRequest, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { canonicalArtifactDigest } from "../utils/taskCandidateContract";

const state = vi.hoisted(() => ({
  collections: new Map<string, Map<string, Record<string, any>>>(),
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => {
  type Reference = { collectionName: string; id: string };
  const reference = (collectionName: string, id: string): Reference => ({ collectionName, id });
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
      collection: (name: string) => ({ doc: (id: string) => reference(name, id) }),
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

vi.mock("../utils/pipelineSyncSecurity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/pipelineSyncSecurity")>();
  return {
    ...actual,
    createPipelineSyncRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  };
});

const sha = (character: string) => `sha256:${character.repeat(64)}`;

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
  delete process.env.PIPELINE_SYNC_TOKEN;
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
});
