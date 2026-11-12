// @vitest-environment node
/**
 * A website job whose active capture's video was too large for frame extraction
 * (`websiteLargeVideoBlock.ts`): the Pipeline never hears of it, so no grant comes. The no-grant sweep
 * reads the marker extractFrames left and turns the job into the new-video ask: the job page asks for
 * a smaller video, one email says the same, no ops page, and the job stays open on the site's clock.
 * A replacement that becomes active clears the ask and the wait is Blueprint's again.
 *
 * The sweep half runs against the fake Firestore with the real outbox, notice builder, dispatch check,
 * job-page projection and ops scan; only the marker reader, email provider, field decryption and
 * saved-recording read are stubbed. The reader half runs against a fake bucket.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { screeningFixture } from "./fixtures/beta-policy-screening";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore, storageAdmin: null };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/field-encryption", () => ({
  decryptFieldValue: vi.fn(async (value: string) => String(value).replace(/^encrypted:/, "")),
}));
const send = vi.hoisted(() => vi.fn());
vi.mock("../utils/email", () => ({ sendEmail: send }));
vi.mock("../utils/siteWalkthrough", async (original) => ({
  ...(await original<typeof import("../utils/siteWalkthrough")>()),
  savedWalkthrough: vi.fn(async () => ({ upload: { captureReceived: true }, received: true, uploadState: "retained" })),
}));
/** Which capture's video the marker blocks; `onRead` runs while the marker is read. */
const marker = vi.hoisted(() => ({ blockedCapture: null as string | null, onRead: null as null | (() => void),
  seen: [] as Array<{ captureId: string }> }));
vi.mock("../utils/websiteLargeVideoBlock", async (original) => ({
  ...(await original<typeof import("../utils/websiteLargeVideoBlock")>()),
  largeVideoIngestBlock: vi.fn(async (identity: { captureId: string; sceneId: string }) => {
    marker.seen.push(identity);
    marker.onRead?.();
    return marker.blockedCapture === identity.captureId
      ? { raw_video_object: `scenes/${identity.sceneId}/captures/${identity.captureId}/raw/walkthrough.mp4`, raw_video_size_bytes: 1_500_000_000 }
      : null;
  }),
}));

import { scanWebsiteJobsWaitingOnGrant } from "../utils/betaOpsMonitor";
import { deliverOutbox } from "../utils/captureOutbox";
import { JOB_NO_GRANT_LARGE_VIDEO_ENDING_MESSAGE, LARGE_VIDEO_RECAPTURE_SENTENCES, largeVideoAskOutcome,
  RECAPTURE_TITLE } from "../utils/taskPreparationOutcome";
import { projectTaskStatus, taskStatusInputFrom } from "../utils/taskStatusProjection";
import { WEBSITE_JOB_WINDOW_DEFAULT_SECONDS } from "../utils/websiteJobWindow";
import { websiteJobNoGrantEndedNoticeKey } from "../utils/websiteJobWindowEnding";
import { sweepWebsiteJobNoGrant, sweepWebsiteJobWindows } from "../utils/websiteJobWindowSweep";
import { websiteJobWorkWindow } from "../utils/websiteSceneSponsorship";
import { siteWalkthroughIdentity } from "../utils/siteWalkthrough";

const HOUR = 3600, DAY = 86400;
const WINDOW = WEBSITE_JOB_WINDOW_DEFAULT_SECONDS;
const NOW = Date.UTC(2026, 10, 12);
const JOB = "inboundRequests/job-one";
const FIRST = "walkthrough-job-one";
const REPLACEMENT = `supplement-${"a".repeat(40)}`;
const docs = state.docs;
const job = () => docs.get(JOB) as Record<string, any>;
const outbox = () => [...docs.entries()].filter(([key]) => key.startsWith("captureOutbox/") && !key.includes("/deliveryReceipts/")) as
  Array<[string, Record<string, any>]>;
const at = (seconds: number) => NOW + seconds * 1000;
const alert = vi.fn(async () => ({ sent: true }));
const opsEmail = vi.fn(async () => ({ sent: true }));
const scanAt = (seconds: number) => scanWebsiteJobsWaitingOnGrant({ now: () => at(seconds), alert, email: opsEmail as never });

function seedJob(changes: Record<string, unknown> = {}) {
  const { job: record } = screeningFixture();
  delete record.website_scene_sponsorship;
  record.request.capture_region = "us";
  docs.set(JOB, { ...record, requestId: "job-one", createdAt: new Date(NOW - DAY * 1000).toISOString(),
    contact: { email: "encrypted:owner@example.com" }, ...changes });
  docs.set("siteTaskBriefs/job-one", { requestId: "job-one", summary: "Move the rigid part to its tray" });
}
/** What the job page shows: the same outcome the two job routes read, through the real projection. */
const page = async () => {
  const record = job();
  const captureId = siteWalkthroughIdentity("job-one", record).captureId;
  return projectTaskStatus(taskStatusInputFrom({ briefDrafted: true, stage: null, hasStoredCapture: true,
    jobWorkWindow: await websiteJobWorkWindow(record),
    preparationOutcome: largeVideoAskOutcome(record, "job-one", captureId) } as never));
};
const activate = (captureId: string) => docs.set(JOB, { ...job(), active_capture_id: captureId });

