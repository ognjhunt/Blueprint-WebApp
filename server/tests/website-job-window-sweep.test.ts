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
import { JOB_WINDOW_ENDING_MESSAGE, JOB_WINDOW_ENDING_SUBJECT } from "../utils/taskPreparationOutcome";
import { projectTaskStatus, taskStatusInputFrom } from "../utils/taskStatusProjection";
import { WEBSITE_JOB_WINDOW_ENDING_NOTICE_CUTOVER_EPOCH, WEBSITE_JOB_WINDOW_ENDING_NOTICE_CUTOVER_ISO,
  websiteJobWindowEndedNoticeKey } from "../utils/websiteJobWindowEnding";
import { startWebsiteJobWindowSweepWorker, sweepWebsiteJobWindow, sweepWebsiteJobWindows } from "../utils/websiteJobWindowSweep";
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
const outbox = () => [...docs.entries()].filter(([key]) => key.startsWith("captureOutbox/") && !key.includes("/deliveryReceipts/")) as
  Array<[string, Record<string, any>]>;
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
      subject: "The simulation of your site has stopped", idempotencyKey: "job-one:scene_outcome:job_window_ended" });

    // The page and the email say the same, exact sentence.
    expect(JOB_WINDOW_ENDING_MESSAGE).toBe("The simulation of your site has stopped because the time Blueprint was authorized to work on this job ran out. "
      + "Blueprint did not finish the simulation in that time, and no more simulation work will run on this job. Your answer stays on your job page. "
      + "Nothing more is needed from you. Keep your original recording; to have Blueprint work on this site again, you can start a new job.");
    expect(JOB_WINDOW_ENDING_SUBJECT).toBe("The simulation of your site has stopped");
    expect(await page()).toMatchObject({ decision: "ended", headline: JOB_WINDOW_ENDING_MESSAGE, operatorAction: null, stage: null });
    const body: string = outbox()[0][1].body;
    // With no paper check for the job, the email says so plainly after the ending (review, 2026-11-11).
    expect(body.startsWith(`${JOB_WINDOW_ENDING_MESSAGE} There is no paper check for this job.\n\nOpen your job on your private job page:\nhttps://`)).toBe(true);
    expect(body).toMatch(/\/capture-upload\/\S+$/);
    // It promises nothing a person or a timer would have to do.
    expect(body).not.toMatch(/we will|we'll|our team|review|follow up|email you/i);

    // Twice more: still one ending and one email.
    for (let pass = 0; pass < 2; pass++) expect(await sweep()).toEqual({ examined: 1, ended: 0, noticesQueued: 0, failed: 0 });
    expect(job().website_job_window_ending).toEqual(ending);
    expect(outbox()).toHaveLength(1);

    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ to: "owner@example.com", subject: "The simulation of your site has stopped" });
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
    expect(await sweepWebsiteJobWindow("job-two", NOW)).toBe("no_window");
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
    expect(send.mock.calls[0][0].subject).toBe("The simulation of your site has stopped");
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
    expect(docs.get(second)).toMatchObject({ kind: "scene_outcome", status: "pending", subject: "The simulation of your site has stopped" });
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
