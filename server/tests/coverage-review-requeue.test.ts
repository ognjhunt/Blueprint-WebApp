// @vitest-environment node
/**
 * The owner's requeue of one video reading that used up its automatic attempts (owner approval, 2026-11-12). A job's
 * three attempts were each lost to another call in flight before any reading ran; the job was left "review_required"
 * and its page said the video was being read for ever. The requeue gives that one reading its attempts back, under
 * the queue's own clearance checks, at most twice in its life, and the queue's own reconcile then reads it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const seams = vi.hoisted(() => ({ review: vi.fn(), authorized: { allowed: true }, realAuthorization: false,
  /** Stands in for the live conversion of a stored visit job: it writes, as the real one does. */
  switchMode: vi.fn(async (requestId: string) => {
    const { sharedFakeFirestoreState } = await import("./helpers/fake-firestore");
    const key = `inboundRequests/${requestId}`, record = sharedFakeFirestoreState.docs.get(key) as Record<string, any>;
    sharedFakeFirestoreState.docs.set(key, { ...record, request: { ...record.request, capture_mode: "self_capture" } });
    sharedFakeFirestoreState.docs.set(`siteTaskBriefs/${requestId}`, { ...sharedFakeFirestoreState.docs.get(`siteTaskBriefs/${requestId}`), captureMode: "self_capture" });
  }) }));

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const fake = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => fake.FAKE_FIELD_DELETE } } },
    dbAdmin: fake.sharedFakeFirestore };
});
vi.mock("../config/env", async () => ({ ...await vi.importActual("../config/env"), isSiteVideoEvidenceEnabled: () => true }));
vi.mock("../utils/captureCoverageReview", () => ({ reviewCaptureCoverage: seams.review }));
vi.mock("../utils/siteTaskBrief", async () => ({ switchSiteToSelfCapture: seams.switchMode, getBrief: async (id: string) =>
  (await import("./helpers/fake-firestore")).sharedFakeFirestoreState.docs.get(`siteTaskBriefs/${id}`) || null }));