beforeEach(() => {
  docs.clear();
  marker.blockedCapture = null;
  marker.onRead = null;
  marker.seen.length = 0;
  alert.mockClear();
  opsEmail.mockClear();
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  send.mockReset().mockResolvedValue({ sent: true, provider: "resend", messageId: "accepted" });
});
afterEach(() => { vi.useRealTimers(); });

describe("a job whose video was too large to process", () => {
  it("asks for a new video on the page and in one email, with no ops page, and keeps the job open", async () => {
    seedJob();
    expect(await sweepWebsiteJobNoGrant("job-one", at(0))).toBe("clock_started");
    expect(job().website_job_no_grant_clock.waiting_on).toBe("blueprint");
    marker.blockedCapture = FIRST;
    // The wait becomes the site's: the clock restarts on the site, with no page due.
    expect(await sweepWebsiteJobNoGrant("job-one", at(HOUR))).toBe("clock_started");
    expect(job().website_job_no_grant_clock).toMatchObject({ waiting_on: "site", since_epoch: NOW / 1000 + HOUR, capture_id: FIRST });
    expect(job().website_job_no_grant_page_due_at_ms).toBeNull();
    expect(job().website_large_video_ask).toMatchObject({ capture_id: FIRST, raw_video_size_bytes: 1_500_000_000 });
    expect(job()).not.toHaveProperty("website_job_no_grant_ending");

    expect(await page()).toMatchObject({ outcome: { title: RECAPTURE_TITLE, reason: "Your video is too large for us to process.",
      nextStep: "Please film a shorter clip, or record at 1080p. Then send us the new video.", actionOwner: "site" } });
    expect(outbox()).toHaveLength(1);
    const [key, entry] = outbox()[0];
    expect(key).toMatch(new RegExp(`^captureOutbox/job-one:video_too_large:${FIRST}\\.[a-f0-9]{16}$`));
    expect(entry).toMatchObject({ kind: "video_too_large", subject: RECAPTURE_TITLE, to: "owner@example.com", status: "pending" });
    expect(entry.body.startsWith(`${LARGE_VIDEO_RECAPTURE_SENTENCES.reason} ${LARGE_VIDEO_RECAPTURE_SENTENCES.nextStep}\n\nSend a new video:\n`)).toBe(true);

    // A second pass, a sweep of all jobs and the ops scan add nothing.
    expect(await sweepWebsiteJobNoGrant("job-one", at(2 * HOUR))).toBe("waiting");
    await sweepWebsiteJobWindows({ now: () => at(3 * HOUR) });
    expect(await scanAt(2 * DAY)).toEqual({ due: 0, newlyAlerted: 0 });
    expect(alert).not.toHaveBeenCalled();
    await deliverOutbox();
    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
    expect(outbox()).toHaveLength(1);
  });

  it("clears the ask once a replacement is active, and the wait is Blueprint's again from the replacement", async () => {
    seedJob();
    marker.blockedCapture = FIRST;
    expect(await sweepWebsiteJobNoGrant("job-one", at(0))).toBe("clock_started");
    activate(REPLACEMENT);
    // The page stops asking at once: the ask names the earlier capture.
    expect((await page()).outcome?.title).not.toBe(RECAPTURE_TITLE);
    expect(await sweepWebsiteJobNoGrant("job-one", at(5 * DAY))).toBe("clock_started");
    expect(job().website_large_video_ask).toBeNull();
    expect(job().website_job_no_grant_clock).toMatchObject({ waiting_on: "blueprint", since_epoch: NOW / 1000 + 5 * DAY,
      capture_id: REPLACEMENT });
    expect(job().website_job_no_grant_page_due_at_ms).toBe(at(5 * DAY + 24 * HOUR));
    // The ask's email, if still unsent, no longer speaks for the job.
    await deliverOutbox();
    expect(send).not.toHaveBeenCalled();
    expect(outbox()[0][1].status).toBe("cancelled");
  });

  it("restarts the Blueprint wait from a replacement that arrives late in an ordinary wait", async () => {
    seedJob();
    expect(await sweepWebsiteJobNoGrant("job-one", at(0))).toBe("clock_started");
    activate(REPLACEMENT);
    expect(await sweepWebsiteJobNoGrant("job-one", at(WINDOW - HOUR))).toBe("clock_started");
    expect(job().website_job_no_grant_clock).toMatchObject({ waiting_on: "blueprint", since_epoch: NOW / 1000 + WINDOW - HOUR });
    expect(await sweepWebsiteJobNoGrant("job-one", at(WINDOW))).toBe("waiting");
  });

  it("writes nothing when a replacement becomes active while the marker is read", async () => {
    seedJob();
    expect(await sweepWebsiteJobNoGrant("job-one", at(0))).toBe("clock_started");
    marker.blockedCapture = FIRST;
    marker.onRead = () => { activate(REPLACEMENT); marker.onRead = null; };
    const before = structuredClone(job());
    expect(await sweepWebsiteJobNoGrant("job-one", at(HOUR))).toBe("changed");
    expect(job()).toEqual({ ...before, active_capture_id: REPLACEMENT });
    expect(outbox()).toHaveLength(0);
  });

  it("ends with the existing site ending, naming the size, when no new video arrives in time", async () => {
    seedJob();
    marker.blockedCapture = FIRST;
    expect(await sweepWebsiteJobNoGrant("job-one", at(0))).toBe("clock_started");
    expect(await sweepWebsiteJobNoGrant("job-one", at(WINDOW - 1))).toBe("waiting");
    expect(await sweepWebsiteJobNoGrant("job-one", at(WINDOW))).toBe("ended_notice_queued");
    expect(job().website_job_no_grant_ending).toMatchObject({ waiting_on: "site", reason: "video_over_ingest_limit", notice: "queued" });
    expect(await page()).toMatchObject({ decision: "ended", headline: JOB_NO_GRANT_LARGE_VIDEO_ENDING_MESSAGE });
    const ending = outbox().find(([key]) => key === `captureOutbox/${websiteJobNoGrantEndedNoticeKey("job-one")}`)!;
    // With no paper check for the job, the email says so plainly after the ending (review, 2026-11-11).
    expect(ending[1].body.startsWith(`${JOB_NO_GRANT_LARGE_VIDEO_ENDING_MESSAGE} There is no first look for this job.\n\n`)).toBe(true);
  });

  it("keeps the ordinary path when the marker is absent or does not read", async () => {
    seedJob();
    expect(await sweepWebsiteJobNoGrant("job-one", at(0))).toBe("clock_started");
    expect(marker.seen).toEqual([{ requestId: "job-one", sceneId: "site-job-one", captureId: FIRST }]);
    expect(job().website_job_no_grant_clock.waiting_on).toBe("blueprint");
    expect(job()).not.toHaveProperty("website_large_video_ask");
    expect(await sweepWebsiteJobNoGrant("job-one", at(WINDOW))).toBe("ended_notice_queued");
    expect(job().website_job_no_grant_ending).not.toHaveProperty("reason");
    expect(outbox().map(([, entry]) => entry.kind)).toEqual(["scene_outcome"]);
  });
});

