// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";

import { canonicalArtifactDigest } from "../utils/taskCandidateContract";

const state = vi.hoisted(() => ({ docs: new Map<string, Record<string, any>>() }));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" } } },
  dbAdmin: {
    collection: (name: string) => ({
      doc: (id: string) => ({ key: `${name}/${id}` }),
    }),
    runTransaction: async (callback: any) => callback({
      get: async (ref: { key: string }) => {
        const data = state.docs.get(ref.key);
        return { exists: Boolean(data), data: () => data };
      },
      set: (ref: { key: string }, patch: Record<string, unknown>) => {
        state.docs.set(ref.key, { ...state.docs.get(ref.key), ...patch });
      },
    }),
  },
}));

vi.mock("../utils/pipelineSyncSecurity", () => ({
  createPipelineSyncRateLimiter: () => (_req: any, _res: any, next: any) => next(),
  verifyPipelineSyncRequest: () => ({ ok: true }),
  validatePipelineArtifactUris: (payload: any) =>
    payload.artifacts.some((row: any) => !String(row.uri).startsWith("gs://blueprint-8c1ca.appspot.com/"))
      ? ["artifacts.uri"]
      : [],
}));

async function start() {
  const { default: router } = await import("../routes/internal-capture-reconstruction");
  const app = express();
  app.use(express.json());
  app.use("/api/internal/pipeline", router);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("bind failed");
  return { server, url: `http://127.0.0.1:${address.port}` };
}

async function stop(server: Server) {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

function status(captureDigest = `sha256:${"a".repeat(64)}`) {
  const value: Record<string, unknown> = {
    schema_version: "capture_reconstruction_status.v1",
    capture_id: "capture-1",
    capture_digest: captureDigest,
    state: "published",
    arm: "postshot-primary",
    artifacts: [{
      artifact_id: "postshot-primary:standard_3dgs_ply",
      digest: `sha256:${"b".repeat(64)}`,
      uri: "gs://blueprint-8c1ca.appspot.com/scenes-derived/capture-1/scene.ply",
    }],
    blockers: [],
    campaign_digest: `sha256:${"c".repeat(64)}`,
    completed_at: "2026-08-23T12:00:00.000Z",
    appearance_fidelity_qualified: false,
    metric_accuracy_qualified: false,
    collision_suitability_qualified: false,
    physical_task_success_proven: false,
  };
  value.status_digest = canonicalArtifactDigest(value, "status_digest");
  return value;
}

afterEach(() => {
  state.docs.clear();
  vi.resetModules();
});

describe("capture reconstruction terminal binding", () => {
  it("binds exact capture digest once and acknowledges replay", async () => {
    state.docs.set("creatorCaptures/capture-1", {
      immutable_upload_identity: {
        raw_bundle_digest: `sha256:${"a".repeat(64)}`,
        verification_status: "pending_pipeline_storage_readback",
      },
    });
    const { server, url } = await start();
    try {
      const body = status();
      const first = await fetch(`${url}/api/internal/pipeline/creator-captures/capture-1/reconstruction`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      expect(first.status).toBe(201);
      await expect(first.json()).resolves.toMatchObject({ written: true, already_synced: false });
      const replay = await fetch(`${url}/api/internal/pipeline/creator-captures/capture-1/reconstruction`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      expect(replay.status).toBe(200);
      await expect(replay.json()).resolves.toMatchObject({ written: false, already_synced: true });
      expect(state.docs.get("creatorCaptures/capture-1")?.immutable_upload_identity)
        .toMatchObject({ verification_status: "pipeline_storage_bytes_verified" });
    } finally {
      await stop(server);
    }
  });

  it("refuses digest mutation, off-bucket artifacts, and terminal replacement", async () => {
    state.docs.set("creatorCaptures/capture-1", {
      immutable_upload_identity: { raw_bundle_digest: `sha256:${"a".repeat(64)}` },
    });
    const { server, url } = await start();
    const post = (body: Record<string, unknown>) => fetch(
      `${url}/api/internal/pipeline/creator-captures/capture-1/reconstruction`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    );
    try {
      expect((await post(status(`sha256:${"d".repeat(64)}`))).status).toBe(409);
      const offBucket = status();
      (offBucket.artifacts as any[])[0].uri = "https://attacker.invalid/scene.ply";
      offBucket.status_digest = canonicalArtifactDigest(offBucket, "status_digest");
      expect((await post(offBucket)).status).toBe(400);
      const accepted = status();
      expect((await post(accepted)).status).toBe(201);
      const replacement = { ...status(), campaign_digest: `sha256:${"e".repeat(64)}` };
      replacement.status_digest = canonicalArtifactDigest(replacement, "status_digest");
      expect((await post(replacement)).status).toBe(409);
    } finally {
      await stop(server);
    }
  });
});
