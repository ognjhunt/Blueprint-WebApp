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

function qaPublication(status: "accepted" | "recapture_required" = "accepted") {
  const stateValue = status === "accepted" ? "capture_accepted" : "rejected_or_recapture_required";
  const recapturePlan = status === "accepted" ? [] : [{
    code: "low_visual_overlap",
    instruction: "Slow down and add overlapping passes around the work surface.",
    reason: "Visual overlap was below the supported threshold.",
  }];
  const report: Record<string, any> = {
    schema_version: "capture_qa_report.v1",
    intake_id: "intake-qa-1",
    envelope_digest: `sha256:${"a".repeat(64)}`,
    capture_authority_profile: "camera_360_equirectangular",
    status,
    state: stateValue,
    checks: [{
      check_id: "visual_overlap",
      status: status === "accepted" ? "pass" : "fail",
      evidence_source: "fixture",
      measurement: status === "accepted" ? 0.9 : 0.3,
      threshold: { minimum: 0.6 },
      claim_impact: ["reconstruction"],
      recapture_code: status === "accepted" ? null : "low_visual_overlap",
      recapture_instruction: status === "accepted" ? null : recapturePlan[0].instruction,
    }],
    recapture_plan: recapturePlan,
    missing_evidence: ["scale_anchor_verified"],
    required_analysis: [],
    next_cheapest_experiment: status === "accepted"
      ? { kind: "owner_measurement", instruction: "Provide a scale measurement if metric claims are needed." }
      : { kind: "targeted_recapture", instruction: recapturePlan[0].instruction },
    quality_observations_digest: `sha256:${"b".repeat(64)}`,
    quality_analysis_errors: [],
    claim_ceiling: {
      capture_admitted: status === "accepted",
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
    capture_session_id: "capture-qa-session-1",
    intake_id: report.intake_id,
    capture_authority_profile: report.capture_authority_profile,
    envelope_digest: report.envelope_digest,
    qa_report_digest: report.qa_report_digest,
    status,
    state: stateValue,
    report,
    proof_boundary: {
      qa_is_task_success: false,
      qa_is_physical_success: false,
      deployment_or_safety_approved: false,
      comparative_policy_ranking_verdict: "thesis_not_supported",
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
  const { default: router } = await import("../routes/internal-capture-qa");
  const app = express();
  app.use(express.json());
  app.use("/internal", router);
  const server = createServer(app);
  const socketPath = join(tmpdir(), `blueprint-capture-qa-${randomUUID()}.sock`);
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
      path: "/internal/capture-qa",
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

describe("internal Pipeline Capture QA publication", () => {
  it("publishes an immutable bound report, replays exactly, and rejects replacement", async () => {
    process.env.PIPELINE_SYNC_TOKEN = "pipeline-secret";
    state.collections.set("captureUploadSessions", new Map([[
      "capture-qa-session-1",
      {
        session_id: "capture-qa-session-1",
        request: {
          intake_id: "intake-qa-1",
          capture_authority_profile: "camera_360_equirectangular",
        },
      },
    ]]));
    const { server, socketPath } = await startServer();
    try {
      const publication = qaPublication();
      const created = await postSigned(socketPath, publication);
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({
        already_exists: false,
        status: "accepted",
        qa_report_digest: publication.qa_report_digest,
      });
      const replay = await postSigned(socketPath, publication);
      expect(replay.status).toBe(200);
      expect(replay.body.already_exists).toBe(true);

      const replacement = await postSigned(socketPath, qaPublication("recapture_required"));
      expect(replacement.status).toBe(409);
      expect(replacement.body.error).toContain("cannot be replaced");

      const tampered = structuredClone(publication);
      tampered.report.missing_evidence = [];
      const rejected = await postSigned(socketPath, tampered);
      expect(rejected.status).toBe(400);
      expect(rejected.body.blockers).toContain("capture_qa_report_digest_mismatch");
    } finally {
      await stopServer(server, socketPath);
    }
  });
});
