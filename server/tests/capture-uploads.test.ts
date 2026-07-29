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
  cancel: vi.fn(),
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
    cancelBackblazeResumableCapture: state.cancel,
  };
});

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
  state.cancel.mockReset();
  state.beforeTransaction = null;
  delete process.env.CAPTURE_UPLOAD_PART_SIZE_BYTES;
});

describe("resumable capture uploads", () => {
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
      expect(JSON.stringify(receipt)).not.toContain("approved_task_definition");
      expect(JSON.stringify(receipt)).not.toContain("decision_evidence_request");

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
