// @vitest-environment node
/**
 * The WebApp's own timer for a website job (`websiteJobWindowSweep`), against the
 * fake Firestore, with the real outbox, notice builder, dispatch check, job-page
 * projection and stored scene progression. Only the email provider and field
 * decryption are stubbed.
 *
 * Pins: a job past its window with nothing on record is ended once, with one
 * email, however often the sweep runs; a window that ended before the cutover is
 * ended with no email; a withdrawn job, a job with a result or a told outcome,
 * an owner-closed job and a job whose window an extension moved are untouched;
 * the email is cancelled on withdrawal and when a result arrives first; and no
 * money record is written.
 *
 * A site's job whose video arrived but which never received a grant has the same
 * length of time from when the video arrived, and ends the same way with its own
 * sentence; a job with no video is never ended; a job whose page asks the site
 * for a step is left alone.
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
  decryptFieldValue: vi.fn(async (value: string) => {
    if (value === "encrypted:unreadable") throw new Error("key service unavailable");
    return String(value).replace(/^encrypted:/, "");
  }),
}));
const send = vi.hoisted(() => vi.fn());
vi.mock("../utils/email", () => ({ sendEmail: send }));

import { crossRuntimeDigest } from "../utils/crossRuntimeCanonical";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";
import { JOB_WINDOW_ENDING_MESSAGE, JOB_WINDOW_ENDING_SUBJECT, JOB_WINDOW_ENDING_WITHOUT_GRANT_MESSAGE } from "../utils/taskPreparationOutcome";
import { projectTaskStatus, taskStatusInputFrom } from "../utils/taskStatusProjection";
import { recordedWebsiteJobWindowEnding, WEBSITE_JOB_WINDOW_ENDING_NOTICE_CUTOVER_EPOCH, WEBSITE_JOB_WINDOW_ENDING_NOTICE_CUTOVER_ISO,
  websiteJobWindowEndedNoticeKey } from "../utils/websiteJobWindowEnding";
import { websiteJobDeadlineWithoutGrant, WEBSITE_JOB_WINDOW_DEFAULT_SECONDS } from "../utils/websiteJobWindow";
import { startWebsiteJobWindowSweepWorker, sweepWebsiteJobWindow, sweepWebsiteJobWindows,
  sweepWebsiteJobWithoutGrant, websiteJobWindowEndingRecorded } from "../utils/websiteJobWindowSweep";
import { websiteJobWorkWindow } from "../utils/websiteSceneSponsorship";
import { recordSceneExecutionWindowExtension, SCENE_EXECUTION_WINDOW_NOTICE_SCHEMA } from "../utils/sceneExecutionWindowExtension";
import { deliverOutbox } from "../utils/captureOutbox";

const DAY = 86400;
const CUTOVER = WEBSITE_JOB_WINDOW_ENDING_NOTICE_CUTOVER_EPOCH;
/** The sweep runs ten days after the cutover. */
const NOW = (CUTOVER + 10 * DAY) * 1000;
/** A window that ended a day after the cutover: the site is owed its one email. */
const AFTER = CUTOVER + DAY;
/** A window that ended two days before the sweep: an extension of at most seven days can still reach past it. */
const RECENT = NOW / 1000 - 2 * DAY;
const GRANT = screeningSha("9");
const JOB = "inboundRequests/job-one";
const INTAKE = "taskEvaluationSceneIntakes/intake-one";
const NOTICE = `captureOutbox/${websiteJobWindowEndedNoticeKey("job-one")}`;
const docs = state.docs;
const job = () => docs.get(JOB) as Record<string, any>;
/** The outbox, less the job's `video_received` receipt the no-grant cases seed as "the video arrived". */
const outbox = () => [...docs.entries()].filter(([key]) => key.startsWith("captureOutbox/") && !key.includes("/deliveryReceipts/")
  && !key.endsWith(":video_received")) as Array<[string, Record<string, any>]>;
const sweep = () => sweepWebsiteJobWindows({ now: () => NOW });

/** A site's job with its grant, as the Pipeline's first grant request leaves it, and nothing else. */
function seedJob(windowEndsAtEpoch = AFTER, changes: Record<string, unknown> = {}, id = "job-one") {
  const { job: record } = screeningFixture();
  Object.assign(record.website_scene_sponsorship, { schema_version: "website_scene_sponsorship.v1", sponsor: "blueprint",
    request_id: id, authority_digest: GRANT, expires_at_epoch: windowEndsAtEpoch,
    max_total_spend_usd: 20, max_paid_attempts: 2, consent: { accepted_at_epoch: windowEndsAtEpoch - 7 * DAY } });
  docs.set(`inboundRequests/${id}`, { ...record, contact: { email: "encrypted:owner@example.com" },
    website_preparation_reservations: { ["b".repeat(64)]: { admission: { maximum_cost_usd: 5 } } }, ...changes });
}
/** The job's scene intake, in the state the worker left it. */
function seedIntake(changes: Record<string, unknown> = {}, windowEndsAtEpoch = AFTER) {
  const { intake } = screeningFixture();
  (intake.request as any).execution = { max_total_spend_usd: 20, max_paid_attempts: 2, max_retries: 0, expires_at_epoch: windowEndsAtEpoch };
  docs.set(INTAKE, { ...intake, request_digest: crossRuntimeDigest(intake.request), created_at_iso: "2026-11-05T00:00:00Z",
    root_sponsorship_digest: GRANT, sponsorship_digest: GRANT, ...changes });
}
/** The owner's time-only extension of the job's scene intent, a day past the sweep, as the Pipeline's signed notice records it. */
async function extendWindow(seed = true) {
  if (seed) { seedJob(RECENT); seedIntake({ state: "accepted" }, RECENT); }
  expect(await recordSceneExecutionWindowExtension({ schema_version: SCENE_EXECUTION_WINDOW_NOTICE_SCHEMA,
    intent_id: "scene-one", intent_digest: screeningSha("a"), extension_digest: screeningSha("7"),
    original_expires_at_epoch: RECENT, expires_at_epoch: NOW / 1000 + DAY, issued_at_epoch: RECENT + 3600,
    authorization_reference: "owner approval (time only)", authorized_via: "operator_door" }))
    .toMatchObject({ status: "recorded", sponsorship_window_mirrored: true });
}
const sealedOutcome = (kind: string, terminal: boolean, reasonCode: string) => {
  const value = { schema_version: "task_evaluation_scene_intent_outcome.v1", intent_id: "scene-one", intent_digest: screeningSha("a"),
    kind, terminal, reason_category: "blueprint_fault", reason_code: reasonCode, decided_at_epoch: AFTER - 60 };
  return { ...value, outcome_digest: crossRuntimeDigest(value) };
};
const screeningRun = (outcome: string) => docs.set("taskEvaluationPolicyRuns/campaign-one", { run_kind: "beta_policy_screening",
  team_namespace: "blueprint-operations", state: "completed", screening_outcome: outcome, screening_execution_observed: true,
  source_scene_intent_id: "scene-one", created_at_iso: "2026-11-06T00:00:00Z" });
