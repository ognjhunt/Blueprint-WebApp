// @vitest-environment node
/**
 * A website job that never received a grant (`websiteJobWindowSweep`, the same pass that ends a
 * granted job's window), against the fake Firestore, with the real outbox, notice builder, dispatch
 * check, job-page reader and projection, and the real ops page scan. Only the email provider, field
 * decryption and the saved-recording read are stubbed.
 *
 * Pins, for a wait on the site and a wait on Blueprint: the clock starts the first time the sweep
 * sees the job (never at its creation); not yet due is quiet; due ends once, with one email; running
 * the sweep again sends nothing more; an already-ended job is untouched; a withdrawn job sends
 * nothing; the ops page comes once, well before the ending; and a scan that read a full page reports
 * "unknown".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { screeningFixture, screeningSha } from "./fixtures/beta-policy-screening";

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
/** Whether the job's recording is saved, as both job pages read it; null when it cannot be read. */
const recording = vi.hoisted(() => ({ received: false as boolean | null }));
vi.mock("../utils/siteWalkthrough", async (original) => ({
  ...(await original<typeof import("../utils/siteWalkthrough")>()),
  savedWalkthrough: vi.fn(async () => recording.received === null ? null
    : { upload: { captureReceived: recording.received }, received: recording.received, uploadState: recording.received ? "retained" : "not_received" }),
}));

import { crossRuntimeDigest } from "../utils/crossRuntimeCanonical";
import { scanWebsiteJobsWaitingOnGrant } from "../utils/betaOpsMonitor";
import { deliverOutbox } from "../utils/captureOutbox";
import { JOB_NO_GRANT_BLUEPRINT_ENDING_MESSAGE, JOB_NO_GRANT_SITE_ENDING_MESSAGE } from "../utils/taskPreparationOutcome";
import { projectTaskStatus, taskStatusInputFrom } from "../utils/taskStatusProjection";
import { WEBSITE_JOB_WINDOW_DEFAULT_SECONDS } from "../utils/websiteJobWindow";
import { websiteJobNoGrantEndedNoticeKey } from "../utils/websiteJobWindowEnding";
import { sweepWebsiteJobNoGrant, sweepWebsiteJobWindows } from "../utils/websiteJobWindowSweep";
import { websiteJobWorkWindow } from "../utils/websiteSceneSponsorship";

const HOUR = 3600, DAY = 86400;
const WINDOW = WEBSITE_JOB_WINDOW_DEFAULT_SECONDS;
/** The first pass that sees the job after this ships. */
const NOW = Date.UTC(2026, 10, 12);
const JOB = "inboundRequests/job-one";
const NOTICE = `captureOutbox/${websiteJobNoGrantEndedNoticeKey("job-one")}`;
const docs = state.docs;
const job = () => docs.get(JOB) as Record<string, any>;
const outbox = () => [...docs.entries()].filter(([key]) => key.startsWith("captureOutbox/") && !key.includes("/deliveryReceipts/")) as
  Array<[string, Record<string, any>]>;
const at = (seconds: number) => NOW + seconds * 1000;
const sweepAt = (seconds: number) => sweepWebsiteJobWindows({ now: () => at(seconds) });
const alert = vi.fn(async () => ({ sent: true }));
const opsEmail = vi.fn(async () => ({ sent: true }));
const scanAt = (seconds: number, limit?: number) => scanWebsiteJobsWaitingOnGrant({ now: () => at(seconds), alert, email: opsEmail as never, limit });

