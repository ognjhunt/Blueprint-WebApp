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
import { sweepWebsiteJobNoGrant, sweepWebsiteJobWindows } from "../utils/websiteJobWindowSweep";
import { SCENE_SCREEN_GATE_ENDED_FIELD, sceneScreenGateEndedMarker } from "../utils/sceneScreenGate";
import { websiteJobWorkWindow } from "../utils/websiteSceneSponsorship";
import { recordedWebsiteJobNoGrantEnding, sealWebsiteJobNoGrantEnding } from "../utils/websiteJobWindowEnding";
import { buildJobSharedListing } from "../utils/jobSharedListing";
import { teamJobAccess } from "../utils/teamJobAccess";
import { sharedJobFields } from "./helpers/sharedJob";

const HOUR = 3600, DAY = 86400;
const WINDOW = WEBSITE_JOB_WINDOW_DEFAULT_SECONDS;
/** The first pass that sees the job after this ships. */
const NOW = Date.UTC(2026, 10, 12);
const JOB = "inboundRequests/job-one";
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

  it("starts its clock when the sweep first sees it, is quiet until the window has run, then ends once (no email)", async () => {
    seedJob();
    expect(await sweepAt(0)).toEqual({ examined: 1, ended: 0, failed: 0 });
    // The clock starts now, not at the job's creation months ago.
    expect(job().website_job_no_grant_clock).toEqual({ schema_version: "website_job_no_grant_clock.v1", request_id: "job-one",
      waiting_on: waitingOn, since_epoch: NOW / 1000, window_seconds: WINDOW, capture_id: "walkthrough-job-one" });
    expect(job().website_job_no_grant_page_due_at_ms).toBe(waitingOn === "blueprint" ? at(24 * HOUR) : null);

    // Not yet due: quiet.
    for (const seconds of [HOUR, WINDOW - 1]) {
      expect(await sweepWebsiteJobNoGrant("job-one", at(seconds))).toBe("waiting");
      expect(await sweepAt(seconds)).toEqual({ examined: 1, ended: 0, failed: 0 });
    }
    expect(job()).not.toHaveProperty("website_job_no_grant_ending");
    expect(outbox()).toHaveLength(0);
    expect((await page()).decision).not.toBe("ended");

    // Due: ended once, in one write; the page says it (no email, owner 2026-11-19).
    expect(await sweepAt(WINDOW)).toEqual({ examined: 1, ended: 1, failed: 0 });
    const ending = job().website_job_no_grant_ending;
    expect(ending).toMatchObject({ schema_version: "website_job_no_grant_ending.v1", request_id: "job-one", waiting_on: waitingOn,
      waiting_since_epoch: NOW / 1000, ended_at_epoch: NOW / 1000 + WINDOW, notice: "none_emails_retired" });
    expect(job().website_job_no_grant_page_due_at_ms).toBeNull();
    expect(outbox()).toHaveLength(0);

    // The job page says the same sentence, the way a window ending shows.
    expect(await page()).toMatchObject({ decision: "ended", headline: message, operatorAction: null, stage: null });

    // Re-running the sweep sends nothing more.
    for (const seconds of [WINDOW + 60, WINDOW + 30 * DAY]) {
      expect(await sweepAt(seconds)).toEqual({ examined: 1, ended: 0, failed: 0 });
    }
    expect(job().website_job_no_grant_ending).toEqual(ending);
    await deliverOutbox();
    expect(send).not.toHaveBeenCalled();
  });

  it("does not end a withdrawn job", async () => {
    seedJob();
    await sweepAt(0);
    Object.assign(job(), { consent_revoked: true, capture_withdrawal: { state: "uploads_stopped_cleanup_pending" } });
    expect(await sweepWebsiteJobNoGrant("job-one", at(WINDOW))).toBe("withdrawn");
    expect(job()).not.toHaveProperty("website_job_no_grant_ending");
    expect(outbox()).toHaveLength(0);
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

  // No job is kept on file for its kind: whatever the screen read, a job with no grant waits on the no-grant clock,
  // recorded exactly as the same job of a kind we score, with or without the 2026-11-11 marker or a bound owner.
  const marked = { [SCENE_SCREEN_GATE_ENDED_FIELD]: sceneScreenGateEndedMarker("job-one", new Date(NOW - DAY * 1000).toISOString(), "job_created"),
    capture_owner_uid: "site-job-owner", capture_owner_bound_at_iso: new Date(NOW - DAY * 1000).toISOString() };
  it.each([
    ["marked, recording saved", marked, true], ["marked, no recording", marked, false],
    ["without the marker", {}, true], ["with no bound owner", { [SCENE_SCREEN_GATE_ENDED_FIELD]: marked[SCENE_SCREEN_GATE_ENDED_FIELD] }, true],
  ] as const)("never keeps on file a job of a kind accepted for analysis (%s)", async (_name, changes, received) => {
    for (const reason of ["mobile", "door_opening", "multi_step", "deformable"]) {
      docs.clear();
      recording.received = received;
      seedJob({ ...changes, site_task_scope: { supported: false, reason, disposition: "accepted_for_analysis" } });
      expect(await sweepWebsiteJobNoGrant("job-one", at(0))).toBe("clock_started");
      const accepted = structuredClone(job());
      expect(accepted).not.toHaveProperty("kept_on_file_answer_owed_at_iso");
      expect(accepted).not.toHaveProperty("answer_notices_waiting");
      // Recorded exactly as the same job of a kind we score.
      docs.clear();
      seedJob({ ...changes, site_task_scope: { supported: true, kind: "rigid_pick_and_place", reason: null, disposition: "scorable" } });
      expect(await sweepWebsiteJobNoGrant("job-one", at(0))).toBe("clock_started");
      expect(accepted.website_job_no_grant_clock).toEqual(job().website_job_no_grant_clock);
      expect(accepted.website_job_no_grant_clock.waiting_on).toBe(received ? "blueprint" : "site");
    }
  });

  // A job an earlier release kept on file had no clock running. Its wait starts at the pass that first sees it now,
  // never backfilled from its creation, and it ends after a full window with the one email.
  it.each([
    ["no clock", marked, {}],
    ["no clock, and no marker", {}, {}],
    ["a clock frozen from before it was kept on file", marked,
      { website_job_no_grant_clock: { schema_version: "website_job_no_grant_clock.v1", request_id: "job-one", waiting_on: "site",
        since_epoch: NOW / 1000 - 10 * DAY, window_seconds: WINDOW, capture_id: "walkthrough-job-one" } }],
  ])("starts the clock at the pass for a job an earlier release kept on file (%s)", async (_name, changes, clock) => {
    const created = new Date(NOW - 8 * DAY * 1000).toISOString();
    seedJob({ ...changes, createdAt: created, kept_on_file_answer_owed_at_iso: new Date(NOW - 7 * DAY * 1000).toISOString(),
      site_task_scope: { supported: false, reason: "mobile", disposition: "accepted_for_analysis" }, ...clock });
    expect(await sweepWebsiteJobNoGrant("job-one", at(0))).toBe("clock_started");
    expect(job().website_job_no_grant_clock).toMatchObject({ waiting_on: "site", since_epoch: NOW / 1000, window_seconds: WINDOW });
    expect(job()).not.toHaveProperty("website_job_no_grant_ending");
    expect(outbox()).toHaveLength(0);
    expect(await sweepWebsiteJobNoGrant("job-one", at(WINDOW - 1))).toBe("waiting");
    expect(await sweepAt(WINDOW)).toEqual({ examined: 1, ended: 1, failed: 0 });
    expect(job().website_job_no_grant_ending).toMatchObject({ waiting_since_epoch: NOW / 1000, ended_at_epoch: NOW / 1000 + WINDOW,
      notice: "none_emails_retired" });
    expect(outbox()).toHaveLength(0);
  });


  it.each([["marked", marked], ["without the marker", {}]])(
    "starts the clock at the pass for a job of another kind it has never seen, however old (%s)", async (_name, changes) => {
      seedJob({ ...changes, createdAt: new Date(NOW - 30 * DAY * 1000).toISOString(),
        site_task_scope: { supported: false, reason: "other", disposition: "accepted_for_analysis" } });
      expect(await sweepWebsiteJobNoGrant("job-one", at(0))).toBe("clock_started");
      expect(job().website_job_no_grant_clock).toMatchObject({ since_epoch: NOW / 1000 });
      expect(job()).not.toHaveProperty("website_job_no_grant_ending");
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

// 2026-11-20: a job sent with its description only is complete without a video. The clock used to take the missing
// video for the site's step and end the job ("start a new job") while companies still saw it.
describe("a job the site sent with its description only", () => {
  const AUTH_AT = new Date(NOW - DAY * 1000).toISOString();
  const wrongEnding = () => sealWebsiteJobNoGrantEnding({ request_id: "job-one", waiting_on: "site", waiting_since_epoch: NOW / 1000 - WINDOW,
    ended_at_epoch: NOW / 1000, recorded_at_iso: new Date(NOW).toISOString(), notice: "none_emails_retired" });
  function seedDescriptionOnly(changes: Record<string, unknown> = {}) {
    const { job: record } = screeningFixture();
    seedJob({ request: { ...record.request, capture_region: "us", consent_attestation: null,
      description_authority: { granted: true, statement_version: "2026-11-12.v5", recorded_at_iso: AUTH_AT } },
    public_task_listing: buildJobSharedListing({ taskStatement: "Move the rigid part to its tray", atIso: AUTH_AT,
      descriptionStatementVersion: "2026-11-12.v5" }), ...changes });
  }

  it("waits on nobody: no clock and no ending, however long it is listed, and the page and the listing agree it is open", async () => {
    seedDescriptionOnly();
    expect(teamJobAccess(job())).toMatchObject({ listed: true, reason: "no_video_yet" });
    const before = snapshot();
    expect(await sweepWebsiteJobNoGrant("job-one", at(0))).toBe("description_only");
    expect(await sweepWebsiteJobNoGrant("job-one", at(WINDOW * 3))).toBe("description_only");
    await sweepAt(WINDOW * 4);
    expect(snapshot()).toEqual(before);
    expect((await page()).decision).not.toBe("ended");
    expect(teamJobAccess(job())).toMatchObject({ listed: true, reason: "no_video_yet" });
  });

  it("reads an ending the clock recorded for it before as no ending, and leaves the stored record as it is", async () => {
    seedDescriptionOnly({ website_job_no_grant_ending: wrongEnding() });
    expect(recordedWebsiteJobNoGrantEnding(job(), "job-one")).toBeNull();
    expect((await page()).decision).not.toBe("ended");
    expect(teamJobAccess(job())).toMatchObject({ listed: true, reason: "no_video_yet" });
    expect(await sweepWebsiteJobNoGrant("job-one", at(WINDOW))).toBe("description_only");
    expect(job().website_job_no_grant_ending).toEqual(wrongEnding());
  });

  it("still waits on the site's sentence while its brief says nothing about the job", async () => {
    seedDescriptionOnly({ site_task_scope: { supported: false, reason: "unclear" } });
    expect(await sweepWebsiteJobNoGrant("job-one", at(0))).toBe("clock_started");
    expect(job().website_job_no_grant_clock).toMatchObject({ waiting_on: "site" });
  });
});

describe("a job ended for want of the site's step", () => {
  const ending = (waitingOn: "site" | "blueprint") => sealWebsiteJobNoGrantEnding({ request_id: "job-one", waiting_on: waitingOn,
    waiting_since_epoch: NOW / 1000 - WINDOW, ended_at_epoch: NOW / 1000, recorded_at_iso: new Date(NOW).toISOString(), notice: "none_emails_retired" });
  it("is not shown to companies, as its page says it ended; a wait on Blueprint holds only the simulation and stays listed", () => {
    const listed = { requestId: "job-one", ...sharedJobFields("job-one") };
    expect(teamJobAccess(listed)).toMatchObject({ listed: true });
    expect(teamJobAccess({ ...listed, website_job_no_grant_ending: ending("site") })).toMatchObject({ listed: false, reason: "job_ended" });
    expect(teamJobAccess({ ...listed, website_job_no_grant_ending: ending("blueprint") })).toMatchObject({ listed: true });
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
    expect(await sweepWebsiteJobNoGrant("job-one", at(5 * DAY + WINDOW))).toBe("ended_no_notice");
    expect(job().website_job_no_grant_ending.waiting_on).toBe("blueprint");
  });

  it("a job whose brief gives no sentence about it waits on the site, recording or not; a job of several steps does not", async () => {
    recording.received = true;
    seedJob({ site_task_scope: { supported: false, reason: "unclear" } });
    expect(await sweepWebsiteJobNoGrant("job-one", at(0))).toBe("clock_started");
    expect(job().website_job_no_grant_clock.waiting_on).toBe("site");
    docs.clear();
    seedJob({ site_task_scope: { supported: false, reason: "multi_step" } }, "job-one", true);
    docs.set("siteTaskBriefs/job-one", { ...(docs.get("siteTaskBriefs/job-one") ?? {}),
      summary: "Take the plates to the kitchen then load the dishwasher" });
    expect(await sweepWebsiteJobNoGrant("job-one", at(0))).toBe("clock_started");
    expect(job().website_job_no_grant_clock.waiting_on).toBe("blueprint");
  });

  it("does not start or end anything when the recording's status cannot be read", async () => {
    recording.received = null;
    seedJob();
    expect(await sweepAt(0)).toEqual({ examined: 1, ended: 0, failed: 1 });
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
    expect(await sweepWebsiteJobNoGrant("job-one", at(WINDOW))).toBe("ended_no_notice");
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
    expect(await sweepAt(0)).toEqual({ examined: 1, ended: 1, failed: 0 });
    expect(job().website_job_no_grant_ending).toMatchObject({ notice, ended_at_epoch: NOW / 1000 });
    expect(job()).not.toHaveProperty("website_job_no_grant_clock");
    expect(job().website_job_no_grant_page_due_at_ms).toBeNull();
    expect(await scanAt(2 * DAY)).toEqual({ due: 0, newlyAlerted: 0 });
    for (const seconds of [WINDOW, 3 * WINDOW]) expect(await sweepAt(seconds)).toMatchObject({ ended: 0 });
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
      expect(await sweepAt(seconds)).toEqual({ examined: 2, ended: 0, failed: 0 });
      expect(await scanAt(seconds)).toEqual({ due: 0, newlyAlerted: 0 });
    }
    await deliverOutbox();
    expect(snapshot()).toEqual(before);
    expect(send).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
  });
});