/** What a job page shows, from the same reader and projection the two job pages use. */
const page = async (extra: Record<string, unknown> = {}) => projectTaskStatus(taskStatusInputFrom({ briefDrafted: true, stage: null,
  hasStoredCapture: true, jobWorkWindow: await websiteJobWorkWindow(job()), ...extra } as never));

beforeEach(() => {
  docs.clear();
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  send.mockReset().mockResolvedValue({ sent: true, provider: "resend", messageId: "accepted" });
});
afterEach(() => { vi.useRealTimers(); });

describe("a job past its window with no outcome", () => {
  it("is ended once, in one write with one email, however often the sweep runs", async () => {
    seedJob();
    const before = structuredClone(job());
    expect(await sweep()).toEqual({ examined: 1, ended: 1, noticesQueued: 1, failed: 0 });

    const ending = job().website_job_window_ending;
    expect(ending).toMatchObject({ schema_version: "website_job_window_ending.v1", request_id: "job-one", authority_digest: GRANT,
      window_ended_at_epoch: AFTER, recorded_at_iso: new Date(NOW).toISOString(), notice: "queued" });
    // Nothing else on the job changed: the grant and its reservations are as they were.
    expect({ ...job(), website_job_window_ending: undefined }).toEqual({ ...before, website_job_window_ending: undefined });
    expect(outbox().map(([key]) => key)).toEqual([NOTICE]);
    expect(outbox()[0][1]).toMatchObject({ kind: "scene_outcome", requestId: "job-one", status: "pending", to: "owner@example.com",
      subject: "Your Blueprint job has ended", idempotencyKey: "job-one:scene_outcome:job_window_ended" });

    // The page and the email say the same, exact sentence.
    expect(JOB_WINDOW_ENDING_MESSAGE).toBe("This job has ended because the time Blueprint was authorized to work on it ran out. "
      + "Blueprint did not finish it in that time, and no more work will run on this job. "
      + "Nothing more is needed from you. Keep your original recording; to have Blueprint work on this site again, you can start a new job.");
    expect(JOB_WINDOW_ENDING_SUBJECT).toBe("Your Blueprint job has ended");
    expect(await page()).toMatchObject({ decision: "ended", headline: JOB_WINDOW_ENDING_MESSAGE, operatorAction: null, stage: null });
    const body: string = outbox()[0][1].body;
    expect(body.startsWith(`${JOB_WINDOW_ENDING_MESSAGE}\n\nOpen your job on your private job page:\nhttps://`)).toBe(true);
    expect(body.endsWith("\n\n— The Blueprint team")).toBe(true);
    // It promises nothing a person or a timer would have to do.
    expect(body).not.toMatch(/we will|we'll|our team|review|follow up|email you/i);

    // Twice more: still one ending and one email.
    for (let pass = 0; pass < 2; pass++) expect(await sweep()).toEqual({ examined: 1, ended: 0, noticesQueued: 0, failed: 0 });
    expect(job().website_job_window_ending).toEqual(ending);
    expect(outbox()).toHaveLength(1);

    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ to: "owner@example.com", subject: "Your Blueprint job has ended" });
    expect(outbox()[0][1].status).toBe("sent");
    await sweep();
    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
    expect(outbox()).toHaveLength(1);
  });

  it("is ended with no email when its window ended before the cutover", async () => {
    expect(WEBSITE_JOB_WINDOW_ENDING_NOTICE_CUTOVER_ISO).toBe("2026-11-11T00:00:00Z");
    expect(CUTOVER).toBe(Date.UTC(2026, 10, 11) / 1000);
    seedJob(CUTOVER - 1);
    expect(await sweep()).toEqual({ examined: 1, ended: 1, noticesQueued: 0, failed: 0 });
    expect(job().website_job_window_ending).toMatchObject({ window_ended_at_epoch: CUTOVER - 1, notice: "none_window_ended_before_cutover" });
    expect(outbox()).toHaveLength(0);
    expect((await page()).headline).toBe(JOB_WINDOW_ENDING_MESSAGE);
    await sweep();
    await deliverOutbox();
    expect(outbox()).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
    // A window that ended exactly at the cutover is owed the email.
    seedJob(CUTOVER, {}, "job-two");
    await sweep();
    expect(outbox().map(([key]) => key)).toEqual(["captureOutbox/job-two:scene_outcome:job_window_ended"]);
  });

  it.each([
    ["a scene intake still waiting to be forwarded", () => seedIntake({ state: "forward_blocked", blocker: "pipeline_transport_failed", receipt: undefined, pipeline_status: undefined })],
    ["a scene intake the old retry cap blocked", () => seedIntake({ state: "blocked", blocker: "transport_retry_cap_exhausted", receipt: undefined, pipeline_status: undefined })],
    ["an accepted intake whose poll stopped at the window", () => seedIntake({ state: "expired", blocker: "consent_expired",
      pipeline_status: { status: "running", phase: "configuration", blockers: [], attempts: [] } })],
    ["an intake waiting on an internal approval", () => seedIntake({ state: "accepted", pipeline_status: { status: "blocked", phase: "configuration",
      blockers: ["scene_intake_spend_cap_exhausted"], outcome: { ...sealedOutcome("awaiting_spend_approval", false, "spend_cap_reached"), } } })],
    ["a built scene no evaluation finished on", () => { seedIntake(); screeningRun("setup_repair"); }],
    ["preparation that never moved", () => docs.set("captureUploadSessions/walkthrough-job-one", { website_preparation: { status: { state: "preparing" } } })],
    ["a preparation status the Pipeline ended without telling the site", () => docs.set("captureUploadSessions/walkthrough-job-one",
      { website_preparation: { status: { state: "authority_ended" } } })],
  ])("ends a job stranded with %s", async (_name, strand) => {
    seedJob();
    strand();
    const intake = structuredClone(docs.get(INTAKE));
    expect(await sweep()).toMatchObject({ ended: 1, noticesQueued: 1 });
    expect(job().website_job_window_ending.notice).toBe("queued");
    // The scene intake, the Pipeline's intent and its budget are not written by the sweep.
    expect(docs.get(INTAKE)).toEqual(intake);
  });
});