/** A site's website job with no grant, created a day before the sweep first sees it: a capture link and a brief, nothing else. */
function seedJob(changes: Record<string, unknown> = {}, id = "job-one", brief = true) {
  const { job: record } = screeningFixture();
  delete record.website_scene_sponsorship;
  record.request.capture_region = "us";
  docs.set(`inboundRequests/${id}`, { ...record, requestId: id, createdAt: new Date(NOW - DAY * 1000).toISOString(),
    contact: { email: "encrypted:owner@example.com" }, ...changes });
  if (brief) docs.set(`siteTaskBriefs/${id}`, { requestId: id, summary: "Move the rigid part to its tray" });
}
/** Nothing but the sweep's own rotating cursors was written. */
const snapshot = () => new Map([...docs.entries()].filter(([key]) => !key.startsWith("automationCursors/"))
  .map(([key, value]) => [key, structuredClone(value)]));
/** What a job page shows, from the same reader and projection the two job pages use. */
const page = async (extra: Record<string, unknown> = {}) => projectTaskStatus(taskStatusInputFrom({ briefDrafted: true, stage: null,
  hasStoredCapture: recording.received === true, jobWorkWindow: await websiteJobWorkWindow(job()), ...extra } as never));

beforeEach(() => {
  docs.clear();
  recording.received = false;
  alert.mockClear();
  opsEmail.mockClear();
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  send.mockReset().mockResolvedValue({ sent: true, provider: "resend", messageId: "accepted" });
});
afterEach(() => { vi.useRealTimers(); });

describe.each([
  ["the site (no recording received)", "site" as const, false, JOB_NO_GRANT_SITE_ENDING_MESSAGE],
  ["Blueprint (recording saved, no grant issued)", "blueprint" as const, true, JOB_NO_GRANT_BLUEPRINT_ENDING_MESSAGE],
])("a job with no grant waiting on %s", (_name, waitingOn, received, message) => {
  beforeEach(() => { recording.received = received; });

  it("starts its clock when the sweep first sees it, is quiet until the window has run, then ends once with one email", async () => {
    seedJob();
    expect(await sweepAt(0)).toEqual({ examined: 1, ended: 0, noticesQueued: 0, failed: 0 });
    // The clock starts now, not at the job's creation months ago.
    expect(job().website_job_no_grant_clock).toEqual({ schema_version: "website_job_no_grant_clock.v1", request_id: "job-one",
      waiting_on: waitingOn, since_epoch: NOW / 1000, window_seconds: WINDOW, capture_id: "walkthrough-job-one" });
    expect(job().website_job_no_grant_page_due_at_ms).toBe(waitingOn === "blueprint" ? at(24 * HOUR) : null);

    // Not yet due: quiet.
    for (const seconds of [HOUR, WINDOW - 1]) {
      expect(await sweepWebsiteJobNoGrant("job-one", at(seconds))).toBe("waiting");
      expect(await sweepAt(seconds)).toEqual({ examined: 1, ended: 0, noticesQueued: 0, failed: 0 });
    }
    expect(job()).not.toHaveProperty("website_job_no_grant_ending");
    expect(outbox()).toHaveLength(0);
    expect((await page()).decision).not.toBe("ended");

    // Due: ended once, in one write with one email.
    expect(await sweepAt(WINDOW)).toEqual({ examined: 1, ended: 1, noticesQueued: 1, failed: 0 });
    const ending = job().website_job_no_grant_ending;
    expect(ending).toMatchObject({ schema_version: "website_job_no_grant_ending.v1", request_id: "job-one", waiting_on: waitingOn,
      waiting_since_epoch: NOW / 1000, ended_at_epoch: NOW / 1000 + WINDOW, notice: "queued" });
    expect(job().website_job_no_grant_page_due_at_ms).toBeNull();
    expect(outbox().map(([key]) => key)).toEqual([NOTICE]);
    expect(outbox()[0][1]).toMatchObject({ kind: "scene_outcome", requestId: "job-one", status: "pending", to: "owner@example.com",
      subject: waitingOn === "site" ? "Your Blueprint job has ended" : "The simulation of your site has stopped",
      idempotencyKey: "job-one:scene_outcome:job_no_grant_ended" });
    const body: string = outbox()[0][1].body;
    // With no paper check for the job, the email says so plainly after the ending (review, 2026-11-11).
    expect(body.startsWith(`${message} There is no first look for this job.\n\nOpen your job on your private job page:\nhttps://`)).toBe(true);
    expect(body).not.toMatch(/we will|we'll|our team|review|follow up|email you/i);

    // The job page says the same sentence, the way a window ending shows.
    expect(await page()).toMatchObject({ decision: "ended", headline: message, operatorAction: null, stage: null });

    // Re-running the sweep sends nothing more.
    for (const seconds of [WINDOW + 60, WINDOW + 30 * DAY]) {
      expect(await sweepAt(seconds)).toEqual({ examined: 1, ended: 0, noticesQueued: 0, failed: 0 });
    }
    expect(job().website_job_no_grant_ending).toEqual(ending);
    await deliverOutbox();
    await sweepAt(WINDOW + 31 * DAY);
    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ to: "owner@example.com",
      subject: waitingOn === "site" ? "Your Blueprint job has ended" : "The simulation of your site has stopped" });
    expect(outbox()).toHaveLength(1);
    expect(outbox()[0][1].status).toBe("sent");
  });

  it("sends nothing for a withdrawn job, and cancels the email when consent is withdrawn before it is sent", async () => {
    seedJob();
    await sweepAt(0);
    Object.assign(job(), { consent_revoked: true, capture_withdrawal: { state: "uploads_stopped_cleanup_pending" } });
    expect(await sweepWebsiteJobNoGrant("job-one", at(WINDOW))).toBe("withdrawn");
    expect(job()).not.toHaveProperty("website_job_no_grant_ending");
    expect(outbox()).toHaveLength(0);

    seedJob({}, "job-two");
    await sweepWebsiteJobNoGrant("job-two", at(0));
    expect(await sweepWebsiteJobNoGrant("job-two", at(WINDOW))).toBe("ended_notice_queued");
    Object.assign(docs.get("inboundRequests/job-two")!, { consent_revoked: true });
    await deliverOutbox();
    expect(send).not.toHaveBeenCalled();
    expect(docs.get(`captureOutbox/${websiteJobNoGrantEndedNoticeKey("job-two")}`)).toMatchObject({ status: "cancelled" });
  });
});

