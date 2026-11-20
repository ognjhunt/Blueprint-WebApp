// @vitest-environment node
/**
 * "Your job needs something from you" (owner, 2026-11-19): the one site email for a job that cannot continue without
 * the site. Once per distinct ask; never for status or progress, never after a withdrawal, never for an ending (the
 * $40 spending cap's `spending_cap_reached` included).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore, storageAdmin: null };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/field-encryption", () => ({ decryptFieldValue: vi.fn(async (value: string) => String(value ?? "").replace(/^encrypted:/, "")) }));
const seams = vi.hoisted(() => ({ send: vi.fn(), scene: null as unknown,
  // The verified preparation status, as `loadCurrentWebsitePreparationStatus` gives it to the job page.
  status: { state: "unavailable", correlationId: null } as Record<string, unknown> }));
vi.mock("../utils/email", () => ({ sendEmail: seams.send }));
vi.mock("../utils/websiteSceneProgression", async importOriginal => ({ ...await importOriginal<object>(),
  readWebsiteSceneProgression: vi.fn(async () => seams.scene) }));
vi.mock("../utils/websitePreparationStatus", async importOriginal => ({ ...await importOriginal<object>(),
  loadCurrentWebsitePreparationStatus: vi.fn(async () => seams.status) }));

const { notifySiteActionNeeded } = await import("../utils/siteActionNeeded");
const { deliverOutbox } = await import("../utils/captureOutbox");
const { newWebsiteLargeVideoAsk, WEBSITE_LARGE_VIDEO_ASK_FIELD } = await import("../utils/websiteJobWindowEnding");
const { LARGE_VIDEO_RECAPTURE_SENTENCES, RECAPTURE_SENTENCES, RECAPTURE_TITLE, TASK_NOT_NAMED_REASON, TASK_NOT_NAMED_SENTENCES,
  taskNotNamedOutcome } = await import("../utils/taskPreparationOutcome");

const ID = "req-1";
const CAPTURE = `walkthrough-${ID}`;
const JOB = `inboundRequests/${ID}`;
const job = (extra: Record<string, unknown> = {}) => ({ requestId: ID, contact: { email: "encrypted:owner@site.example" },
  request: { buyerType: "site_operator", consent_attestation: { granted: true, statement_version: "2026-11-12.v4",
    recorded_at_iso: "2026-11-12T00:00:00Z" } }, ...extra });
const largeVideo = (object = "raw/video.mov") => ({ [WEBSITE_LARGE_VIDEO_ASK_FIELD]: newWebsiteLargeVideoAsk({ request_id: ID,
  capture_id: CAPTURE, raw_video_object: object, raw_video_size_bytes: 1_500_000_000, recorded_at_iso: "2026-11-19T00:00:00Z" }) });
/** A stored preparation row (retained), and what its verified read gives the page now. */
const status = (outcome: Record<string, unknown> | null, state_ = "awaiting_inputs", verified = true) => {
  state.docs.set(`captureUploadSessions/${CAPTURE}`, { website_preparation: { selector: { request_id: ID, capture_id: CAPTURE },
    status: { state: state_, outcome: outcome && { reason: "retained" } }, notification: null } });
  seams.status = verified ? { state: state_, correlationId: null, outcome } : { state: "unavailable", correlationId: null };
};
const newVideo = (reason: keyof typeof RECAPTURE_SENTENCES) => ({ category: "insufficient_evidence", basis: "missing_evidence",
  title: RECAPTURE_TITLE, reason: RECAPTURE_SENTENCES[reason].reason, scope: "x", nextStep: RECAPTURE_SENTENCES[reason].nextStep,
  actionOwner: "site", evidence: [{ label: "Video coverage finding", digest: `sha256:${"e".repeat(64)}` }] });
const rows = () => [...state.docs.entries()].filter(([key]) => key.startsWith("captureOutbox/") && !key.includes("/deliveryReceipts/")) as
  Array<[string, Record<string, any>]>;

beforeEach(() => {
  state.docs.clear();
  seams.scene = null;
  seams.status = { state: "unavailable", correlationId: null };
  seams.send.mockReset().mockResolvedValue({ sent: true, provider: "resend", messageId: "accepted" });
});

