// @vitest-environment node
/**
 * A provider outage is not a reading that went wrong. When the video model refused (rate or quota, a funding refusal,
 * a key refusal, a 5xx, a timeout) each refusal used one of the reading's three attempts, the queue tried again on the
 * next minute's pass, and three minutes later the job was parked for a person ("automatic_review_attempts_exhausted")
 * with nothing that ever tried again. The site read "We're watching your video." for good. An outage now gives its
 * attempt back and is tried again on a back-off (2 minutes, doubling, at most an hour) until the provider answers or the
 * job's window ends; a reading parked before this change is picked up again by the queue itself; and the owner hears
 * once per provider per cause.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const seams = vi.hoisted(() => ({ review: vi.fn(), alert: vi.fn(async () => ({ sent: true, suppressed: false })) }));

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const fake = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => fake.FAKE_FIELD_DELETE } } },
    dbAdmin: fake.sharedFakeFirestore };
});
vi.mock("../config/env", async () => ({ ...await vi.importActual("../config/env"), isSiteVideoEvidenceEnabled: () => true }));
vi.mock("../utils/captureCoverageReview", () => ({ reviewCaptureCoverage: seams.review }));
vi.mock("../utils/siteTaskBrief", () => ({ getBrief: async () => BRIEF }));
vi.mock("../utils/captureFootageReview", () => ({ findPriorFootageReview: async () => ({ state: "none" }) }));
vi.mock("../utils/siteTaskBriefReading", () => ({ mergeFootageIntoBrief: vi.fn() }));
vi.mock("../utils/captureUploadAuthorization", () => ({ authorizeCaptureUpload: async () => ({ allowed: true }),
  CAPTURE_MODE_NOT_CONVERTED: "capture_mode_not_converted", CAPTURE_MODE_NOT_CONVERTED_DETAIL: "" }));
vi.mock("../utils/betaAbuseCaps", () => ({ modelReviewHeadroom: async () => ({ available: true }) }));
vi.mock("../agents/adapters/site-assessment-budget", () => ({ GEMINI_VIDEO_CALL_RESERVATION_USD: 0.12 }));
vi.mock("../utils/opsProcessAlerts", () => ({ sendRateLimitedOpsAlert: seams.alert }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
import { humanDecisionDigest } from "../utils/human-reply-admission";
import { reconcileCoverageReviews } from "../utils/captureCoverageQueue";
import { classifyProviderFailure, providerOutageRetryDelayMs } from "../utils/providerOutage";
import { sealWebsiteJobWindowEnding } from "../utils/websiteJobWindowEnding";
import { requeueExhaustedCoverageReview } from "../utils/captureCoverageRequeue";

const BRIEF = { requestId: "req-1", summary: "Move the tray to the other end of the table", proposed: [] };
const FINDING = { coversScene: true, missingCoverage: [], supplementWouldFinish: false, unreadableReasons: [], confidence: 0.9 };
const SOURCE = { kind: "browser_pending", key: `sha256:${"a".repeat(64)}` };
const T0 = Date.parse("2026-11-23T15:21:00.000Z");
const MINUTE = 60_000;

function seedJob(extra: Record<string, unknown> = {}) {
  state.docs.set("inboundRequests/req-1", {
    request: { buyerType: "site_operator", consent_attestation: { granted: true, statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-11-23T15:20:00.000Z" } },
    capture_privacy_source_bound_decision: { capture_id: "walkthrough-req-1", proceeded: true, producer_source: SOURCE },
    capture_coverage_pending: true,
    capture_coverage_request: { requestId: "req-1", sceneId: "site-req-1", captureId: "walkthrough-req-1" },
    ...extra,
  });
  state.docs.set("siteTaskBriefs/req-1", BRIEF);
}
const request = () => state.docs.get("inboundRequests/req-1") as Record<string, any>;
/** The job's grant ran out at `endedMs` and the window sweep recorded its ending, as the job page reads it. */
function endWindow(endedMs: number) {
  const authority = `sha256:${"b".repeat(64)}`;
  state.docs.set("inboundRequests/req-1", { ...request(),
    website_scene_sponsorship: { request_id: "req-1", authority_digest: authority, expires_at_epoch: endedMs / 1000 },
    website_job_window_ending: sealWebsiteJobWindowEnding({ request_id: "req-1", authority_digest: authority,
      window_ended_at_epoch: endedMs / 1000, recorded_at_iso: new Date(endedMs).toISOString(), notice: "none_emails_retired" }) });
}
const reviewOf = () => request()?.capture_coverage_review as Record<string, unknown> | undefined;
const job = () => [...state.docs.entries()].find(([key]) => /^captureCoverageReviews\/[a-f0-9]{64}$/.test(key))?.[1] as Record<string, any> | undefined;

