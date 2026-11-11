// @vitest-environment node
/**
 * Waiting for another call on the same capture is not an attempt (reference job, 2026-11-11). The video reading and
 * the site assessment share one per-capture budget record that allows one model call at a time; a reading that meets
 * a call in flight used to spend one of its three attempts on the wait, and a job could be left with no first answer
 * for good. A wait is now given back and tried again after a short delay, bounded by time; a real failure still
 * counts as before.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const seams = vi.hoisted(() => ({ review: vi.fn() }));

vi.mock("../../client/src/lib/firebaseAdmin", async () => ({
  default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => undefined } } },
  dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore,
}));
vi.mock("../config/env", async () => ({ ...await vi.importActual("../config/env"), isSiteVideoEvidenceEnabled: () => true }));
vi.mock("../utils/captureCoverageReview", () => ({ reviewCaptureCoverage: seams.review }));
vi.mock("../utils/siteTaskBrief", () => ({ getBrief: async () => BRIEF }));
vi.mock("../utils/captureFootageReview", () => ({ findPriorFootageReview: async () => ({ state: "none" }) }));
vi.mock("../utils/siteTaskBriefReading", () => ({ mergeFootageIntoBrief: vi.fn() }));
vi.mock("../utils/captureUploadAuthorization", () => ({ authorizeCaptureUpload: async () => ({ allowed: true }) }));
vi.mock("../utils/betaAbuseCaps", () => ({ modelReviewHeadroom: async () => ({ available: true }) }));
vi.mock("../agents/adapters/site-assessment-budget", () => ({ GEMINI_VIDEO_CALL_RESERVATION_USD: 0.12 }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
import { reconcileCoverageReviews } from "../utils/captureCoverageQueue";

/** The bounds, as the queue sets them: a minute's delay between waits, and 30 minutes from the first claim. */
const COVERAGE_REVIEW_WAIT_RETRY_MS = 60_000;
const COVERAGE_REVIEW_WAIT_LIMIT_MS = 30 * 60_000;

const BRIEF = { requestId: "req-1", summary: "Move the tray to the other end of the table", proposed: [] };
const FINDING = { coversScene: false, missingCoverage: ["The far side of the table"], supplementWouldFinish: true, unreadableReasons: [], confidence: 0.9 };
const T0 = Date.parse("2026-11-11T18:44:00.000Z");

function seedJob() {
  state.docs.set("inboundRequests/req-1", {
    request: { buyerType: "site_operator", consent_attestation: { granted: true, statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-11-11T18:43:00.000Z" } },
    capture_privacy_source_bound_decision: { capture_id: "walkthrough-req-1", proceeded: true, producer_source: { kind: "browser_pending", key: `sha256:${"a".repeat(64)}` } },
    capture_coverage_pending: true,
    capture_coverage_request: { requestId: "req-1", sceneId: "site-req-1", captureId: "walkthrough-req-1" },
  });
  state.docs.set("siteTaskBriefs/req-1", BRIEF);
}
const reviewOf = () => state.docs.get("inboundRequests/req-1")?.capture_coverage_review as Record<string, unknown> | undefined;
const job = () => [...state.docs.entries()].find(([key]) => key.startsWith("captureCoverageReviews/"))?.[1] as Record<string, unknown> | undefined;

/** One pass of the queue a minute (and a little) later, as the scheduler runs it. */
async function tickAfter(ms: number) {
  vi.setSystemTime(Date.now() + ms);
  await reconcileCoverageReviews();
  // The cursor walks past the only job and wraps on the next pass.
  await reconcileCoverageReviews();
}

/** A read that met the assessment's call in flight, as the budget refuses it. */
const meetsCallInFlight = async (params: { onWaiting?: (reason: string) => void }) => { params.onWaiting?.("coverage_budget_call_in_flight"); return null; };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  state.docs.clear();
  seams.review.mockReset();
  seedJob();
});
afterEach(() => { vi.useRealTimers(); });

describe("the video reading and a call in flight for the same capture", () => {
  it("reads the video once the assessment's calls end, after three collisions inside three minutes", async () => {
    seams.review.mockImplementationOnce(meetsCallInFlight).mockImplementationOnce(meetsCallInFlight).mockImplementationOnce(meetsCallInFlight)
      .mockResolvedValue(FINDING);
    for (let pass = 0; pass < 8 && !reviewOf(); pass++) await tickAfter(COVERAGE_REVIEW_WAIT_RETRY_MS + 1_000);
    expect(seams.review).toHaveBeenCalledTimes(4);
    expect(reviewOf()).toMatchObject({ state: "completed", reason: null });
    expect(state.docs.get("inboundRequests/req-1")!.capture_coverage_pending).toBe(false);
    // The three waits were given back: only the read that happened counts.
    expect(job()).toMatchObject({ state: "completed", attempts: 1, finding: FINDING });
  });

  it("waits a short delay before trying again, rather than at once", async () => {
    seams.review.mockImplementation(meetsCallInFlight);
    await tickAfter(0);
    expect(seams.review).toHaveBeenCalledTimes(1);
    expect(job()).toMatchObject({ state: "waiting_prerequisite", attempts: 0, wait_reason: "coverage_budget_call_in_flight" });
    await tickAfter(1_000);
    expect(seams.review).toHaveBeenCalledTimes(1);
    await tickAfter(COVERAGE_REVIEW_WAIT_RETRY_MS);
    expect(seams.review).toHaveBeenCalledTimes(2);
  });

  it("still hands the job to a person after three real failed reads", async () => {
    seams.review.mockResolvedValue(null);
    for (let pass = 0; pass < 8 && !reviewOf(); pass++) await tickAfter(COVERAGE_REVIEW_WAIT_RETRY_MS + 1_000);
    expect(seams.review).toHaveBeenCalledTimes(3);
    expect(reviewOf()).toMatchObject({ state: "review_required", reason: "automatic_review_attempts_exhausted" });
  });

  it("counts a wait only once it has lasted longer than the time bound from the first claim, with its typed reason", async () => {
    seams.review.mockImplementation(meetsCallInFlight);
    // Inside the bound, any number of waits leaves the reading pending.
    for (let pass = 0; pass < 10; pass++) await tickAfter(COVERAGE_REVIEW_WAIT_RETRY_MS + 1_000);
    expect(seams.review.mock.calls.length).toBeGreaterThan(3);
    expect(reviewOf()).toBeUndefined();
    expect(job()).toMatchObject({ attempts: 0 });
    // Past the bound, each wait counts as a failed attempt, and the third hands the job to a person.
    vi.setSystemTime(T0 + COVERAGE_REVIEW_WAIT_LIMIT_MS + 1_000);
    for (let pass = 0; pass < 10 && !reviewOf(); pass++) await tickAfter(COVERAGE_REVIEW_WAIT_RETRY_MS + 1_000);
    expect(reviewOf()).toMatchObject({ state: "review_required", reason: "automatic_review_attempts_exhausted" });
    expect(job()).toMatchObject({ attempts: 3, wait_reason: "coverage_budget_call_in_flight", wait_counted: true });
  });
});
