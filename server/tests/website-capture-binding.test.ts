// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import express from "express";
import { createServer } from "node:http";
import { sharedFakeFirestore, sharedFakeFirestoreState } from "./helpers/fake-firestore";
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({ dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore,
  default: { firestore: { FieldValue: { serverTimestamp: () => "synthetic-time" } } } }));
vi.mock("../utils/siteCaptureBundleStorage", () => ({ resolveBundleStorage: () => storage }));
vi.mock("../utils/siteTaskBrief", async () => ({ getBrief: async () => (await import("./fixtures/website-continuation-vector.json")).default.brief,
  TASK_BRIEFS_COLLECTION: "siteTaskBriefs" }));
vi.mock("../utils/taskLifecycleNotifications", () => ({ enqueueTaskLifecycleNotification: vi.fn(), reconstructionIsViewable: vi.fn() }));
vi.mock("../utils/pipelineSyncSecurity", () => ({
  createPipelineSyncRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  verifyPipelineSyncRequest: (req: any) => req.headers["x-synthetic-signed"] === "1" ? { ok: true } : { ok: false, status: 401, code: "unauthorized" },
}));
import { resolveWebsiteCaptureBinding, assertWebsiteCaptureBindingInTransaction } from "../utils/websiteCaptureBinding";
import { supplementIdentity } from "../utils/captureSupplement";
import { bundleDigest } from "../utils/siteCaptureBundle";
import { projectWebsiteTaskContext } from "../utils/websiteTaskContext";
import continuationVector from "./fixtures/website-continuation-vector.json";
import type { BundleStorage, BundleObjectInfo } from "../utils/siteCaptureBundleStorage";

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const texts = new Map<string, string>(), infos = new Map<string, BundleObjectInfo>();
const storage = { bucketName: "synthetic", info: async (name: string) => infos.get(name) ?? null,
  readText: async (name: string) => texts.get(name) ?? null } as BundleStorage;
function put(path: string, text: string) {
  texts.set(path, text); infos.set(path, { name: path, generation: "123", size: Buffer.byteLength(text), crc32c: "AAAAAA==", md5Hash: null });
}
function finalized(captureId: string) {
  const prefix = `scenes/site-req1/captures/${captureId}`, raw = `${prefix}/raw`;
  const manifest = JSON.stringify({ site_submission_id: "req1", scene_id: "site-req1", capture_id: captureId });
  const marker = JSON.stringify({ capture_id: captureId, scene_id: "site-req1", status: "complete" });
  const artifacts = { "manifest.json": sha(manifest), "capture_upload_complete.json": sha(marker), "walkthrough.mov": sha("synthetic") };
  const bundle = bundleDigest(artifacts);
  const identity = { raw_bundle_digest: `sha256:${bundle}`, raw_manifest_uri: `gs://synthetic/${raw}/manifest.json`,
    upload_completion_digest: `sha256:${sha(marker)}`, verification_status: "pending_pipeline_storage_readback" };
  put(`${raw}/manifest.json`, manifest); put(`${raw}/capture_upload_complete.json`, marker); put(`${raw}/walkthrough.mov`, "synthetic");
  put(`${prefix}/upload/bundle_completion.json`, JSON.stringify({ request_id: "req1", scene_id: "site-req1", capture_id: captureId,
    identity, completion_marker_json: marker, server_files: { "manifest.json": manifest },
    hashes_json: JSON.stringify({ artifacts, bundle_sha256: bundle }), device_objects: {
      "walkthrough.mov": { generation: "123", size_bytes: 9, crc32c: "AAAAAA==" } } }));
  sharedFakeFirestoreState.docs.set(`captureUploadSessions/${captureId}`, {
    site_capture_bundle: { request_id: "req1", scene_id: "site-req1", capture_id: captureId }, immutable_upload_identity: identity });
  return identity;
}
function child(parent = "walkthrough-req1") {
  const identity = finalized(parent);
  const coverage = { status: "needs_more", capture_id: parent, covers_scene: false, missing_coverage: ["destination"] };
  const value = supplementIdentity({ requestId: "req1", sceneId: "site-req1", captureId: parent, exp: 1 }, identity, coverage);
  sharedFakeFirestoreState.docs.set(`captureSupplements/${value.captureId}`, { ...value, requestId: "req1", sceneId: "site-req1", parent_coverage: coverage });
  finalized(value.captureId);
  return value.captureId;
}
beforeEach(() => { sharedFakeFirestoreState.docs.clear(); texts.clear(); infos.clear(); });

