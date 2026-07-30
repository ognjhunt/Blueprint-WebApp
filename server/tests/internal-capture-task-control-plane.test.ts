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
  collections: new Map<string, Map<string, Record<string, unknown>>>(),
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => {
  const reference = (collectionName: string, id: string) => ({
    get: async () => {
      const record = state.collections.get(collectionName)?.get(id);
      return {
        exists: Boolean(record),
        data: () => record && structuredClone(record),
      };
    },
    create: async (payload: Record<string, unknown>) => {
      const collection = state.collections.get(collectionName) || new Map();
      if (collection.has(id)) throw new Error("already exists");
      collection.set(id, structuredClone(payload));
      state.collections.set(collectionName, collection);
    },
    set: async (payload: Record<string, unknown>, options?: { merge?: boolean }) => {
      const collection = state.collections.get(collectionName) || new Map();
      const next = options?.merge
        ? { ...(collection.get(id) || {}), ...structuredClone(payload) }
        : structuredClone(payload);
      collection.set(id, next);
      state.collections.set(collectionName, collection);
    },
  });
  return {
    dbAdmin: {
      collection: (name: string) => ({ doc: (id: string) => reference(name, id) }),
      runTransaction: async <T>(
        callback: (transaction: {
          get: (ref: ReturnType<typeof reference>) => ReturnType<ReturnType<typeof reference>["get"]>;
          create: (ref: ReturnType<typeof reference>, payload: Record<string, unknown>) => void;
          set: (
            ref: ReturnType<typeof reference>,
            payload: Record<string, unknown>,
            options?: { merge?: boolean },
          ) => void;
        }) => Promise<T>,
      ) => callback({
        get: (ref) => ref.get(),
        create: (ref, payload) => {
          void ref.create(payload);
        },
        set: (ref, payload, options) => {
          void ref.set(payload, options);
        },
      }),
    },
  };
});

vi.mock("../utils/pipelineSyncSecurity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/pipelineSyncSecurity")>();
  return {
    ...actual,
    createPipelineSyncRateLimiter: () => (
      _request: unknown,
      _response: unknown,
      next: () => void,
    ) => next(),
  };
});

function discovery(discoveryId = "discovery-1") {
  const candidate: Record<string, any> = {
    description: "Move the blue tote into the marked box.",
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
    task_candidate_id: "task-candidate-1",
  };
  candidate.candidate_digest = canonicalArtifactDigest(candidate, "candidate_digest");
  const value: Record<string, any> = {
    schema_version: "task_candidate_discovery.v1",
    discovery_id: discoveryId,
    source_capture: {
      intake_id: "intake-1",
      capture_digest: `sha256:${"a".repeat(64)}`,
      capture_authority_profile: "camera_360_equirectangular",
    },
    capture_qa_report_digest: `sha256:${"b".repeat(64)}`,
    scene_analysis: {
      observed_site_facts: [{
        fact_id: "fact-tote",
        description: "A blue tote is directly visible on the table.",
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
  value.discovery_digest = canonicalArtifactDigest(value, "discovery_digest");
  return value;
}

function publication(value = discovery()) {
  return {
    schema_version: "task_candidate_discovery_publication.v1",
    capture_session_id: "capture-review-1",
    intake_id: "intake-1",
    discovery_digest: value.discovery_digest,
    pipeline_task_discovery: value,
    proof_boundary: {
      candidate_is_customer_intent: false,
      decision_evidence_request_compiled: false,
      task_success_established: false,
    },
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
  const { default: router } = await import("../routes/internal-capture-task-control-plane");
  const app = express();
  app.use(express.json());
  app.use("/internal", router);
  const server = createServer(app);
  const socketPath = join(tmpdir(), `blueprint-task-discovery-${randomUUID()}.sock`);
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
    // Node may remove the Unix socket during close.
  }
}

async function postSigned(
  socketPath: string,
  path: string,
  signed: ReturnType<typeof signedBody>,
) {
  return new Promise<{ status: number; json: () => Promise<unknown> }>((resolve, reject) => {
    const request = httpRequest({
      socketPath,
      path,
      method: "POST",
      headers: {
        ...signed.headers,
        "content-length": Buffer.byteLength(signed.rawBody),
      },
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        resolve({ status: response.statusCode || 0, json: async () => body });
      });
    });
    request.on("error", reject);
    request.end(signed.rawBody);
  });
}

afterEach(() => {
  state.collections.clear();
  delete process.env.PIPELINE_SYNC_TOKEN;
});

describe("internal Pipeline task discovery publication", () => {
  it("publishes an immutable digest-verified discovery and replays exactly", async () => {
    process.env.PIPELINE_SYNC_TOKEN = "pipeline-secret";
    state.collections.set("captureUploadSessions", new Map([
      ["capture-review-1", {
        session_id: "capture-review-1",
        request: { intake_id: "intake-1" },
        content_addressing: { status: "verified", sha256: `sha256:${"a".repeat(64)}` },
      }],
    ]));
    const { server, socketPath } = await startServer();
    try {
      const body = publication();
      const firstSigned = signedBody(body);
      const first = await postSigned(
        socketPath,
        "/internal/capture-task-discoveries",
        firstSigned,
      );
      expect(first.status).toBe(201);
      await expect(first.json()).resolves.toMatchObject({
        status: "published",
        already_exists: false,
        discovery_digest: body.discovery_digest,
      });
      expect(
        state.collections.get("captureUploadSessions")?.get("capture-review-1"),
      ).toMatchObject({
        pipeline_task_discovery_digest: body.discovery_digest,
        pipeline_task_discovery: { discovery_id: "discovery-1" },
      });
      expect(state.collections.get("captureTaskDiscoveries")?.size).toBe(1);

      const replaySigned = signedBody(body);
      const replay = await postSigned(
        socketPath,
        "/internal/capture-task-discoveries",
        replaySigned,
      );
      expect(replay.status).toBe(200);
      await expect(replay.json()).resolves.toMatchObject({ already_exists: true });
      expect(state.collections.get("captureTaskDiscoveries")?.size).toBe(1);
    } finally {
      await stopServer(server, socketPath);
    }
  });

  it("rejects a successor while a customer command is pending", async () => {
    process.env.PIPELINE_SYNC_TOKEN = "pipeline-secret";
    const current = discovery();
    state.collections.set("captureUploadSessions", new Map([
      ["capture-review-1", {
        session_id: "capture-review-1",
        request: { intake_id: "intake-1" },
        pipeline_task_discovery: current,
        latest_task_decision_command: {
          pipeline_approval_status: "pending_pipeline_validation",
        },
      }],
    ]));
    const successor = publication(discovery("discovery-2"));
    const signed = signedBody(successor);
    const { server, socketPath } = await startServer();
    try {
      const response = await postSigned(
        socketPath,
        "/internal/capture-task-discoveries",
        signed,
      );
      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toMatchObject({
        error: "A task decision is pending for the current discovery",
      });
      expect(state.collections.get("captureTaskDiscoveries")?.size || 0).toBe(0);
    } finally {
      await stopServer(server, socketPath);
    }
  });
});
