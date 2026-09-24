// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  decideReconstructionFromReview,
  describeReconstructionReview,
} from "../utils/captureReviewGate";
import { startWorldReconstruction } from "../utils/worldReconstruction";
import { buildCaptureFootageReviewer } from "../utils/captureFootageReview";
import type { SiteVideoEvidenceOutput } from "../agents/tasks/site-video-evidence";

function evidence(overrides: Partial<SiteVideoEvidenceOutput> = {}): SiteVideoEvidenceOutput {
  return {
    footage_status: "usable",
    footage_status_reason: null,
    summary: "One station, totes moved onto a pallet.",
    observations: [],
    cycle_measurement: {
      cycles: [],
      median_cycle_seconds: null,
      implied_band: null,
      note: "",
    },
    people_present: {
      max_visible_at_once: 0,
      relationship_to_work: "none_visible",
      note: "",
    },
    not_evidenced: [],
    privacy_flag: false,
    ...overrides,
  } as SiteVideoEvidenceOutput;
}

function contradiction(fieldId: string, confidence: number) {
  return {
    field_id: fieldId,
    operator_answer: "stable",
    stance: "contradicts" as const,
    observation: "The layout is rearranged twice in the clip.",
    confidence,
    moments: [{ at_seconds: 12, note: "pallet positions change" }],
  };
}

const BINDING = ["sceneStability", "taskShape", "objectVariety", "accessWindow"];

describe("we do not pay to reconstruct a video that shows nothing", () => {
  it("reconstructs when the footage shows the task", () => {
    expect(decideReconstructionFromReview({ evidence: evidence() })).toEqual({ reconstruct: true });
  });

  it("stops unusable footage and says to film it again", () => {
    // Cheap to fix and worth saying plainly: forty-five seconds, not a meeting.
    const decision = decideReconstructionFromReview({
      evidence: evidence({
        footage_status: "unusable",
        footage_status_reason: "The clip shows a corridor, not a work area.",
      }),
    });

    expect(decision).toMatchObject({
      reconstruct: false,
      blocker: "capture_footage_unusable",
      refilm: true,
    });
    expect(decision.reconstruct === false && decision.detail).toContain("corridor");
  });

  it("still reconstructs partially usable footage", () => {
    // Marble does not need a perfect orbit, and holding a site's whole loop
    // over footage that was merely imperfect would cost far more than it saves.
    expect(
      decideReconstructionFromReview({ evidence: evidence({ footage_status: "partially_usable" }) }),
    ).toEqual({ reconstruct: true });
  });

  it("holds footage that contradicts what the site told us, and does not ask for a re-shoot", () => {
    // Re-filming does not fix a disagreement. One of the two is wrong and only
    // a conversation establishes which.
    const decision = decideReconstructionFromReview({
      evidence: evidence({ observations: [contradiction("sceneStability", 0.9)] }),
      bindingFieldIds: BINDING,
    });

    expect(decision).toMatchObject({
      reconstruct: false,
      blocker: "capture_footage_contradicts_gates",
      refilm: false,
    });
    expect(decision.reconstruct === false && decision.detail).toContain("sceneStability");
  });

  it("ignores a low-confidence contradiction", () => {
    // Same floor the qualification path uses, rather than a second number.
    expect(
      decideReconstructionFromReview({
        evidence: evidence({ observations: [contradiction("sceneStability", 0.2)] }),
        bindingFieldIds: BINDING,
      }),
    ).toEqual({ reconstruct: true });
  });

  it("ignores a contradiction on a gate that does not bind", () => {
    // Nobody was asked about it, so footage disagreeing with it settles nothing.
    expect(
      decideReconstructionFromReview({
        evidence: evidence({ observations: [contradiction("serviceArea", 0.95)] }),
        bindingFieldIds: BINDING,
      }),
    ).toEqual({ reconstruct: true });
  });

  it("does not hold usable task footage because people appear", () => {
    expect(decideReconstructionFromReview({
      evidence: evidence({ privacy_flag: true }),
    })).toEqual({ reconstruct: true });
  });

  it("refuses to spend when the review was asked for and did not answer", () => {
    // Fails closed. A scene built from footage nothing confirmed is worse than
    // no scene, because it looks like a result.
    expect(decideReconstructionFromReview({ evidence: null })).toMatchObject({
      reconstruct: false,
      blocker: "capture_review_unavailable",
      refilm: false,
    });
  });

  it("describes a hold in terms an operator can act on", () => {
    const held = decideReconstructionFromReview({
      evidence: evidence({ footage_status: "unusable", footage_status_reason: "Too dark." }),
    });
    expect(describeReconstructionReview(held)).toContain("film it again");
    expect(describeReconstructionReview({ reconstruct: true })).toContain("supports reconstruction");
  });
});

describe("the gate sits in front of the paid call, not behind it", () => {
  const frames = [{ name: "frame-0001.jpg", url: "https://example.test/f1.jpg", sharpness: 1 }];

  it("never reaches generation when the review holds", async () => {
    const loadFrames = vi.fn().mockResolvedValue(frames);
    const record = await startWorldReconstruction({
      framesPrefixUri: "gs://bucket/scenes/s/captures/c/frames",
      loadFrames,
      reviewCapture: async () => evidence({ footage_status: "unusable" }),
    });

    expect(record.state).toBe("failed");
    expect(record.blocker).toBe("capture_footage_unusable");
    // Frames were loaded -- that is free -- and nothing was generated.
    expect(loadFrames).toHaveBeenCalledOnce();
  });

  it("holds rather than spending when the reviewer throws", async () => {
    const record = await startWorldReconstruction({
      framesPrefixUri: "gs://bucket/scenes/s/captures/c/frames",
      loadFrames: async () => frames,
      reviewCapture: async () => {
        throw new Error("gemini unavailable");
      },
    });

    expect(record.blocker).toBe("capture_review_unavailable");
  });

  it("leaves every existing caller untouched when no reviewer is supplied", async () => {
    // The iOS capture path passes no reviewer, and must behave exactly as it
    // did before this gate existed: straight through to generation, which fails
    // here only because World Labs is not configured in the test environment.
    const record = await startWorldReconstruction({
      framesPrefixUri: "gs://bucket/scenes/s/captures/c/frames",
      loadFrames: async () => frames,
    });

    expect(record.blocker).not.toBe("capture_review_unavailable");
    expect(record.blocker).not.toBe("capture_footage_unusable");
  });
});

describe("a gate that is switched off says so rather than vanishing", () => {
  const original = process.env.BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED;

  afterEach(() => {
    if (original === undefined) delete process.env.BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED;
    else process.env.BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED = original;
  });

  it("builds no reviewer when the footage lane is off", async () => {
    // Null from the *builder* means proceed without review, which is how a
    // deployment with the lane off keeps behaving exactly as it did. That is a
    // different thing from null out of the reviewer it builds, which blocks --
    // and conflating the two would either halt every reconstruction on a
    // misconfiguration or wave through footage nobody read.
    delete process.env.BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED;

    const reviewer = await buildCaptureFootageReviewer({
      requestId: "req-1",
      sceneId: "site-req-1",
      captureId: "walkthrough-req-1",
    });

    expect(reviewer).toBeNull();
  });

  it("a reconstruction with no reviewer is not the same as one that failed review", () => {
    // The distinction restated as an assertion, because the two nulls sit one
    // function call apart and reading them the same way is the bug.
    expect(decideReconstructionFromReview({ evidence: null }).reconstruct).toBe(false);
  });
});
