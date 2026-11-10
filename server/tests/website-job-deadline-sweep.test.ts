// @vitest-environment node
// OFFLINE: the deadline sweep, its reconciler and the real outbox dispatch against the fake Firestore; email is mocked.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";
import type { TaskSceneProgression } from "../utils/taskStatusProjection";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return {
    // Stored creation times are ISO strings here, so the fake orders them; Firestore orders Timestamps the same way.
    default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE },
      Timestamp: { fromMillis: (ms: number) => new Date(ms).toISOString() } } },
    dbAdmin: sharedFakeFirestore,
  };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/field-encryption", () => ({ decryptFieldValue: vi.fn(async (value: string) => value) }));
vi.mock("../utils/teamJobAccess", () => ({ teamJobAccess: () => ({ evaluationAvailable: false, reason: null }) }));
const send = vi.hoisted(() => vi.fn());
vi.mock("../utils/email", () => ({ sendEmail: send }));
// The scene progression and the evaluation runs the page reads, set per test.
const page = vi.hoisted(() => ({ progression: new Map<string, unknown>(), unreadable: new Set<string>(),
  screening: { teams: 0, queued: 0, running: 0, reported: 0, noResult: 0 } }));
vi.mock("../utils/websiteSceneProgression", async importOriginal => ({
  ...await importOriginal<typeof import("../utils/websiteSceneProgression")>(),
  readWebsiteSceneProgression: vi.fn(async (requestId: string) => {
    if (page.unreadable.has(requestId)) throw new Error("website_scene_progression_unavailable");
    return page.progression.get(requestId) ?? null;
  }),
}));
vi.mock("../utils/agentEvalRuns", () => ({ loadSceneScreening: vi.fn(async () => page.screening) }));

const { sweepWebsiteJobDeadlines, reconcileWebsiteJobEndingNotifications, websiteJobEndingShown, websiteJobPageReading,
  websiteJobEndingEventId, WEBSITE_JOB_DEADLINE_LOOKBACK_SECONDS } = await import("../utils/websiteJobDeadlineSweep");
const { deliverOutbox } = await import("../utils/captureOutbox");
// Load the mocked modules once, so passes that race below all read the mocks.
await Promise.all([import("../utils/websiteSceneProgression"), import("../utils/agentEvalRuns"), import("../utils/siteTaskBrief"),
  import("../utils/teamJobAccess"), import("../utils/pilotRecommendationEvidence"), import("../utils/taskLifecycleNotifications")]);
const { JOB_WINDOW_ENDED_HEADLINE } = await import("../utils/taskStatusProjection");
const { WEBSITE_JOB_WINDOW_DEFAULT_SECONDS } = await import("../utils/websiteJobWindow");
const { JOB_TIME_ENDED_SENTENCE, PREPARATION_ENDED_NEXT } = await import("../utils/taskPreparationOutcome");

const NOW_MS = Date.parse("2026-11-10T12:00:00Z");
const NOW = NOW_MS / 1000;
const docs = sharedFakeFirestoreState.docs;
const job = (id: string) => docs.get(`inboundRequests/${id}`) as Record<string, any>;
const outbox = (id: string) => [...docs.entries()].filter(([key]) => key.startsWith(`captureOutbox/${id}:job_window_ended:`)
  && !key.includes("/deliveryReceipts/"));
const sha = (char: string) => `sha256:${char.repeat(64)}`;