describe("the marker reader", () => {
  const prefix = "scenes/site-r1/captures/walkthrough-r1";
  const marker = (changes: Record<string, unknown> = {}) => ({
    schema_version: "extract_frames_large_video_block.v1", status: "blocked",
    block_code: "blocked_large_video_requires_segmented_ingest", scene_id: "site-r1", capture_id: "walkthrough-r1",
    raw_video_object: `${prefix}/raw/walkthrough.mp4`, raw_video_size_bytes: 1_500_000_000,
    max_inline_video_bytes: 1_000_000_000, ...changes });
  const bucket = (files: Record<string, { json?: unknown; size?: string }>, fail = false) => ({
    file: (name: string) => ({
      exists: async () => { if (fail) throw new Error("storage down"); return [name in files] as [boolean]; },
      download: async () => [Buffer.from(JSON.stringify(files[name]?.json ?? {}))] as [Buffer],
      getMetadata: async () => [{ size: files[name]?.size }] as [Record<string, unknown>],
    }),
  });
  const read = async (files: Record<string, { json?: unknown; size?: string }>, fail = false) => {
    const { largeVideoIngestBlock } = await vi.importActual<typeof import("../utils/websiteLargeVideoBlock")>(
      "../utils/websiteLargeVideoBlock");
    return largeVideoIngestBlock({ sceneId: "site-r1", captureId: "walkthrough-r1" }, bucket(files, fail));
  };
  const video = { [`${prefix}/raw/walkthrough.mp4`]: { size: "1500000000" } };

  it("returns the block only for the stored video it names, at the size it recorded", async () => {
    expect(await read({ [`${prefix}/large_video_ingest_blocked.json`]: { json: marker() }, ...video }))
      .toEqual({ raw_video_object: `${prefix}/raw/walkthrough.mp4`, raw_video_size_bytes: 1_500_000_000 });
    // A later, smaller upload under the same name is not blocked by the old marker.
    expect(await read({ [`${prefix}/large_video_ingest_blocked.json`]: { json: marker() },
      [`${prefix}/raw/walkthrough.mp4`]: { size: "400000000" } })).toBeNull();
    expect(await read({ [`${prefix}/large_video_ingest_blocked.json`]: { json: marker() } })).toBeNull();
  });

  it("is not blocked by a missing, unreadable or different marker", async () => {
    expect(await read(video)).toBeNull();
    expect(await read(video, true)).toBeNull();
    for (const changes of [
      { block_code: "blocked_raw_walkthrough_video_size_unavailable", raw_video_size_bytes: null },
      { raw_video_size_bytes: 900_000_000 },
      { capture_id: "walkthrough-other" },
      { raw_video_object: "scenes/site-other/captures/walkthrough-r1/raw/walkthrough.mp4" },
      { schema_version: "extract_frames_large_video_block.v2" },
    ]) {
      expect(await read({ [`${prefix}/large_video_ingest_blocked.json`]: { json: marker(changes) }, ...video })).toBeNull();
    }
  });
});