describe("a job the sweep must leave alone", () => {
  const cases: Array<[string, () => unknown]> = [
    ["withdrawn", () => Object.assign(job(), { consent_revoked: true, future_processing_allowed: false,
      capture_withdrawal: { state: "deletion_confirmed", requestedAtIso: "2026-11-09T00:00:00Z" } })],
    ["in the middle of a withdrawal", () => Object.assign(job(), { consent_revoked: true,
      capture_withdrawal: { state: "uploads_stopped_cleanup_pending" }, captureWithdrawalPending: true })],
    ["estimated", () => { seedIntake(); screeningRun("estimate"); }],
    ["held by its evaluation", () => { seedIntake(); screeningRun("held_capability"); }],
    ["told the Pipeline's own ending", () => seedIntake({ state: "blocked", pipeline_status: { status: "blocked", phase: "authority",
      blockers: ["scene_intake_authority_expired"], outcome: sealedOutcome("setup_repair", true, "authority_expired") } })],
    ["told its preparation ended for good", () => docs.set("captureUploadSessions/walkthrough-job-one",
      { website_preparation: { status: { state: "failed_terminal", terminal_reason: "retry_exhausted" } } })],
    ["held because no robot fits", () => docs.set("captureUploadSessions/walkthrough-job-one",
      { website_preparation: { status: { state: "awaiting_inputs", outcome: { reason: "robot_fit_none" } } } })],
    ["evaluated by a run", () => docs.set("evaluationRuns/run-one", { sceneId: "job-one", teamId: "team-one", state: "completed",
      purpose: "site_evaluation", result: { observed: { episodesRun: 10, episodesSucceeded: 4 } } })],
    ["extended into the future by the owner", () => extendWindow()],
    ["still inside its window", () => { job().website_scene_sponsorship.expires_at_epoch = NOW / 1000 + 60; }],
  ];
  it.each(cases)("leaves a job %s untouched", async (_name, arrange) => {
    seedJob();
    await arrange();
    const before = new Map([...docs.entries()].map(([key, value]) => [key, structuredClone(value)]));
    expect(await sweep()).toEqual({ examined: 1, ended: 0, noticesQueued: 0, failed: 0 });
    await sweep();
    // Nothing but the sweep's own rotating cursor was written: not the job, not an intake, not the outbox.
    const after = new Map([...docs.entries()].filter(([key]) => !key.startsWith("automationCursors/")));
    expect(after).toEqual(before);
    expect(job()).not.toHaveProperty("website_job_window_ending");
    expect(outbox()).toHaveLength(0);
  });

  it("leaves an owner-closed job untouched, and a job with no grant has no window to end", async () => {
    seedJob();
    const closure = { schema_version: "website_run_closure.v1", request_id: "job-one", capture_id: "walkthrough-job-one",
      decision: "conservative_abstention", actor: "signed_owner_link", source_identity_digest: screeningSha("1"),
      closed_at_iso: "2026-11-09T00:00:00.000Z", new_execution_authorized: false, explicit_resume_required: true, physical_validation: false };
    job().website_run_closures = { "walkthrough-job-one": { ...closure, closure_digest: crossRuntimeDigest(closure) } };
    expect(await sweepWebsiteJobWindow("job-one", NOW)).toBe("owner_closed");
    const { job: ungranted } = screeningFixture();
    delete ungranted.website_scene_sponsorship;
    docs.set("inboundRequests/job-two", ungranted);
    // No grant and no video yet: nothing runs for it, so it is not ended (the no-grant cases below).
    expect(await sweepWebsiteJobWindow("job-two", NOW)).toBe("no_video");
    expect(await sweep()).toMatchObject({ ended: 0 });
    expect(outbox()).toHaveLength(0);
  });

  it("ends it later, once, when the extended window passes with still nothing on record", async () => {
    await extendWindow();
    expect(await websiteJobWorkWindow(job())).toEqual({ untilEpoch: NOW / 1000 + DAY, ended: false });
    expect(await sweep()).toMatchObject({ ended: 0 });
    vi.setSystemTime(NOW + 2 * DAY * 1000);
    expect(await sweepWebsiteJobWindows()).toMatchObject({ ended: 1, noticesQueued: 1 });
    expect(job().website_job_window_ending.window_ended_at_epoch).toBe(NOW / 1000 + DAY);
  });
});

