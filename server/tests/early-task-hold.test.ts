// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";
import { crossRuntimeArtifactDigest, crossRuntimeDigest } from "../utils/crossRuntimeCanonical";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/field-encryption", () => ({ decryptFieldValue: vi.fn(async (value: string) => value.replace(/^encrypted:/, "")) }));
// The preparation event's own currency check reads the Pipeline ledger; it is covered in website-preparation-status.
vi.mock("../utils/taskLifecycleNotificationAuthority", () => ({ taskLifecycleNotificationIsCurrent: vi.fn(async () => true) }));
const send = vi.hoisted(() => vi.fn());
vi.mock("../utils/email", () => ({ sendEmail: send }));

const { projectAtlasPreparationOutcome, EARLY_TASK_HOLD_SENTENCES, RECAPTURE_SENTENCES } = await import("../utils/taskPreparationOutcome");
const { selectWebsiteAtlasPreview } = await import("../utils/websiteAtlasPreview");
const { projectTaskStatus } = await import("../utils/taskStatusProjection");
const { enqueueTaskLifecycleNotification } = await import("../utils/taskLifecycleNotifications");
const { drainPendingWebsitePreparationNotifications, mergeWebsitePreparationStatus, EARLY_HOLD_PREVIEW_WAIT_MS } =
  await import("../utils/websitePreparationStatus");
type Stored = import("../utils/websitePreparationStatus").StoredWebsitePreparation;
type Receipt = import("../utils/websitePreparationStatus").WebsitePreparationReceipt;

const EVENT = `sha256:${"c".repeat(64)}`;
function atlas(reason: string, state = "needs_input") {
  const value = { schema_version: "website_atlas_preview.v1", capture_id: "walkthrough-req-1", revision: 3, state, reason,
    updated_at_epoch: 1793109960, bundle: null, splat_available: false, mesh_available: false,
    claim_ceiling: "development_only", scale_status: "unscaled_provider_world_units" };
  return { ...value, preview_digest: crossRuntimeArtifactDigest(value, "preview_digest") };
}
const base = { briefDrafted: true, briefConfirmed: true, hasStoredCapture: true, stage: null, coversScene: null,
  missingViews: [], supplementWouldFinish: false };

/** The exact sentence for each Pipeline early-hold reason (website_early_task_hold.EARLY_CODES). */
const EXPECTED: Record<string, string> = {
  website_native_task_profile_preparation_required: "The simulation is held: we can't simulate this kind of job yet.",
  website_task_family_runtime_preparation_required:
    "The simulation is held: we can't simulate this kind of job yet, because the simulator it needs isn't set up on our side.",
  website_task_operation_coverage_unresolved: "The simulation is held: we can't simulate every step this job asks for yet.",
};

beforeEach(() => {
  sharedFakeFirestoreState.docs.clear();
  send.mockReset();
});