describe("a job the no-grant clock must leave alone", () => {
  const closure = () => {
    const value = { schema_version: "website_run_closure.v1", request_id: "job-one", capture_id: "walkthrough-job-one",
      decision: "conservative_abstention", actor: "signed_owner_link", source_identity_digest: screeningSha("1"),
      closed_at_iso: "2026-11-09T00:00:00.000Z", new_execution_authorized: false, explicit_resume_required: true, physical_validation: false };
    return { "walkthrough-job-one": { ...value, closure_digest: crossRuntimeDigest(value) } };
  };
  const cases: Array<[string, string, () => void]> = [
    ["withdrawn", "withdrawn", () => seedJob({ consent_revoked: true, capture_withdrawal: { state: "deletion_confirmed" } })],
    ["closed by its owner", "owner_closed", () => seedJob({ website_run_closures: closure() })],
    ["told its preparation ended for good", "outcome_told", () => { recording.received = true; seedJob();
      docs.set("captureUploadSessions/walkthrough-job-one", { website_preparation: { status: { state: "failed_terminal", terminal_reason: "retry_exhausted" } } }); }],
    ["with a grant (the window sweep's)", "has_grant", () => { const { job: granted } = screeningFixture();
      docs.set(JOB, { ...granted, requestId: "job-one", contact: { email: "encrypted:owner@example.com" } }); }],
    ["that is not a website job: no task brief", "not_a_job", () => seedJob({}, "job-one", false)],
    ["that is not a website job: no capture link was ever given", "not_a_job", () => seedJob({ request: { buyerType: "site_operator" } })],
    ["that is not a website job: a robot team's request", "not_a_job", () => seedJob({ request: { buyerType: "robot_team", capture_region: "us" } })],
  ];
  it.each(cases)("leaves a job %s untouched", async (_name, result, arrange) => {
    arrange();
    const before = new Map([...docs.entries()].map(([key, value]) => [key, structuredClone(value)]));
    expect(await sweepWebsiteJobNoGrant("job-one", at(0))).toBe(result);
    await sweepAt(WINDOW * 3);
    const after = new Map([...docs.entries()].filter(([key]) => !key.startsWith("automationCursors/")));
    expect(after).toEqual(before);
    expect(outbox()).toHaveLength(0);
  });

  // Review, 2026-11-11: kept on file is a recorded ending. The sweep starts no clock and records no no-grant ending for
  // it, but it owes the job its answer email, durably on the job, queued once the answer can be read.
  it("starts no clock for a job kept on file, and owes it its answer email", async () => {
    seedJob({ site_task_scope: { supported: false, reason: "door_opening" } });
    expect(await sweepWebsiteJobNoGrant("job-one", at(0))).toBe("kept_on_file");
    await sweepAt(WINDOW * 3);
    expect(job()).not.toHaveProperty("website_job_no_grant_clock");
    expect(job()).not.toHaveProperty("website_job_no_grant_ending");
    expect(Object.values(job().answer_notices_waiting).map((entry: any) => entry.params)).toEqual([{ requestId: "job-one", milestone: "answer_ready" }]);
    expect(job().answer_notices_next_ms).toBeGreaterThan(0);
    // Marked once: a later pass neither writes the job nor loads the outlook again.
    expect(job().kept_on_file_answer_owed_at_iso).toEqual(expect.any(String));
    const before = structuredClone(job());
    const outlook = await import("../utils/jobOutlook");
    const loads = vi.spyOn(outlook, "loadJobOutlookDecision");
    expect(await sweepWebsiteJobNoGrant("job-one", at(WINDOW * 4))).toBe("kept_on_file");
    expect(loads).not.toHaveBeenCalled();
    loads.mockRestore();
    expect(job()).toEqual(before);
  });

  it("leaves an already-ended job untouched", async () => {
    seedJob();
    await sweepAt(0);
    await sweepAt(WINDOW);
    const before = new Map([...docs.entries()].filter(([key]) => !key.startsWith("automationCursors/"))
      .map(([key, value]) => [key, structuredClone(value)]));
    expect(await sweepWebsiteJobNoGrant("job-one", at(WINDOW * 2))).toBe("ending_recorded");
    recording.received = true;
    expect(await sweepWebsiteJobNoGrant("job-one", at(WINDOW * 3))).toBe("ending_recorded");
    expect(new Map([...docs.entries()].filter(([key]) => !key.startsWith("automationCursors/")))).toEqual(before);
  });

  it("stops speaking for the job once a grant is issued: the window sweep has it from then", async () => {
    seedJob();
    await sweepAt(0);
    await sweepAt(WINDOW);
    expect((await page()).decision).toBe("ended");
    const { job: granted } = screeningFixture();
    job().website_scene_sponsorship = { ...granted.website_scene_sponsorship, request_id: "job-one", expires_at_epoch: NOW / 1000 + 2 * WINDOW };
    expect(await websiteJobWorkWindow(job())).toEqual({ untilEpoch: NOW / 1000 + 2 * WINDOW, ended: false });
    expect((await page()).decision).not.toBe("ended");
    expect(await sweepWebsiteJobNoGrant("job-one", at(WINDOW + 60))).toBe("has_grant");
  });
});