describe("the ending and what comes after it", () => {
  it("cancels the email when recording permission is withdrawn before it is sent", async () => {
    seedJob();
    await sweep();
    Object.assign(job(), { consent_revoked: true, capture_withdrawal: { state: "uploads_stopped_cleanup_pending" } });
    await deliverOutbox();
    expect(send).not.toHaveBeenCalled();
    expect(outbox()[0][1].status).toBe("cancelled");
    expect((await page({ consentRevoked: true })).headline).toMatch(/consent was withdrawn/);
  });

  it("cancels the email when an estimate arrived first, and the page shows the estimate", async () => {
    seedJob();
    await sweep();
    seedIntake();
    screeningRun("estimate");
    await deliverOutbox();
    expect(outbox().find(([key]) => key === NOTICE)![1].status).toBe("cancelled");
    expect((await page({ sceneProgression: { state: "evaluated" } })).headline).toMatch(/^Your simulation estimate is ready/);
  });

  it("is the job's one ending: a Pipeline ending read afterwards sends no second email and does not change the page", async () => {
    seedJob();
    await sweep();
    const outcome = sealedOutcome("setup_repair", true, "authority_expired");
    const { sceneOutcomeNoticeIntent } = await import("../utils/sceneIntentOutcome");
    seedIntake({ state: "blocked", pipeline_status: { status: "blocked", phase: "authority",
      blockers: ["scene_intake_authority_expired"], outcome } });
    const intent = sceneOutcomeNoticeIntent("intake-one", docs.get(INTAKE) as never);
    expect(intent).toMatchObject({ kind: "setup_repair" });
    Object.assign(docs.get(INTAKE)!, { scene_outcome_notification_pending: true, scene_outcome_notification_intent: intent });
    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].subject).toBe("Your Blueprint job has ended");
    expect(outbox().map(([key]) => key)).toEqual([NOTICE]);
    expect((docs.get(INTAKE) as any).scene_outcome_notification_pending).toBe(false);
    expect((await page({ sceneProgression: { state: "ended", sceneOutcome: { kind: "setup_repair", terminal: true,
      reasonCode: "authority_expired", digest: outcome.outcome_digest } } })).headline).toBe(JOB_WINDOW_ENDING_MESSAGE);
  });

  it("stops speaking for the job when the window is reopened or the grant is re-issued, and never emails a job twice", async () => {
    seedJob();
    await sweep();
    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
    // The owner re-issues the expired grant: a new window, so the old ending no longer shows.
    Object.assign(job().website_scene_sponsorship, { authority_digest: screeningSha("8"), expires_at_epoch: NOW / 1000 + 7 * DAY });
    expect(await websiteJobWorkWindow(job())).toEqual({ untilEpoch: NOW / 1000 + 7 * DAY, ended: false });
    expect((await page()).decision).not.toBe("ended");
    expect(await sweep()).toMatchObject({ ended: 0 });
    // That window passes too with nothing on record: the ending is recorded for the new grant, with no second email.
    vi.setSystemTime(NOW + 8 * DAY * 1000);
    expect(await sweepWebsiteJobWindows()).toMatchObject({ ended: 1, noticesQueued: 0 });
    expect(job().website_job_window_ending).toMatchObject({ authority_digest: screeningSha("8"), notice: "queued" });
    expect((await page()).decision).toBe("ended");
    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
    expect(outbox()).toHaveLength(1);
  });

  it("still tells the site when an extension cancelled the first email unsent and the extended window then ends", async () => {
    seedJob(RECENT);
    seedIntake({ state: "accepted" }, RECENT);
    expect(await sweep()).toMatchObject({ ended: 1, noticesQueued: 1 });
    // The owner's extension lands before the email is dispatched: the ending no longer stands, so it is cancelled.
    await extendWindow(false);
    await deliverOutbox();
    expect(send).not.toHaveBeenCalled();
    expect(docs.get(NOTICE)).toMatchObject({ status: "cancelled" });
    expect(await sweep()).toMatchObject({ ended: 0 });
    // The extended window passes with still nothing on record: a new ending, and its one email under its own fixed key.
    const extendedEnd = NOW / 1000 + DAY;
    vi.setSystemTime(NOW + 2 * DAY * 1000);
    expect(await sweepWebsiteJobWindows()).toEqual({ examined: 1, ended: 1, noticesQueued: 1, failed: 0 });
    expect(job().website_job_window_ending).toMatchObject({ authority_digest: GRANT, window_ended_at_epoch: extendedEnd, notice: "queued" });
    const second = `captureOutbox/job-one:scene_outcome:job_window_ended-${Math.round(extendedEnd)}`;
    expect(websiteJobWindowEndedNoticeKey("job-one", extendedEnd)).toBe(second.slice("captureOutbox/".length));
    expect(outbox().map(([key]) => key).sort()).toEqual([NOTICE, second].sort());
    expect(docs.get(second)).toMatchObject({ kind: "scene_outcome", status: "pending", subject: "Your Blueprint job has ended" });
    for (let pass = 0; pass < 2; pass++) {
      expect(await sweepWebsiteJobWindows()).toMatchObject({ ended: 0, noticesQueued: 0 });
      await deliverOutbox();
    }
    expect(send).toHaveBeenCalledTimes(1);
    expect(docs.get(second)).toMatchObject({ status: "sent" });
    expect(docs.get(NOTICE)).toMatchObject({ status: "cancelled" });
    expect(outbox()).toHaveLength(2);
  });

  it("never sends a second email when the first was sent before the window was extended", async () => {
    seedJob(RECENT);
    seedIntake({ state: "accepted" }, RECENT);
    await sweep();
    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
    await extendWindow(false);
    vi.setSystemTime(NOW + 2 * DAY * 1000);
    // The later ending is recorded for the page, and the email that already went out stays the only one.
    expect(await sweepWebsiteJobWindows()).toEqual({ examined: 1, ended: 1, noticesQueued: 0, failed: 0 });
    expect(job().website_job_window_ending).toMatchObject({ window_ended_at_epoch: NOW / 1000 + DAY, notice: "queued" });
    expect((await page()).decision).toBe("ended");
    await sweepWebsiteJobWindows();
    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
    expect(outbox().map(([key]) => key)).toEqual([NOTICE]);
  });

  it("ends a job nobody can be emailed about, and waits a day for an address that will not decrypt", async () => {
    seedJob(AFTER, { contact: {} });
    expect(await sweepWebsiteJobWindow("job-one", NOW)).toBe("ended_no_notice");
    expect(job().website_job_window_ending.notice).toBe("none_no_contact_on_file");
    seedJob(AFTER, { contact: { email: "encrypted:unreadable" } }, "job-two");
    expect(await sweepWebsiteJobWindow("job-two", (AFTER + 3600) * 1000)).toBe("contact_unreadable");
    expect(docs.get("inboundRequests/job-two")).not.toHaveProperty("website_job_window_ending");
    expect(await sweepWebsiteJobWindow("job-two", (AFTER + DAY) * 1000)).toBe("ended_no_notice");
    expect(outbox()).toHaveLength(0);
  });

  it("keeps turning through the jobs when one cannot be read", async () => {
    seedJob(AFTER, { website_run_closures: "damaged" }, "job-a");
    seedJob(AFTER, {}, "job-b");
    expect(await sweepWebsiteJobWindows({ now: () => NOW, limit: 1 })).toEqual({ examined: 1, ended: 0, noticesQueued: 0, failed: 1 });
    expect(await sweepWebsiteJobWindows({ now: () => NOW, limit: 1 })).toEqual({ examined: 1, ended: 1, noticesQueued: 1, failed: 0 });
    expect(docs.get("inboundRequests/job-a")).not.toHaveProperty("website_job_window_ending");
  });
});

/** When a no-grant job's video arrived: a day after the cutover, so its deadline (seven days on) passed three days before the sweep. */
const ARRIVED = CUTOVER + DAY;
const iso = (epoch: number) => new Date(epoch * 1000).toISOString();
const SOURCE_OWNER = `site-job-${"a".repeat(40)}`;
/** A site's job whose video arrived (its `video_received` receipt) and for which no grant was ever issued. */
function seedUngranted(arrivedAtEpoch: number | null = ARRIVED, changes: Record<string, unknown> = {}, id = "job-one") {
  const { job: record, brief } = screeningFixture();
  delete record.website_scene_sponsorship;
  docs.set(`inboundRequests/${id}`, { ...record, capture_owner_uid: SOURCE_OWNER, contact: { email: "encrypted:owner@example.com" }, ...changes });
  docs.set(`siteTaskBriefs/${id}`, { ...brief, requestId: id });
  if (arrivedAtEpoch !== null) docs.set(`captureOutbox/${id}:video_received`, { kind: "video_received", requestId: id,
    idempotencyKey: `${id}:video_received`, status: "sent", createdAtIso: iso(arrivedAtEpoch) });
}
const atlasHold = () => {
  const value = { schema_version: "website_atlas_preview.v1", capture_id: "walkthrough-job-one", revision: 3, state: "needs_input",
    reason: "website_native_task_profile_preparation_required", updated_at_epoch: ARRIVED + 60, bundle: null, splat_available: false,
    mesh_available: false, claim_ceiling: "development_only", scale_status: "unscaled_provider_world_units" };
  return { "walkthrough-job-one": { ...value, preview_digest: crossRuntimeArtifactDigest(value, "preview_digest") } };
};
const HOLD = "website_job_no_grant_hold";
const MULTI_STEP = "Pick up the box from the shelf, then wipe the counter, then sweep the floor";
const setBrief = (summary: string, id = "job-one") => Object.assign(docs.get(`siteTaskBriefs/${id}`)!, { summary });
const at = (epoch: number) => epoch * 1000;
const POLICY = { owner: { user_id: "blueprint", organization_id: "blueprint" }, upstream_max_spend_usd: 1, native_max_spend_usd: 1,
  max_total_spend_usd: 2, max_paid_attempts: 2, provider_terms_reference: `sha256:${"c".repeat(64)}` };