it("retains the original browser/native read-before-upload contract", async () => {
  expect(await resolveWebsiteCaptureBinding("req1", "site-req1", "walkthrough-req1", storage)).toBeUndefined();
  await expect(resolveWebsiteCaptureBinding("req1", "site-other", "walkthrough-req1", storage)).rejects.toThrow("mismatch");
});
it("binds finalized descendants to original sources with independent coordinate frames and stable replay", async () => {
  const first = child(), second = child(first);
  const binding = await resolveWebsiteCaptureBinding("req1", "site-req1", second, storage);
  expect(binding?.lineage).toHaveLength(2);
  expect(binding?.coordinate_frames_independent).toBe(true);
  expect(await resolveWebsiteCaptureBinding("req1", "site-req1", second, storage)).toEqual(binding);
  await sharedFakeFirestore.runTransaction(tx => assertWebsiteCaptureBindingInTransaction(tx, "req1", binding));
});
it("exports an authoritative supplementary context consumed by the shared Pipeline vector", async () => {
  const captureId = child();
  const captureBinding = await resolveWebsiteCaptureBinding("req1", "site-req1", captureId, storage);
  expect(projectWebsiteTaskContext(continuationVector.brief as any, continuationVector.rights as any,
    { captureId, captureBinding })).toEqual(continuationVector.context);
});
it("serves verified supplementary context through the controller and projects current late withdrawal", async () => {
  const captureId = child();
  sharedFakeFirestoreState.docs.set("inboundRequests/req1", { request: { consent_attestation: {
    granted: true, statement_version: "2026-09-18.v1", recorded_at_iso: "2026-10-06T00:00:00Z" } } });
  const { default: router } = await import("../routes/internal-capture-worlds");
  const app = express(); app.use(express.json()); app.use(router);
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("synthetic bind failed");
  const post = (signed = true, id = captureId) => fetch(`http://127.0.0.1:${address.port}/creator-captures/${id}/task-context`, {
    method: "POST", headers: { "content-type": "application/json", ...(signed ? { "x-synthetic-signed": "1" } : {}) },
    body: JSON.stringify({ request_id: "req1", scene_id: "site-req1" }),
  });
  try {
    const accepted = await post();
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toEqual(continuationVector.context);
    expect((await post(false)).status).toBe(401);
    expect((await post(true, "supplement-unissued")).status).toBe(409);
    const source = sharedFakeFirestoreState.docs.get("inboundRequests/req1") as any;
    source.consent_revoked = true;
    const revoked = await (await post()).json();
    expect(revoked.capture_rights).toMatchObject({ consent_status: "revoked", derived_scene_generation_allowed: false });
    expect(revoked.context_digest).not.toBe(continuationVector.context.context_digest);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
it.each(["unknown", "cross_site", "changed_parent", "unfinished", "source_generation", "marker_generation", "changed_lineage"])("refuses %s rather than granting authority by ID pattern", async fault => {
  const captureId = child();
  const ref = `captureSupplements/${captureId}`, record = sharedFakeFirestoreState.docs.get(ref) as any;
  if (fault === "unknown") sharedFakeFirestoreState.docs.delete(ref);
  if (fault === "cross_site") record.requestId = "other-tenant";
  if (fault === "changed_parent") record.supplement.parent_bundle_digest = `sha256:${"0".repeat(64)}`;
  if (fault === "unfinished") texts.delete(`scenes/site-req1/captures/${captureId}/raw/capture_upload_complete.json`);
  if (fault === "source_generation") infos.get(`scenes/site-req1/captures/${captureId}/raw/walkthrough.mov`)!.generation = "999";
  if (fault === "marker_generation") {
    const info = storage.info;
    let calls = 0;
    storage.info = async path => {
      const row = await info(path);
      if (path.endsWith("capture_upload_complete.json") && ++calls > 1 && row) return { ...row, generation: "999" };
      return row;
    };
    try { await expect(resolveWebsiteCaptureBinding("req1", "site-req1", captureId, storage)).rejects.toThrow(); }
    finally { storage.info = info; }
    return;
  }
  if (fault === "changed_lineage") record.parent_coverage.status = "changed";
  await expect(resolveWebsiteCaptureBinding("req1", "site-req1", captureId, storage)).rejects.toThrow();
});
