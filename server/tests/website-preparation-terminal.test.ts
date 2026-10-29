// @vitest-environment node
/**
 * Beta journey L3/L6: website_preparation_status.v2 on the WebApp side.
 *
 * A capture's preparation can end for good (failed_terminal, with a reason) or
 * wait only on Blueprint's capacity (capacity_delayed). The production verifier,
 * commit and notification code run against the shared Firestore fake, which
 * models Firestore's deep `merge` and whole-field `mergeFields`. Owner
 * observation, the Pipeline read and storage are local doubles; no network,
 * provider or mail is used.
 */
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

const runtime = vi.hoisted(() => ({ objects: new Map<string, { metadata: any; bytes: Buffer }>(),
  observation: null as any, requests: [] as RequestInit[] }));
vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore, storageAdmin: { bucket() { return { file(name: string) {
      const read = () => { const row = runtime.objects.get(name); if (!row) throw Object.assign(Error("missing"), { code: 404 }); return row; };
      return { async getMetadata() { return [read().metadata]; }, async download() { return [read().bytes]; } };
    } }; } } };
});
vi.mock("../utils/websiteCaptureOwnerTransport", () => ({ withWebsiteOwnerDeps: async (_ms: number, action: (deps: any) => Promise<unknown>) => action({}) }));
vi.mock("../utils/websiteCaptureOwnerObservation", () => ({ observeWebsiteCaptureOwner: async () => runtime.observation }));

const { buildBrowserDelivery } = await import("../utils/websiteCaptureDelivery");
const { projectWebsiteTaskContext, projectWebsiteCaptureRights } = await import("../utils/websiteTaskContext");
const { crossRuntimeArtifactDigest, crossRuntimeDigest } = await import("../utils/crossRuntimeCanonical");
const status = await import("../utils/websitePreparationStatus");
const { WEBSITE_PREPARATION_WATCH_FIELD, WEBSITE_PREPARATION_WATCH_DUE_FIELD } = await import("../utils/websitePreparationWatch");
type Receipt = import("../utils/websitePreparationStatus").WebsitePreparationReceipt;
type Selector = import("../utils/websitePreparationStatus").WebsitePreparationSelector;

const codes: Record<string, string> = { preparing: "preparation_in_progress", awaiting_inputs: "preparation_inputs_pending",
  failed_retryable: "preparation_retryable_failure", authority_ended: "preparation_authority_ended",
  handed_off: "preparation_handed_off", capacity_delayed: "preparation_capacity_delayed",
  failed_terminal: "preparation_failed_terminal" };
const sha = (bytes: Buffer) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

function receipt(selected: Selector, state: string, attempt = 1, revision = 3,
  version: "v1" | "v2" = "v2", reason: string | null = state === "failed_terminal" ? "retry_exhausted" : null): Receipt {
  const value: Record<string, unknown> = { ...selected, schema_version: `website_preparation_status.${version}`, state,
    code: codes[state], attempt_count: attempt, revision, correlation_id: crossRuntimeDigest({ selected, attempt, revision }),
    ...(version === "v2" ? { terminal_reason: reason } : {}) };
  return { ...value, status_digest: crossRuntimeArtifactDigest(value, "status_digest") } as Receipt;
}