describe("a site's job whose video arrived but which never received a grant", () => {
  it("is never ended while no video has arrived, at any age", async () => {
    seedUngranted(null);
    for (const at of [NOW, NOW + 400 * DAY * 1000]) {
      expect(await sweepWebsiteJobWindow("job-one", at)).toBe("no_video");
      expect(await sweepWebsiteJobWindows({ now: () => at })).toEqual({ examined: 1, ended: 0, noticesQueued: 0, failed: 0 });
    }
    expect(job()).not.toHaveProperty("website_job_window_ending");
    expect(outbox()).toHaveLength(0);
  });

  it("is open until the window length has passed from the video's arrival, then ended once with one email in its own sentence", async () => {
    const arrived = NOW / 1000 - 6 * DAY;
    seedUngranted(arrived);
    const before = structuredClone(job());
    expect(await sweepWebsiteJobWindow("job-one", NOW)).toBe("window_open");
    expect(await sweep()).toEqual({ examined: 1, ended: 0, noticesQueued: 0, failed: 0 });
    expect(job()).toEqual(before);

    const later = NOW + 2 * DAY * 1000;
    vi.setSystemTime(later);
    expect(await sweepWebsiteJobWindows({ now: () => later })).toEqual({ examined: 1, ended: 1, noticesQueued: 1, failed: 0 });
    const ending = job().website_job_window_ending;
    expect(websiteJobDeadlineWithoutGrant({ videoReceivedAtIso: iso(arrived) }, WEBSITE_JOB_WINDOW_DEFAULT_SECONDS))
      .toEqual({ waitingSinceIso: iso(arrived), deadlineEpoch: arrived + 7 * DAY });
    expect(ending).toEqual({ schema_version: "website_job_window_ending.v2", basis: "video_received_no_grant", request_id: "job-one",
      video_received_at_iso: iso(arrived), waiting_since_iso: iso(arrived), window_seconds: 7 * DAY, window_ended_at_epoch: arrived + 7 * DAY,
      recorded_at_iso: new Date(later).toISOString(), notice: "queued", ending_digest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/) });
    // Only the ending was written to the job: still no grant, no hold marker (never held), and no money record.
    expect({ ...job(), website_job_window_ending: undefined }).toEqual({ ...before, website_job_window_ending: undefined });
    expect(await websiteJobWindowEndingRecorded("job-one")).toBe(true);

    // The page and the email say the same, exact sentence, under the job's one window-ended key.
    expect(JOB_WINDOW_ENDING_WITHOUT_GRANT_MESSAGE).toBe("This job has ended because Blueprint did not finish it in the time it sets "
      + "for a job, and no more work will run on this job. Nothing more is needed from you. Keep your original recording; "
      + "to have Blueprint work on this site again, you can start a new job.");
    expect(outbox().map(([key]) => key)).toEqual([NOTICE]);
    expect(outbox()[0][1]).toMatchObject({ kind: "scene_outcome", status: "pending", to: "owner@example.com",
      subject: JOB_WINDOW_ENDING_SUBJECT, idempotencyKey: "job-one:scene_outcome:job_window_ended" });
    expect(String(outbox()[0][1].body).startsWith(`${JOB_WINDOW_ENDING_WITHOUT_GRANT_MESSAGE}\n\n`)).toBe(true);
    expect(await websiteJobWorkWindow(job())).toEqual({ untilEpoch: null, ended: false, endingRecorded: true, endingWithoutGrant: true });
    expect(await page()).toMatchObject({ decision: "ended", headline: JOB_WINDOW_ENDING_WITHOUT_GRANT_MESSAGE, operatorAction: null });

    for (let pass = 0; pass < 2; pass++) expect(await sweepWebsiteJobWindows({ now: () => later }))
      .toEqual({ examined: 1, ended: 0, noticesQueued: 0, failed: 0 });
    expect(job().website_job_window_ending).toEqual(ending);
    await deliverOutbox();
    await sweepWebsiteJobWindows({ now: () => later });
    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ to: "owner@example.com", subject: JOB_WINDOW_ENDING_SUBJECT });
    expect(outbox()).toHaveLength(1);
  });

  it("counts the deadline with the configured window length", async () => {
    vi.stubEnv("BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON", JSON.stringify({ ...POLICY, ttl_seconds: 3600 }));
    try {
      seedUngranted(NOW / 1000 - 1800);
      expect(await sweepWebsiteJobWindow("job-one", NOW)).toBe("window_open");
      seedUngranted(NOW / 1000 - 7200, {}, "job-two");
      expect(await sweepWebsiteJobWindow("job-two", NOW)).toBe("ended_notice_queued");
      expect(docs.get("inboundRequests/job-two")!.website_job_window_ending)
        .toMatchObject({ window_seconds: 3600, window_ended_at_epoch: NOW / 1000 - 3600 });
    } finally { vi.unstubAllEnvs(); }
  });

  it("is ended with no email when its deadline passed before the cutover", async () => {
    seedUngranted(CUTOVER - 8 * DAY);
    expect(await sweep()).toEqual({ examined: 1, ended: 1, noticesQueued: 0, failed: 0 });
    expect(job().website_job_window_ending).toMatchObject({ window_ended_at_epoch: CUTOVER - DAY, notice: "none_window_ended_before_cutover" });
    expect((await page()).headline).toBe(JOB_WINDOW_ENDING_WITHOUT_GRANT_MESSAGE);
    await sweep();
    await deliverOutbox();
    expect(outbox()).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("waits a day for an address that will not decrypt, and ends a job nobody can be emailed about", async () => {
    seedUngranted(ARRIVED, { contact: { email: "encrypted:unreadable" } });
    const deadline = ARRIVED + 7 * DAY;
    expect(await sweepWebsiteJobWindow("job-one", (deadline + 3600) * 1000)).toBe("contact_unreadable");
    expect(job()).not.toHaveProperty("website_job_window_ending");
    expect(await sweepWebsiteJobWindow("job-one", (deadline + DAY) * 1000)).toBe("ended_no_notice");
    expect(job().website_job_window_ending.notice).toBe("none_no_contact_on_file");
    expect(outbox()).toHaveLength(0);
  });

  const leftAlone: Array<[string, () => unknown, string]> = [
    ["withdrawn", () => Object.assign(job(), { consent_revoked: true, future_processing_allowed: false,
      capture_withdrawal: { state: "deletion_confirmed", requestedAtIso: "2026-11-09T00:00:00Z" } }), "withdrawn"],
    ["in the middle of a withdrawal", () => Object.assign(job(), { consent_revoked: true,
      capture_withdrawal: { state: "uploads_stopped_cleanup_pending" }, captureWithdrawalPending: true }), "withdrawn"],
    ["closed by the owner", () => {
      const closure = { schema_version: "website_run_closure.v1", request_id: "job-one", capture_id: "walkthrough-job-one",
        decision: "conservative_abstention", actor: "signed_owner_link", source_identity_digest: screeningSha("1"),
        closed_at_iso: "2026-11-09T00:00:00.000Z", new_execution_authorized: false, explicit_resume_required: true, physical_validation: false };
      job().website_run_closures = { "walkthrough-job-one": { ...closure, closure_digest: crossRuntimeDigest(closure) } };
    }, "owner_closed"],
    ["estimated", () => { seedIntake(); screeningRun("estimate"); }, "result_recorded"],
    ["held by its evaluation", () => { seedIntake(); screeningRun("held_capability"); }, "result_recorded"],
    ["told its preparation ended for good", () => docs.set("captureUploadSessions/walkthrough-job-one",
      { website_preparation: { status: { state: "failed_terminal", terminal_reason: "retry_exhausted" } } }), "outcome_told"],
    ["held because no robot fits", () => docs.set("captureUploadSessions/walkthrough-job-one",
      { website_preparation: { status: { state: "awaiting_inputs", outcome: { reason: "robot_fit_none" } } } }), "result_recorded"],
    ["held early because we can't simulate this kind of job yet", () => { job().website_atlas_previews = atlasHold(); }, "outcome_told"],
    ["asked by its page to split a job of several steps", () => Object.assign(docs.get("siteTaskBriefs/job-one")!,
      { summary: "Pick up the box from the shelf, then wipe the counter, then sweep the floor" }), "site_step_pending"],
    ["asked by its page to describe the job in one sentence", () => Object.assign(job(),
      { site_task_scope: { supported: false, reason: "unclear" } }), "site_step_pending"],
    ["a robot team's workspace evaluation, not a site's own job", () => Object.assign(job(), { workspace_evaluation: true }), "not_site_job"],
  ];
  it.each(leftAlone)("leaves a job %s unended", async (_name, arrange, reason) => {
    seedUngranted();
    await arrange();
    const before = new Map([...docs.entries()].map(([key, value]) => [key, structuredClone(value)]));
    expect(await sweepWebsiteJobWithoutGrant("job-one", NOW)).toBe(reason);
    const markerAfterFirst = structuredClone(job()[HOLD]);
    await sweep();
    await sweep();
    // A held job gets its hold marker once; a withdrawn, closed or non-site job gets nothing.
    const held = !["withdrawn", "owner_closed", "not_site_job"].includes(reason);
    expect(job()[HOLD]).toEqual(held ? { schema_version: "website_job_no_grant_hold.v1", request_id: "job-one", held: true } : undefined);
    expect(job()[HOLD]).toEqual(markerAfterFirst);
    if (held) delete job()[HOLD];
    const after = new Map([...docs.entries()].filter(([key]) => !key.startsWith("automationCursors/")));
    expect(after).toEqual(before);
    expect(job()).not.toHaveProperty("website_job_window_ending");
    expect(outbox()).toHaveLength(0);
  });

  it("asks the same projection the job page runs, from stored data alone", async () => {
    seedUngranted();
    Object.assign(docs.get("siteTaskBriefs/job-one")!, { summary: "Pick up the box from the shelf, then wipe the counter, then sweep the floor" });
    const status = await page({ multiStepHold: { steps: ["a", "b"] } });
    expect(status.operatorAction).toBeTruthy();
    expect(await sweepWebsiteJobWithoutGrant("job-one", NOW)).toBe("site_step_pending");
    // Once the site splits its job the page asks nothing more of it: the clock starts again from then.
    Object.assign(docs.get("siteTaskBriefs/job-one")!, { summary: "Move the rigid part to its tray" });
    expect(await sweepWebsiteJobWithoutGrant("job-one", NOW)).toBe("window_open");
    expect(await sweepWebsiteJobWithoutGrant("job-one", NOW + 7 * DAY * 1000)).toBe("ended_notice_queued");
  });

  it("leaves an unreadable job for the next pass and keeps turning through the rest", async () => {
    seedUngranted(ARRIVED, { website_run_closures: "damaged" }, "job-a");
    seedUngranted(ARRIVED, {}, "job-b");
    docs.set("captureOutbox/job-b:video_received", { ...docs.get("captureOutbox/job-b:video_received"), createdAtIso: 17 });
    seedUngranted(ARRIVED, {}, "job-c");
    expect(await sweepWebsiteJobWindows({ now: () => NOW, limit: 1 })).toEqual({ examined: 1, ended: 0, noticesQueued: 0, failed: 1 });
    expect(await sweepWebsiteJobWindows({ now: () => NOW, limit: 1 })).toEqual({ examined: 1, ended: 0, noticesQueued: 0, failed: 1 });
    expect(await sweepWebsiteJobWindows({ now: () => NOW, limit: 1 })).toEqual({ examined: 1, ended: 1, noticesQueued: 1, failed: 0 });
    for (const id of ["job-a", "job-b"]) expect(docs.get(`inboundRequests/${id}`)).not.toHaveProperty("website_job_window_ending");
    expect(docs.get("inboundRequests/job-c")!.website_job_window_ending).toMatchObject({ basis: "video_received_no_grant" });
  });

  it("reaches every job over successive passes with a page smaller than the job count, skipping granted jobs", async () => {
    for (const id of ["job-a", "job-b", "job-c", "job-d", "job-e"]) seedUngranted(ARRIVED, { contact: {} }, id);
    seedJob(NOW / 1000 + DAY, {}, "job-g");
    const passes = [];
    for (let pass = 0; pass < 3; pass++) passes.push(await sweepWebsiteJobWindows({ now: () => NOW, limit: 2 }));
    expect(passes.map(summary => summary.ended)).toEqual([2, 2, 1]);
    for (const id of ["job-a", "job-b", "job-c", "job-d", "job-e"])
      expect(docs.get(`inboundRequests/${id}`)!.website_job_window_ending).toMatchObject({ notice: "none_no_contact_on_file" });
    expect(docs.get("inboundRequests/job-g")).not.toHaveProperty("website_job_window_ending");
    expect(docs.get("automationCursors/website_job_window_sweep_no_grant")).toBeDefined();
  });

  it("leaves the job to the granted path when a grant is issued before the sweep's write", async () => {
    seedUngranted();
    const observed = structuredClone(job());
    // The Pipeline's first grant request commits between the sweep's reads and its transaction.
    job().website_scene_sponsorship = { schema_version: "website_scene_sponsorship.v1", request_id: "job-one",
      authority_digest: GRANT, expires_at_epoch: NOW / 1000 + 7 * DAY, consent: { accepted_at_epoch: NOW / 1000 } };
    expect(await sweepWebsiteJobWithoutGrant("job-one", NOW, observed)).toBe("granted");
    expect(job()).not.toHaveProperty("website_job_window_ending");
    expect(outbox()).toHaveLength(0);
    expect(await sweep()).toMatchObject({ ended: 0 });
  });

  it("stops speaking for the job, and its email is cancelled at dispatch, once the job has a grant", async () => {
    seedUngranted();
    await sweep();
    expect(recordedWebsiteJobWindowEnding(job(), "job-one")).toMatchObject({ basis: "video_received_no_grant" });
    job().website_scene_sponsorship = { schema_version: "website_scene_sponsorship.v1", request_id: "job-one",
      authority_digest: GRANT, expires_at_epoch: NOW / 1000 + 7 * DAY, consent: { accepted_at_epoch: NOW / 1000 } };
    expect(recordedWebsiteJobWindowEnding(job())).toBeNull();
    expect(await websiteJobWindowEndingRecorded("job-one")).toBe(false);
    expect(await websiteJobWorkWindow(job())).toEqual({ untilEpoch: NOW / 1000 + 7 * DAY, ended: false });
    expect((await page()).decision).not.toBe("ended");
    await deliverOutbox();
    expect(send).not.toHaveBeenCalled();
    expect(docs.get(NOTICE)).toMatchObject({ status: "cancelled" });
  });

  it("cancels the email when recording permission is withdrawn before it is sent", async () => {
    seedUngranted();
    await sweep();
    Object.assign(job(), { consent_revoked: true, capture_withdrawal: { state: "uploads_stopped_cleanup_pending" } });
    await deliverOutbox();
    expect(send).not.toHaveBeenCalled();
    expect(docs.get(NOTICE)).toMatchObject({ status: "cancelled" });
  });

  it("is sealed over every field, and reads only for the job it names", async () => {
    seedUngranted();
    await sweep();
    const ending = structuredClone(job().website_job_window_ending);
    expect(recordedWebsiteJobWindowEnding(job(), "job-one")).toEqual(ending);
    expect(recordedWebsiteJobWindowEnding(job(), "job-two")).toBeNull();
    for (const [field, value] of Object.entries({ request_id: "job-two", video_received_at_iso: iso(ARRIVED + 1),
      window_seconds: 3600, window_ended_at_epoch: ARRIVED, recorded_at_iso: iso(ARRIVED), notice: "none_no_contact_on_file",
      basis: "video_received" })) {
      job().website_job_window_ending = { ...ending, [field]: value };
      expect(recordedWebsiteJobWindowEnding(job()), field).toBeNull();
    }
    job().website_job_window_ending = ending;
    expect(await websiteJobWindowEndingRecorded("job-one")).toBe(true);
  });
});