describe("the wait moving from the site to Blueprint", () => {
  it("restarts the clock when the recording arrives, so Blueprint gets the whole window", async () => {
    seedJob();
    await sweepAt(0);
    recording.received = true;
    expect(await sweepWebsiteJobNoGrant("job-one", at(5 * DAY))).toBe("clock_started");
    expect(job().website_job_no_grant_clock).toMatchObject({ waiting_on: "blueprint", since_epoch: NOW / 1000 + 5 * DAY });
    expect(await sweepWebsiteJobNoGrant("job-one", at(WINDOW))).toBe("waiting");
    expect(await sweepWebsiteJobNoGrant("job-one", at(5 * DAY + WINDOW))).toBe("ended_notice_queued");
    expect(job().website_job_no_grant_ending.waiting_on).toBe("blueprint");
  });

  it("a held job whose next step is the site's own waits on the site, recording or not", async () => {
    recording.received = true;
    seedJob({ site_task_scope: { supported: false, reason: "multi_step" } });
    expect(await sweepWebsiteJobNoGrant("job-one", at(0))).toBe("clock_started");
    expect(job().website_job_no_grant_clock.waiting_on).toBe("site");
  });

  it("does not start or end anything when the recording's status cannot be read", async () => {
    recording.received = null;
    seedJob();
    expect(await sweepAt(0)).toEqual({ examined: 1, ended: 0, noticesQueued: 0, failed: 1 });
    expect(job()).not.toHaveProperty("website_job_no_grant_clock");
  });
});

