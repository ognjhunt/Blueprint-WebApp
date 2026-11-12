// @vitest-environment node
/**
 * Review, 2026-11-12: ONE decision says a job waits for its sentence (`jobWaitsForItsSentence`), from the same signals
 * and the same capture identity (`siteWalkthroughIdentity`, honouring `active_capture_id`), for the job outlook, the
 * page's naming form (`taskStatementNeeded`), and the "needs attention" email it suppresses. The two states that broke:
 * a v7 status with the reason and no Atlas preview, and a re-filmed job.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";

const seam = vi.hoisted(() => ({ notNamed: new Set<string>(), send: vi.fn() }));
vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/email", () => ({ sendEmail: seam.send }));
vi.mock("../utils/field-encryption", () => ({ decryptFieldValue: async (value: string) => value }));
// The Pipeline's verified status for a capture: `website_task_not_named` only for the captures in `seam.notNamed`.
vi.mock("../utils/websitePreparationStatus", () => ({
  loadCurrentWebsitePreparationStatus: async (_requestId: string, captureId: string) => seam.notNamed.has(captureId)
    ? { state: "awaiting_inputs", correlationId: null, taskNotNamed: true } : { state: "preparing", correlationId: null },
  canNotifyCurrentWebsitePreparationIssue: async () => true,
  drainPendingWebsitePreparationNotifications: async () => ({ enqueued: 0, pending: 0 }),
}));
const { jobWaitsForItsSentence: decide, loadJobWaitsForItsSentence } = await import("../utils/jobSentenceWait");
const { isPlaceholderSummary } = await import("../utils/siteTaskBrief");
const jobWaitsForItsSentence = (input: { requestId: string; record: Record<string, any>; preparationTaskNotNamed?: boolean;
  brief?: { summary?: string | null; confirmedAtIso?: string | null } | null }) =>
  decide({ brief: null, ...input, isPlaceholder: isPlaceholderSummary });
const { enqueueTaskLifecycleNotification } = await import("../utils/taskLifecycleNotifications");
const { jobOutlook } = await import("../utils/jobOutlook");

const REFILMED = `supplement-${"a".repeat(40)}`;
function atlas(captureId: string, reason = "website_task_not_named") {
  const value = { schema_version: "website_atlas_preview.v1", capture_id: captureId, revision: 3, state: "needs_input", reason,
    updated_at_epoch: 1793109960, bundle: null, splat_available: false, mesh_available: false,
    claim_ceiling: "development_only", scale_status: "unscaled_provider_world_units" };
  return { ...value, preview_digest: crossRuntimeArtifactDigest(value, "preview_digest") };
}
const EVENT = `sha256:${"e".repeat(64)}`;
const job = (extra: Record<string, unknown> = {}) => ({ contact: { email: "encrypted:owner@example.com" }, ...extra });
const outlookFor = (awaitsSiteSentence: boolean) => jobOutlook({ consentRevoked: false, closedByOwner: false,
  answer: { state: "ready", unsized: false, reason: null }, windowEnded: false, noGrantEnded: false,
  preparation: { state: "awaiting_inputs", geometryOnlyEnd: false }, scene: null, proof: null, awaitsSiteSentence });
const needsAttention = () => enqueueTaskLifecycleNotification({ requestId: "req-1", captureId: "walkthrough-req-1", eventId: EVENT,
  milestone: "preparation_needs_attention" });

describe("a job waiting for its sentence: one decision", () => {
  beforeEach(() => { sharedFakeFirestoreState.docs.clear(); seam.notNamed.clear(); seam.send.mockReset(); });

  it("a v7 status with the reason and no preview: the outlook, the form and the email all say the site's step", async () => {
    const record = job();
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", record);
    sharedFakeFirestoreState.docs.set("captureUploadSessions/walkthrough-req-1", { website_preparation: { status: {} } });
    seam.notNamed.add("walkthrough-req-1");
    expect(jobWaitsForItsSentence({ requestId: "req-1", record, preparationTaskNotNamed: true })).toBe(true);
    // The form flag reads it the same way.
    expect(await loadJobWaitsForItsSentence("req-1", record)).toBe(true);
    expect(outlookFor(true)).toMatchObject({ phase: "waiting_on_site", reason: "task_not_named" });
    expect(await needsAttention()).toEqual({ enqueued: false, reason: "awaiting_site_sentence" });
    expect([...sharedFakeFirestoreState.docs.keys()].filter(key => key.startsWith("captureOutbox/"))).toEqual([]);
    // Once the site confirms its sentence, nothing waits on it.
    expect(await loadJobWaitsForItsSentence("req-1", { ...record, site_task_brief_confirmed_at: "2026-11-12T00:00:00Z" })).toBe(false);
  });

  // Review, 2026-11-12: the wait ends when the site has answered, even before it confirms its brief.
  it("a job the site has named (not confirmed) no longer waits: no ask, no form, no email", async () => {
    const record = job({ website_atlas_previews: { "walkthrough-req-1": atlas("walkthrough-req-1") } });
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", record);
    expect(await loadJobWaitsForItsSentence("req-1", record)).toBe(true);
    sharedFakeFirestoreState.docs.set("siteTaskBriefs/req-1", { summary: "Move the boxes onto the shelf.", confirmedAtIso: null });
    expect(await loadJobWaitsForItsSentence("req-1", record)).toBe(false);
    expect(jobWaitsForItsSentence({ requestId: "req-1", record, brief: { summary: "Move the boxes onto the shelf." } })).toBe(false);
    expect(jobWaitsForItsSentence({ requestId: "req-1", record, brief: { summary: "" } })).toBe(true);
    // Still no "needs attention" email: the Pipeline holds the job for a sentence the site has now given.
    expect(await needsAttention()).toEqual({ enqueued: false, reason: "awaiting_site_sentence" });
  });
  it("a re-filmed job reads its current capture, never the first one", async () => {
    // The first capture's preview said the job was not named; the site filmed again, and the new one has no such wait.
    const stale = job({ active_capture_id: REFILMED, website_atlas_previews: { "walkthrough-req-1": atlas("walkthrough-req-1") } });
    expect(jobWaitsForItsSentence({ requestId: "req-1", record: stale })).toBe(false);
    expect(await loadJobWaitsForItsSentence("req-1", stale)).toBe(false);
    // The new capture's own preview says it: the wait is the new capture's.
    const current = job({ active_capture_id: REFILMED, website_atlas_previews: { [REFILMED]: atlas(REFILMED) } });
    expect(jobWaitsForItsSentence({ requestId: "req-1", record: current })).toBe(true);
    expect(await loadJobWaitsForItsSentence("req-1", current)).toBe(true);
    // And the new capture's own status says it, with no preview at all.
    const statusOnly = job({ active_capture_id: REFILMED });
    sharedFakeFirestoreState.docs.set(`captureUploadSessions/${REFILMED}`, { website_preparation: { status: {} } });
    seam.notNamed.add(REFILMED);
    expect(await loadJobWaitsForItsSentence("req-1", statusOnly)).toBe(true);
    seam.notNamed.clear(); seam.notNamed.add("walkthrough-req-1");
    sharedFakeFirestoreState.docs.set("captureUploadSessions/walkthrough-req-1", { website_preparation: { status: {} } });
    expect(await loadJobWaitsForItsSentence("req-1", statusOnly)).toBe(false);
  });
});

describe("the page once the site has named its job", () => {
  it("says we have the sentence and are starting, with no ask", async () => {
    const { projectTaskStatus } = await import("../utils/taskStatusProjection");
    const { taskNotNamedOutcome } = await import("../utils/taskPreparationOutcome");
    const base = { briefDrafted: true, briefConfirmed: false, hasStoredCapture: true, stage: null, coversScene: null,
      missingViews: [], supplementWouldFinish: false, preparationOutcome: taskNotNamedOutcome(`sha256:${"a".repeat(64)}`) };
    const asking = projectTaskStatus(base as never);
    expect(asking).toMatchObject({ headline: "Tell us the job in one sentence" });
    const named = projectTaskStatus({ ...base, siteNamedTask: true } as never);
    expect(named.headline).toBe("We have your job's sentence");
    expect(named.outcome).toMatchObject({ actionOwner: "blueprint",
      reason: "We have the sentence you gave us, and we are starting to build the simulation of your job.",
      nextStep: "Nothing more is needed from you." });
    expect(named.operatorAction).toBeNull();
  });
});