async function passAt(ms: number) {
  vi.setSystemTime(ms);
  await reconcileCoverageReviews();
  await reconcileCoverageReviews();
}

/** The provider refused the call (as the video adapter reports a 429 with no credit left). */
const refused = async (params: { onProviderOutage?: (outage: unknown) => void }) => {
  params.onProviderOutage?.({ provider: "gemini", cause: "rate_limited" });
  return null;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  state.docs.clear();
  seams.review.mockReset();
  seams.alert.mockClear();
});
afterEach(() => { vi.useRealTimers(); });

describe("which failures are the provider's", () => {
  it("classifies refusals, server errors and timeouts as an outage, and a reading that went wrong as not", () => {
    expect(classifyProviderFailure("gemini", "gemini_video_provider_failed: Gemini returned HTTP 429")).toEqual({ provider: "gemini", cause: "rate_limited" });
    expect(classifyProviderFailure("gemini", "gemini_video_upload_failed: Gemini file upload start returned HTTP 503")?.cause).toBe("provider_error");
    expect(classifyProviderFailure("gemini", "gemini_video_provider_failed: Gemini returned HTTP 403")?.cause).toBe("key_refused");
    expect(classifyProviderFailure("gemini", "gemini_video_not_configured")?.cause).toBe("key_refused");
    expect(classifyProviderFailure("gemini", "gemini_video_failed: The operation was aborted due to timeout")?.cause).toBe("timeout");
    expect(classifyProviderFailure("openai", "429 You have no credits remaining. (insufficient_quota)")?.cause).toBe("funding_refused");
    // The video or the answer, not the provider: these still use an attempt.
    expect(classifyProviderFailure("gemini", "video_fetch_failed: Task video link returned HTTP 403")).toBeNull();
    expect(classifyProviderFailure("gemini", "gemini_video_provider_failed: Gemini returned HTTP 400")).toBeNull();
    expect(classifyProviderFailure("gemini", "non_json_response: model returned text")).toBeNull();
    expect(classifyProviderFailure("gemini", undefined)).toBeNull();
  });

  it("waits 2, 4, 8, 16, 32 minutes, then an hour at most", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 40].map(providerOutageRetryDelayMs)).toEqual([2, 4, 8, 16, 32, 60, 60, 60].map(m => m * MINUTE));
  });
});