vi.mock("../utils/captureFootageReview", () => ({ findPriorFootageReview: async () => ({ state: "none" }) }));
vi.mock("../utils/siteTaskBriefReading", () => ({ mergeFootageIntoBrief: vi.fn() }));
vi.mock("../utils/captureUploadAuthorization", async () => {
  const actual = await vi.importActual<typeof import("../utils/captureUploadAuthorization")>("../utils/captureUploadAuthorization");
  return { ...actual, authorizeCaptureUpload: async (id: string, options?: { readOnly?: boolean }) =>
    seams.realAuthorization ? actual.authorizeCaptureUpload(id, options) : { holdReason: null, ...seams.authorized } };
});
vi.mock("../utils/betaAbuseCaps", () => ({ modelReviewHeadroom: async () => ({ available: true }) }));
vi.mock("../agents/adapters/site-assessment-budget", () => ({ GEMINI_VIDEO_CALL_RESERVATION_USD: 0.12 }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { authorizeCaptureUpload } from "../utils/captureUploadAuthorization";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
import { coverageClearanceRefusal, reconcileCoverageReviews } from "../utils/captureCoverageQueue";
import { humanDecisionDigest } from "../utils/human-reply-admission";
import { COVERAGE_REQUEUE_AUDIT_COLLECTION, parseRequeueArgs, printableRequeueResult,
  requeueExhaustedCoverageReview } from "../utils/captureCoverageRequeue";

const BRIEF = { requestId: "req-1", summary: "Move the tray to the other end of the table", proposed: [] };
const FINDING = { coversScene: true, missingCoverage: [], supplementWouldFinish: false, unreadableReasons: [], confidence: 0.9 };
const T0 = Date.parse("2026-11-11T18:44:00.000Z");
const APPROVAL = { approvedBy: "owner-uid", approvalEvidence: "Owner approved requeuing this one reading on 2026-11-12." };
const WAIT_SLOT = "a".repeat(32);

function seedJob() {
  state.docs.set("inboundRequests/req-1", {
    request: { buyerType: "site_operator", consent_attestation: { granted: true, statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-11-11T18:43:00.000Z" } },
    capture_privacy_source_bound_decision: { capture_id: "walkthrough-req-1", proceeded: true, producer_source: { kind: "browser_pending", key: `sha256:${"a".repeat(64)}` } },
    capture_coverage_pending: true,
    capture_coverage_request: { requestId: "req-1", sceneId: "site-req-1", captureId: "walkthrough-req-1" },
  });
  state.docs.set("siteTaskBriefs/req-1", BRIEF);
}
const request = () => state.docs.get("inboundRequests/req-1") as Record<string, any>;
const reviewOf = () => request()?.capture_coverage_review as Record<string, unknown> | undefined;
const jobEntry = () => [...state.docs.entries()].find(([key]) => key.startsWith("captureCoverageReviews/") && !key.includes("budget-"));
const job = () => jobEntry()?.[1] as Record<string, any> | undefined;
/** Every stored document but the queue's own scan cursor, to show a refusal wrote nothing. */
const snapshot = () => JSON.stringify([...state.docs.entries()].filter(([key]) => !key.startsWith("automationCursors/")).sort());
const patchRequest = (patch: Record<string, unknown>) => state.docs.set("inboundRequests/req-1", { ...request(), ...patch });
const patchJob = (patch: Record<string, unknown>) => state.docs.set(jobEntry()![0], { ...job(), ...patch });

async function tickAfter(ms: number) {
  vi.setSystemTime(Date.now() + ms);
  await reconcileCoverageReviews();
  await reconcileCoverageReviews();
}
const meetsCallInFlight = async (params: { onWaiting?: (reason: string) => void }) => { params.onWaiting?.("coverage_budget_call_in_flight"); return null; };

/** The real job's fault: every attempt lost to a call in flight, past the wait bound, until the reading is exhausted. */
async function exhaustByWaits() {
  seams.review.mockImplementation(meetsCallInFlight);
  await tickAfter(0);
  vi.setSystemTime(T0 + 31 * 60_000);
  for (let pass = 0; pass < 10 && reviewOf()?.state !== "review_required"; pass++) await tickAfter(61_000);
  expect(reviewOf()).toMatchObject({ state: "review_required", reason: "automatic_review_attempts_exhausted" });
  expect(request().capture_coverage_pending).toBe(false);
  seams.review.mockReset();
}
/** Three real failed reads, as the queue counts them. */
async function exhaustByFailures() {
  seams.review.mockResolvedValue(null);
  for (let pass = 0; pass < 10 && reviewOf()?.state !== "review_required"; pass++) await tickAfter(61_000);
  expect(reviewOf()?.state).toBe("review_required");
  seams.review.mockReset();
}
const apply = () => requeueExhaustedCoverageReview("req-1", { apply: true, approval: APPROVAL });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  state.docs.clear();
  seams.review.mockReset();
  seams.authorized = { allowed: true };
  seams.realAuthorization = false;
  seams.switchMode.mockClear();
  seedJob();
});
afterEach(() => { vi.useRealTimers(); });

describe("requeuing one exhausted video reading", () => {
  it("previews without writing, then requeues so the queue's own reconcile reads it and a completed reading settles it", async () => {
    await exhaustByWaits();
    const before = snapshot();
    const preview = await requeueExhaustedCoverageReview("req-1");
    expect(preview.outcome).toBe("would_requeue");
    expect(preview.checks.every(check => check.passed)).toBe(true);
    expect(preview.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "attempts", from: 3, to: 0 }),
      expect.objectContaining({ field: "capture_coverage_pending", from: false, to: true }),
      expect.objectContaining({ field: "wait_counted", from: true, to: "(removed)" }),
    ]));
    expect(snapshot()).toBe(before);

    const result = await apply();
    expect(result.outcome).toBe("requeued");
    expect(job()).toMatchObject({ attempts: 0, state: "requeued", claim_token: null });
    for (const field of ["wait_reason", "wait_counted", "retry_after_ms", "first_claimed_at_ms"]) expect(job()).not.toHaveProperty(field);
    expect(job()!.requeue_history).toEqual([expect.objectContaining({ approved_by: "owner-uid", prior_attempts: 3,
      prior_state: "waiting_prerequisite", approval_evidence: APPROVAL.approvalEvidence, audit_digest: result.audit!.digest })]);
    expect(request()).toMatchObject({ capture_coverage_pending: true,
      capture_coverage_review: { state: "requeued", reason: "owner_approved_requeue" } });
    expect(request().capture_coverage).toBeUndefined();
    const audit = state.docs.get(`${COVERAGE_REQUEUE_AUDIT_COLLECTION}/${result.audit!.id}`) as Record<string, any>;
    expect(audit).toMatchObject({ request_id: "req-1", requeue_number: 1, approved_by: "owner-uid", audit_digest: result.audit!.digest });

    seams.review.mockImplementation(async () => { patchRequest({ capture_coverage: { covers_scene: true } }); return FINDING; });
    await tickAfter(61_000);
    expect(seams.review).toHaveBeenCalledTimes(1);
    expect(job()).toMatchObject({ state: "completed", attempts: 1, finding: FINDING });
    expect(reviewOf()).toMatchObject({ state: "completed", reason: null });
    expect(request().capture_coverage_pending).toBe(false);
  });

  it("starts the wait window afresh, so a call still in flight after the requeue is given back, not counted", async () => {
    await exhaustByWaits();
    await apply();
    seams.review.mockImplementation(meetsCallInFlight);
    await tickAfter(61_000);
    expect(job()).toMatchObject({ state: "waiting_prerequisite", attempts: 0, wait_reason: "coverage_budget_call_in_flight" });
    expect(job()!.wait_counted).toBeUndefined();
  });

  it("changes nothing and says so when run again while the requeued reading is pending or running", async () => {
    await exhaustByFailures();
    await apply();
    const before = snapshot();
    expect((await apply()).outcome).toBe("already_requeued");
    expect(snapshot()).toBe(before);
    patchJob({ state: "running", started_at: Date.now() });
    const running = snapshot();
    expect((await apply()).outcome).toBe("already_requeued");
    expect(snapshot()).toBe(running);
  });

  it("requeues a reading at most twice in its life", async () => {
    await exhaustByFailures();
    expect((await apply()).outcome).toBe("requeued");
    await exhaustByFailures();
    const second = await apply();
    expect(second.outcome).toBe("requeued");
    expect(second.flags).toContain("This reading was requeued 1 time(s) before.");
    await exhaustByFailures();
    const before = snapshot();
    const third = await apply();
    expect(third).toMatchObject({ outcome: "refused", reason: "requeue_limit_reached", changes: [] });
    expect(snapshot()).toBe(before);
    expect(job()!.requeue_history).toHaveLength(2);
  });

  it("leaves a reading that is not exhausted untouched", async () => {
    seams.review.mockResolvedValueOnce(null);
    await tickAfter(0);
    expect(job()).toMatchObject({ attempts: 1 });
    const before = snapshot();
    expect(await apply()).toMatchObject({ outcome: "refused", reason: "not_exhausted" });
    expect(snapshot()).toBe(before);
  });

  it("gives an ending's waiting email the reading's 24 hours again from the requeue", async () => {
    await exhaustByFailures();
    patchRequest({ answer_notices_waiting: { [WAIT_SLOT]: { params: { requestId: "req-1", milestone: "answer_ready" },
      since_iso: "2026-11-10T00:00:00.000Z", next_ms: 1, attempts: 2 } }, answer_notices_waiting_pending: true, answer_notices_next_ms: 1 });
    await apply();
    expect(request().answer_notices_waiting[WAIT_SLOT]).toMatchObject({ since_iso: new Date(Date.now()).toISOString(), next_ms: 1, attempts: 2,
      params: { milestone: "answer_ready" } });
  });
});