describe("the no-grant clock counts only time the site was waiting on Blueprint", () => {
  /** Day 0 is the video's arrival, a day after the cutover. */
  const day = (n: number) => ARRIVED + n * DAY;

  it("starts a full window after a step the page asked for is cleared on day 6, not at the video", async () => {
    seedUngranted();
    setBrief(MULTI_STEP);
    expect(await sweepWebsiteJobWithoutGrant("job-one", at(day(0) + 60))).toBe("site_step_pending");
    expect(job()[HOLD]).toEqual({ schema_version: "website_job_no_grant_hold.v1", request_id: "job-one", held: true });
    setBrief("Move the rigid part to its tray");
    expect(await sweepWebsiteJobWithoutGrant("job-one", at(day(6)))).toBe("window_open");
    expect(job()[HOLD]).toEqual({ schema_version: "website_job_no_grant_hold.v1", request_id: "job-one", held: false,
      released_at_iso: iso(day(6)) });
    expect(await sweepWebsiteJobWithoutGrant("job-one", at(day(7) + 60))).toBe("window_open");
    expect(await sweepWebsiteJobWithoutGrant("job-one", at(day(13) - 1))).toBe("window_open");
    expect(await sweepWebsiteJobWithoutGrant("job-one", at(day(13)))).toBe("ended_notice_queued");
    expect(job().website_job_window_ending).toMatchObject({ video_received_at_iso: iso(day(0)), waiting_since_iso: iso(day(6)),
      window_ended_at_epoch: day(13) });
  });

  it("starts a full window after a step cleared on day 9", async () => {
    seedUngranted();
    setBrief(MULTI_STEP);
    for (const n of [1, 3, 8]) expect(await sweepWebsiteJobWithoutGrant("job-one", at(day(n)))).toBe("site_step_pending");
    setBrief("Move the rigid part to its tray");
    expect(await sweepWebsiteJobWithoutGrant("job-one", at(day(9)))).toBe("window_open");
    expect(await sweepWebsiteJobWithoutGrant("job-one", at(day(10)))).toBe("window_open");
    expect(await sweepWebsiteJobWithoutGrant("job-one", at(day(16)))).toBe("ended_notice_queued");
    expect(job().website_job_window_ending).toMatchObject({ waiting_since_iso: iso(day(9)), window_ended_at_epoch: day(16) });
  });

  it("counts from the video for a job never held, with no marker written", async () => {
    seedUngranted();
    expect(await sweepWebsiteJobWithoutGrant("job-one", at(day(7) - 1))).toBe("window_open");
    expect(job()).not.toHaveProperty(HOLD);
    expect(await sweepWebsiteJobWithoutGrant("job-one", at(day(7)))).toBe("ended_notice_queued");
    expect(job()).not.toHaveProperty(HOLD);
    expect(job().website_job_window_ending).toMatchObject({ waiting_since_iso: iso(day(0)), window_ended_at_epoch: day(7) });
  });

  it("writes the marker once for a job held for ever, and never ends it", async () => {
    seedUngranted();
    setBrief(MULTI_STEP);
    const updates = vi.spyOn(state.docs, "set");
    for (let n = 0; n < 60; n += 3) await sweepWebsiteJobWindows({ now: () => at(day(n)) });
    const jobWrites = updates.mock.calls.filter(([key]) => key === "inboundRequests/job-one").length;
    updates.mockRestore();
    // Twenty passes over sixty days: one write to the job in all, the marker's first transition.
    expect(jobWrites).toBe(1);
    expect(job()[HOLD]).toEqual({ schema_version: "website_job_no_grant_hold.v1", request_id: "job-one", held: true });
    expect(job()).not.toHaveProperty("website_job_window_ending");
    expect(outbox()).toHaveLength(0);
  });

  it("restarts the clock when an outcome on record later lifts", async () => {
    seedUngranted();
    docs.set("captureUploadSessions/walkthrough-job-one",
      { website_preparation: { status: { state: "awaiting_inputs", outcome: { reason: "robot_fit_none" } } } });
    expect(await sweepWebsiteJobWithoutGrant("job-one", at(day(8)))).toBe("result_recorded");
    expect(job()[HOLD]).toMatchObject({ held: true });
    docs.set("captureUploadSessions/walkthrough-job-one", { website_preparation: { status: { state: "preparing" } } });
    expect(await sweepWebsiteJobWithoutGrant("job-one", at(day(9)))).toBe("window_open");
    expect(await sweepWebsiteJobWithoutGrant("job-one", at(day(15)))).toBe("window_open");
    expect(await sweepWebsiteJobWithoutGrant("job-one", at(day(16)))).toBe("ended_notice_queued");
    // Held again after a release: the marker says held, and the job is not ended.
    seedUngranted(ARRIVED, {}, "job-two");
    setBrief(MULTI_STEP, "job-two");
    await sweepWebsiteJobWithoutGrant("job-two", at(day(1)));
    setBrief("Move the rigid part to its tray", "job-two");
    await sweepWebsiteJobWithoutGrant("job-two", at(day(2)));
    setBrief(MULTI_STEP, "job-two");
    expect(await sweepWebsiteJobWithoutGrant("job-two", at(day(20)))).toBe("site_step_pending");
    expect(docs.get("inboundRequests/job-two")![HOLD]).toMatchObject({ held: true });
    expect(docs.get("inboundRequests/job-two")).not.toHaveProperty("website_job_window_ending");
  });

  it("leaves a job with an unreadable marker for the next pass, without writing it", async () => {
    seedUngranted(ARRIVED, { [HOLD]: { schema_version: "website_job_no_grant_hold.v1", request_id: "job-one", held: false } });
    const before = structuredClone(job());
    expect(await sweepWebsiteJobWindows({ now: () => NOW })).toEqual({ examined: 1, ended: 0, noticesQueued: 0, failed: 1 });
    await expect(sweepWebsiteJobWithoutGrant("job-one", NOW)).rejects.toThrow("website_job_no_grant_hold_unreadable");
    expect(job()).toEqual(before);
  });

  it("returns changed when the marker moved between the read and the ending's transaction", async () => {
    seedUngranted(ARRIVED, { [HOLD]: { schema_version: "website_job_no_grant_hold.v1", request_id: "job-one", held: false,
      released_at_iso: iso(day(0)) } });
    const observed = structuredClone(job());
    // Another visit saw the job held meanwhile.
    job()[HOLD] = { schema_version: "website_job_no_grant_hold.v1", request_id: "job-one", held: true };
    expect(await sweepWebsiteJobWithoutGrant("job-one", NOW, observed)).toBe("changed");
    expect(job()).not.toHaveProperty("website_job_window_ending");
    expect(outbox()).toHaveLength(0);
  });

  it("writes no marker when a grant is issued between the marker's read and its write", async () => {
    seedUngranted();
    setBrief(MULTI_STEP);
    const observed = structuredClone(job());
    job().website_scene_sponsorship = { schema_version: "website_scene_sponsorship.v1", request_id: "job-one",
      authority_digest: GRANT, expires_at_epoch: NOW / 1000 + 7 * DAY, consent: { accepted_at_epoch: NOW / 1000 } };
    expect(await sweepWebsiteJobWithoutGrant("job-one", NOW, observed)).toBe("granted");
    expect(job()).not.toHaveProperty(HOLD);
  });
});