/** A site's job, filmed and handed off, whose grant expired `ago` seconds before now. */
function seedJob(id: string, options: { ago?: number; progression?: TaskSceneProgression["state"] | null; grant?: boolean;
  createdAgo?: number } = {}) {
  const expires = NOW - (options.ago ?? 3600);
  docs.set(`inboundRequests/${id}`, {
    requestId: id,
    createdAt: new Date((NOW - (options.createdAgo ?? 8 * 86400)) * 1000).toISOString(),
    contact: { email: "owner@example.com" },
    capture_owner_uid: `site-job-${id}`, capture_owner_bound_at_iso: "2026-11-01T00:00:00Z",
    site_task_brief_confirmed_at: "2026-11-01T00:00:00Z",
    request: { buyerType: "site_operator", consent_attestation: { granted: true, statement_version: "2026-09-18.v1",
      recorded_at_iso: "2026-11-01T00:00:00Z" } },
    ...(options.grant === false ? {} : { website_scene_sponsorship: { authority_digest: sha("9"), expires_at_epoch: expires,
      consent: { accepted_at_epoch: expires - 7 * 86400 } } }),
  });
  docs.set(`siteTaskBriefs/${id}`, { requestId: id, summary: "Move the carton from the bench to the shelf",
    confirmedAtIso: "2026-11-01T00:00:00Z" });
  docs.set(`captureOutbox/${id}:video_received`, { requestId: id, kind: "video_received", status: "sent",
    createdAtIso: "2026-11-01T01:00:00Z" });
  if (options.progression !== null) {
    docs.set(`captureUploadSessions/walkthrough-${id}`, { website_preparation: { status: { state: "handed_off" } } });
    page.progression.set(id, { state: options.progression ?? "testing" });
  }
}

beforeEach(() => {
  docs.clear();
  page.progression.clear();
  page.unreadable.clear();
  page.screening = { teams: 0, queued: 0, running: 0, reported: 0, noResult: 0 };
  send.mockReset().mockResolvedValue({ sent: true, provider: "resend", messageId: "accepted" });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW_MS);
});
afterEach(() => vi.useRealTimers());