/** The same production fixture as website-preparation-status.test.ts, on the shared fake. */
function production() {
  sharedFakeFirestoreState.docs.clear(); runtime.objects.clear(); runtime.requests = [];
  const request = { account_owner_uid: "owner1", contact: { email: "owner@example.test" }, request: { buyerType: "site_operator",
    capture_mode: "self_capture", consent_attestation: { granted: true, statement_version: "2026-09-18.v1",
      recorded_at_iso: "2026-09-29T00:00:00.000Z" } } };
  const brief = { requestId: "r1", summary: "Move sealed cartons", confirmedAtIso: "2026-09-29T00:00:00.000Z", operatorAnswers: {}, unresolved: [] };
  const prefix = "scenes/site-r1/captures/walkthrough-r1/raw";
  const video = { object_name: `${prefix}/walkthrough.mp4`, generation: "90071992547409932", size_bytes: 7, crc32c: "AAAAAA==" };
  const manifestBytes = Buffer.from(JSON.stringify({ request_id: "r1", scene_id: "site-r1", capture_id: "walkthrough-r1",
    capture_rights: projectWebsiteCaptureRights(request), video_uri: video.object_name }));
  const manifest = { object_name: `${prefix}/manifest.json`, generation: "90071992547409933", size_bytes: manifestBytes.length,
    crc32c: "AAAAAA==", sha256: sha(manifestBytes) };
  const pending = { schema_version: "website_browser_pending.v1", request_id: "r1", scene_id: "site-r1", capture_id: "walkthrough-r1",
    state: "published", video, manifest, completed_at_iso: "2026-09-29T00:00:00.000Z" };
  const delivery = buildBrowserDelivery({ requestId: "r1", sceneId: "site-r1", captureId: "walkthrough-r1", rawPrefix: prefix,
    video, manifest, completedAtIso: pending.completed_at_iso });
  const add = (name: string, generation: string, bytes: Buffer) => runtime.objects.set(name, { metadata: { name, generation,
    size: String(bytes.length), crc32c: "AAAAAA==" }, bytes });
  const marker = "90071992547409931";
  add(video.object_name, video.generation, Buffer.from("video-1")); add(manifest.object_name, manifest.generation, manifestBytes);
  add(`${prefix}/capture_upload_complete.json`, marker, delivery.markerBytes); add(delivery.objectName, "90071992547409934", delivery.recordBytes);
  sharedFakeFirestoreState.docs.set("inboundRequests/r1", request); sharedFakeFirestoreState.docs.set("siteTaskBriefs/r1", brief);
  sharedFakeFirestoreState.docs.set("captureUploadSessions/walkthrough-r1", { browser_pending_delivery: pending });
  runtime.observation = { capture_rights: projectWebsiteCaptureRights(request), capture_owner: { user_id: "owner1" },
    completion_marker: { object_name: `${prefix}/capture_upload_complete.json`, generation: marker, sha256: sha(delivery.markerBytes) },
    producer_delivery: { kind: "website_browser_capture_delivery", delivery_key: delivery.record.delivery_key, raw_video: video } };
  const selected: Selector = { request_id: "r1", scene_id: "site-r1", capture_id: "walkthrough-r1", completion_marker_generation: marker,
    producer_delivery_key: delivery.record.delivery_key, source_payload_sha256: "b".repeat(64),
    task_context_digest: projectWebsiteTaskContext(brief as never, projectWebsiteCaptureRights(request), { captureId: "walkthrough-r1" }).context_digest };
  let canonical: unknown = receipt(selected, "preparing");
  vi.stubEnv("CAPTURE_LIFECYCLE_PIPELINE_BASE_URL", "https://pipeline.invalid"); vi.stubEnv("CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN", "isolated-read-token");
  vi.stubGlobal("fetch", vi.fn(async (_url: string, options: RequestInit) => {
    runtime.requests.push(options);
    expect(JSON.parse(String(options.body))).toEqual(selected);
    return new Response(JSON.stringify(canonical), { headers: { "content-type": "application/json" } });
  }));
  const session = () => sharedFakeFirestoreState.docs.get("captureUploadSessions/walkthrough-r1") as Record<string, any>;
  return { selected, session, ledger(next: unknown) { canonical = next; } };
}

