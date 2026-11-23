// @vitest-environment node
/**
 * A video reading that can never succeed ends at once, the job goes on without a first look, and the site's page stops
 * saying "We're watching your video."; a reading parked because the reading refused every video over 64 MB is read
 * again after that cause was removed, once, with nobody pressing anything.
 *
 * Before: a 73 MB video failed "video_too_large" three times a minute apart, the job was parked for a person
 * (review_required / automatic_review_attempts_exhausted), and the page said "We're watching your video." for hours.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const seams = vi.hoisted(() => ({ review: vi.fn() }));

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const fake = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => fake.FAKE_FIELD_DELETE } } },
    dbAdmin: fake.sharedFakeFirestore };
});
vi.mock("../config/env", async () => ({ ...await vi.importActual("../config/env"), isSiteVideoEvidenceEnabled: () => true }));
vi.mock("../utils/captureCoverageReview", () => ({ reviewCaptureCoverage: seams.review }));
vi.mock("../utils/siteTaskBrief", async () => ({ ...await vi.importActual("../utils/siteTaskBrief"), getBrief: async () => BRIEF }));
vi.mock("../utils/captureFootageReview", () => ({ findPriorFootageReview: async () => ({ state: "none" }) }));
vi.mock("../utils/siteTaskBriefReading", () => ({ mergeFootageIntoBrief: vi.fn() }));
vi.mock("../utils/captureUploadAuthorization", () => ({ authorizeCaptureUpload: async () => ({ allowed: true }),
  CAPTURE_MODE_NOT_CONVERTED: "capture_mode_not_converted", CAPTURE_MODE_NOT_CONVERTED_DETAIL: "" }));
vi.mock("../utils/betaAbuseCaps", () => ({ modelReviewHeadroom: async () => ({ available: true }) }));
vi.mock("../agents/adapters/site-assessment-budget", () => ({ GEMINI_VIDEO_CALL_RESERVATION_USD: 0.12 }));
vi.mock("../utils/opsProcessAlerts", () => ({ sendRateLimitedOpsAlert: vi.fn(async () => ({ sent: true, suppressed: false })) }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
import { humanDecisionDigest } from "../utils/human-reply-admission";
import { reconcileCoverageReviews } from "../utils/captureCoverageQueue";
import { requeueExhaustedCoverageReview } from "../utils/captureCoverageRequeue";
import { sealWebsiteJobWindowEnding } from "../utils/websiteJobWindowEnding";
import { composeSiteAnswer } from "../utils/siteAnswer";
import { jobOutlook, outlookAnswerOf } from "../utils/jobOutlook";

const BRIEF = { requestId: "req-1", summary: "Move the tray to the other end of the table", proposed: [] };
const FINDING = { coversScene: true, missingCoverage: [], supplementWouldFinish: false, unreadableReasons: [], confidence: 0.9 };
const SOURCE = { kind: "browser_pending", key: `sha256:${"a".repeat(64)}` };
const T0 = Date.parse("2026-11-23T15:22:22.000Z");
const MINUTE = 60_000;
const NOT_READ = "We couldn't read your video, so this job has no first look.";

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
const reviewOf = () => request()?.capture_coverage_review as Record<string, unknown> | undefined;
const job = () => [...state.docs.entries()].find(([key]) => /^captureCoverageReviews\/[a-f0-9]{64}$/.test(key))?.[1] as Record<string, any> | undefined;
async function passAt(ms: number) {
  vi.setSystemTime(ms);
  await reconcileCoverageReviews();
  await reconcileCoverageReviews();
}
const failsWith = (reason: string) => async (params: { onFailed?: (reason: string) => void }) => { params.onFailed?.(reason); return null; };
/** The site's page as the server composes it from the job's record: the answer and the outlook. */
function page() {
  const answer = composeSiteAnswer({ request: request(), brief: BRIEF as never, measurements: null, videoReceived: true });
  const outlook = jobOutlook({ consentRevoked: false, closedByOwner: false, answer: outlookAnswerOf(answer), windowEnded: false,
    noGrantEnded: false, preparation: null, scene: null, proof: null });
  return { answer, outlook };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  state.docs.clear();
  seams.review.mockReset();
});
afterEach(() => { vi.useRealTimers(); });

describe("a read that another try cannot change", () => {
  it.each(["video_too_large", "video_not_directly_readable", "video_empty"])(
    "ends the reading at once on %s, and the job goes on without a first look", async (code) => {
      seedJob();
      seams.review.mockImplementation(failsWith(code));
      await passAt(T0);
      await passAt(T0 + 5 * MINUTE);
      expect(seams.review).toHaveBeenCalledTimes(1);
      expect(job()).toMatchObject({ state: "ended", reason: code, attempts: 1, retry_after_ms: null });
      expect(request().capture_coverage_pending).toBe(false);
      expect(reviewOf()).toMatchObject({ state: "ended", reason: "video_not_readable", failure_reason: code });
      // The page stops saying it is watching: no first look, and the job goes on building its simulation.
      const { answer, outlook } = page();
      expect(answer).toMatchObject({ state: "cannot_assess", reason: NOT_READ });
      expect(outlook).toMatchObject({ phase: "building", reason: null });
    });

  it("still tries a read that failed for another reason again, and parks it only after three", async () => {
    seedJob();
    seams.review.mockImplementation(failsWith("video_fetch_failed"));
    await passAt(T0);
    expect(job()).toMatchObject({ state: "failed", reason: "video_fetch_failed", attempts: 1 });
    expect(page().answer).toMatchObject({ state: "reading" });
    for (let pass = 1; pass < 6 && !reviewOf(); pass++) await passAt(T0 + pass * 2 * MINUTE);
    expect(seams.review).toHaveBeenCalledTimes(3);
    expect(reviewOf()).toMatchObject({ state: "review_required", reason: "automatic_review_attempts_exhausted" });
    // Parked after three real failed reads: the page no longer says it is watching either.
    expect(page().answer).toMatchObject({ state: "cannot_assess", reason: NOT_READ });
  });
});