describe("the video reading during a provider outage", () => {
  it("keeps trying on the back-off without using its attempts, and reads the video once the provider answers", async () => {
    seedJob();
    seams.review.mockImplementation(refused);
    let now = T0;
    await passAt(now);
    expect(job()).toMatchObject({ state: "waiting_provider", attempts: 0, retry_after_ms: now + 2 * MINUTE,
      provider_outage: { provider: "gemini", cause: "rate_limited", retries: 1 } });
    // Inside the back-off nothing is tried.
    await passAt(now + MINUTE);
    expect(seams.review).toHaveBeenCalledTimes(1);
    // Ten refusals over hours: far past the three attempts, the job is never parked.
    for (let pass = 0; pass < 9; pass++) { now = job()!.retry_after_ms + 1_000; await passAt(now); }
    expect(seams.review).toHaveBeenCalledTimes(10);
    expect(reviewOf()).toBeUndefined();
    expect(request().capture_coverage_pending).toBe(true);
    expect(job()).toMatchObject({ state: "waiting_provider", attempts: 0 });
    expect(job()!.retry_after_ms - now).toBe(60 * MINUTE);
    // The provider answers: the reading completes.
    seams.review.mockResolvedValue(FINDING);
    await passAt(job()!.retry_after_ms + 1_000);
    expect(reviewOf()).toMatchObject({ state: "completed", reason: null });
    expect(job()).toMatchObject({ state: "completed", attempts: 1 });
  });

  it("still parks a reading that itself went wrong three times, and marks it so", async () => {
    seedJob();
    seams.review.mockResolvedValue(null);
    for (let pass = 0; pass < 6 && !reviewOf(); pass++) await passAt(T0 + pass * 2 * MINUTE);
    expect(seams.review).toHaveBeenCalledTimes(3);
    expect(reviewOf()).toMatchObject({ state: "review_required", reason: "automatic_review_attempts_exhausted", waits_and_outages_excluded: true });
  });

  it("stops trying once the job's window has ended, and ends the reading so nothing says it is still under way", async () => {
    seedJob();
    seams.review.mockImplementation(refused);
    await passAt(T0);
    endWindow(T0 + MINUTE);
    await passAt(T0 + 3 * 60 * MINUTE);
    expect(seams.review).toHaveBeenCalledTimes(1);
    expect(request().capture_coverage_pending).toBe(false);
    expect(reviewOf()).toMatchObject({ state: "ended", reason: "job_window_ended" });
    expect(job()).toMatchObject({ state: "ended", reason: "job_window_ended" });
  });

  it("goes on trying while the window's ending is recorded for an earlier grant only (the field alone is no ending)", async () => {
    seedJob();
    seams.review.mockImplementation(refused);
    await passAt(T0);
    state.docs.set("inboundRequests/req-1", { ...request(), website_job_window_ending: { window_ended_at_epoch: T0 / 1000 } });
    await passAt(job()!.retry_after_ms + 1_000);
    expect(seams.review).toHaveBeenCalledTimes(2);
    expect(request().capture_coverage_pending).toBe(true);
  });

  it("tells the owner once per provider and cause, not once per pass, and again after the provider recovered", async () => {
    seedJob();
    seams.review.mockImplementation(refused);
    await passAt(T0);
    for (let pass = 0; pass < 3; pass++) await passAt(job()!.retry_after_ms + 1_000);
    expect(seams.alert).toHaveBeenCalledTimes(1);
    expect(seams.alert.mock.calls[0]).toEqual(["provider_outage:gemini:rate_limited",
      "Gemini refuses for rate or quota (HTTP 429): 1 job waiting (video reading retries by itself)"]);
    seams.review.mockResolvedValue(FINDING);
    await passAt(job()!.retry_after_ms + 1_000);
    expect(state.docs.get("providerOutageAlerts/gemini-rate_limited")).toMatchObject({ open: false });
  });
});