beforeEach(() => { vi.useRealTimers(); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("v2 receipt contract", () => {
  it("TERM-001 asks the Pipeline for v4 on every signed read and accepts a v1 answer", async () => {
    const f = production();
    f.ledger(receipt(f.selected, "failed_retryable", 1, 3, "v1"));
    expect((await status.syncWebsitePreparationStatus(f.selected)).schema_version).toBe("website_preparation_status.v1");
    for (const sent of runtime.requests)
      expect((sent.headers as Record<string, string>)[status.WEBSITE_PREPARATION_STATUS_VERSION_HEADER]).toBe("4");
    expect(f.session().website_preparation.status.state).toBe("failed_retryable");
  });
  it.each(["permanent_invalid", "retry_exhausted", "budget_exhausted", "capacity_blocked", "out_of_scope"])(
    "TERM-002 an ending with reason %s is stored and readable", async reason => {
      const f = production(); f.ledger(receipt(f.selected, "failed_terminal", 5, 9, "v2", reason));
      await status.syncWebsitePreparationStatus(f.selected);
      expect(await status.loadCurrentWebsitePreparationStatus("r1", "walkthrough-r1"))
        .toMatchObject({ state: "failed_terminal", terminalReason: reason });
    });
  it.each([
    ["terminal without a reason", (s: Selector) => receipt(s, "failed_terminal", 1, 3, "v2", null)],
    ["a reason on a live state", (s: Selector) => receipt(s, "preparing", 1, 3, "v2", "retry_exhausted")],
    ["an unknown reason", (s: Selector) => receipt(s, "failed_terminal", 1, 3, "v2", "provider_failed")],
    ["a v2 state in a v1 receipt", (s: Selector) => receipt(s, "capacity_delayed", 1, 3, "v1")],
    ["a forged code", (s: Selector) => { const value: any = receipt(s, "capacity_delayed"); const { status_digest: _drop, ...rest } = value;
      rest.code = "preparation_inputs_pending"; return { ...rest, status_digest: crossRuntimeArtifactDigest(rest, "status_digest") }; }],
    ["an extra private field", (s: Selector) => ({ ...receipt(s, "failed_terminal"), provider_error: "PRIVATE" })],
  ])("TERM-003 refuses %s", async (_label, build) => {
    const f = production(); f.ledger(build(f.selected));
    await expect(status.syncWebsitePreparationStatus(f.selected)).rejects.toThrow();
    expect(f.session().website_preparation).toBeUndefined();
  });
});

describe("one durable intent per notice", () => {
  it("TERM-010 an ending supersedes an unsent needs-attention intent and stays one notice on replay", async () => {
    const f = production(); f.ledger(receipt(f.selected, "failed_retryable", 4, 7));
    await status.syncWebsitePreparationStatus(f.selected);
    expect(f.session().website_preparation.notification).toEqual({ eventId: status.websitePreparationEventId(f.selected), state: "pending" });
    f.ledger(receipt(f.selected, "failed_terminal", 4, 8, "v2", "budget_exhausted"));
    await status.syncWebsitePreparationStatus(f.selected);
    const ended = status.websitePreparationEndedEventId(f.selected, 4);
    expect(f.session().website_preparation.notification).toEqual({ eventId: ended, state: "pending" });
    const intents: any[] = [];
    expect(await status.drainPendingWebsitePreparationNotifications(async intent => { intents.push(intent); return "enqueued"; }))
      .toEqual({ enqueued: 1, pending: 0 });
    expect(intents[0]).toMatchObject({ milestone: "preparation_ended", terminalReason: "budget_exhausted", eventId: ended });
    expect(await status.canNotifyCurrentWebsitePreparationIssue("r1", ended)).toBe(true);
    // A later revision of the same ending (or the same ledger read as v1) is no new notice.
    f.ledger(receipt(f.selected, "failed_terminal", 4, 9, "v2", "budget_exhausted"));
    await status.syncWebsitePreparationStatus(f.selected);
    expect(f.session().website_preparation.notification).toEqual({ eventId: ended, state: "enqueued" });
    expect(f.session().website_preparation_notification_pending).toBe(false);
  });
  it("TERM-011 a re-drive cancels the old ending and a second ending is a second notice", async () => {
    const f = production(); f.ledger(receipt(f.selected, "failed_terminal", 5, 9));
    await status.syncWebsitePreparationStatus(f.selected);
    const first = status.websitePreparationEndedEventId(f.selected, 5);
    f.ledger(receipt(f.selected, "preparing", 6, 10));
    await status.syncWebsitePreparationStatus(f.selected);
    expect(f.session().website_preparation.notification).toBeNull();
    expect(await status.canNotifyCurrentWebsitePreparationIssue("r1", first)).toBe(false);
    f.ledger(receipt(f.selected, "failed_terminal", 6, 11));
    await status.syncWebsitePreparationStatus(f.selected);
    expect(f.session().website_preparation.notification)
      .toEqual({ eventId: status.websitePreparationEndedEventId(f.selected, 6), state: "pending" });
  });
  it("TERM-012 waiting for capacity asks nothing of the site", async () => {
    const f = production(); f.ledger(receipt(f.selected, "capacity_delayed", 2, 4));
    await status.syncWebsitePreparationStatus(f.selected);
    expect(f.session().website_preparation.notification).toBeNull();
    expect(f.session().website_preparation_notification_pending).toBe(false);
    expect((await status.loadCurrentWebsitePreparationStatus("r1", "walkthrough-r1")).state).toBe("capacity_delayed");
  });
});

describe("cross-version revisions and Firestore merge semantics", () => {
  it("TERM-020 the same revision may move between versions, never change within one", async () => {
    const f = production(); f.ledger(receipt(f.selected, "failed_retryable", 5, 9, "v1"));
    await status.syncWebsitePreparationStatus(f.selected);
    f.ledger(receipt(f.selected, "failed_terminal", 5, 9, "v2", "budget_exhausted"));
    await status.syncWebsitePreparationStatus(f.selected);
    expect(f.session().website_preparation.status).toMatchObject({ state: "failed_terminal", terminal_reason: "budget_exhausted" });
    f.ledger(receipt(f.selected, "failed_terminal", 5, 9, "v2", "retry_exhausted"));
    await expect(status.syncWebsitePreparationStatus(f.selected)).rejects.toThrow();
    // Rollback to a v1-only Pipeline: a deep merge would keep terminal_reason
    // under the v1 receipt and the strict stored schema would then refuse it.
    f.ledger(receipt(f.selected, "failed_retryable", 5, 9, "v1"));
    await status.syncWebsitePreparationStatus(f.selected);
    expect(f.session().website_preparation.status).not.toHaveProperty("terminal_reason");
    expect((await status.loadCurrentWebsitePreparationStatus("r1", "walkthrough-r1")).state).toBe("failed_retryable");
  });
  it("TERM-021 the commit keeps unrelated session fields and replaces only its own", async () => {
    const f = production(); f.ledger(receipt(f.selected, "preparing", 1, 3));
    await status.syncWebsitePreparationStatus(f.selected);
    expect(f.session().browser_pending_delivery.state).toBe("published");
    expect(f.session()[WEBSITE_PREPARATION_WATCH_FIELD]).toMatchObject({ kind: "unchanged_state", state: "preparing" });
    expect(typeof f.session()[WEBSITE_PREPARATION_WATCH_DUE_FIELD]).toBe("number");
  });
});

describe("watch on commit", () => {
  it("TERM-030 the clock runs from a change of state, an ending is due at once, hand-off clears it", async () => {
    const f = production(); f.ledger(receipt(f.selected, "preparing", 1, 3));
    await status.syncWebsitePreparationStatus(f.selected);
    const first = f.session()[WEBSITE_PREPARATION_WATCH_FIELD];
    f.ledger(receipt(f.selected, "preparing", 1, 4));
    await status.syncWebsitePreparationStatus(f.selected);
    expect(f.session()[WEBSITE_PREPARATION_WATCH_FIELD]).toEqual(first);
    const before = Date.now();
    f.ledger(receipt(f.selected, "failed_terminal", 1, 5));
    await status.syncWebsitePreparationStatus(f.selected);
    expect(f.session()[WEBSITE_PREPARATION_WATCH_FIELD]).toMatchObject({ kind: "ended", terminal_reason: "retry_exhausted", attempt_count: 1 });
    expect(f.session()[WEBSITE_PREPARATION_WATCH_DUE_FIELD]).toBeGreaterThanOrEqual(before);
    expect(f.session()[WEBSITE_PREPARATION_WATCH_DUE_FIELD]).toBeLessThanOrEqual(Date.now());
    f.ledger(receipt(f.selected, "handed_off", 2, 6));
    await status.syncWebsitePreparationStatus(f.selected);
    expect(f.session()[WEBSITE_PREPARATION_WATCH_FIELD]).toBeNull();
    expect(f.session()[WEBSITE_PREPARATION_WATCH_DUE_FIELD]).toBeNull();
  });
});