describe("a reading parked because the video was over 64 MB", () => {
  /**
   * The live record's shape after pull request 1418's deploy: its one automatic recovery used, three more reads failed
   * as too large, parked again and marked as parked by reads that went wrong.
   */
  function seedLiveShape(extra: Record<string, unknown> = {}) {
    const binding = { source: SOURCE, brief_digest: humanDecisionDigest(BRIEF), capture_id: "walkthrough-req-1" };
    const id = humanDecisionDigest({ request_id: "req-1", ...binding });
    seedJob({ capture_coverage_pending: false, capture_coverage_review: { review_id: id, state: "review_required",
      reason: "automatic_review_attempts_exhausted", waits_and_outages_excluded: true }, ...extra });
    state.docs.set(`captureCoverageReviews/${id}`, { requestId: "req-1", sceneId: "site-req-1", captureId: "walkthrough-req-1",
      binding, state: "failed", reason: "video_too_large", attempts: 3, claim_token: "old", started_at: T0 - 10 * MINUTE,
      retry_after_ms: T0 - 9 * MINUTE, first_claimed_at_ms: T0 - 14 * MINUTE,
      requeue_history: [{ requeued_at_iso: new Date(T0 - 15 * MINUTE).toISOString(), approved_by: null, approval_evidence: null,
        automatic: true, prior_attempts: 3, prior_state: "failed", audit_digest: "d1" }] });
    return id;
  }
  const stored = (id: string) => state.docs.get(`captureCoverageReviews/${id}`) as Record<string, any>;

  it("is read again by the queue itself, once, and the site gets its first look", async () => {
    const id = seedLiveShape();
    expect(page().answer).toMatchObject({ state: "cannot_assess", reason: NOT_READ });
    seams.review.mockResolvedValue(FINDING);
    await passAt(T0);
    await passAt(T0 + MINUTE);
    expect(seams.review).toHaveBeenCalledTimes(1);
    expect(reviewOf()).toMatchObject({ review_id: id, state: "completed" });
    expect(stored(id).requeue_history).toHaveLength(2);
    expect(stored(id).requeue_history[1]).toMatchObject({ automatic: true, automatic_cause: "video_too_large", approved_by: null });
  });

  it("is recovered for that cause at most once, and never uses the owner's two requeues", async () => {
    const id = seedLiveShape();
    seams.review.mockImplementation(failsWith("video_too_large"));
    await passAt(T0);
    // Still too large (over what the start form accepts): this time the reading ends at once.
    await passAt(T0 + MINUTE);
    expect(seams.review).toHaveBeenCalledTimes(1);
    expect(reviewOf()).toMatchObject({ state: "ended", reason: "video_not_readable", failure_reason: "video_too_large" });
    // Even parked again for the same cause, the queue does not recover it a second time.
    state.docs.set("inboundRequests/req-1", { ...request(), capture_coverage_review: { review_id: id, state: "review_required",
      reason: "automatic_review_attempts_exhausted", waits_and_outages_excluded: true } });
    state.docs.set(`captureCoverageReviews/${id}`, { ...stored(id), state: "failed", attempts: 3 });
    expect((await requeueExhaustedCoverageReview("req-1", { apply: true, automatic: true, cause: "video_too_large" })).reason)
      .toBe("requeue_limit_reached");
    await passAt(T0 + 10 * MINUTE);
    expect(seams.review).toHaveBeenCalledTimes(1);
    const approval = { approvedBy: "owner-uid", approvalEvidence: "owner said so" };
    expect((await requeueExhaustedCoverageReview("req-1", { apply: true, approval })).outcome).toBe("requeued");
  });

  it("is left alone when its window has ended, when its last failure was another, or when its consent is not current", async () => {
    seedLiveShape();
    const authority = `sha256:${"b".repeat(64)}`;
    state.docs.set("inboundRequests/req-1", { ...request(),
      website_scene_sponsorship: { request_id: "req-1", authority_digest: authority, expires_at_epoch: (T0 - MINUTE) / 1000 },
      website_job_window_ending: sealWebsiteJobWindowEnding({ request_id: "req-1", authority_digest: authority,
        window_ended_at_epoch: (T0 - MINUTE) / 1000, recorded_at_iso: new Date(T0 - MINUTE).toISOString(), notice: "none_emails_retired" }) });
    await passAt(T0);
    expect(reviewOf()).toMatchObject({ state: "review_required" });

    state.docs.clear();
    const id = seedLiveShape();
    state.docs.set(`captureCoverageReviews/${id}`, { ...stored(id), reason: "non_json_response" });
    await passAt(T0);
    expect(reviewOf()).toMatchObject({ state: "review_required" });
    expect((await requeueExhaustedCoverageReview("req-1", { apply: true, automatic: true, cause: "video_too_large" })).reason)
      .toBe("recovery_cause_not_recorded");

    state.docs.clear();
    seedLiveShape();
    state.docs.set("inboundRequests/req-1", { ...request(), request: { ...request().request, consent_attestation: null } });
    await passAt(T0);
    expect(reviewOf()).toMatchObject({ state: "review_required" });
    expect(seams.review).not.toHaveBeenCalled();
  });
});