describe("the video's arrival without the video_received notice", () => {
  const session = (value: Record<string, unknown>) => docs.set("captureUploadSessions/walkthrough-job-one", value);

  it("uses a finished browser upload's own stamp when no contact address was on file", async () => {
    seedUngranted(null, { contact: {} });
    session({ browser_pending_delivery: { schema_version: "website_browser_pending.v1", request_id: "job-one",
      scene_id: "site-job-one", capture_id: "walkthrough-job-one", state: "published", completed_at_iso: iso(ARRIVED) } });
    expect(await sweepWebsiteJobWithoutGrant("job-one", at(ARRIVED + 7 * DAY - 1))).toBe("window_open");
    expect(await sweepWebsiteJobWithoutGrant("job-one", at(ARRIVED + 7 * DAY))).toBe("ended_no_notice");
    expect(job().website_job_window_ending).toMatchObject({ video_received_at_iso: iso(ARRIVED), notice: "none_no_contact_on_file" });
    expect((await page()).headline).toBe(JOB_WINDOW_ENDING_WITHOUT_GRANT_MESSAGE);
  });

  it("uses the stored-upload journal while the browser upload's pending record is not yet written", async () => {
    seedUngranted(null, { contact: {} });
    session({ browser_stored_upload: { schema_version: "website_browser_stored_upload.v1", request_id: "job-one",
      scene_id: "site-job-one", capture_id: "walkthrough-job-one", completed_at_iso: iso(ARRIVED) } });
    expect(await sweepWebsiteJobWithoutGrant("job-one", at(ARRIVED + 7 * DAY))).toBe("ended_no_notice");
  });

  it("uses an app bundle's recorded stamp the same way", async () => {
    seedUngranted(null, { contact: {} });
    session({ site_capture_bundle: { schema_version: "site_capture_bundle_session.v1", request_id: "job-one",
      scene_id: "site-job-one", capture_id: "walkthrough-job-one", recorded_at_iso: iso(ARRIVED) } });
    expect(await sweepWebsiteJobWithoutGrant("job-one", at(ARRIVED + 7 * DAY))).toBe("ended_no_notice");
    expect(job().website_job_window_ending).toMatchObject({ video_received_at_iso: iso(ARRIVED), notice: "none_no_contact_on_file" });
  });

  it("prefers the notice when it exists, and has no video with neither", async () => {
    seedUngranted(ARRIVED + DAY);
    session({ browser_pending_delivery: { request_id: "job-one", capture_id: "walkthrough-job-one", completed_at_iso: iso(ARRIVED) } });
    expect(await sweepWebsiteJobWithoutGrant("job-one", at(ARRIVED + 7 * DAY))).toBe("window_open");
    seedUngranted(null, {}, "job-two");
    docs.set("captureUploadSessions/walkthrough-job-two", { website_preparation_watch: { since_iso: iso(ARRIVED) } });
    expect(await sweepWebsiteJobWithoutGrant("job-two", NOW)).toBe("no_video");
    // A stamp bound to another job does not read: left for the next pass, never ended on a guess.
    seedUngranted(null, {}, "job-three");
    docs.set("captureUploadSessions/walkthrough-job-three", { site_capture_bundle: { request_id: "job-one",
      capture_id: "walkthrough-job-three", recorded_at_iso: iso(ARRIVED) } });
    await expect(sweepWebsiteJobWithoutGrant("job-three", NOW)).rejects.toThrow("website_job_video_received_unreadable");
  });
});