describe("website job deadline sweep", () => {
  it("ends an open job exactly once, its ending and email intent in one write; a second pass or a racing one changes nothing", async () => {
    seedJob("req-1");
    const [first, second] = await Promise.all([sweepWebsiteJobDeadlines(), sweepWebsiteJobDeadlines()]);
    expect(first.ended + second.ended).toBe(1);
    expect((await sweepWebsiteJobDeadlines()).ended).toBe(0);
    const deadline = NOW - 3600;
    // A small versioned record beside the job's other website_* fields.
    expect(job("req-1").website_job_ending).toEqual({ schema_version: "website_job_ending.v1", reason: "window_ended",
      deadline_epoch: deadline, deadline_basis: "grant", event_id: websiteJobEndingEventId(deadline), ended_at_epoch: NOW,
      progression: "testing", notice_owed: true, notice_withheld_reason: null });
    expect(job("req-1").website_job_ending_notification_pending).toBe(true);

    // The pump's reconciler queues it under a key naming the deadline; dispatch sends it once.
    await deliverOutbox();
    await deliverOutbox();
    await reconcileWebsiteJobEndingNotifications();
    const rows = outbox("req-1");
    expect(rows.map(([key]) => key)).toEqual([`captureOutbox/req-1:job_window_ended:${websiteJobEndingEventId(deadline)}`]);
    expect(rows[0][1]).toMatchObject({ status: "sent", kind: "job_window_ended", to: "owner@example.com",
      subject: "Your Blueprint job has ended" });
    expect(String((rows[0][1] as any).body)).toContain(JOB_WINDOW_ENDED_HEADLINE);
    expect(String((rows[0][1] as any).body)).not.toMatch(/\b[a-z]+_[a-z_]+\b/);
    expect(send).toHaveBeenCalledOnce();
    expect(job("req-1").website_job_ending_notification_pending).toBe(false);
    // The page says the same sentence without waiting for anything.
    expect((await websiteJobPageReading("req-1", job("req-1"))).status.headline).toBe(JOB_WINDOW_ENDED_HEADLINE);
  });

  it("never ends a job the page shows as evaluated, held or ended, or one not yet past its deadline", async () => {
    seedJob("req-e", { progression: "evaluated" });
    seedJob("req-h", { progression: "held" });
    seedJob("req-x", { progression: "ended" });
    seedJob("req-f", { ago: -3600 });
    seedJob("req-r", { progression: "testing" });
    page.screening = { teams: 1, queued: 0, running: 0, reported: 1, noResult: 0 };
    const summary = await sweepWebsiteJobDeadlines();
    expect(summary).toMatchObject({ ended: 0, failed: 0 });
    for (const id of ["req-e", "req-h", "req-x", "req-f", "req-r"]) expect(job(id).website_job_ending).toBeUndefined();
  });

  it("lets a result that arrives after the ending win on the page and cancels the email it would contradict", async () => {
    seedJob("req-1");
    await sweepWebsiteJobDeadlines();
    await reconcileWebsiteJobEndingNotifications();
    expect(outbox("req-1")[0][1]).toMatchObject({ status: "pending" });
    page.progression.set("req-1", { state: "evaluated" });
    expect((await websiteJobPageReading("req-1", job("req-1"))).status.headline).toMatch(/^Your simulation estimate is ready/);
    await deliverOutbox();
    expect(outbox("req-1")[0][1]).toMatchObject({ status: "cancelled" });
    expect(send).not.toHaveBeenCalled();
    // An ending still owed when a hold lands is dropped by the reconciler, never queued.
    seedJob("req-2");
    await sweepWebsiteJobDeadlines();
    page.progression.set("req-2", { state: "held" });
    await reconcileWebsiteJobEndingNotifications();
    expect(outbox("req-2")).toEqual([]);
    expect(job("req-2").website_job_ending_notification_pending).toBe(false);
  });

  it("moves the deadline with a verified extension: the older ending is ignored, and the new deadline ends the job again", async () => {
    seedJob("req-1");
    const raw = NOW - 3600;
    await sweepWebsiteJobDeadlines();
    await reconcileWebsiteJobEndingNotifications();
    const oldKey = `req-1:job_window_ended:${websiteJobEndingEventId(raw)}`;
    // The owner's time-only extension to tomorrow, verified against the intake it binds.
    const extension = { schema_version: "task_evaluation_scene_execution_window_extension_notice.v1", intent_id: "scene-1",
      intent_digest: sha("a"), extension_digest: sha("7"), original_expires_at_epoch: raw, expires_at_epoch: NOW + 86400,
      issued_at_epoch: NOW - 60, authorization_reference: "owner approval (time only)", authorized_via: "operator_door" };
    docs.set("taskEvaluationSceneIntakes/intake-1", { state: "accepted", root_sponsorship_digest: sha("9"),
      receipt: { intent_id: "scene-1", intent_digest: sha("a") }, request: { execution: { expires_at_epoch: raw } },
      execution_window_extensions: [{ ...extension, received_at_iso: "2026-11-10T11:59:00Z" }] });
    job("req-1").website_scene_sponsorship_execution_window = { schema_version: "website_scene_sponsorship_execution_window.v1",
      scope: "execution_time_only", authority_digest: sha("9"), intent_id: "scene-1", intake_id: "intake-1",
      extension_digest: sha("7"), original_expires_at_epoch: raw, expires_at_epoch: NOW + 86400 };
    expect(await websiteJobEndingShown("req-1", oldKey)).toBe(false);
    expect((await websiteJobPageReading("req-1", job("req-1"))).status.headline).not.toBe(JOB_WINDOW_ENDED_HEADLINE);
    await deliverOutbox();
    expect(docs.get(`captureOutbox/${oldKey}`)).toMatchObject({ status: "cancelled" });
    expect((await sweepWebsiteJobDeadlines()).ended).toBe(0);

    // Still unfinished at the new deadline: ended again, as its own event.
    vi.setSystemTime((NOW + 86400 + 60) * 1000);
    expect((await sweepWebsiteJobDeadlines()).ended).toBe(1);
    expect(job("req-1").website_job_ending).toMatchObject({ deadline_epoch: NOW + 86400, deadline_basis: "grant_extended",
      event_id: websiteJobEndingEventId(NOW + 86400), notice_owed: true });
    await deliverOutbox();
    expect(outbox("req-1").map(([, row]) => (row as any).status).sort()).toEqual(["cancelled", "sent"]);
    expect(send).toHaveBeenCalledOnce();
  });

  it("records a deadline that passed more than 48 hours before the first sweep without an email, and reads no further back than its bound", async () => {
    seedJob("req-late", { ago: 3 * 86400 });
    seedJob("req-old", { ago: WEBSITE_JOB_DEADLINE_LOOKBACK_SECONDS + 3600 });
    await sweepWebsiteJobDeadlines();
    expect(job("req-late").website_job_ending).toMatchObject({ notice_owed: false,
      notice_withheld_reason: "deadline_passed_before_first_sweep" });
    expect(job("req-late").website_job_ending_notification_pending).toBe(false);
    // Outside the lookback: never read by the sweep; the page still shows it ended by its window.
    expect(job("req-old").website_job_ending).toBeUndefined();
    expect((await websiteJobPageReading("req-old", job("req-old"))).status.headline).toBe(JOB_WINDOW_ENDED_HEADLINE);
    await deliverOutbox();
    expect(outbox("req-late")).toEqual([]);
    expect(send).not.toHaveBeenCalled();
  });

  it("reads at most its per-pass limit and turns through the rest on later passes", async () => {
    for (const [index, id] of ["req-a", "req-b", "req-c"].entries()) seedJob(id, { ago: 3600 * (index + 1) });
    expect((await sweepWebsiteJobDeadlines({ limit: 2 })).examined).toBe(2);
    expect((await sweepWebsiteJobDeadlines({ limit: 2 })).ended).toBe(1);
    for (const id of ["req-a", "req-b", "req-c"]) expect(job(id).website_job_ending).toBeDefined();
  });

  it("ends a website job the hand-off never reached at its creation plus the default window, and no other kind of request", async () => {
    seedJob("req-ng", { grant: false, progression: null, createdAgo: WEBSITE_JOB_WINDOW_DEFAULT_SECONDS + 3600 });
    seedJob("req-young", { grant: false, progression: null, createdAgo: WEBSITE_JOB_WINDOW_DEFAULT_SECONDS - 3600 });
    seedJob("req-team", { grant: false, progression: null, createdAgo: WEBSITE_JOB_WINDOW_DEFAULT_SECONDS + 3600 });
    job("req-team").request.buyerType = "robot_team";
    await sweepWebsiteJobDeadlines();
    expect(job("req-ng").website_job_ending).toMatchObject({ deadline_basis: "job_created", progression: "in_progress",
      deadline_epoch: NOW - 3600, notice_owed: true });
    expect(job("req-young").website_job_ending).toBeUndefined();
    expect(job("req-team").website_job_ending).toBeUndefined();
    // No grant was ever issued, so the page and the email both say only that the job's time ran out.
    const said = `${JOB_TIME_ENDED_SENTENCE} ${PREPARATION_ENDED_NEXT}`;
    expect((await websiteJobPageReading("req-ng", job("req-ng"))).status.headline).toBe(said);
    await deliverOutbox();
    const rows = outbox("req-ng");
    expect(rows).toHaveLength(1);
    expect(rows[0][1]).toMatchObject({ status: "sent", kind: "job_window_ended" });
    expect(String((rows[0][1] as any).body)).toContain(said);
    expect(String((rows[0][1] as any).body)).not.toMatch(/authorized/);
    expect(send).toHaveBeenCalledOnce();
  });

  it("never ends or emails a withdrawn job, and drops an owed email once recording consent is withdrawn", async () => {
    seedJob("req-w");
    job("req-w").request.consent_attestation.withdrawn_at_iso = "2026-11-09T00:00:00Z";
    seedJob("req-1");
    await sweepWebsiteJobDeadlines();
    expect(job("req-w").website_job_ending).toBeUndefined();
    expect((await websiteJobPageReading("req-w", job("req-w"))).status.headline).toMatch(/Recording consent was withdrawn/);
    job("req-1").request.consent_attestation.withdrawn_at_iso = "2026-11-10T11:00:00Z";
    await deliverOutbox();
    expect(outbox("req-1")).toEqual([]);
    expect(outbox("req-w")).toEqual([]);
    expect(send).not.toHaveBeenCalled();
  });

  it("logs a job it cannot read and still ends the others in the same pass", async () => {
    seedJob("req-1");
    seedJob("req-2");
    page.unreadable.add("req-2");
    const summary = await sweepWebsiteJobDeadlines();
    expect(summary).toMatchObject({ examined: 2, ended: 1, failed: 1 });
    expect(job("req-2").website_job_ending).toBeUndefined();
    const { logger } = await import("../logger");
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ requestId: "req-2" }), expect.stringMatching(/deadline/));
  });
});
