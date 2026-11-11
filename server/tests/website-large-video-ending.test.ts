// @vitest-environment node
/**
 * A website job whose video was too large for frame extraction (`websiteLargeVideoBlock.ts`): the
 * Pipeline never hears of it, so no grant comes. The no-grant sweep reads the marker extractFrames
 * left and ends the job on the first pass that sees it, before any clock runs out and before the ops
 * page, with one email that says what the job page says.
 *
 * The sweep half runs against the fake Firestore with the real outbox, notice builder, dispatch check,
 * job-page reader, projection and ops scan; only the marker reader, email provider, field decryption
 * and saved-recording read are stubbed. The reader half runs against a fake bucket.
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
const decrypt = vi.hoisted(() => vi.fn(async (value: string) => String(value).replace(/^encrypted:/, "")));
vi.mock("../utils/field-encryption", () => ({ decryptFieldValue: decrypt }));
const send = vi.hoisted(() => vi.fn());
vi.mock("../utils/email", () => ({ sendEmail: send }));
vi.mock("../utils/siteWalkthrough", async (original) => ({
  ...(await original<typeof import("../utils/siteWalkthrough")>()),
  savedWalkthrough: vi.fn(async () => ({ upload: { captureReceived: true }, received: true, uploadState: "retained" })),
}));
const blocked = vi.hoisted(() => ({ value: false, seen: [] as unknown[] }));
vi.mock("../utils/websiteLargeVideoBlock", async (original) => ({
  ...(await original<typeof import("../utils/websiteLargeVideoBlock")>()),
  largeVideoIngestBlock: vi.fn(async (identity: unknown) => {
    blocked.seen.push(identity);
    return blocked.value ? { raw_video_object: "x", raw_video_size_bytes: 2 } : null;
  }),
}));

import { scanWebsiteJobsWaitingOnGrant } from "../utils/betaOpsMonitor";
import { deliverOutbox } from "../utils/captureOutbox";
import { JOB_NO_GRANT_LARGE_VIDEO_ENDING_MESSAGE } from "../utils/taskPreparationOutcome";
import { projectTaskStatus, taskStatusInputFrom } from "../utils/taskStatusProjection";
import { WEBSITE_JOB_WINDOW_DEFAULT_SECONDS } from "../utils/websiteJobWindow";
import { websiteJobNoGrantEndedNoticeKey } from "../utils/websiteJobWindowEnding";
import { sweepWebsiteJobNoGrant, sweepWebsiteJobWindows } from "../utils/websiteJobWindowSweep";
import { websiteJobWorkWindow } from "../utils/websiteSceneSponsorship";

const HOUR = 3600, DAY = 86400;
const NOW = Date.UTC(2026, 10, 12);
const JOB = "inboundRequests/job-one";
const NOTICE = `captureOutbox/${websiteJobNoGrantEndedNoticeKey("job-one")}`;
const docs = state.docs;
const job = () => docs.get(JOB) as Record<string, any>;
const outbox = () => [...docs.entries()].filter(([key]) => key.startsWith("captureOutbox/") && !key.includes("/deliveryReceipts/")) as
  Array<[string, Record<string, any>]>;
const at = (seconds: number) => NOW + seconds * 1000;
const alert = vi.fn(async () => ({ sent: true }));
const opsEmail = vi.fn(async () => ({ sent: true }));

function seedJob(changes: Record<string, unknown> = {}) {
  const { job: record } = screeningFixture();
  delete record.website_scene_sponsorship;
  record.request.capture_region = "us";
  docs.set(JOB, { ...record, requestId: "job-one", createdAt: new Date(NOW - DAY * 1000).toISOString(),
    contact: { email: "encrypted:owner@example.com" }, ...changes });
  docs.set("siteTaskBriefs/job-one", { requestId: "job-one", summary: "Move the rigid part to its tray" });
}
const page = async () => projectTaskStatus(taskStatusInputFrom({ briefDrafted: true, stage: null,
  hasStoredCapture: true, jobWorkWindow: await websiteJobWorkWindow(job()) } as never));

beforeEach(() => {
  docs.clear();
  blocked.value = false;
  blocked.seen.length = 0;
  alert.mockClear();
  opsEmail.mockClear();
  decrypt.mockClear();
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  send.mockReset().mockResolvedValue({ sent: true, provider: "resend", messageId: "accepted" });
});
afterEach(() => { vi.useRealTimers(); });

describe("a job whose video was too large to process", () => {
  it("ends on the first pass that sees the marker, long before its clock, with one email the page matches", async () => {
    seedJob();
    expect(await sweepWebsiteJobNoGrant("job-one", at(0))).toBe("clock_started");
    expect(job().website_job_no_grant_page_due_at_ms).toBe(at(24 * HOUR));
    expect(await sweepWebsiteJobNoGrant("job-one", at(HOUR))).toBe("waiting");

    // extractFrames blocks the video and leaves its marker: the next pass ends the job.
    blocked.value = true;
    expect(await sweepWebsiteJobNoGrant("job-one", at(HOUR + 60))).toBe("ended_notice_queued");
    expect(blocked.seen.at(-1)).toEqual({ requestId: "job-one", sceneId: "site-job-one", captureId: "walkthrough-job-one" });
    expect(job().website_job_no_grant_ending).toMatchObject({ waiting_on: "site", reason: "video_over_ingest_limit",
      waiting_since_epoch: NOW / 1000, ended_at_epoch: NOW / 1000 + HOUR + 60, notice: "queued" });
    expect(job().website_job_no_grant_page_due_at_ms).toBeNull();
    expect(outbox().map(([key]) => key)).toEqual([NOTICE]);
    const body: string = outbox()[0][1].body;
    expect(outbox()[0][1].subject).toBe("Your Blueprint job has ended");
    expect(body.startsWith(`${JOB_NO_GRANT_LARGE_VIDEO_ENDING_MESSAGE}\n\n`)).toBe(true);
    expect(await page()).toMatchObject({ decision: "ended", headline: JOB_NO_GRANT_LARGE_VIDEO_ENDING_MESSAGE });

    // No ops page for it, and nothing more on later passes.
    expect(await scanWebsiteJobsWaitingOnGrant({ now: () => at(DAY), alert, email: opsEmail as never }))
      .toEqual({ due: 0, newlyAlerted: 0 });
    expect(alert).not.toHaveBeenCalled();
    await sweepWebsiteJobWindows({ now: () => at(2 * DAY) });
    await deliverOutbox();
    await sweepWebsiteJobWindows({ now: () => at(3 * DAY) });
    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
    expect(outbox()).toHaveLength(1);
  });

  it("ends a job the sweep sees for the first time, without starting a clock first", async () => {
    seedJob();
    blocked.value = true;
    expect(await sweepWebsiteJobNoGrant("job-one", at(0))).toBe("ended_notice_queued");
    expect(job().website_job_no_grant_ending).toMatchObject({ waiting_on: "site", reason: "video_over_ingest_limit",
      waiting_since_epoch: NOW / 1000, notice: "queued" });
  });

  it("waits for an unreadable contact address within the grace period, then ends with nobody to email", async () => {
    seedJob();
    blocked.value = true;
    decrypt.mockRejectedValue(new Error("kms unavailable"));
    expect(await sweepWebsiteJobNoGrant("job-one", at(0))).toBe("contact_unreadable");
    expect(job().website_job_no_grant_clock).toMatchObject({ since_epoch: NOW / 1000 });
    expect(await sweepWebsiteJobNoGrant("job-one", at(HOUR))).toBe("contact_unreadable");
    expect(await sweepWebsiteJobNoGrant("job-one", at(DAY))).toBe("ended_no_notice");
    expect(job().website_job_no_grant_ending).toMatchObject({ reason: "video_over_ingest_limit", notice: "none_no_contact_on_file" });
    expect(outbox()).toHaveLength(0);
    decrypt.mockReset().mockImplementation(async (value: string) => String(value).replace(/^encrypted:/, ""));
  });

  it("never reads a marker for a job still waiting on the site's recording, or for a withdrawn job", async () => {
    const walkthrough = await import("../utils/siteWalkthrough");
    vi.mocked(walkthrough.savedWalkthrough).mockResolvedValueOnce(
      { upload: { captureReceived: false }, received: false, uploadState: "not_received" } as never);
    seedJob();
    blocked.value = true;
    expect(await sweepWebsiteJobNoGrant("job-one", at(0))).toBe("clock_started");
    expect(blocked.seen).toEqual([]);
    seedJob({ capture_withdrawal: { state: "requested" } });
    expect(await sweepWebsiteJobNoGrant("job-one", at(HOUR))).toBe("withdrawn");
    expect(blocked.seen).toEqual([]);
    expect(outbox()).toHaveLength(0);
  });

  it("an ending recorded without a reason still reads as before", async () => {
    seedJob();
    expect(await sweepWebsiteJobNoGrant("job-one", at(0))).toBe("clock_started");
    expect(await sweepWebsiteJobNoGrant("job-one", at(WEBSITE_JOB_WINDOW_DEFAULT_SECONDS))).toBe("ended_notice_queued");
    expect(job().website_job_no_grant_ending).not.toHaveProperty("reason");
    expect((await page()).headline).not.toBe(JOB_NO_GRANT_LARGE_VIDEO_ENDING_MESSAGE);
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