describe("refusals, each writing nothing", () => {
  const refusals: Array<[string, () => void, string]> = [
    ["recording consent withdrawn since", () => patchRequest({ request: { consent_attestation: { granted: false, revoked_at_iso: "2026-11-12T00:00:00.000Z" } } }), "recording_consent_not_current"],
    ["the privacy decision no longer proceeded", () => patchRequest({ capture_privacy_source_bound_decision: { ...request().capture_privacy_source_bound_decision, proceeded: false } }), "privacy_decision_not_proceeded"],
    ["the source changed since", () => patchRequest({ capture_privacy_source_bound_decision: { ...request().capture_privacy_source_bound_decision, producer_source: { kind: "browser_pending", key: `sha256:${"b".repeat(64)}` } } }), "source_changed"],
    ["the brief changed since", () => state.docs.set("siteTaskBriefs/req-1", { ...BRIEF, summary: "Another job" }), "brief_changed"],
    ["the review job is missing", () => state.docs.delete(jobEntry()![0]), "review_job_missing"],
    ["the review job is running inside its trusted window", () => patchJob({ state: "running", started_at: Date.now() - 60_000 }), "review_running"],
    ["the review job is completed", () => patchJob({ state: "completed" }), "review_completed"],
    ["the review job has attempts left", () => patchJob({ attempts: 2 }), "attempts_remaining"],
    ["a reading is already recorded", () => patchRequest({ capture_coverage: { covers_scene: true } }), "coverage_already_recorded"],
    ["a newer capture replaced this one", () => patchRequest({ active_capture_id: "walkthrough-req-1-2" }), "capture_superseded"],
    ["the review names another job", () => patchRequest({ capture_coverage_review: { ...reviewOf(), review_id: "f".repeat(64) } }), "review_job_missing"],
    ["the job belongs to another request", () => patchJob({ requestId: "req-2" }), "review_job_mismatch"],
    ["the review ended some other way", () => patchRequest({ capture_coverage_review: { ...reviewOf(), reason: "something_else" } }), "not_exhausted"],
    ["the upload is no longer authorized", () => { seams.authorized = { allowed: false }; }, "capture_not_authorized"],
  ];
  for (const [name, change, reason] of refusals) it(`refuses when ${name}`, async () => {
    await exhaustByFailures();
    change();
    const before = snapshot();
    const result = await apply();
    expect(result).toMatchObject({ outcome: "refused", reason, changes: [] });
    expect(result.checks.at(-1)).toMatchObject({ passed: false });
    expect(snapshot()).toBe(before);
  });

  it("refuses while a model call for the capture is recorded in flight, whoever owns it, and says what clears it", async () => {
    await exhaustByFailures();
    const budget = `captureCoverageReviews/budget-${humanDecisionDigest({ capture_id: "walkthrough-req-1" })}`;
    state.docs.set(budget, { capture_id: "walkthrough-req-1", pending_token: "tok-1", exposure_usd: 0.12, calls: 1 });
    state.docs.set(`${budget}/calls/tok-1`, { state: "admitted", run_id: "run-1", review_id: null, capture_id: "walkthrough-req-1" });
    const before = snapshot();
    const result = await requeueExhaustedCoverageReview("req-1");
    expect(result).toMatchObject({ outcome: "refused", reason: "model_call_in_flight", changes: [] });
    expect(result.flags.join(" ")).toMatch(/the site assessment.*clears when that call records its response/);
    expect(snapshot()).toBe(before);
  });

  it("refuses a requeue history it cannot read, rather than resetting the bound", async () => {
    await exhaustByFailures();
    patchJob({ requeue_history: { 0: { requeued_at_iso: "2026-11-11T00:00:00.000Z" } } });
    const before = snapshot();
    expect(await apply()).toMatchObject({ outcome: "refused", reason: "requeue_history_unreadable", changes: [] });
    expect(snapshot()).toBe(before);
  });

  it("refuses an apply without the owner's approval", async () => {
    await exhaustByFailures();
    const before = snapshot();
    expect(await requeueExhaustedCoverageReview("req-1", { apply: true })).toMatchObject({ outcome: "refused", reason: "approval_required" });
    expect(await requeueExhaustedCoverageReview("req-1", { apply: true, approval: { approvedBy: " ", approvalEvidence: "x" } }))
      .toMatchObject({ outcome: "refused", reason: "approval_required" });
    expect(snapshot()).toBe(before);
  });
});