describe("a job that cannot continue without the site", () => {
  it("sends one email for a blocking ask (a video too large to process), however often it is asked", async () => {
    state.docs.set(JOB, job(largeVideo()));
    expect(await notifySiteActionNeeded(ID)).toEqual({ enqueued: true });
    expect(await notifySiteActionNeeded(ID)).toEqual({ enqueued: false });
    await deliverOutbox();
    await notifySiteActionNeeded(ID);
    await deliverOutbox();
    expect(seams.send).toHaveBeenCalledTimes(1);
    const [[key, row]] = rows();
    // Keyed by the capture and the ask's own words: the same ask is the same key.
    expect(key).toMatch(new RegExp(`^captureOutbox/${ID}:site_action_needed:${CAPTURE}\\.[a-f0-9]{16}$`));
    // The ask's own title is the subject (e-019); the body says what was wrong and what to do, then the private link (e-018).
    expect(row).toMatchObject({ kind: "site_action_needed", to: "owner@site.example", subject: RECAPTURE_TITLE, status: "sent" });
    expect(row.body.startsWith(`${LARGE_VIDEO_RECAPTURE_SENTENCES.reason} ${LARGE_VIDEO_RECAPTURE_SENTENCES.nextStep}\n\nOpen your job:\nhttps://`)).toBe(true);
    expect(row.body).toMatch(/\/capture-upload\//);
  });

  it("sends once per distinct ask: a new-video ask, then the job's sentence, each once", async () => {
    state.docs.set(JOB, job());
    status(newVideo("website_registration_poor_fit"));
    await notifySiteActionNeeded(ID);
    await notifySiteActionNeeded(ID);
    expect(rows()).toHaveLength(1);
    expect(rows()[0][1].body).toContain(RECAPTURE_SENTENCES.website_registration_poor_fit.nextStep);
    // The Pipeline now holds the job for its sentence instead: a different ask, its own one email.
    status(taskNotNamedOutcome(`sha256:${"f".repeat(64)}`) as never);
    await notifySiteActionNeeded(ID);
    await notifySiteActionNeeded(ID);
    expect(rows()).toHaveLength(2);
    const sentence = rows().find(([, row]) => row.body.includes(TASK_NOT_NAMED_SENTENCES.nextStep))!;
    const video = rows().find(([, row]) => row.body.includes(RECAPTURE_SENTENCES.website_registration_poor_fit.nextStep))!;
    // The new-video ask no longer stands: its email, still queued, is cancelled; the sentence ask goes.
    await deliverOutbox();
    expect(seams.send).toHaveBeenCalledTimes(1);
    expect(state.docs.get(video[0])).toMatchObject({ status: "cancelled" });
    expect(state.docs.get(sentence[0])).toMatchObject({ status: "sent" });
  });

  it("never emails a status or progress: preparing, handed off, or a job waiting on Blueprint", async () => {
    state.docs.set(JOB, job());
    for (const [outcome, stateName] of [[null, "preparing"], [null, "handed_off"],
      [{ ...newVideo("website_registration_poor_fit"), title: "Our team is reviewing", actionOwner: "blueprint" }, "awaiting_inputs"]] as const) {
      status(outcome as never, stateName);
      expect(await notifySiteActionNeeded(ID)).toEqual({ enqueued: false });
    }
    expect(rows()).toEqual([]);
  });

  it("never emails a job that has ended, the spending cap included, even with an ask still recorded", async () => {
    state.docs.set(JOB, job(largeVideo()));
    seams.scene = { state: "ended", sceneOutcome: { kind: "spending_cap_reached", terminal: true } };
    expect(await notifySiteActionNeeded(ID)).toEqual({ enqueued: false });
    expect(rows()).toEqual([]);
  });

  it("never emails after a withdrawal, and cancels one queued before it", async () => {
    state.docs.set(JOB, job({ ...largeVideo(), consent_revoked: true }));
    expect(await notifySiteActionNeeded(ID)).toEqual({ enqueued: false });
    state.docs.set(JOB, job(largeVideo()));
    expect(await notifySiteActionNeeded(ID)).toEqual({ enqueued: true });
    Object.assign(state.docs.get(JOB)!, { consent_revoked: true, capture_withdrawal: { state: "uploads_stopped_cleanup_pending" } });
    await deliverOutbox();
    expect(seams.send).not.toHaveBeenCalled();
    expect(rows()[0][1]).toMatchObject({ status: "cancelled" });
  });

  it("never sends a new-video ask retained for a context the site has since changed, and cancels one queued before", async () => {
    state.docs.set(JOB, job());
    // A failure stored for the earlier task context: the verified read says it is not current, so the page asks nothing.
    status(newVideo("website_registration_poor_fit"), "awaiting_inputs", false);
    expect(await notifySiteActionNeeded(ID)).toEqual({ enqueued: false });
    // Queued while it was current, then the site changed its job: cancelled at dispatch.
    status(newVideo("website_registration_poor_fit"));
    expect(await notifySiteActionNeeded(ID)).toEqual({ enqueued: true });
    status(newVideo("website_registration_poor_fit"), "awaiting_inputs", false);
    await deliverOutbox();
    expect(seams.send).not.toHaveBeenCalled();
    expect(rows()[0][1]).toMatchObject({ status: "cancelled" });
  });

  it("asks a job whose footage showed no job, unnamed and unconfirmed, for its sentence, once, as the page does", async () => {
    state.docs.set(JOB, job({ capture_task_statement_draft: { state: "none_seen" } }));
    state.docs.set(`siteTaskBriefs/${ID}`, { requestId: ID, summary: "", confirmedAtIso: null });
    expect(await notifySiteActionNeeded(ID)).toEqual({ enqueued: true });
    expect(await notifySiteActionNeeded(ID)).toEqual({ enqueued: false });
    expect(rows()).toHaveLength(1);
    expect(rows()[0][1].subject).toBe(TASK_NOT_NAMED_SENTENCES.title);
    expect(rows()[0][1].body.startsWith(`${TASK_NOT_NAMED_SENTENCES.reason} ${TASK_NOT_NAMED_SENTENCES.nextStep}\n\nOpen your job:\n`)).toBe(true);
    // Once the site names its job, the ask is gone: nothing more, and the queued one would be cancelled.
    state.docs.set(`siteTaskBriefs/${ID}`, { requestId: ID, summary: "Move the boxes onto the shelf.", confirmedAtIso: null });
    await deliverOutbox();
    expect(seams.send).not.toHaveBeenCalled();
    expect(rows()[0][1]).toMatchObject({ status: "cancelled" });
    expect(TASK_NOT_NAMED_REASON).toBe("website_task_not_named");
  });

  it("is brought by the sweep of every site job, with no other trigger", async () => {
    state.docs.set(JOB, job(largeVideo()));
    const { sweepWebsiteJobWindows } = await import("../utils/websiteJobWindowSweep");
    await sweepWebsiteJobWindows();
    await sweepWebsiteJobWindows();
    expect(rows().map(([, row]) => row.kind)).toEqual(["site_action_needed"]);
  });
});
