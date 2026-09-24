// @vitest-environment node
/**
 * Looking at the walkthrough before we start copying it.
 *
 * ## The ordering bug
 *
 * The footage review was correctly placed for two of its three blockers.
 * "Unusable" and "contradicts" are questions about whether to *spend*, and the
 * review runs immediately before `generateWorldFromFrames`, which is the billed
 * call. Right place.
 *
 * `capture_footage_privacy_review` is not a spending question. Its own words
 * are that consent is "settled before the footage goes any further" — but by
 * the time it fired, `extractFrames` had already decoded the video and written
 * frames of whoever is in it into our bucket. The gate stood in front of the
 * cheque and behind the copying.
 *
 * These cover the screen that moves that one question to upload time, where the
 * video exists and nothing has been derived from it yet.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const buildCapturePrivacyReviewer = vi.hoisted(() => vi.fn());
const isSiteVideoEvidenceEnabled = vi.hoisted(() => vi.fn(() => true));

vi.mock("../utils/captureFootageReview", () => ({ buildCapturePrivacyReviewer }));
vi.mock("../config/env", () => ({ isSiteVideoEvidenceEnabled }));
vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { screenCaptureForPrivacy } = await import("../utils/capturePrivacyScreen");

const CAPTURE = { requestId: "req-1", sceneId: "site-req-1", captureId: "walkthrough-req-1" };

/** A reading with everything benign except what the test sets. */
function evidence(overrides: Record<string, unknown> = {}) {
  return {
    decision: "clear",
    evidence_seconds: [],
    ...overrides,
  };
}

function reviewerReturning(value: unknown) {
  return { review: vi.fn(async () => value) };
}

beforeEach(() => {
  vi.clearAllMocks();
  isSiteVideoEvidenceEnabled.mockReturnValue(true);
  vi.unstubAllEnvs();
});

describe("the one question it asks", () => {
  it("holds a capture whose footage centres identifiable people", async () => {
    buildCapturePrivacyReviewer.mockResolvedValue(
      reviewerReturning(evidence({ decision: "hold", evidence_seconds: [2] })),
    );

    const result = await screenCaptureForPrivacy(CAPTURE);

    expect(result.proceed).toBe(false);
    expect(result.outcome).toBe("privacy_hold");
    expect(result.detail).toMatch(/consent is a question for a person/i);
    // The reading is carried out, so a person handling the hold can see what
    // was seen rather than taking the verdict on trust.
    expect(result.evidence).toMatchObject({ decision: "hold", evidence_seconds: [2] });
  });

  it("clears only an explicit privacy-only clear reading", async () => {
    buildCapturePrivacyReviewer.mockResolvedValue(
      reviewerReturning(evidence()),
    );

    const result = await screenCaptureForPrivacy(CAPTURE);

    expect(result.proceed).toBe(true);
    expect(result.outcome).toBe("cleared");
  });

  it("holds an uncertain privacy reading for a person", async () => {
    buildCapturePrivacyReviewer.mockResolvedValue(
      reviewerReturning(evidence({ decision: "uncertain" })),
    );
    await expect(screenCaptureForPrivacy(CAPTURE)).resolves.toMatchObject({
      proceed: false, eligibility: "rejected", retryable: false,
    });
  });
});

describe("accepting an upload fails open; deriving from it fails closed", () => {
  it("proceeds when no reviewer was ever configured, and says so", async () => {
    // The one case that still proceeds. A deployment that never switched the
    // evidence lane on has not made a privacy decision, and halting every
    // capture dead would be a surprise rather than a safeguard. It is recorded
    // as `unscreened`, which cannot be read as "watched and found nothing".
    isSiteVideoEvidenceEnabled.mockReturnValue(false);

    const result = await screenCaptureForPrivacy(CAPTURE);

    expect(result.proceed).toBe(true);
    expect(result.eligibility).toBe("unscreened");
    expect(result.outcome).toBe("not_reviewed");
    expect(buildCapturePrivacyReviewer).not.toHaveBeenCalled();
  });

  it("holds when there is nothing signable to review", async () => {
    // The lane is on, so we opted into screening and could not do it. Not the
    // same as never having configured a reviewer.
    buildCapturePrivacyReviewer.mockResolvedValue(null);

    await expect(screenCaptureForPrivacy(CAPTURE)).resolves.toMatchObject({
      proceed: false,
      eligibility: "pending",
      outcome: "review_unavailable",
      retryable: true,
    });
  });

  it("holds when building the reviewer throws", async () => {
    buildCapturePrivacyReviewer.mockRejectedValue(new Error("storage unavailable"));

    await expect(screenCaptureForPrivacy(CAPTURE)).resolves.toMatchObject({
      proceed: false,
      eligibility: "pending",
      retryable: true,
    });
  });

  it("holds when the review itself throws", async () => {
    // The path the audit was specifically about. A model error is not evidence
    // that the footage is clear, and the old behaviour treated it as such --
    // which is how frames of unconsented people reach a bucket. The
    // reconstruction-time gate cannot un-copy them, so pointing at it was
    // never a defence.
    buildCapturePrivacyReviewer.mockResolvedValue({
      review: vi.fn(async () => {
        throw new Error("provider refused");
      }),
    });

    await expect(screenCaptureForPrivacy(CAPTURE)).resolves.toMatchObject({
      proceed: false,
      eligibility: "pending",
      outcome: "review_unavailable",
    });
  });

  it("holds when the review returns nothing", async () => {
    buildCapturePrivacyReviewer.mockResolvedValue(reviewerReturning(null));

    await expect(screenCaptureForPrivacy(CAPTURE)).resolves.toMatchObject({
      proceed: false,
      eligibility: "pending",
    });
  });

  it("still returns promptly when a provider stops answering, without deriving", async () => {
    // Both halves matter. The site is holding an open request with a video
    // already stored, so this cannot wait on a hung call -- and it must not pay
    // for returning quickly by letting extraction start.
    vi.stubEnv("BLUEPRINT_CAPTURE_PRIVACY_SCREEN_TIMEOUT_MS", "40");
    buildCapturePrivacyReviewer.mockResolvedValue({
      review: vi.fn(() => new Promise(() => {})),
    });

    const started = Date.now();
    const result = await screenCaptureForPrivacy(CAPTURE);

    expect(result.proceed).toBe(false);
    expect(result.eligibility).toBe("pending");
    expect(result.retryable).toBe(true);
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("never marks a hold retryable when a person is what is needed", async () => {
    // A privacy reading is not a transient failure. Asking the same reviewer
    // the same question about the same video gives the same answer.
    buildCapturePrivacyReviewer.mockResolvedValue(
      reviewerReturning(evidence({ decision: "hold" })),
    );

    const result = await screenCaptureForPrivacy(CAPTURE);

    expect(result.eligibility).toBe("rejected");
    expect(result.retryable).toBe(false);
    expect(result.proceed).toBe(false);
  });
});

describe("what it hands on", () => {
  it("carries a clean reading forward so it is not read twice", async () => {
    const reading = evidence();
    buildCapturePrivacyReviewer.mockResolvedValue(reviewerReturning(reading));

    const result = await screenCaptureForPrivacy(CAPTURE);

    expect(result.evidence).toMatchObject({ decision: "clear" });
  });

  it("carries no evidence when nothing was watched", async () => {
    // An absent reading must not read as "watched and found nothing" -- the
    // same distinction the footage schema draws with `not_evidenced`.
    buildCapturePrivacyReviewer.mockResolvedValue(null);

    await expect(screenCaptureForPrivacy(CAPTURE)).resolves.toMatchObject({ evidence: null });
  });
});
