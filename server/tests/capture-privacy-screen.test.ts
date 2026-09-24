// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const buildCapturePrivacyReviewer = vi.hoisted(() => vi.fn());
vi.mock("../utils/captureFootageReview", () => ({ buildCapturePrivacyReviewer }));

import { privacyResultFromEvidence, screenCaptureForPrivacy } from "../utils/capturePrivacyScreen";

const capture = { requestId: "req-1", sceneId: "site-req-1", captureId: "walkthrough-req-1" };

describe("task video capture admission", () => {
  it("admits the upload without a person-specific provider review", async () => {
    buildCapturePrivacyReviewer.mockClear();
    await expect(screenCaptureForPrivacy(capture)).resolves.toMatchObject({
      proceed: true, eligibility: "unscreened", outcome: "not_reviewed", evidence: null,
    });
    expect(buildCapturePrivacyReviewer).not.toHaveBeenCalled();
  });

  it("does not reintroduce a hold when reading an old person decision", () => {
    expect(privacyResultFromEvidence({ decision: "hold", evidence_seconds: [2] })).toMatchObject({
      proceed: true, eligibility: "unscreened", outcome: "not_reviewed",
    });
  });
});