describe("the ops page for a job waiting on Blueprint", () => {
  it("pages once, a day in, well before the job ends held; never for a wait on the site", async () => {
    recording.received = true;
    seedJob();
    recording.received = false;
    seedJob({}, "job-site");
    recording.received = true;
    await sweepWebsiteJobNoGrant("job-one", at(0));
    recording.received = false;
    await sweepWebsiteJobNoGrant("job-site", at(0));
    expect(await scanAt(24 * HOUR - 1)).toEqual({ due: 0, newlyAlerted: 0 });
    expect(alert).not.toHaveBeenCalled();
    expect(await scanAt(24 * HOUR)).toEqual({ due: 1, newlyAlerted: 1 });
    expect(alert).toHaveBeenCalledTimes(1);
    expect(String((alert.mock.calls[0] as unknown[])[1])).toMatch(/job-one: the site did its part by 2026-11-12T00:00:00.000Z; with no grant the job ends as held at 2026-11-19T00:00:00.000Z/);
    expect(opsEmail).toHaveBeenCalledTimes(1);
    expect(job().website_job_no_grant_page_due_at_ms).toBeNull();
    expect(job().website_job_no_grant_clock.paged_at_iso).toBe(new Date(at(24 * HOUR)).toISOString());
    expect(await scanAt(2 * DAY)).toEqual({ due: 0, newlyAlerted: 0 });
    expect(alert).toHaveBeenCalledTimes(1);
    // The page's own write does not reset the clock: the job still ends on time.
    recording.received = true;
    expect(await sweepWebsiteJobNoGrant("job-one", at(WINDOW))).toBe("ended_notice_queued");
  });

  it("clears a withdrawn job without a page", async () => {
    recording.received = true;
    seedJob();
    await sweepWebsiteJobNoGrant("job-one", at(0));
    Object.assign(job(), { consent_revoked: true });
    expect(await scanAt(DAY)).toEqual({ due: 1, newlyAlerted: 0 });
    expect(alert).not.toHaveBeenCalled();
    expect(job().website_job_no_grant_page_due_at_ms).toBeNull();
  });

  it("clears a job its owner closed after the clock started, without a page", async () => {
    recording.received = true;
    seedJob();
    await sweepWebsiteJobNoGrant("job-one", at(0));
    const value = { schema_version: "website_run_closure.v1", request_id: "job-one", capture_id: "walkthrough-job-one",
      decision: "conservative_abstention", actor: "signed_owner_link", source_identity_digest: screeningSha("1"),
      closed_at_iso: "2026-11-12T01:00:00.000Z", new_execution_authorized: false, explicit_resume_required: true, physical_validation: false };
    Object.assign(job(), { website_run_closures: { "walkthrough-job-one": { ...value, closure_digest: crossRuntimeDigest(value) } } });
    expect(await scanAt(DAY)).toEqual({ due: 1, newlyAlerted: 0 });
    expect(alert).not.toHaveBeenCalled();
    expect(opsEmail).not.toHaveBeenCalled();
    expect(job().website_job_no_grant_page_due_at_ms).toBeNull();
    expect(job().website_job_no_grant_clock.paged_at_iso).toBeUndefined();
  });

  it("reports \"unknown\" when it read only a full first page, and pages the rest on the next pass", async () => {
    recording.received = true;
    for (const id of ["job-a", "job-b", "job-c"]) { seedJob({}, id); await sweepWebsiteJobNoGrant(id, at(0)); }
    expect(await scanAt(DAY, 2)).toEqual({ due: "unknown", newlyAlerted: 2 });
    expect(await scanAt(DAY, 2)).toEqual({ due: 1, newlyAlerted: 1 });
    expect(await scanAt(DAY, 2)).toEqual({ due: 0, newlyAlerted: 0 });
  });
});

