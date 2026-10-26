// @vitest-environment node
/**
 * Beta journey L3/L6: every website capture's preparation reaches an operator
 * when it goes quiet or ends. Shared Firestore fake; Slack and email are spies.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestore, sharedFakeFirestoreState as state } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => ({
  default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => undefined } } },
  dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore,
}));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const watch = await import("../utils/websitePreparationWatch");
const { backfillWebsitePreparationWatches, scanWebsitePreparationWatch, scanEndedWebsiteSceneIntakes } = await import("../utils/websitePreparationOpsAlerts");
const { projectWebsiteSceneProgression, loadWebsiteSceneProgression, policyTestAccepted } = await import("../utils/websiteSceneProgression");
const { recordSiteCaptureUploadIdentity } = await import("../utils/siteCaptureUploadIdentity");
type Stored = import("../utils/websitePreparationStatus").StoredWebsitePreparation;

const HOUR = 60 * 60 * 1000;
const selector = { request_id: "r1", scene_id: "site-r1", capture_id: "walkthrough-r1", completion_marker_generation: "19",
  producer_delivery_key: `sha256:${"a".repeat(64)}`, source_payload_sha256: "b".repeat(64), task_context_digest: `sha256:${"c".repeat(64)}` };
function stored(state: string, attempt = 1, reason: string | null = state === "failed_terminal" ? "budget_exhausted" : null): Stored {
  return { selector, notification: null, status: { ...selector, schema_version: "website_preparation_status.v2", state, code: "x",
    attempt_count: attempt, revision: 3, correlation_id: `sha256:${"d".repeat(64)}`, status_digest: `sha256:${"e".repeat(64)}`,
    terminal_reason: reason } as never };
}
const session = (id = "walkthrough-r1") => state.docs.get(`captureUploadSessions/${id}`) as Record<string, any> | undefined;

beforeEach(() => {
  state.docs.clear();
  state.docs.set("inboundRequests/r1", { request: { consent_attestation: { granted: true, statement_version: "2026-09-18.v1",
    recorded_at_iso: "2026-09-29T00:00:00.000Z" } } });
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("watch transitions", () => {
  it("WATCH-001 starts at the upload for walkthrough and supplement captures only", () => {
    const fields = watch.websitePreparationUploadWatchFields("r1", "site-r1", "walkthrough-r1", 1_000);
    expect(fields[watch.WEBSITE_PREPARATION_WATCH_DUE_FIELD]).toBe(1_000 + 2 * HOUR);
    expect(fields[watch.WEBSITE_PREPARATION_WATCH_FIELD]).toMatchObject({ kind: "awaiting_first_status", request_id: "r1" });
    expect(Object.keys(watch.websitePreparationUploadWatchFields("r1", "site-r1", `supplement-${"f".repeat(40)}`))).toHaveLength(2);
    for (const [scene, capture] of [["site-r1", "creator-capture-1"], ["site-r2", "walkthrough-r1"], ["site-r1", "supplement-short"]])
      expect(watch.websitePreparationUploadWatchFields("r1", scene, capture)).toEqual({});
  });
  it("WATCH-002 a state keeps its clock across revisions; a new state restarts it", () => {
    const first = watch.nextWebsitePreparationWatch(null, stored("preparing"), 1_000)!;
    expect(first).toMatchObject({ kind: "unchanged_state", state: "preparing", due_at_ms: 1_000 + 24 * HOUR });
    expect(watch.nextWebsitePreparationWatch(first, stored("preparing", 2), 9_000)).toBe(first);
    expect(watch.nextWebsitePreparationWatch(first, stored("capacity_delayed", 2), 9_000))
      .toMatchObject({ state: "capacity_delayed", due_at_ms: 9_000 + 24 * HOUR });
  });
  it("WATCH-003 an ending is due at once and reported once per terminal transition", () => {
    const ended = watch.nextWebsitePreparationWatch(null, stored("failed_terminal", 5), 1_000)!;
    expect(ended).toMatchObject({ kind: "ended", due_at_ms: 1_000, terminal_reason: "budget_exhausted", attempt_count: 5 });
    const alerted = { ...ended, due_at_ms: null, alerted_at_iso: "x" };
    expect(watch.nextWebsitePreparationWatch(alerted, stored("failed_terminal", 5), 2_000)).toBe(alerted);
    expect(watch.nextWebsitePreparationWatch(alerted, stored("failed_terminal", 6), 2_000)).toMatchObject({ due_at_ms: 2_000 });
  });
  it.each(["handed_off", "authority_ended"])("WATCH-004 %s ends the watch", final => {
    expect(watch.nextWebsitePreparationWatch(null, stored(final), 1_000)).toBeNull();
  });
  it("WATCH-005 bounds are configurable and overdue never applies to an ending", () => {
    vi.stubEnv("BLUEPRINT_WEBSITE_PREPARATION_FIRST_STATUS_ALERT_MS", String(HOUR));
    const start = watch.websitePreparationUploadWatchFields("r1", "site-r1", "walkthrough-r1", 0)[watch.WEBSITE_PREPARATION_WATCH_FIELD];
    expect(watch.websitePreparationOverdue(start, HOUR - 1)).toBe(false);
    expect(watch.websitePreparationOverdue(start, HOUR)).toBe(true);
    expect(watch.websitePreparationOverdue(watch.nextWebsitePreparationWatch(null, stored("failed_terminal"), 0), 99 * HOUR)).toBe(false);
    expect(watch.websitePreparationOverdue({ kind: "awaiting_first_status" }, 99 * HOUR)).toBe(false);
  });
  it("WATCH-006 a finished app-bundle upload (supplements included) starts the watch in its own transaction", async () => {
    const supplement = `supplement-${"f".repeat(40)}`;
    expect(await recordSiteCaptureUploadIdentity({ requestId: "r1", planDigest: `sha256:${"1".repeat(64)}`, client: "ios" as never,
      target: { sceneId: "site-r1", captureId: supplement, rawPrefix: `scenes/site-r1/captures/${supplement}/raw` } as never,
      identity: { raw_bundle_digest: `sha256:${"2".repeat(64)}`, upload_completion_digest: `sha256:${"3".repeat(64)}`,
        raw_manifest_uri: `gs://blueprint-8c1ca.appspot.com/scenes/site-r1/captures/${supplement}/raw/manifest.json` } })).toBe("recorded");
    expect(session(supplement)?.[watch.WEBSITE_PREPARATION_WATCH_FIELD]).toMatchObject({ kind: "awaiting_first_status", capture_id: supplement });
    expect(typeof session(supplement)?.[watch.WEBSITE_PREPARATION_WATCH_DUE_FIELD]).toBe("number");
  });
});

describe("ops alert", () => {
  function due(id: string, w: Record<string, unknown>) {
    state.docs.set(`captureUploadSessions/${id}`, { other_field: "kept", [watch.WEBSITE_PREPARATION_WATCH_FIELD]: w,
      [watch.WEBSITE_PREPARATION_WATCH_DUE_FIELD]: w.due_at_ms });
  }
  const quiet = (since: number) => ({ ...watch.websitePreparationUploadWatchFields("r1", "site-r1", "walkthrough-r1", since)
    [watch.WEBSITE_PREPARATION_WATCH_FIELD] as Record<string, unknown> });
  it("ALERT-001 acknowledges a due watch only after Slack confirms, with ids and links only", async () => {
    due("walkthrough-r1", quiet(0));
    const alert = vi.fn(async () => ({ sent: true })), email = vi.fn(async () => ({ sent: true }) as never);
    expect(await scanWebsitePreparationWatch({ store: sharedFakeFirestore as never, now: () => 3 * HOUR, alert, email }))
      .toEqual({ due: 1, alerted: 1 });
    expect(alert).toHaveBeenCalledTimes(1); expect(email).not.toHaveBeenCalled();
    const text = (alert.mock.calls[0] as unknown as [string, string])[1];
    expect(text).toContain("walkthrough-r1 (request r1): no preparation status since its upload");
    expect(text).toContain("/admin/leads/r1");
    expect(session()?.other_field).toBe("kept");
    expect(session()?.[watch.WEBSITE_PREPARATION_WATCH_DUE_FIELD]).toBeNull();
    expect(session()?.[watch.WEBSITE_PREPARATION_WATCH_FIELD]).toMatchObject({ due_at_ms: null, alerted_at_iso: new Date(3 * HOUR).toISOString() });
    expect(await scanWebsitePreparationWatch({ store: sharedFakeFirestore as never, now: () => 9 * HOUR, alert, email }))
      .toEqual({ due: 0, alerted: 0 });
    expect(alert).toHaveBeenCalledTimes(1);
  });
  it("ALERT-002 a not-yet-due watch, a newer status clock and a withdrawn recording do not alert", async () => {
    due("walkthrough-r1", quiet(0));
    const alert = vi.fn(async () => ({ sent: true })), email = vi.fn(async () => ({ sent: true }) as never);
    expect((await scanWebsitePreparationWatch({ store: sharedFakeFirestore as never, now: () => HOUR, alert, email })).alerted).toBe(0);
    const record = state.docs.get("inboundRequests/r1") as any;
    record.request.consent_attestation.withdrawn_at_iso = "2026-10-10T00:00:00.000Z";
    expect((await scanWebsitePreparationWatch({ store: sharedFakeFirestore as never, now: () => 3 * HOUR, alert, email })).alerted).toBe(0);
    expect(session()?.[watch.WEBSITE_PREPARATION_WATCH_DUE_FIELD]).toBeNull();
    expect(alert).not.toHaveBeenCalled();
  });
  it("ALERT-003 an ending alerts at once and names its reason", async () => {
    due("walkthrough-r1", watch.nextWebsitePreparationWatch(null, stored("failed_terminal", 5), 1_000) as never);
    const alert = vi.fn(async () => ({ sent: true }));
    await scanWebsitePreparationWatch({ store: sharedFakeFirestore as never, now: () => 1_000, alert, email: vi.fn(async () => ({}) as never) });
    expect((alert.mock.calls[0] as unknown as [string, string])[1]).toContain("ended for good (budget_exhausted)");
  });
  it("ALERT-004 an unreadable watch leaves the index without an alert", async () => {
    state.docs.set("captureUploadSessions/walkthrough-r1", { [watch.WEBSITE_PREPARATION_WATCH_FIELD]: { kind: "forged" },
      [watch.WEBSITE_PREPARATION_WATCH_DUE_FIELD]: 0 });
    const alert = vi.fn(async () => ({ sent: true }));
    expect(await scanWebsitePreparationWatch({ store: sharedFakeFirestore as never, now: () => 1, alert, email: vi.fn(async () => ({}) as never) }))
      .toEqual({ due: 1, alerted: 0 });
    expect(session()?.[watch.WEBSITE_PREPARATION_WATCH_DUE_FIELD]).toBeNull();
  });
  it("ALERT-005 failed transports retain due work with capped backoff, then acknowledge recovery", async () => {
    due("walkthrough-r1", quiet(0));
    let now = 3 * HOUR;
    const alert = vi.fn(async () => ({ sent: false, suppressed: false }));
    const email = vi.fn(async () => ({ sent: false, provider: "resend", outcome: "not_sent" }) as never);
    const deps = { store: sharedFakeFirestore as never, now: () => now, alert, email };
    for (let attempt = 1; attempt <= 9; attempt++) {
      expect((await scanWebsitePreparationWatch(deps)).alerted).toBe(0);
      const saved = session()?.[watch.WEBSITE_PREPARATION_WATCH_FIELD];
      expect(saved).toMatchObject({ alerted_at_iso: null, delivery: { state: "pending", attempts: attempt, email_state: "not_sent" } });
      expect(saved.due_at_ms - now).toBe(Math.min(6 * HOUR, HOUR / 4 * 2 ** (attempt - 1)));
      expect((await scanWebsitePreparationWatch(deps)).alerted).toBe(0);
      expect(alert).toHaveBeenCalledTimes(attempt);
      now = saved.due_at_ms;
    }
    alert.mockResolvedValue({ sent: true, suppressed: false });
    expect((await scanWebsitePreparationWatch(deps)).alerted).toBe(1);
    expect(session()?.[watch.WEBSITE_PREPARATION_WATCH_FIELD]).toMatchObject({ due_at_ms: null,
      delivery: { state: "delivered", attempts: 10, acknowledged_at_iso: new Date(now).toISOString() } });
    expect(email).toHaveBeenCalledTimes(9);
  });
  it("ALERT-006 an explicit Slack failure falls back to one acknowledged ops email", async () => {
    due("walkthrough-r1", quiet(0));
    const alert = vi.fn(async () => ({ sent: false, suppressed: true }));
    const email = vi.fn(async () => ({ sent: true, provider: "resend" }) as never);
    expect((await scanWebsitePreparationWatch({ store: sharedFakeFirestore as never, now: () => 3 * HOUR, alert, email })).alerted).toBe(1);
    expect(email).toHaveBeenCalledTimes(1);
    expect(session()?.[watch.WEBSITE_PREPARATION_WATCH_FIELD]).toMatchObject({ delivery: { state: "delivered", email_state: "sent" } });
  });
  it("ALERT-007 concurrent monitor passes send a due watch once", async () => {
    due("walkthrough-r1", quiet(0));
    const alert = vi.fn(async () => ({ sent: true })), email = vi.fn(async () => ({ sent: true }) as never);
    const deps = { store: sharedFakeFirestore as never, now: () => 3 * HOUR, alert, email };
    const results = await Promise.all([scanWebsitePreparationWatch(deps), scanWebsitePreparationWatch(deps)]);
    expect(results.reduce((sum, row) => sum + row.alerted, 0)).toBe(1);
    expect(alert).toHaveBeenCalledTimes(1); expect(email).not.toHaveBeenCalled();
  });
  it("ALERT-008 a process lost after claiming resumes after the lease expires", async () => {
    due("walkthrough-r1", quiet(0));
    const alert = vi.fn(async () => ({ sent: true })), email = vi.fn(async () => ({ sent: true }) as never);
    const lostProcessStore = { ...sharedFakeFirestore, runTransaction: async (action: any) => {
      await sharedFakeFirestore.runTransaction(action);
      throw new Error("process lost after durable claim");
    } };
    expect((await scanWebsitePreparationWatch({ store: lostProcessStore as never, now: () => 3 * HOUR, alert, email })).alerted).toBe(0);
    expect(alert).not.toHaveBeenCalled();
    expect(session()?.[watch.WEBSITE_PREPARATION_WATCH_FIELD]).toMatchObject({ alerted_at_iso: null, delivery: { state: "claimed", attempts: 1 } });
    expect((await scanWebsitePreparationWatch({ store: sharedFakeFirestore as never, now: () => 3 * HOUR + 4 * 60_000, alert, email })).alerted).toBe(0);
    expect((await scanWebsitePreparationWatch({ store: sharedFakeFirestore as never, now: () => 3 * HOUR + 6 * 60_000, alert, email })).alerted).toBe(1);
    expect(alert).toHaveBeenCalledTimes(1);
  });
  it("ALERT-009 an email accepted before a lost durable acknowledgement is never blindly resent", async () => {
    due("walkthrough-r1", quiet(0));
    const alert = vi.fn(async () => ({ sent: false })), email = vi.fn(async () => ({ sent: true }) as never);
    const lostAckStore = { ...sharedFakeFirestore, runTransaction: (action: any) => sharedFakeFirestore.runTransaction(async tx => action({
      ...tx, set: (ref: any, payload: any, options: any) => {
        if (payload[watch.WEBSITE_PREPARATION_WATCH_FIELD]?.delivery?.state === "delivered") throw new Error("ack commit unavailable");
        tx.set(ref, payload, options);
      },
    })) };
    expect((await scanWebsitePreparationWatch({ store: lostAckStore as never, now: () => 3 * HOUR, alert, email })).alerted).toBe(0);
    expect(email).toHaveBeenCalledTimes(1);
    expect(session()?.[watch.WEBSITE_PREPARATION_WATCH_FIELD]).toMatchObject({ delivery: { state: "claimed", email_state: "sending" } });
    const later = 3 * HOUR + 6 * 60_000;
    expect((await scanWebsitePreparationWatch({ store: sharedFakeFirestore as never, now: () => later, alert, email })).alerted).toBe(0);
    expect(email).toHaveBeenCalledTimes(1);
    expect(session()?.[watch.WEBSITE_PREPARATION_WATCH_FIELD]).toMatchObject({ delivery: { state: "pending", email_state: "unknown",
      last_error: "email_acknowledgement_unknown" } });
    alert.mockResolvedValue({ sent: true });
    const retryAt = session()?.[watch.WEBSITE_PREPARATION_WATCH_DUE_FIELD];
    expect((await scanWebsitePreparationWatch({ store: sharedFakeFirestore as never, now: () => retryAt, alert, email })).alerted).toBe(1);
    expect(email).toHaveBeenCalledTimes(1);
  });
  it.each(["unknown", "throw", "missing"])("ALERT-010 %s email acknowledgement stays unknown and only Slack retries", async failure => {
    due("walkthrough-r1", quiet(0));
    const alert = vi.fn(async () => ({ sent: false }));
    const email = vi.fn(async () => {
      if (failure === "throw") throw new Error("connection lost after submission");
      return (failure === "unknown" ? { sent: false, provider: "resend", outcome: "unknown" } : {}) as never;
    });
    expect((await scanWebsitePreparationWatch({ store: sharedFakeFirestore as never, now: () => 3 * HOUR, alert, email })).alerted).toBe(0);
    expect(session()?.[watch.WEBSITE_PREPARATION_WATCH_FIELD]).toMatchObject({ delivery: { state: "pending", email_state: "unknown" } });
    const retryAt = session()?.[watch.WEBSITE_PREPARATION_WATCH_DUE_FIELD];
    expect((await scanWebsitePreparationWatch({ store: sharedFakeFirestore as never, now: () => retryAt, alert, email })).alerted).toBe(0);
    expect(email).toHaveBeenCalledTimes(1); expect(alert).toHaveBeenCalledTimes(2);
  });
  it("ALERT-011 a new preparation state fences a sender's late acknowledgement", async () => {
    due("walkthrough-r1", quiet(0));
    const replacement = watch.nextWebsitePreparationWatch(null, stored("preparing"), 3 * HOUR)!;
    const alert = vi.fn(async () => { due("walkthrough-r1", replacement); return { sent: true }; });
    const email = vi.fn(async () => ({ sent: true }) as never);
    expect((await scanWebsitePreparationWatch({ store: sharedFakeFirestore as never, now: () => 3 * HOUR, alert, email })).alerted).toBe(0);
    expect(session()?.[watch.WEBSITE_PREPARATION_WATCH_FIELD]).toEqual(replacement);
    expect(email).not.toHaveBeenCalled();
  });
  it("ALERT-012 withdrawn consent during Slack failure cancels the email fallback", async () => {
    due("walkthrough-r1", quiet(0));
    const alert = vi.fn(async () => {
      (state.docs.get("inboundRequests/r1") as any).request.consent_attestation.withdrawn_at_iso = "2026-10-19T00:00:00Z";
      return { sent: false };
    });
    const email = vi.fn(async () => ({ sent: true }) as never);
    expect((await scanWebsitePreparationWatch({ store: sharedFakeFirestore as never, now: () => 3 * HOUR, alert, email })).alerted).toBe(0);
    expect(email).not.toHaveBeenCalled();
    expect(session()?.[watch.WEBSITE_PREPARATION_WATCH_FIELD]).toMatchObject({ due_at_ms: null, delivery: { state: "cancelled" } });
  });
  it("ALERT-013 a newer status observed immediately after a claim prevents sending it", async () => {
    due("walkthrough-r1", quiet(0));
    let replaced = false;
    const store = { ...sharedFakeFirestore, runTransaction: async (action: any) => {
      const result = await sharedFakeFirestore.runTransaction(action);
      if (!replaced) { replaced = true; due("walkthrough-r1", watch.nextWebsitePreparationWatch(null, stored("preparing"), 3 * HOUR)!); }
      return result;
    } };
    const alert = vi.fn(async () => ({ sent: true })), email = vi.fn(async () => ({ sent: true }) as never);
    expect((await scanWebsitePreparationWatch({ store: store as never, now: () => 3 * HOUR, alert, email })).alerted).toBe(0);
    expect(alert).not.toHaveBeenCalled(); expect(email).not.toHaveBeenCalled();
  });
  it("ALERT-014 every acknowledged capture is included in a bounded message batch", async () => {
    for (let index = 0; index < 45; index++) {
      const id = `walkthrough-batch${index}`;
      due(id, { ...quiet(0), capture_id: id });
    }
    const alert = vi.fn(async () => ({ sent: true })), email = vi.fn(async () => ({ sent: true }) as never);
    expect((await scanWebsitePreparationWatch({ store: sharedFakeFirestore as never, now: () => 3 * HOUR, alert, email })).alerted).toBe(45);
    expect(alert).toHaveBeenCalledTimes(5);
    const messages = alert.mock.calls.map(call => (call as unknown as [string, string])[1]);
    expect(messages.every(message => message.split("\n").length <= 11)).toBe(true);
    for (let index = 0; index < 45; index++) expect(messages.join("\n")).toContain(`walkthrough-batch${index} (request r1)`);
  });
  it("ALERT-015 a hung email leaves recoverable unknown delivery at the transport bound", async () => {
    vi.useFakeTimers();
    due("walkthrough-r1", quiet(0));
    const alert = vi.fn(async () => ({ sent: false })), email = vi.fn(() => new Promise<never>(() => {}));
    const pass = scanWebsitePreparationWatch({ store: sharedFakeFirestore as never, now: () => 3 * HOUR, alert, email });
    await vi.advanceTimersByTimeAsync(20_000);
    expect((await pass).alerted).toBe(0);
    expect(session()?.[watch.WEBSITE_PREPARATION_WATCH_FIELD]).toMatchObject({ delivery: { state: "pending", email_state: "unknown" } });
  });
});

describe("captures uploaded before the watch shipped", () => {
  const published = (captureId: string, requestId: string, extra: Record<string, unknown> = {}) =>
    state.docs.set(`captureUploadSessions/${captureId}`, { browser_pending_delivery: { state: "published", request_id: requestId,
      scene_id: `site-${requestId}`, capture_id: captureId, completed_at_iso: new Date(0).toISOString() }, ...extra });
  it("BACKFILL-001 dates a missing watch from the recorded upload, so a stuck capture alerts on the same pass", async () => {
    published("walkthrough-r1", "r1");
    published("walkthrough-r2", "r2", { website_preparation: { status: { state: "failed_retryable", attempt_count: 5 } } });
    published("walkthrough-r3", "r3", { website_preparation: { status: { state: "handed_off", attempt_count: 2 } } });
    published("walkthrough-r4", "r4", { [watch.WEBSITE_PREPARATION_WATCH_FIELD]: null });
    published("creator-capture-1", "r5");
    state.docs.set("captureUploadSessions/supplement-" + "f".repeat(40), { site_capture_bundle: {
      schema_version: "site_capture_bundle_session.v1", request_id: "r1", scene_id: "site-r1",
      capture_id: "supplement-" + "f".repeat(40), recorded_at_iso: new Date(0).toISOString() } });
    for (const id of ["r2", "r3", "r4", "r5"]) state.docs.set(`inboundRequests/${id}`, state.docs.get("inboundRequests/r1")!);
    expect(await backfillWebsitePreparationWatches({ store: sharedFakeFirestore as never, now: () => 30 * HOUR }))
      .toEqual({ scanned: 6, started: 3 });
    expect(session("walkthrough-r1")?.[watch.WEBSITE_PREPARATION_WATCH_FIELD]).toMatchObject({ kind: "awaiting_first_status",
      since_iso: new Date(0).toISOString(), due_at_ms: 2 * HOUR });
    expect(session("walkthrough-r2")?.[watch.WEBSITE_PREPARATION_WATCH_FIELD]).toMatchObject({ kind: "unchanged_state",
      state: "failed_retryable", attempt_count: 5, due_at_ms: 24 * HOUR });
    expect(session("walkthrough-r3")?.[watch.WEBSITE_PREPARATION_WATCH_FIELD]).toBeNull();
    expect(session("walkthrough-r4")?.[watch.WEBSITE_PREPARATION_WATCH_FIELD]).toBeNull();
    expect(session("creator-capture-1")?.[watch.WEBSITE_PREPARATION_WATCH_FIELD]).toBeUndefined();
    const alert = vi.fn(async () => ({ sent: true }));
    expect((await scanWebsitePreparationWatch({ store: sharedFakeFirestore as never, now: () => 30 * HOUR, alert,
      email: vi.fn(async () => ({}) as never) })).alerted).toBe(3);
    // Nothing is backfilled twice, so nothing alerts twice.
    expect((await backfillWebsitePreparationWatches({ store: sharedFakeFirestore as never, now: () => 31 * HOUR })).started).toBe(0);
    expect((await scanWebsitePreparationWatch({ store: sharedFakeFirestore as never, now: () => 31 * HOUR, alert,
      email: vi.fn(async () => ({}) as never) })).alerted).toBe(0);
  });
  it("BACKFILL-002 a recent legacy upload waits out its own bound", async () => {
    state.docs.set("captureUploadSessions/walkthrough-r1", { browser_pending_delivery: { state: "published", request_id: "r1",
      scene_id: "site-r1", capture_id: "walkthrough-r1", completed_at_iso: new Date(29 * HOUR).toISOString() } });
    await backfillWebsitePreparationWatches({ store: sharedFakeFirestore as never, now: () => 30 * HOUR });
    expect((await scanWebsitePreparationWatch({ store: sharedFakeFirestore as never, now: () => 30 * HOUR,
      alert: vi.fn(async () => ({ sent: true })), email: vi.fn(async () => ({}) as never) })).alerted).toBe(0);
    expect(session()?.[watch.WEBSITE_PREPARATION_WATCH_DUE_FIELD]).toBe(31 * HOUR);
  });
  it("BACKFILL-003 repairs an old pre-send alert marker without blindly sending email again", async () => {
    const legacy = watch.websitePreparationUploadWatchFields("r1", "site-r1", "walkthrough-r1", 0)
      [watch.WEBSITE_PREPARATION_WATCH_FIELD] as Record<string, unknown>;
    delete legacy.delivery;
    Object.assign(legacy, { due_at_ms: null, alerted_at_iso: new Date(3 * HOUR).toISOString() });
    published("walkthrough-r1", "r1", { [watch.WEBSITE_PREPARATION_WATCH_FIELD]: legacy, [watch.WEBSITE_PREPARATION_WATCH_DUE_FIELD]: null });
    expect((await backfillWebsitePreparationWatches({ store: sharedFakeFirestore as never, now: () => 30 * HOUR })).started).toBe(1);
    expect(session()?.[watch.WEBSITE_PREPARATION_WATCH_FIELD]).toMatchObject({ due_at_ms: 30 * HOUR, alerted_at_iso: null,
      delivery: { email_state: "unknown", legacy_alerted_at_iso: new Date(3 * HOUR).toISOString() } });
    const alert = vi.fn(async () => ({ sent: false })), email = vi.fn(async () => ({ sent: true }) as never);
    expect((await scanWebsitePreparationWatch({ store: sharedFakeFirestore as never, now: () => 30 * HOUR, alert, email })).alerted).toBe(0);
    expect(email).not.toHaveBeenCalled();
    alert.mockResolvedValue({ sent: true });
    const retryAt = session()?.[watch.WEBSITE_PREPARATION_WATCH_DUE_FIELD];
    expect((await scanWebsitePreparationWatch({ store: sharedFakeFirestore as never, now: () => retryAt, alert, email })).alerted).toBe(1);
    expect(email).not.toHaveBeenCalled();
  });
});

describe("scene progression after hand-off", () => {
  it.each([
    [{ state: "completed" }, "completed"],
    [{ state: "blocked", blocker: "consent_expired" }, "ended"],
    [{ state: "expired" }, "ended"],
    [{ state: "accepted", pipeline_status: { status: "blocked", phase: "scene_configuration_failed", blockers: ["x"] } }, "ended"],
    [{ state: "accepted", pipeline_status: { status: "blocked", phase: "preparation", blockers: ["retry_cap_exhausted"] } }, "ended"],
    [{ state: "accepted", pipeline_status: { status: "blocked", phase: "configuration_capacity", blockers: ["preallocation_capacity_not_recovered"] } }, "waiting"],
    [{ state: "accepted", pipeline_status: { status: "needs_input", phase: "source", blockers: [] } }, "waiting"],
    [{ state: "forward_blocked", blocker: "pipeline_transport_failed" }, "waiting"],
    [{ state: "accepted", pipeline_status: { status: "running", phase: "configuration" } }, "in_progress"],
    [{ state: "accepted", pipeline_status: { status: "running", phase: "terminal_reconciliation" } }, "testing"],
    [{ state: "completed", pipeline_status: { status: "completed", phase: "policy_canary_complete" } }, "testing"],
    [{ state: "completed", pipeline_status: { status: "completed", phase: "scene_prepared" } }, "completed"],
    [{ state: "unknown_future_state" }, null],
  ])("PROG-001 %j projects to %s", (record, expected) => {
    expect(projectWebsiteSceneProgression(record)?.state ?? null).toBe(expected);
  });
  it("PROG-002 reads only this capture's latest intake and never fails the page", async () => {
    state.docs.set("taskEvaluationSceneIntakes/scene-a", { website_request_id: "r1", source_session_id: "walkthrough-r1",
      created_at_iso: "2026-10-01T00:00:00Z", state: "blocked" });
    state.docs.set("taskEvaluationSceneIntakes/scene-b", { website_request_id: "r1", source_session_id: "walkthrough-r1",
      created_at_iso: "2026-10-02T00:00:00Z", state: "accepted", pipeline_status: { status: "running" } });
    state.docs.set("taskEvaluationSceneIntakes/scene-c", { website_request_id: "r1", source_session_id: "supplement-other",
      created_at_iso: "2026-10-03T00:00:00Z", state: "blocked" });
    expect(await loadWebsiteSceneProgression("r1", "walkthrough-r1")).toEqual({ state: "in_progress" });
    expect(await loadWebsiteSceneProgression("r2", "walkthrough-r2")).toBeNull();
  });
  it("PROG-005 a built scene is ready only once a test on its configured scene was accepted", async () => {
    const taskId = `website-${"0".repeat(20)}`;
    state.docs.set("taskEvaluationSceneIntakes/scene-a", { website_request_id: "r1", source_session_id: "walkthrough-r1",
      created_at_iso: "2026-10-02T00:00:00Z", state: "completed", pipeline_status: { status: "completed", phase: "scene_prepared" },
      request: { task: { task_id: taskId }, owner: { organization_id: "team-a" } } });
    const progression = () => loadWebsiteSceneProgression("r1", "walkthrough-r1");
    expect(await progression()).toEqual({ state: "completed" });
    // Another team's configured scene of the same task id is not this job's test.
    state.docs.set("taskEvaluationLaunches/launch-other", { configured_scene_offering: { task: { identity: { id: taskId } }, team_namespace: "team-b" } });
    state.docs.set("taskEvaluationPolicyRuns/run-other", { source_launch_id: "launch-other", state: "queued_in_pipeline" });
    expect(await progression()).toEqual({ state: "completed" });
    state.docs.set("taskEvaluationLaunches/launch-a", { configured_scene_offering: { task: { identity: { id: taskId } }, team_namespace: "team-a" } });
    // Stored but not accepted by the Pipeline, or ended unrun: not started.
    state.docs.set("taskEvaluationPolicyRuns/run-a", { source_launch_id: "launch-a", state: "forward_blocked" });
    expect(await progression()).toEqual({ state: "completed" });
    state.docs.set("taskEvaluationPolicyRuns/run-a", { source_launch_id: "launch-a", state: "forward_terminal_blocked",
      launch_forward: { status: "forwarded" } });
    expect(await progression()).toEqual({ state: "completed" });
    state.docs.set("taskEvaluationPolicyRuns/run-a", { source_launch_id: "launch-a", state: "queued_in_pipeline",
      launch_forward: { status: "forwarded" } });
    expect(await progression()).toEqual({ state: "testing" });
  });
  it("PROG-007 finds an accepted test past the first page of runs and the first 30 launches", async () => {
    const taskId = `website-${"1".repeat(20)}`;
    state.docs.set("taskEvaluationSceneIntakes/scene-a", { website_request_id: "r1", source_session_id: "walkthrough-r1",
      created_at_iso: "2026-10-02T00:00:00Z", state: "completed", pipeline_status: { status: "completed", phase: "scene_prepared" },
      request: { task: { task_id: taskId }, owner: { organization_id: "team-a" } } });
    for (let index = 0; index < 35; index += 1) state.docs.set(`taskEvaluationLaunches/launch-${String(index).padStart(3, "0")}`,
      { configured_scene_offering: { task: { identity: { id: taskId } }, team_namespace: "team-a" } });
    for (let index = 0; index < 150; index += 1) state.docs.set(`taskEvaluationPolicyRuns/run-${String(index).padStart(3, "0")}`,
      { source_launch_id: `launch-${String(index % 35).padStart(3, "0")}`, state: "failed" });
    expect(await loadWebsiteSceneProgression("r1", "walkthrough-r1")).toEqual({ state: "completed" });
    // The only accepted test is the last run, on the last launch.
    state.docs.set("taskEvaluationPolicyRuns/run-zzz", { source_launch_id: "launch-034", state: "running" });
    expect(await loadWebsiteSceneProgression("r1", "walkthrough-r1")).toEqual({ state: "testing" });
  });
  it("PROG-006 a policy run counts as started only once the Pipeline accepted it", () => {
    expect(policyTestAccepted({ state: "queued_for_preparation" })).toBe(false);
    expect(policyTestAccepted({ state: "forward_pending" })).toBe(false);
    expect(policyTestAccepted({ state: "running" })).toBe(true);
    expect(policyTestAccepted({ state: "queued_dispatch_blocked", launch_forward: { status: "forwarded" } })).toBe(true);
    expect(policyTestAccepted({ state: "failed", launch_forward: { status: "forwarded" } })).toBe(false);
    expect(policyTestAccepted(null)).toBe(false);
  });

  it("PROG-008 screening preparation is not execution, and only this intake's team can mark testing", async () => {
    state.docs.set("taskEvaluationSceneIntakes/scene-a", { website_request_id: "r1", source_session_id: "walkthrough-r1",
      created_at_iso: "2026-10-02T00:00:00Z", state: "completed", receipt: { intent_id: "intent-one" },
      pipeline_status: { status: "completed", phase: "scene_prepared" },
      request: { task: { task_id: "task-one" }, owner: { organization_id: "team-a" } } });
    const run = { run_kind: "beta_policy_screening", source_scene_intent_id: "intent-one", team_namespace: "team-a",
      state: "running", screening_execution_observed: false };
    state.docs.set("taskEvaluationPolicyRuns/screening-one", run);
    expect(await loadWebsiteSceneProgression("r1", "walkthrough-r1")).toEqual({ state: "completed" });
    state.docs.set("taskEvaluationPolicyRuns/screening-one", { ...run, team_namespace: "team-b", screening_execution_observed: true });
    expect(await loadWebsiteSceneProgression("r1", "walkthrough-r1")).toEqual({ state: "completed" });
    state.docs.set("taskEvaluationPolicyRuns/screening-one", { ...run, screening_execution_observed: true });
    expect(await loadWebsiteSceneProgression("r1", "walkthrough-r1")).toEqual({ state: "testing" });
  });
  it("PROG-003 alerts once per website scene that stopped after hand-off", async () => {
    state.docs.set("taskEvaluationSceneIntakes/scene-a", { website_request_id: "r1", source_session_id: "walkthrough-r1", state: "blocked" });
    state.docs.set("taskEvaluationSceneIntakes/scene-b", { website_request_id: "r1", source_session_id: "walkthrough-r1", state: "accepted",
      pipeline_status: { status: "blocked", phase: "preparation", blockers: ["retry_cap_exhausted"] } });
    state.docs.set("taskEvaluationSceneIntakes/scene-c", { owner_user_id: "team", state: "blocked" });
    state.docs.set("taskEvaluationSceneIntakes/scene-d", { website_request_id: "r1", state: "revoked" });
    const alert = vi.fn(async () => ({ sent: true })), email = vi.fn(async () => ({}) as never);
    expect(await scanEndedWebsiteSceneIntakes({ store: sharedFakeFirestore as never, alert, email })).toEqual({ ended: 2, alerted: 2 });
    // The rotating cursor finishes the batch, then wraps; no pass alerts the same intake again.
    expect((await scanEndedWebsiteSceneIntakes({ store: sharedFakeFirestore as never, alert, email })).alerted).toBe(0);
    expect(await scanEndedWebsiteSceneIntakes({ store: sharedFakeFirestore as never, alert, email })).toEqual({ ended: 2, alerted: 0 });
    expect(alert).toHaveBeenCalledTimes(1);
  });
  it("PROG-004 a failed scene alert remains pending across cursor wraps and retries after its bound", async () => {
    state.docs.set("taskEvaluationSceneIntakes/scene-a", { website_request_id: "r1", state: "blocked" });
    const alert = vi.fn(async () => ({ sent: false }));
    const email = vi.fn(async () => ({ sent: false, provider: null }) as never);
    let now = 3 * HOUR;
    const deps = { store: sharedFakeFirestore as never, now: () => now, alert, email };
    expect((await scanEndedWebsiteSceneIntakes(deps)).alerted).toBe(0);
    const marker = state.docs.get("opsWebsiteSceneIntakeAlerts/scene-a") as any;
    expect(marker).toMatchObject({ alerted_at_iso: null, next_attempt_at_ms: now + HOUR / 4,
      delivery: { state: "pending", attempts: 1, email_state: "not_sent" } });
    await scanEndedWebsiteSceneIntakes(deps);
    expect((await scanEndedWebsiteSceneIntakes(deps)).alerted).toBe(0);
    expect(alert).toHaveBeenCalledTimes(1);
    now = marker.next_attempt_at_ms;
    await scanEndedWebsiteSceneIntakes(deps);
    alert.mockResolvedValue({ sent: true });
    expect((await scanEndedWebsiteSceneIntakes(deps)).alerted).toBe(1);
    expect(state.docs.get("opsWebsiteSceneIntakeAlerts/scene-a")).toMatchObject({ next_attempt_at_ms: null,
      delivery: { state: "delivered", attempts: 2 } });
  });
  it("PROG-005 concurrent scene scans share one durable claim", async () => {
    state.docs.set("taskEvaluationSceneIntakes/scene-a", { website_request_id: "r1", state: "blocked" });
    const alert = vi.fn(async () => ({ sent: true })), email = vi.fn(async () => ({ sent: true }) as never);
    const deps = { store: sharedFakeFirestore as never, now: () => 3 * HOUR, alert, email };
    const results = await Promise.all([scanEndedWebsiteSceneIntakes(deps), scanEndedWebsiteSceneIntakes(deps)]);
    expect(results.reduce((sum, row) => sum + row.alerted, 0)).toBe(1);
    expect(alert).toHaveBeenCalledTimes(1);
  });
  it("PROG-006 a resumed scene cancels an in-flight fallback", async () => {
    state.docs.set("taskEvaluationSceneIntakes/scene-a", { website_request_id: "r1", state: "blocked" });
    const alert = vi.fn(async () => {
      state.docs.set("taskEvaluationSceneIntakes/scene-a", { website_request_id: "r1", state: "accepted", pipeline_status: { status: "running" } });
      return { sent: false };
    });
    const email = vi.fn(async () => ({ sent: true }) as never);
    expect((await scanEndedWebsiteSceneIntakes({ store: sharedFakeFirestore as never, now: () => 3 * HOUR, alert, email })).alerted).toBe(0);
    expect(email).not.toHaveBeenCalled();
    expect(state.docs.get("opsWebsiteSceneIntakeAlerts/scene-a")).toMatchObject({ next_attempt_at_ms: null, delivery: { state: "cancelled" } });
  });
  it("PROG-007 a legacy scene marker has unverified delivery and only retries Slack", async () => {
    state.docs.set("taskEvaluationSceneIntakes/scene-a", { website_request_id: "r1", state: "blocked" });
    state.docs.set("opsWebsiteSceneIntakeAlerts/scene-a", { intake_id: "scene-a", request_id: "r1", alerted_at_iso: "2026-10-06T00:00:00Z" });
    const alert = vi.fn(async () => ({ sent: false })), email = vi.fn(async () => ({ sent: true }) as never);
    expect((await scanEndedWebsiteSceneIntakes({ store: sharedFakeFirestore as never, now: () => 3 * HOUR, alert, email })).alerted).toBe(0);
    expect(alert).toHaveBeenCalledTimes(1); expect(email).not.toHaveBeenCalled();
    expect(state.docs.get("opsWebsiteSceneIntakeAlerts/scene-a")).toMatchObject({ delivery: { state: "pending", email_state: "unknown",
      legacy_alerted_at_iso: "2026-10-06T00:00:00Z" } });
  });
  it("PROG-008 unknown delivery metadata is preserved without inferring permission to resend", async () => {
    state.docs.set("taskEvaluationSceneIntakes/scene-a", { website_request_id: "r1", state: "blocked" });
    const existing = { intake_id: "scene-a", request_id: "r1", delivery: { schema_version: "future", state: "unknown" } };
    state.docs.set("opsWebsiteSceneIntakeAlerts/scene-a", existing);
    const alert = vi.fn(async () => ({ sent: true })), email = vi.fn(async () => ({ sent: true }) as never);
    expect((await scanEndedWebsiteSceneIntakes({ store: sharedFakeFirestore as never, now: () => 3 * HOUR, alert, email })).alerted).toBe(0);
    expect(alert).not.toHaveBeenCalled(); expect(email).not.toHaveBeenCalled();
    expect(state.docs.get("opsWebsiteSceneIntakeAlerts/scene-a")).toEqual(existing);
  });
});