describe("a stored job that still asks for a filming visit", () => {
  /** Every document and collection the fake store holds, the queue's cursor included. */
  const everything = () => JSON.stringify([...state.docs.entries()].sort());
  beforeEach(async () => {
    await exhaustByFailures();
    seams.realAuthorization = true;
    patchRequest({ request: { ...request().request, capture_mode: "site_visit" } });
  });

  it("is refused by a preview that writes nothing at all, and says what converts it", async () => {
    const before = everything();
    const result = await requeueExhaustedCoverageReview("req-1");
    expect(result).toMatchObject({ outcome: "refused", reason: "capture_mode_not_converted", changes: [] });
    expect(result.flags.join(" ")).toMatch(/first time the site's link is checked or the video queue next considers the job/);
    expect(seams.switchMode).not.toHaveBeenCalled();
    expect(everything()).toBe(before);
  });

  it("is refused by an apply that writes nothing and never converts it", async () => {
    const before = everything();
    expect(await apply()).toMatchObject({ outcome: "refused", reason: "capture_mode_not_converted", changes: [] });
    expect(seams.switchMode).not.toHaveBeenCalled();
    expect(everything()).toBe(before);
  });

  it("is still converted by every other caller, which uses the default path", async () => {
    await authorizeCaptureUpload("req-1");
    expect(seams.switchMode).toHaveBeenCalledWith("req-1", "filming_visits_retired");
    expect(request().request.capture_mode).toBe("self_capture");
  });
});

describe("the queue around a requeue", () => {
  it("still skips a reading whose current source has no key, and the shared check refuses it", async () => {
    const privacy = request().capture_privacy_source_bound_decision;
    patchRequest({ capture_privacy_source_bound_decision: { ...privacy, producer_source: { kind: "browser_pending" } } });
    seams.review.mockResolvedValue(FINDING);
    await tickAfter(0);
    expect(seams.review).not.toHaveBeenCalled();
    expect(job()).toBeUndefined();
    expect(request().capture_coverage_pending).toBe(true);
    const keyless = { kind: "browser_pending" };
    expect(coverageClearanceRefusal({ ...request(), capture_privacy_source_bound_decision: { ...privacy, producer_source: keyless } },
      BRIEF, { source: keyless, brief_digest: humanDecisionDigest(BRIEF) }, "walkthrough-req-1")).toBe("source_changed");
  });

  it("shuts out a late finish from an old claim after the requeue", async () => {
    let release!: (value: typeof FINDING) => void;
    seams.review.mockResolvedValueOnce(null).mockResolvedValueOnce(null)
      .mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    await tickAfter(0);
    await tickAfter(61_000);
    expect(job()).toMatchObject({ attempts: 2 });
    // The third claim starts reading and hangs past its trusted window.
    vi.setSystemTime(Date.now() + 61_000);
    const hanging = reconcileCoverageReviews();
    await vi.waitFor(() => expect(job()).toMatchObject({ state: "running", attempts: 3 }));
    vi.setSystemTime(Date.now() + 31 * 60_000);
    await reconcileCoverageReviews();
    await reconcileCoverageReviews();
    expect(reviewOf()).toMatchObject({ state: "review_required", reason: "automatic_review_attempts_exhausted" });
    expect((await apply()).outcome).toBe("requeued");
    release(FINDING);
    await hanging;
    expect(job()).toMatchObject({ state: "requeued", attempts: 0, claim_token: null });
    expect(job()!.finding).toBeUndefined();
    expect(reviewOf()).toMatchObject({ state: "requeued" });
    expect(request().capture_coverage_pending).toBe(true);
  });
});

describe("the script's arguments and output", () => {
  it("defaults to a preview and needs both approval fields to apply", () => {
    expect(parseRequeueArgs(["req-1"])).toEqual({ requestId: "req-1", apply: false });
    expect(parseRequeueArgs(["req-1", "--apply", "--approved-by", "owner-uid", "--approval-evidence", "Approved."]))
      .toEqual({ requestId: "req-1", apply: true, approval: { approvedBy: "owner-uid", approvalEvidence: "Approved." } });
    expect(() => parseRequeueArgs(["req-1", "--apply"])).toThrow("--apply requires");
    expect(() => parseRequeueArgs(["req-1", "--apply", "--approved-by", "owner-uid"])).toThrow("--apply requires");
    expect(() => parseRequeueArgs([])).toThrow("Expected");
    expect(() => parseRequeueArgs(["req-1", "req-2"])).toThrow("Expected");
    expect(() => parseRequeueArgs(["req-1", "--all"])).toThrow("Expected");
  });

  it("never prints the approval's words or who gave it", async () => {
    await exhaustByFailures();
    const result = await requeueExhaustedCoverageReview("req-1", { apply: true,
      approval: { approvedBy: "owner@example.com", approvalEvidence: "Approved by owner@example.com" } });
    const printed = JSON.stringify(printableRequeueResult("req-1", true, result));
    expect(result.outcome).toBe("requeued");
    expect(printed).not.toContain("@");
  });
});
