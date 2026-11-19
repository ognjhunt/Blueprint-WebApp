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
const seams = vi.hoisted(() => ({ send: vi.fn(), scene: null as unknown }));
vi.mock("../utils/email", () => ({ sendEmail: seams.send }));
vi.mock("../utils/websiteSceneProgression", async importOriginal => ({ ...await importOriginal<object>(),
  readWebsiteSceneProgression: vi.fn(async () => seams.scene) }));

const { notifySiteActionNeeded, SITE_ACTION_SUBJECT } = await import("../utils/siteActionNeeded");
const { deliverOutbox } = await import("../utils/captureOutbox");
const { newWebsiteLargeVideoAsk, WEBSITE_LARGE_VIDEO_ASK_FIELD } = await import("../utils/websiteJobWindowEnding");
const { LARGE_VIDEO_RECAPTURE_SENTENCES, RECAPTURE_SENTENCES, TASK_NOT_NAMED_SENTENCES } = await import("../utils/taskPreparationOutcome");

const ID = "req-1";
const CAPTURE = `walkthrough-${ID}`;
const JOB = `inboundRequests/${ID}`;
const job = (extra: Record<string, unknown> = {}) => ({ requestId: ID, contact: { email: "encrypted:owner@site.example" },
  request: { buyerType: "site_operator", consent_attestation: { granted: true, statement_version: "2026-11-12.v4",
    recorded_at_iso: "2026-11-12T00:00:00Z" } }, ...extra });
const largeVideo = (object = "raw/video.mov") => ({ [WEBSITE_LARGE_VIDEO_ASK_FIELD]: newWebsiteLargeVideoAsk({ request_id: ID,
  capture_id: CAPTURE, raw_video_object: object, raw_video_size_bytes: 1_500_000_000, recorded_at_iso: "2026-11-19T00:00:00Z" }) });
const status = (outcome: Record<string, unknown> | null, state_ = "awaiting_inputs") =>
  state.docs.set(`captureUploadSessions/${CAPTURE}`, { website_preparation: { selector: { request_id: ID, capture_id: CAPTURE },
    status: { state: state_, outcome }, notification: null } });
const rows = () => [...state.docs.entries()].filter(([key]) => key.startsWith("captureOutbox/") && !key.includes("/deliveryReceipts/")) as
  Array<[string, Record<string, any>]>;

beforeEach(() => {
  state.docs.clear();
  seams.scene = null;
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
    expect(key).toMatch(new RegExp(`^captureOutbox/${ID}:site_action_needed:${CAPTURE}\\.video_too_large\\.[a-f0-9]{16}$`));
    expect(row).toMatchObject({ kind: "site_action_needed", to: "owner@site.example", subject: SITE_ACTION_SUBJECT, status: "sent" });
    // One short line saying what is needed, then the private link.
    expect(row.body.startsWith(`We need a new video to build the simulation of your site. ${LARGE_VIDEO_RECAPTURE_SENTENCES.nextStep}\n\nOpen your job:\nhttps://`)).toBe(true);
    expect(row.body).toMatch(/\/capture-upload\//);
  });

  it("sends once per distinct ask: a new-video ask, then the job's sentence, each once", async () => {
    state.docs.set(JOB, job());
    status({ reason: "website_registration_poor_fit" });
    await notifySiteActionNeeded(ID);
    await notifySiteActionNeeded(ID);
    expect(rows()).toHaveLength(1);
    expect(rows()[0][1].body).toContain(RECAPTURE_SENTENCES.website_registration_poor_fit.nextStep);
    // The Pipeline now holds the job for its sentence instead: a different ask, its own one email.
    status({ reason: "website_task_not_named" });
    await notifySiteActionNeeded(ID);
    await notifySiteActionNeeded(ID);
    expect(rows().map(([key]) => key.split(":site_action_needed:")[1]).sort())
      .toEqual([`${CAPTURE}.job_sentence`, `${CAPTURE}.website_registration_poor_fit`]);
    expect(rows().find(([key]) => key.endsWith("job_sentence"))![1].body).toContain(TASK_NOT_NAMED_SENTENCES.nextStep);
    // The new-video ask no longer stands: its email, still queued, is cancelled; the sentence ask goes.
    await deliverOutbox();
    expect(seams.send).toHaveBeenCalledTimes(1);
    expect(state.docs.get(`captureOutbox/${ID}:site_action_needed:${CAPTURE}.website_registration_poor_fit`)).toMatchObject({ status: "cancelled" });
  });

  it("never emails a status or progress: preparing, handed off, or a job waiting on Blueprint", async () => {
    state.docs.set(JOB, job());
    for (const [outcome, stateName] of [[null, "preparing"], [null, "handed_off"], [{ reason: "website_scene_planner_abstained" }, "awaiting_inputs"]] as const) {
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

  it("is brought by the sweep of every site job, with no other trigger", async () => {
    state.docs.set(JOB, job(largeVideo()));
    const { sweepWebsiteJobWindows } = await import("../utils/websiteJobWindowSweep");
    await sweepWebsiteJobWindows();
    await sweepWebsiteJobWindows();
    expect(rows().map(([, row]) => row.kind)).toEqual(["site_action_needed"]);
  });
});
