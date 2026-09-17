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

const buildCaptureFootageReviewer = vi.hoisted(() => vi.fn());
const isSiteVideoEvidenceEnabled = vi.hoisted(() => vi.fn(() => true));

vi.mock("../utils/captureFootageReview", () => ({ buildCaptureFootageReviewer }));
vi.mock("../config/env", () => ({ isSiteVideoEvidenceEnabled }));
vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { screenCaptureForPrivacy } = await import("../utils/capturePrivacyScreen");

const CAPTURE = { requestId: "req-1", sceneId: "site-req-1", captureId: "walkthrough-req-1" };

/** A reading with everything benign except what the test sets. */
function evidence(overrides: Record<string, unknown> = {}) {
  return {
    footage_status: "usable",
    footage_status_reason: null,
    summary: "A tote is moved from a conveyor to a pallet.",
    observations: [],
    cycle_measurement: { cycles: [], median_cycle_seconds: null, implied_band: null, note: "" },
    people_present: { max_visible_at_once: 0, relationship_to_work: "none_visible", note: "" },
    not_evidenced: [],
    privacy_flag: false,
    ...overrides,
  };
}

function reviewerReturning(value: unknown) {
  return { review: vi.fn(async () => value), bindingFieldIds: [] };
}

beforeEach(() => {
  vi.clearAllMocks();
  isSiteVideoEvidenceEnabled.mockReturnValue(true);
  vi.unstubAllEnvs();
});

describe("the one question it asks", () => {
  it("holds a capture whose footage centres identifiable people", async () => {
    buildCaptureFootageReviewer.mockResolvedValue(
      reviewerReturning(evidence({ privacy_flag: true })),
    );

    const result = await screenCaptureForPrivacy(CAPTURE);

    expect(result.proceed).toBe(false);
    expect(result.outcome).toBe("privacy_hold");
    expect(result.detail).toMatch(/consent is a question for a person/i);
    // The reading is carried out, so a person handling the hold can see what
    // was seen rather than taking the verdict on trust.
    expect(result.evidence).toMatchObject({ privacy_flag: true });
  });

  it("lets unusable footage through, because that is a spending question", async () => {
    // Deliberately narrow. Unusable belongs at reconstruction: it decides
    // whether to pay, it reads better with the frames in hand, and deciding it
    // in two places means two places can disagree about one video.
    buildCaptureFootageReviewer.mockResolvedValue(
      reviewerReturning(
        evidence({ footage_status: "unusable", footage_status_reason: "Ten seconds of a wall." }),
      ),
    );

    const result = await screenCaptureForPrivacy(CAPTURE);

    expect(result.proceed).toBe(true);
    expect(result.outcome).toBe("cleared");
  });

  it("lets contradicting footage through for the same reason", async () => {
    buildCaptureFootageReviewer.mockResolvedValue(
      reviewerReturning(
        evidence({
          observations: [
            { field_id: "sceneStability", stance: "contradicts", observation: "Everything moved." },
          ],
        }),
      ),
    );

    await expect(screenCaptureForPrivacy(CAPTURE)).resolves.toMatchObject({
      proceed: true,
      outcome: "cleared",
    });
  });

  it("clears footage with people merely passing by", async () => {
    // `people_present` is the clear-window gate and is not the privacy flag.
    // Treating any visible person as a hold would stop most real warehouses.
    buildCaptureFootageReviewer.mockResolvedValue(
      reviewerReturning(
        evidence({
          people_present: {
            max_visible_at_once: 3,
            relationship_to_work: "working_in_the_space",
            note: "",
          },
        }),
      ),
    );

    await expect(screenCaptureForPrivacy(CAPTURE)).resolves.toMatchObject({ proceed: true });
  });
});

describe("failing open, on purpose", () => {
  it("proceeds when the evidence lane is switched off", async () => {
    // The rule everywhere else in this repo is fail closed. Not here: this is a
    // tightening of an existing gate, and a tightening that strands every
    // upload when a flag is off is worse than the thing it fixes.
    isSiteVideoEvidenceEnabled.mockReturnValue(false);

    const result = await screenCaptureForPrivacy(CAPTURE);

    expect(result.proceed).toBe(true);
    expect(result.outcome).toBe("not_reviewed");
    expect(buildCaptureFootageReviewer).not.toHaveBeenCalled();
  });

  it("proceeds when no reviewer can be built", async () => {
    buildCaptureFootageReviewer.mockResolvedValue(null);

    await expect(screenCaptureForPrivacy(CAPTURE)).resolves.toMatchObject({
      proceed: true,
      outcome: "not_reviewed",
    });
  });

  it("proceeds when building the reviewer throws", async () => {
    buildCaptureFootageReviewer.mockRejectedValue(new Error("storage unavailable"));

    await expect(screenCaptureForPrivacy(CAPTURE)).resolves.toMatchObject({
      proceed: true,
      outcome: "not_reviewed",
    });
  });

  it("proceeds when the review itself throws", async () => {
    buildCaptureFootageReviewer.mockResolvedValue({
      review: vi.fn(async () => {
        throw new Error("provider refused");
      }),
      bindingFieldIds: [],
    });

    await expect(screenCaptureForPrivacy(CAPTURE)).resolves.toMatchObject({
      proceed: true,
      outcome: "not_reviewed",
    });
  });

  it("proceeds when the review returns nothing", async () => {
    buildCaptureFootageReviewer.mockResolvedValue(reviewerReturning(null));

    await expect(screenCaptureForPrivacy(CAPTURE)).resolves.toMatchObject({
      proceed: true,
      outcome: "not_reviewed",
    });
  });

  it("does not hold an upload open on a provider that has stopped answering", async () => {
    vi.stubEnv("BLUEPRINT_CAPTURE_PRIVACY_SCREEN_TIMEOUT_MS", "40");
    buildCaptureFootageReviewer.mockResolvedValue({
      review: vi.fn(() => new Promise(() => {})),
      bindingFieldIds: [],
    });

    const started = Date.now();
    const result = await screenCaptureForPrivacy(CAPTURE);

    expect(result.proceed).toBe(true);
    expect(result.outcome).toBe("not_reviewed");
    // The site is holding an open request with a video already stored, so this
    // has to return rather than wait on a hung call.
    expect(Date.now() - started).toBeLessThan(2_000);
  });
});

describe("what it hands on", () => {
  it("carries a clean reading forward so it is not read twice", async () => {
    // Watching a walkthrough is a model call, and reconstruction asks the same
    // question of the same video minutes later.
    const reading = evidence({ summary: "Totes onto a pallet, twice." });
    buildCaptureFootageReviewer.mockResolvedValue(reviewerReturning(reading));

    const result = await screenCaptureForPrivacy(CAPTURE);

    expect(result.evidence).toMatchObject({ summary: "Totes onto a pallet, twice." });
  });

  it("carries no evidence when nothing was watched", async () => {
    // An absent reading must not read as "watched and found nothing" -- the
    // same distinction the footage schema draws with `not_evidenced`.
    buildCaptureFootageReviewer.mockResolvedValue(null);

    await expect(screenCaptureForPrivacy(CAPTURE)).resolves.toMatchObject({ evidence: null });
  });
});