describe("no backfill: a job that had already waited a window when the sweep first saw it", () => {
  it.each([
    ["created more than a window ago", { createdAt: new Date(NOW - (WINDOW + 1) * 1000).toISOString() }, "none_waited_before_this_change", false],
    ["created more than a window ago, waiting on Blueprint", { createdAt: { _seconds: NOW / 1000 - 30 * DAY } }, "none_waited_before_this_change", true],
    ["with no readable creation time", { createdAt: "SERVER_TIMESTAMP" }, "none_age_unknown", true],
  ])("is ended at first sight with no email and no page: %s", async (_name, changes, notice, received) => {
    recording.received = received;
    seedJob(changes);
    expect(await sweepAt(0)).toEqual({ examined: 1, ended: 1, noticesQueued: 0, failed: 0 });
    expect(job().website_job_no_grant_ending).toMatchObject({ notice, ended_at_epoch: NOW / 1000 });
    expect(job()).not.toHaveProperty("website_job_no_grant_clock");
    expect(job().website_job_no_grant_page_due_at_ms).toBeNull();
    expect(await scanAt(2 * DAY)).toEqual({ due: 0, newlyAlerted: 0 });
    for (const seconds of [WINDOW, 3 * WINDOW]) expect(await sweepAt(seconds)).toMatchObject({ ended: 0, noticesQueued: 0 });
    await deliverOutbox();
    expect(outbox()).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
    expect((await page()).decision).toBe("ended");
  });

  it("counts the latest site activity, not only the creation: a recording received a day ago is a young wait", async () => {
    recording.received = true;
    seedJob({ createdAt: new Date(NOW - 60 * DAY * 1000).toISOString() });
    docs.set("captureOutbox/job-one:video_received", { kind: "video_received", requestId: "job-one", status: "sent",
      createdAtIso: new Date(NOW - DAY * 1000).toISOString() });
    expect(await sweepWebsiteJobNoGrant("job-one", at(0))).toBe("clock_started");
    expect(job().website_job_no_grant_page_due_at_ms).toBe(at(24 * HOUR));
  });

  it("never gives a site operator's request that is not a website job a clock, an ending, an email or a page", async () => {
    recording.received = true;
    seedJob({}, "job-one", false);
    seedJob({ request: { buyerType: "site_operator", capture_region: "non_us" } }, "job-two");
    const before = snapshot();
    for (const seconds of [0, 2 * DAY, WINDOW, 3 * WINDOW]) {
      expect(await sweepAt(seconds)).toEqual({ examined: 2, ended: 0, noticesQueued: 0, failed: 0 });
      expect(await scanAt(seconds)).toEqual({ due: 0, newlyAlerted: 0 });
    }
    await deliverOutbox();
    expect(snapshot()).toEqual(before);
    expect(send).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
  });
});
