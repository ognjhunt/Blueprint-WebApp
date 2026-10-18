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
const { scanWebsitePreparationWatch, scanEndedWebsiteSceneIntakes } = await import("../utils/websitePreparationOpsAlerts");
const { projectWebsiteSceneProgression, loadWebsiteSceneProgression } = await import("../utils/websiteSceneProgression");
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
afterEach(() => { vi.unstubAllEnvs(); });

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
  it("ALERT-001 alerts once per due watch, by Slack and one ops email, with ids and links only", async () => {
    due("walkthrough-r1", quiet(0));
    const alert = vi.fn(async () => undefined), email = vi.fn(async () => ({ sent: true }) as never);
    expect(await scanWebsitePreparationWatch({ store: sharedFakeFirestore as never, now: () => 3 * HOUR, alert, email }))
      .toEqual({ due: 1, alerted: 1 });
    expect(alert).toHaveBeenCalledTimes(1); expect(email).toHaveBeenCalledTimes(1);
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
    const alert = vi.fn(async () => undefined), email = vi.fn(async () => ({ sent: true }) as never);
    expect((await scanWebsitePreparationWatch({ store: sharedFakeFirestore as never, now: () => HOUR, alert, email })).alerted).toBe(0);
    const record = state.docs.get("inboundRequests/r1") as any;
    record.request.consent_attestation.withdrawn_at_iso = "2026-10-10T00:00:00.000Z";
    expect((await scanWebsitePreparationWatch({ store: sharedFakeFirestore as never, now: () => 3 * HOUR, alert, email })).alerted).toBe(0);
    expect(session()?.[watch.WEBSITE_PREPARATION_WATCH_DUE_FIELD]).toBeNull();
    expect(alert).not.toHaveBeenCalled();
  });
  it("ALERT-003 an ending alerts at once and names its reason", async () => {
    due("walkthrough-r1", watch.nextWebsitePreparationWatch(null, stored("failed_terminal", 5), 1_000) as never);
    const alert = vi.fn(async () => undefined);
    await scanWebsitePreparationWatch({ store: sharedFakeFirestore as never, now: () => 1_000, alert, email: vi.fn(async () => ({}) as never) });
    expect((alert.mock.calls[0] as unknown as [string, string])[1]).toContain("ended for good (budget_exhausted)");
  });
  it("ALERT-004 an unreadable watch leaves the index without an alert", async () => {
    state.docs.set("captureUploadSessions/walkthrough-r1", { [watch.WEBSITE_PREPARATION_WATCH_FIELD]: { kind: "forged" },
      [watch.WEBSITE_PREPARATION_WATCH_DUE_FIELD]: 0 });
    const alert = vi.fn(async () => undefined);
    expect(await scanWebsitePreparationWatch({ store: sharedFakeFirestore as never, now: () => 1, alert, email: vi.fn(async () => ({}) as never) }))
      .toEqual({ due: 1, alerted: 0 });
    expect(session()?.[watch.WEBSITE_PREPARATION_WATCH_DUE_FIELD]).toBeNull();
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
  it("PROG-003 alerts once per website scene that stopped after hand-off", async () => {
    state.docs.set("taskEvaluationSceneIntakes/scene-a", { website_request_id: "r1", source_session_id: "walkthrough-r1", state: "blocked" });
    state.docs.set("taskEvaluationSceneIntakes/scene-b", { website_request_id: "r1", source_session_id: "walkthrough-r1", state: "accepted",
      pipeline_status: { status: "blocked", phase: "preparation", blockers: ["retry_cap_exhausted"] } });
    state.docs.set("taskEvaluationSceneIntakes/scene-c", { owner_user_id: "team", state: "blocked" });
    state.docs.set("taskEvaluationSceneIntakes/scene-d", { website_request_id: "r1", state: "revoked" });
    const alert = vi.fn(async () => undefined), email = vi.fn(async () => ({}) as never);
    expect(await scanEndedWebsiteSceneIntakes({ store: sharedFakeFirestore as never, alert, email })).toEqual({ ended: 2, alerted: 2 });
    // The rotating cursor finishes the batch, then wraps; no pass alerts the same intake again.
    expect((await scanEndedWebsiteSceneIntakes({ store: sharedFakeFirestore as never, alert, email })).alerted).toBe(0);
    expect(await scanEndedWebsiteSceneIntakes({ store: sharedFakeFirestore as never, alert, email })).toEqual({ ended: 2, alerted: 0 });
    expect(alert).toHaveBeenCalledTimes(1);
  });
});