describe("the Pipeline's early task hold", () => {
  it("covers exactly the three early-hold reasons", () => {
    expect(Object.keys(EARLY_TASK_HOLD_SENTENCES).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  for (const [reason, sentence] of Object.entries(EXPECTED)) {
    it(`shows ${reason} as held, in one plain sentence, never as a processing failure`, () => {
      const preview = atlas(reason);
      const outcome = projectAtlasPreparationOutcome(selectWebsiteAtlasPreview(
        { website_atlas_previews: { [preview.capture_id]: preview } }, preview.capture_id));
      expect(outcome).toMatchObject({ category: "held", basis: "simulation_not_available", title: sentence, actionOwner: "none",
        evidence: [{ digest: preview.preview_digest }] });
      const status = projectTaskStatus({ ...base, preparationOutcome: outcome });
      expect(status).toMatchObject({ decision: "held", headline: sentence, operatorAction: null });
      const text = JSON.stringify(status);
      expect(text).not.toMatch(/could not finish processing|processing step stopped/i);
      expect(text).not.toMatch(/website_|_required|_unresolved/);
      // No rerun, date or follow-up the code does not deliver.
      expect(text).not.toMatch(/we will|we'll|email you|again once|rerun|run it again|by \w+day/i);
    });
  }

  it("keeps the recording sentence true when the recording is not stored", () => {
    const outcome = projectAtlasPreparationOutcome(selectWebsiteAtlasPreview(
      { website_atlas_previews: { "walkthrough-req-1": atlas("website_native_task_profile_preparation_required") } }, "walkthrough-req-1"));
    expect(projectTaskStatus({ ...base, hasStoredCapture: false, preparationOutcome: outcome }).outcome!.nextStep)
      .toBe("Nothing is needed from you. Keep your original recording; you do not need to send it again.");
  });

  it("leaves other needs-input reasons where they were", () => {
    const preview = atlas("website_atlas_api_key_missing");
    expect(projectAtlasPreparationOutcome(selectWebsiteAtlasPreview(
      { website_atlas_previews: { [preview.capture_id]: preview } }, preview.capture_id))!.category).toBe("processing_failure");
    const failed = atlas("website_native_task_profile_preparation_required", "failed");
    expect(projectAtlasPreparationOutcome(selectWebsiteAtlasPreview(
      { website_atlas_previews: { [failed.capture_id]: failed } }, failed.capture_id))!.category).toBe("processing_failure");
  });

  for (const [reason, sentence] of Object.entries(EXPECTED)) {
    it(`sends the held email for ${reason} in place of needs-attention, once, with the page's sentence`, async () => {
      const preview = atlas(reason);
      sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { contact: { email: "encrypted:owner@example.com" },
        website_atlas_previews: { [preview.capture_id]: preview } });
      const intent = { requestId: "req-1", captureId: "walkthrough-req-1", eventId: EVENT,
        correlationId: "bp-prep-0123456789abcdef", milestone: "preparation_needs_attention" as const, terminalReason: null };
      expect((await enqueueTaskLifecycleNotification(intent)).enqueued).toBe(true);
      expect((await enqueueTaskLifecycleNotification(intent)).enqueued).toBe(false);
      const rows = [...sharedFakeFirestoreState.docs.entries()].filter(([key]) => key.startsWith("captureOutbox/"));
      expect(rows).toHaveLength(1);
      const row = rows[0][1] as Record<string, string>;
      expect(rows[0][0]).toBe(`captureOutbox/req-1:preparation_needs_attention:${EVENT.replace(":", "_")}`);
      expect(row.subject).toBe("The simulation of your job is on hold");
      expect(row.body.startsWith(`${sentence} No robot was tested in a simulation of your job, and this is not a finding that a robot could not do it. Your first look stays on your job page.`)).toBe(true);
      expect(row.body).toMatch(/Reference: bp-prep-0123456789abcdef\./);
      expect(row.body).not.toMatch(/needs our team's review|could not finish|website_|we'll|email you|rerun/i);
      expect(send).not.toHaveBeenCalled();
    });
  }

  // Review, 2026-11-12: only the Atlas preview says the job has no sentence, before any preparation status arrived.
  it("asks the site for its sentence and queues no needs-attention email when only the preview says the job is not named", async () => {
    const { jobAwaitsItsSentence, TASK_NOT_NAMED_SENTENCES } = await import("../utils/taskPreparationOutcome");
    const preview = atlas("website_task_not_named");
    const record = { contact: { email: "encrypted:owner@example.com" }, website_atlas_previews: { [preview.capture_id]: preview } };
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", record);
    // The page: the brief route asks for the sentence (`taskStatementNeeded`), and the card says why, the site's step.
    expect(jobAwaitsItsSentence(record, "walkthrough-req-1")).toBe(true);
    expect(jobAwaitsItsSentence(record, "walkthrough-other")).toBe(false);
    const outcome = projectAtlasPreparationOutcome(selectWebsiteAtlasPreview(record, preview.capture_id));
    expect(outcome).toMatchObject({ title: TASK_NOT_NAMED_SENTENCES.title, actionOwner: "site" });
    expect(JSON.stringify(projectTaskStatus({ ...base, preparationOutcome: outcome }))).not.toMatch(/needs our team's review|could not finish/i);
    // No needs-attention email: the notice is not queued.
    expect(await enqueueTaskLifecycleNotification({ requestId: "req-1", captureId: "walkthrough-req-1", eventId: EVENT,
      milestone: "preparation_needs_attention" })).toEqual({ enqueued: false, reason: "awaiting_site_sentence" });
    expect([...sharedFakeFirestoreState.docs.keys()].filter(key => key.startsWith("captureOutbox/"))).toEqual([]);
    expect(send).not.toHaveBeenCalled();
  });

  it("keeps the needs-attention email for a job that is not early-held and asks nothing of the site", async () => {
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { contact: { email: "encrypted:owner@example.com" },
      website_atlas_previews: { "walkthrough-req-1": atlas("atlas_scene_planner_abstained") } });
    await enqueueTaskLifecycleNotification({ requestId: "req-1", captureId: "walkthrough-req-1", eventId: EVENT,
      milestone: "preparation_needs_attention" });
    const row = [...sharedFakeFirestoreState.docs.entries()].find(([key]) => key.startsWith("captureOutbox/"))![1] as Record<string, string>;
    expect(row.subject).toBe("An update on your Blueprint job preparation");
    expect(row.body).toMatch(/needs our team's review/);
    expect(send).not.toHaveBeenCalled();
  });

  it.each(Object.keys(RECAPTURE_SENTENCES))("says what the job page says for the new-video ask %s, once", async reason => {
    const sentences = RECAPTURE_SENTENCES[reason as keyof typeof RECAPTURE_SENTENCES];
    const preparation = reason.startsWith("website_");
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { contact: { email: "encrypted:owner@example.com" },
      website_atlas_previews: { "walkthrough-req-1": atlas(preparation ? "atlas_scene_planner_abstained" : reason) } });
    if (preparation) sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { contact: { email: "encrypted:owner@example.com" } });
    const notice = { requestId: "req-1", captureId: "walkthrough-req-1", eventId: EVENT,
      milestone: "preparation_needs_attention" as const, ...(preparation ? { recaptureReason: reason as never } : {}) };
    await enqueueTaskLifecycleNotification(notice);
    await enqueueTaskLifecycleNotification(notice);
    const rows = [...sharedFakeFirestoreState.docs.entries()].filter(([key]) => key.startsWith("captureOutbox/"));
    expect(rows).toHaveLength(1); // the same outbox key: a job already told is not told again
    const row = rows[0][1] as Record<string, string>;
    expect(row.subject).toBe("We need a new video to build the simulation of your site");
    expect(row.body.startsWith(`${sentences.reason} ${sentences.nextStep}`)).toBe(true);
    expect(row.body).not.toMatch(/needs our team's review|Nothing more is needed from you|website_|atlas_/);
    expect(send).not.toHaveBeenCalled();
  });
});

/** The Pipeline delivers the Atlas preview apart from the preparation status, with backoff up to an hour. */
describe("an early hold whose preview arrives after its preparation status", () => {
  const selector = { request_id: "req-1", scene_id: "site-req-1", capture_id: "walkthrough-req-1",
    completion_marker_generation: "1", producer_delivery_key: `sha256:${"a".repeat(64)}`,
    source_payload_sha256: "b".repeat(64), task_context_digest: `sha256:${"d".repeat(64)}` };
  function status(state: "awaiting_inputs" | "failed_retryable"): Receipt {
    const value = { ...selector, schema_version: "website_preparation_status.v1" as const, state,
      code: state === "awaiting_inputs" ? "preparation_inputs_pending" : "preparation_retryable_failure",
      attempt_count: 1, revision: 2, correlation_id: crossRuntimeDigest({ selector, state }) };
    return { ...value, status_digest: crossRuntimeArtifactDigest(value, "status_digest") } as Receipt;
  }
  const T0 = Date.parse("2026-11-09T12:00:00Z");
  let stored: Stored | null = null;
  let current: Receipt;
  const deps = {
    async readLedger() { return current; }, async verifyCurrent() { return { fingerprint: "f", owner: "o" }; },
    async readStored() { return stored; }, async commit() {},
    // The owed time the production store keeps beside the row (`website_preparation_notice_owed`).
    async pending() { return stored?.notification?.state === "pending" ? [{ ...stored, owedSinceMs: T0 }] : []; },
    async acknowledge(_capture: string, eventId: string) {
      if (stored?.notification?.eventId === eventId) stored = { ...stored, notification: { ...stored.notification, state: "enqueued" } };
    },
    async findEvent() { return stored; },
  };
  // The outbox tick's own mapping (reconcileWebsitePreparationNotifications).
  const tick = () => drainPendingWebsitePreparationNotifications(async intent => {
    const result = await enqueueTaskLifecycleNotification({ ...intent, milestone: intent.milestone });
    if (result.enqueued) return "enqueued";
    const key = `captureOutbox/${intent.requestId}:${intent.milestone}:${intent.eventId.replace(/[^A-Za-z0-9._-]/g, "_")}`;
    return sharedFakeFirestoreState.docs.has(key) ? "duplicate" : "unavailable";
  }, deps);
  const outbox = () => [...sharedFakeFirestoreState.docs.entries()].filter(([key]) => key.startsWith("captureOutbox/"))
    .map(([, row]) => row as Record<string, string>);
  const request = (previews: Record<string, unknown> = {}) => sharedFakeFirestoreState.docs.set("inboundRequests/req-1",
    { contact: { email: "encrypted:owner@example.com" }, website_atlas_previews: previews });

  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(T0); });
  afterEach(() => { vi.useRealTimers(); });
  function owe(state: "awaiting_inputs" | "failed_retryable") {
    current = status(state);
    stored = mergeWebsitePreparationStatus(null, selector, current);
    expect(stored.notification).toEqual({ eventId: expect.any(String), state: "pending" });
  }

  it("status first, preview later: exactly one email, and it is the held one", async () => {
    owe("awaiting_inputs");
    request();
    vi.setSystemTime(T0 + 60_000);
    expect(await tick()).toEqual({ enqueued: 0, pending: 1 });
    // A preview still processing says nothing about the hold yet either.
    request({ "walkthrough-req-1": atlas("website_task_family_runtime_preparation_required", "processing") });
    vi.setSystemTime(T0 + 30 * 60_000);
    expect(await tick()).toEqual({ enqueued: 0, pending: 1 });
    expect(outbox()).toHaveLength(0);
    request({ "walkthrough-req-1": atlas("website_task_family_runtime_preparation_required") });
    vi.setSystemTime(T0 + 61 * 60_000);
    expect(await tick()).toEqual({ enqueued: 1, pending: 0 });
    expect(await tick()).toEqual({ enqueued: 0, pending: 0 });
    expect(outbox()).toHaveLength(1);
    expect(outbox()[0].subject).toBe("The simulation of your job is on hold");
    expect(outbox()[0].body.startsWith(EXPECTED.website_task_family_runtime_preparation_required)).toBe(true);
    expect(send).not.toHaveBeenCalled();
  });

  it("sends the generic notice once the bounded wait passes with no preview", async () => {
    owe("awaiting_inputs");
    request();
    vi.setSystemTime(T0 + EARLY_HOLD_PREVIEW_WAIT_MS - 1);
    expect(await tick()).toEqual({ enqueued: 0, pending: 1 });
    vi.setSystemTime(T0 + EARLY_HOLD_PREVIEW_WAIT_MS);
    expect(await tick()).toEqual({ enqueued: 1, pending: 0 });
    expect(outbox().map(row => row.subject)).toEqual(["An update on your Blueprint job preparation"]);
  });

  it("does not wait when the preview already settled otherwise, or the status cannot be an early hold", async () => {
    owe("awaiting_inputs");
    request({ "walkthrough-req-1": atlas("atlas_task_and_scene_coverage_gap") });
    expect(await tick()).toEqual({ enqueued: 1, pending: 0 });
    sharedFakeFirestoreState.docs.clear();
    owe("failed_retryable");
    request();
    expect(await tick()).toEqual({ enqueued: 1, pending: 0 });
    expect(outbox().map(row => row.subject)).toEqual(["An update on your Blueprint job preparation"]);
  });
});