describe("the sweep worker", () => {
  it("runs a pass only while it holds its own leader lease", async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ now: NOW });
    try {
      seedJob();
      const leader = { value: false };
      const lease = { instanceId: "i", isLeader: vi.fn(() => leader.value), tick: vi.fn(), start: vi.fn(), stop: vi.fn(async () => {}) };
      const stop = startWebsiteJobWindowSweepWorker({ lease: lease as never, intervalMs: 1_000 });
      await vi.advanceTimersByTimeAsync(20_000);
      expect(lease.start).toHaveBeenCalledTimes(1);
      expect(lease.isLeader).toHaveBeenCalled();
      expect(job()).not.toHaveProperty("website_job_window_ending");
      leader.value = true;
      await vi.advanceTimersByTimeAsync(2_000);
      expect(job().website_job_window_ending).toMatchObject({ notice: "queued" });
      stop();
      expect(lease.stop).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });

  it("does not start in a pull request preview", () => {
    vi.stubEnv("IS_PULL_REQUEST", "true");
    try {
      const lease = { instanceId: "i", isLeader: vi.fn(() => true), tick: vi.fn(), start: vi.fn(), stop: vi.fn(async () => {}) };
      startWebsiteJobWindowSweepWorker({ lease: lease as never })();
      expect(lease.start).not.toHaveBeenCalled();
    } finally { vi.unstubAllEnvs(); }
  });
});