describe("a reading parked before provider outages were retried", () => {
  function seedParked(extra: Record<string, unknown> = {}) {
    const binding = { source: SOURCE, brief_digest: humanDecisionDigest(BRIEF), capture_id: "walkthrough-req-1" };
    const id = humanDecisionDigest({ request_id: "req-1", ...binding });
    seedJob({ capture_coverage_pending: false,
      capture_coverage_review: { review_id: id, state: "review_required", reason: "automatic_review_attempts_exhausted" }, ...extra });
    state.docs.set(`captureCoverageReviews/${id}`, { requestId: "req-1", sceneId: "site-req-1", captureId: "walkthrough-req-1",
      binding, state: "waiting_prerequisite", attempts: 3, claim_token: "old", started_at: T0 - 3 * 60 * MINUTE });
    return id;
  }

  it("is picked up again by the queue itself and read once the provider answers, with no one pressing anything", async () => {
    const id = seedParked();
    seams.review.mockResolvedValue(FINDING);
    await passAt(T0);
    await passAt(T0 + MINUTE);
    expect(seams.review).toHaveBeenCalledTimes(1);
    expect(reviewOf()).toMatchObject({ review_id: id, state: "completed" });
    const parked = state.docs.get(`captureCoverageReviews/${id}`) as Record<string, any>;
    expect(parked.requeue_history).toHaveLength(1);
    expect(parked.requeue_history[0]).toMatchObject({ approved_by: null, automatic: true });
  });

  /** The live record's shape: three waits in 3 min 22 s counted as attempts; no outage mark, no wait reason. */
  function seedLiveShape() {
    const id = seedParked();
    const ref = `captureCoverageReviews/${id}`;
    state.docs.set(ref, { ...state.docs.get(ref), state: "waiting_prerequisite", attempts: 3,
      first_claimed_at_ms: T0 - 202_000, started_at: T0 - 1_000 });
    return id;
  }
  /** The capture's budget still names the last call in flight, as a call that failed before recording a response leaves it. */
  function seedPendingCall(id: string, runStatus: string) {
    const budget = `captureCoverageReviews/budget-${humanDecisionDigest({ capture_id: "walkthrough-req-1" })}`;
    state.docs.set(budget, { schema_version: "capture_coverage_inference_budget.v1", capture_id: "walkthrough-req-1", cap_usd: null,
      exposure_usd: 1.818624, calls: 1, pending_token: "tok-1", last_review_id: id });
    state.docs.set(`${budget}/calls/tok-1`, { schema_version: "capture_inference_call.v1", admission_token: "tok-1", state: "admitted",
      capture_id: "walkthrough-req-1", request_id: "req-1", run_id: null, owner_run_id: "run-1", review_id: id, claim_token: "old",
      reserved_usd: 1.818624 });
    state.docs.set("agentRuns/run-1", { task_kind: "capture_coverage", status: runStatus, session_key: `capture_coverage:${id}`,
      metadata: { capture_id: "walkthrough-req-1", review_id: id, coverage_claim_token: "old" } });
    return budget;
  }

  it("recovers a reading parked by waits, shaped as the live record, and reads it with no one pressing anything", async () => {
    const id = seedLiveShape();
    seams.review.mockResolvedValue(FINDING);
    await passAt(T0);
    await passAt(T0 + MINUTE);
    expect(seams.review).toHaveBeenCalledTimes(1);
    expect(reviewOf()).toMatchObject({ review_id: id, state: "completed" });
    expect((state.docs.get(`captureCoverageReviews/${id}`) as Record<string, any>).requeue_history)
      .toEqual([expect.objectContaining({ automatic: true, prior_attempts: 3, prior_state: "waiting_prerequisite" })]);
  });

  it("recovers it when its last call's owner has ended but the budget still names that call in flight", async () => {
    const id = seedLiveShape();
    seedPendingCall(id, "failed");
    seams.review.mockResolvedValue(FINDING);
    await passAt(T0);
    await passAt(T0 + MINUTE);
    expect(seams.review).toHaveBeenCalledTimes(1);
    expect(reviewOf()).toMatchObject({ review_id: id, state: "completed" });
  });

  it("does not recover it while its last call's owner may still be running", async () => {
    seedPendingCall(seedLiveShape(), "running");
    await passAt(T0);
    expect(reviewOf()).toMatchObject({ state: "review_required" });
    expect(seams.review).not.toHaveBeenCalled();
  });

  it("recovers a reading by itself once at most, and never uses the owner's two requeues for it", async () => {
    const id = seedLiveShape();
    seams.review.mockResolvedValue(null);
    // Recovered, then three reads that went wrong park it again, this time marked.
    await passAt(T0);
    expect(reviewOf()).toMatchObject({ state: "requeued", reason: "automatic_parked_reading_recovery" });
    for (let pass = 1; pass < 10 && reviewOf()?.state !== "review_required"; pass++) await passAt(T0 + pass * 2 * MINUTE);
    expect(seams.review).toHaveBeenCalledTimes(3);
    expect(reviewOf()).toMatchObject({ state: "review_required", waits_and_outages_excluded: true });
    // Even unmarked, a reading already recovered once is not recovered by the queue again.
    state.docs.set("inboundRequests/req-1", { ...request(), capture_coverage_review: { review_id: id, state: "review_required",
      reason: "automatic_review_attempts_exhausted" } });
    expect((await requeueExhaustedCoverageReview("req-1", { apply: true, automatic: true })).reason).toBe("requeue_limit_reached");
    const approval = { approvedBy: "owner-uid", approvalEvidence: "owner said so" };
    expect((await requeueExhaustedCoverageReview("req-1", { apply: true, approval })).outcome).toBe("requeued");
  });

  it("is left alone when its window has ended, or when it was parked by readings that went wrong", async () => {
    seedParked();
    endWindow(T0 - MINUTE);
    await passAt(T0);
    expect(reviewOf()).toMatchObject({ state: "review_required" });
    state.docs.clear();
    const id = seedParked();
    state.docs.set("inboundRequests/req-1", { ...request(), capture_coverage_review: { ...reviewOf(), waits_and_outages_excluded: true } });
    await passAt(T0);
    expect(reviewOf()).toMatchObject({ review_id: id, state: "review_required" });
    expect(seams.review).not.toHaveBeenCalled();
  });
});
