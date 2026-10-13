// @vitest-environment node
/**
 * WebApp-owned storage deletion after withdrawal, against a fake bucket.
 *
 * Pins: only owned prefixes are touched; every generation and multipart part
 * goes; a durable receipt records what was listed, deleted and failed; failed
 * deletes retry with backoff; outstanding upload targets are waited out; a
 * missing Pipeline acknowledgement delays confirmation but not deletion; and
 * the forwarder cannot regress deletion progress.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => ({
  dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore, storageAdmin: null,
}));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
const transport = vi.hoisted(() => ({ result: {} as any }));
vi.mock("../utils/captureLifecycleForwarding", () => ({ signedCaptureLifecycleRequest: async () => transport.result }));

import { canonicalArtifactDigest as digest } from "../utils/taskCandidateContract";
import { forwardWebsiteCaptureWithdrawals, projectWebsiteCaptureWithdrawal, websiteWithdrawalCommand } from "../utils/websiteCaptureWithdrawal";
import { DELETION_RECEIPTS_COLLECTION, NATIVE_RESUMABLE_SESSION_TTL_MS, ownedPrefixes,
  resetWebsiteCaptureDeletionCursorsForTests, runWebsiteCaptureDeletions, startWebsiteCaptureDeletionWorker } from "../utils/websiteCaptureDeletion";

type Obj = { name: string; generation: number; size: number };
class FakeBucket {
  objects: Obj[] = [];
  failNames = new Set<string>();
  deleteCalls: Array<{ name: string; generation?: number }> = [];
  add(name: string, generation = 1, size = 10) { this.objects.push({ name, generation, size }); }
  names() { return this.objects.map(object => `${object.name}#${object.generation}`).sort(); }
  async getFiles(options: Record<string, any>) {
    const all = this.objects.filter(object => object.name.startsWith(options.prefix))
      .filter((object, _i, list) => options.versions || object.generation === Math.max(...list.filter(o => o.name === object.name).map(o => o.generation)));
    const start = Number(options.pageToken || 0), size = Number(options.maxResults || all.length || 1);
    const page = all.slice(start, start + size);
    const next = start + size < all.length ? { ...options, pageToken: String(start + size) } : null;
    return [page.map(object => ({ name: object.name, metadata: { generation: String(object.generation), size: String(object.size) } })), next] as [any[], any];
  }
  file(name: string, options?: { generation?: number }) {
    return { delete: async () => {
      this.deleteCalls.push({ name, generation: options?.generation });
      if (this.failNames.has(name)) throw Object.assign(new Error("denied"), { code: 403 });
      this.objects = this.objects.filter(object => !(object.name === name
        && (options?.generation === undefined || object.generation === options.generation)));
    } };
  }
}

const REQUESTED_AT = Date.parse("2026-10-06T00:00:00Z");
const HOUR = 60 * 60 * 1000;
let bucket: FakeBucket;
let clock: number;
const deps = () => ({ bucket, bucketName: "fake-bucket", now: () => clock, ackTimeoutMs: 2 * HOUR });
const record = () => state.docs.get("inboundRequests/req1") as any;
const receipts = () => [...state.docs.entries()].filter(([key]) => key.startsWith(`${DELETION_RECEIPTS_COLLECTION}/`)).map(([, value]) => value as any);

function seedWithdrawal(extra: Record<string, unknown> = {}) {
  state.docs.set("inboundRequests/req1", { consent_revoked: true, captureWithdrawalPending: true, captureDeletionPending: true,
    capture_withdrawal: { state: "uploads_stopped_cleanup_pending", requestedAtIso: new Date(REQUESTED_AT).toISOString(),
      requestedBy: "signed_owner_link", requestId: "req1", sceneId: "site-req1", captureId: "walkthrough-req1",
      deletionConfirmed: false, pipelineAcknowledged: false, localCleanupVerified: false, providerAcknowledgement: "unknown",
      retainedAuditRecords: true, webappDeletion: { phase: "pending", attempts: 0, nextAttemptAtMs: 0, leaseUntilMs: 0 }, ...extra } });
}
function seedBrowserObjects() {
  const raw = "scenes/site-req1/captures/walkthrough-req1/raw";
  bucket.add(`${raw}/walkthrough.mp4`, 1); bucket.add(`${raw}/walkthrough.mp4`, 2);
  bucket.add(`${raw}/manifest.json`); bucket.add(`${raw}/capture_upload_complete.json`);
  bucket.add(`${raw}/parts/part-000000`); bucket.add(`${raw}/parts/part-000001`);
  bucket.add("scenes/site-req1/items/forklift/img-1.jpg");
}
function seedForeignObjects() {
  bucket.add("scenes/site-req10/captures/walkthrough-req10/raw/walkthrough.mp4");
  bucket.add("scenes/site-req1/captures/walkthrough-req1/frames/000001.jpg");
  bucket.add("scenes/site-req1/world/scene.spz");
  bucket.add("scenes/site-other/items/x.jpg");
}
function ackReceipt() {
  const command = websiteWithdrawalCommand("req1", record().capture_withdrawal);
  const value = { schema_version: "website_capture_withdrawal_receipt.v1", request_id: command.request_id,
    scene_id: command.scene_id, capture_id: command.capture_id, withdrawal_id: command.withdrawal_id,
    command_digest: digest(command, "digest"), tombstone_digest: `sha256:${"1".repeat(64)}`,
    state: "pipeline_acknowledged_cleanup_pending", pipeline_acknowledged: true, serve_allowed: false,
    future_processing_allowed: false, local_cleanup_verified: false, local_cleanup_receipt_digest: null,
    deletion_confirmed: false, provider_acknowledgement: "unknown", cloud_storage_cleanup_verified: false,
    delivered_copy_cleanup_verified: false, retained_audit_records: true, legal_hold: false,
    cleanup_scope: "server_mapped_site_local_files", external_cleanup_required: true };
  return { status: "forwarded", value: { ...value, digest: digest(value, "digest") } };
}

beforeEach(() => {
  state.docs.clear();
  resetWebsiteCaptureDeletionCursorsForTests();
  bucket = new FakeBucket();
  clock = REQUESTED_AT + 10 * 60 * 1000;
  transport.result = {};
});

describe("owned prefixes", () => {
  it("covers only this request's capture raw/upload, supplements and item photos", () => {
    expect(ownedPrefixes("req1", ["supplement-abc", "walkthrough-other", "../x"])).toEqual([
      "scenes/site-req1/captures/walkthrough-req1/raw/", "scenes/site-req1/captures/walkthrough-req1/upload/",
      "scenes/site-req1/captures/supplement-abc/raw/", "scenes/site-req1/captures/supplement-abc/upload/",
      "scenes/site-req1/items/"]);
    expect(() => ownedPrefixes("../req1")).toThrow();
  });
});

describe("deletion worker", () => {
  it("waits for signed targets to expire and for Pipeline acknowledgement before deleting", async () => {
    seedWithdrawal(); seedBrowserObjects();
    await runWebsiteCaptureDeletions({ deps: deps() });
    expect(bucket.deleteCalls).toHaveLength(0);
    clock = REQUESTED_AT + 40 * 60 * 1000; // targets expired, no ack, before timeout
    record().capture_withdrawal.webappDeletion.nextAttemptAtMs = 0;
    await runWebsiteCaptureDeletions({ deps: deps() });
    expect(bucket.deleteCalls).toHaveLength(0);
    expect(record().capture_withdrawal.deletionConfirmed).toBe(false);
  });

  it("deletes every owned generation and part, writes a receipt, and confirms once Pipeline acknowledged", async () => {
    seedWithdrawal(); seedBrowserObjects(); seedForeignObjects();
    const foreign = bucket.names().filter(name => !name.includes("walkthrough-req1/raw") && !name.includes("site-req1/items"));
    transport.result = ackReceipt();
    await forwardWebsiteCaptureWithdrawals();
    expect(record().capture_withdrawal).toMatchObject({ pipelineAcknowledged: true, deletionConfirmed: false, state: "pipeline_acknowledged_cleanup_pending" });
    clock = REQUESTED_AT + 40 * 60 * 1000;
    await runWebsiteCaptureDeletions({ deps: deps() });
    expect(bucket.names()).toEqual(foreign.sort());
    const [receipt] = receipts();
    expect(receipt).toMatchObject({ schema_version: "website_capture_deletion_receipt.v1", request_id: "req1", pass: "initial",
      listed_count: 7, deleted_count: 7, failures: [], remaining_count_after_pass: 0, outcome: "complete",
      pipeline_acknowledgement: "acknowledged", bucket: "fake-bucket" });
    expect(receipt.objects.map((object: any) => `${object.name}#${object.generation}`)).toContain("scenes/site-req1/captures/walkthrough-req1/raw/walkthrough.mp4#1");
    expect(receipt.upload_targets).toMatchObject({ native_resumable_sessions_possible: false,
      signed_put_targets_expired_by_iso: new Date(REQUESTED_AT + 35 * 60 * 1000).toISOString() });
    expect(receipt.digest).toMatch(/^sha256:/);
    expect(record().capture_withdrawal).toMatchObject({ state: "deletion_confirmed", deletionConfirmed: true,
      webappDeletion: { phase: "deleted", deletedObjectCount: 7 } });
    expect(record().captureDeletionPending).toBe(false);
    expect(projectWebsiteCaptureWithdrawal(record().capture_withdrawal)).toMatchObject({ deletionConfirmed: true,
      storageDeletion: { state: "deleted", deletedObjectCount: 7 }, pipelineCleanupVerified: false });
    // The hourly re-acknowledgement cannot regress confirmed deletion.
    record().captureWithdrawalOutbox.nextAttemptAtMs = 0;
    await forwardWebsiteCaptureWithdrawals();
    expect(record().capture_withdrawal).toMatchObject({ state: "deletion_confirmed", deletionConfirmed: true });
    // Idempotent: nothing further happens.
    const calls = bucket.deleteCalls.length;
    await runWebsiteCaptureDeletions({ deps: deps() });
    expect(bucket.deleteCalls).toHaveLength(calls);
  });

  it("deletes after the acknowledgement timeout but confirms only once the acknowledgement arrives", async () => {
    seedWithdrawal(); seedBrowserObjects();
    clock = REQUESTED_AT + 3 * HOUR;
    await runWebsiteCaptureDeletions({ deps: deps() });
    expect(bucket.objects).toHaveLength(0);
    expect(receipts()[0].pipeline_acknowledgement).toBe("pending_after_timeout");
    expect(record().capture_withdrawal).toMatchObject({ state: "storage_deleted_pipeline_ack_pending", deletionConfirmed: false,
      webappDeletion: { pipelineAckState: "pending_after_timeout" } });
    expect(projectWebsiteCaptureWithdrawal(record().capture_withdrawal).pipelineAcknowledgementTimedOut).toBe(true);
    transport.result = ackReceipt();
    await forwardWebsiteCaptureWithdrawals();
    expect(record().capture_withdrawal).toMatchObject({ state: "deletion_confirmed", deletionConfirmed: true });
    clock += HOUR;
    await runWebsiteCaptureDeletions({ deps: deps() });
    expect(record().captureDeletionPending).toBe(false);
  });

  it("retries failed deletes with backoff and records each failure", async () => {
    seedWithdrawal({ pipelineAcknowledged: true }); seedBrowserObjects();
    bucket.failNames.add("scenes/site-req1/captures/walkthrough-req1/raw/manifest.json");
    clock = REQUESTED_AT + HOUR;
    await runWebsiteCaptureDeletions({ deps: deps() });
    expect(receipts()[0]).toMatchObject({ outcome: "failed", deleted_count: 6,
      failures: [{ name: "scenes/site-req1/captures/walkthrough-req1/raw/manifest.json", generation: "1", error: "storage_error_403" }] });
    const deletion = record().capture_withdrawal.webappDeletion;
    expect(deletion).toMatchObject({ phase: "pending", lastError: "storage_delete_failed", attempts: 1 });
    expect(deletion.nextAttemptAtMs).toBe(clock + 60_000);
    expect(record().capture_withdrawal.deletionConfirmed).toBe(false);
    await runWebsiteCaptureDeletions({ deps: deps() }); // still backing off
    expect(receipts()).toHaveLength(1);
    bucket.failNames.clear();
    clock += 61_000;
    await runWebsiteCaptureDeletions({ deps: deps() });
    expect(bucket.objects).toHaveLength(0);
    expect(record().capture_withdrawal).toMatchObject({ deletionConfirmed: true, webappDeletion: { deletedObjectCount: 7, failedObjectCount: 0 } });
  });

  it("does not steal a live claim and keeps a legal hold", async () => {
    seedWithdrawal({ pipelineAcknowledged: true, webappDeletion: { phase: "pending", attempts: 1, leaseUntilMs: REQUESTED_AT + 2 * HOUR, nextAttemptAtMs: 0 } });
    seedBrowserObjects();
    clock = REQUESTED_AT + HOUR;
    await runWebsiteCaptureDeletions({ deps: deps() });
    expect(bucket.deleteCalls).toHaveLength(0);
    seedWithdrawal({ pipelineAcknowledged: true, legalHold: true });
    await runWebsiteCaptureDeletions({ deps: deps() });
    expect(bucket.deleteCalls).toHaveLength(0);
    expect(record().capture_withdrawal).toMatchObject({ state: "cleanup_retained_legal_hold", deletionConfirmed: false });
  });

  it("sweeps late native uploads after resumable sessions expire before confirming", async () => {
    seedWithdrawal({ pipelineAcknowledged: true });
    bucket.add("scenes/site-req1/captures/walkthrough-req1/upload/bundle_plan.json");
    bucket.add("scenes/site-req1/captures/walkthrough-req1/raw/depth/000001.png");
    state.docs.set("captureSupplements/supplement-abc", { requestId: "req1", sceneId: "site-req1" });
    bucket.add("scenes/site-req1/captures/supplement-abc/raw/walkthrough.mov");
    clock = REQUESTED_AT + HOUR;
    await runWebsiteCaptureDeletions({ deps: deps() });
    expect(bucket.objects).toHaveLength(0);
    expect(record().capture_withdrawal).toMatchObject({ state: "storage_deleted_late_upload_check_pending", deletionConfirmed: false,
      webappDeletion: { phase: "awaiting_late_upload_sweep", lateSweepAtMs: REQUESTED_AT + NATIVE_RESUMABLE_SESSION_TTL_MS + HOUR } });
    // An outstanding resumable session finalizes after the first pass.
    bucket.add("scenes/site-req1/captures/walkthrough-req1/raw/walkthrough.mov");
    clock = REQUESTED_AT + 2 * 24 * HOUR;
    await runWebsiteCaptureDeletions({ deps: deps() });
    expect(bucket.objects).toHaveLength(1);
    clock = REQUESTED_AT + NATIVE_RESUMABLE_SESSION_TTL_MS + 2 * HOUR;
    await runWebsiteCaptureDeletions({ deps: deps() });
    expect(bucket.objects).toHaveLength(0);
    expect(receipts().map(receipt => receipt.pass).sort()).toEqual(["initial", "late_upload_sweep"]);
    expect(record().capture_withdrawal).toMatchObject({ state: "deletion_confirmed", deletionConfirmed: true });
  });

  it("adopts a withdrawal recorded before the deletion queue existed", async () => {
    seedWithdrawal({ pipelineAcknowledged: true });
    delete record().captureDeletionPending; delete record().capture_withdrawal.webappDeletion;
    seedBrowserObjects();
    clock = REQUESTED_AT + HOUR;
    await runWebsiteCaptureDeletions({ deps: deps() });
    expect(bucket.objects).toHaveLength(0);
    expect(record().capture_withdrawal.deletionConfirmed).toBe(true);
  });

  it("refuses to delete for a record whose consent was not revoked", async () => {
    seedWithdrawal({ pipelineAcknowledged: true }); seedBrowserObjects();
    record().consent_revoked = false;
    clock = REQUESTED_AT + HOUR;
    await runWebsiteCaptureDeletions({ deps: deps() });
    expect(bucket.deleteCalls).toHaveLength(0);
  });

  it("runs only while holding its own leader lease", async () => {
    vi.useFakeTimers();
    try {
      const lease = { instanceId: "i", isLeader: vi.fn(() => false), tick: vi.fn(), start: vi.fn(), stop: vi.fn(async () => {}) };
      const stop = startWebsiteCaptureDeletionWorker({ lease, intervalMs: 1_000 });
      await vi.advanceTimersByTimeAsync(12_000);
      expect(lease.start).toHaveBeenCalled();
      expect(lease.isLeader).toHaveBeenCalled();
      stop();
      expect(lease.stop).toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
});
