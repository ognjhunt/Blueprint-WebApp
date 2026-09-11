/**
 * The footage door.
 *
 * These tests exist to pin one property: video can lower a verdict and can
 * never raise one. Everything else here is secondary.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyVideoEvidence,
  credibleVideoContradictions,
  lowerToCeiling,
  triageGateAnswers,
  videoEvidenceCeiling,
  VIDEO_CONTRADICTION_CONFIDENCE_FLOOR,
  type TriageResult,
  type VideoEvidenceReview,
} from "../../client/src/lib/gateTriage";

const clearAnswers = {
  serviceArea: "austin_metro",
  sceneStability: "stable",
  taskShape: "single",
  objectVariety: "under_10",
  deploymentTimeline: "this_quarter",
  accessWindow: "scheduled",
};

function review(overrides: Partial<VideoEvidenceReview> = {}): VideoEvidenceReview {
  return {
    footageStatus: "usable",
    contradictions: [],
    ...overrides,
  };
}

const strongContradiction = {
  fieldId: "taskShape",
  observation: "Three distinct jobs at 0:12, 0:40 and 1:05.",
  confidence: 0.9,
};

describe("video evidence door", () => {
  it("leaves a qualified verdict alone when the footage agrees", () => {
    const base = triageGateAnswers(clearAnswers);
    expect(base.disposition).toBe("qualified");
    expect(applyVideoEvidence(base, review()).disposition).toBe("qualified");
  });

  it("drops qualified to needs_conversation on a credible contradiction", () => {
    const base = triageGateAnswers(clearAnswers);
    const result = applyVideoEvidence(
      base,
      review({ contradictions: [strongContradiction] }),
    );
    expect(result.disposition).toBe("needs_conversation");
    expect(result.openQuestions.at(-1)?.detail).toContain("Three distinct jobs");
  });

  it("never raises a blocked verdict, however glowing the footage", () => {
    const blocked = triageGateAnswers({ ...clearAnswers, serviceArea: "outside_texas" });
    expect(blocked.disposition).toBe("not_now");

    // Contradictions here would be the model disputing the site's own answers.
    // The verdict must not move up regardless.
    const result = applyVideoEvidence(
      blocked,
      review({ contradictions: [strongContradiction] }),
    );
    expect(result.disposition).toBe("not_now");
  });

  it("ignores contradictions below the confidence floor", () => {
    const base = triageGateAnswers(clearAnswers);
    const result = applyVideoEvidence(
      base,
      review({
        contradictions: [
          { ...strongContradiction, confidence: VIDEO_CONTRADICTION_CONFIDENCE_FLOOR - 0.01 },
        ],
      }),
    );
    expect(result.disposition).toBe("qualified");
  });

  it("treats unreadable footage as silence, not as a problem", () => {
    const base = triageGateAnswers(clearAnswers);
    const result = applyVideoEvidence(
      base,
      review({ footageStatus: "unusable", contradictions: [strongContradiction] }),
    );
    expect(result.disposition).toBe("qualified");
    expect(credibleVideoContradictions(review({ footageStatus: "unusable" }))).toHaveLength(0);
  });

  it("treats a missing review as silence", () => {
    const base = triageGateAnswers(clearAnswers);
    expect(applyVideoEvidence(base, null).disposition).toBe("qualified");
    expect(videoEvidenceCeiling(null)).toBeNull();
  });

  it("lowerToCeiling only ever moves downward", () => {
    expect(lowerToCeiling("qualified", "needs_conversation")).toBe("needs_conversation");
    expect(lowerToCeiling("not_now", "needs_conversation")).toBe("not_now");
    expect(lowerToCeiling("needs_conversation", null)).toBe("needs_conversation");
  });

  it("records observations on an already-blocked site without moving it", () => {
    const blocked = triageGateAnswers({ ...clearAnswers, serviceArea: "outside_texas" });
    const result = applyVideoEvidence(
      blocked,
      review({ contradictions: [strongContradiction] }),
    );
    // The reviewer still gets to read what the footage showed.
    expect(result.openQuestions.some((q) => q.detail.includes("Three distinct jobs"))).toBe(
      true,
    );
  });
});

describe("shadow mode", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.BLUEPRINT_SITE_VIDEO_EVIDENCE_APPLY;
  });

  const summary = {
    status: "analysed" as const,
    footage_status: "usable" as const,
    contradictions: [
      { field_id: "taskShape", observation: "Three jobs, not one.", confidence: 0.9 },
    ],
    corroborations: [],
    not_evidenced: [],
    measured_cycle_seconds: 41,
    measured_cycle_band: "thirty_to_two_min",
    people_relationship_to_work: "none_visible",
    privacy_flag: false,
    summary: "One station, three different jobs.",
    error_code: null,
    model: "gemini-3.8-flash",
    evaluated_at: new Date().toISOString(),
  };

  it("reports what it would have done without doing it", async () => {
    const { measureVideoEvidenceEffect } = await import("../utils/siteVideoEvidence");
    const effect = measureVideoEvidenceEffect("qualified", summary);
    expect(effect.applied).toBe(false);
    expect(effect.wouldHaveChangedDisposition).toBe(true);
  });

  it("applies once the second flag is set", async () => {
    process.env.BLUEPRINT_SITE_VIDEO_EVIDENCE_APPLY = "1";
    vi.resetModules();
    const { measureVideoEvidenceEffect } = await import("../utils/siteVideoEvidence");
    expect(measureVideoEvidenceEffect("qualified", summary).applied).toBe(true);
  });

  it("reports no change when the verdict was already at the ceiling", async () => {
    const { measureVideoEvidenceEffect } = await import("../utils/siteVideoEvidence");
    expect(
      measureVideoEvidenceEffect("not_now", summary).wouldHaveChangedDisposition,
    ).toBe(false);
  });
});

describe("video URL guard", () => {
  it("rejects anything that is not a public https link", async () => {
    const { assertFetchableVideoUrl } = await import("../agents/adapters/gemini-video");

    expect(() => assertFetchableVideoUrl("https://example.com/clip.mp4")).not.toThrow();
    expect(() => assertFetchableVideoUrl("http://example.com/clip.mp4")).toThrow(
      /https/i,
    );
    expect(() => assertFetchableVideoUrl("https://user:pw@example.com/c.mp4")).toThrow(
      /credentials/i,
    );
    expect(() => assertFetchableVideoUrl("https://localhost/clip.mp4")).toThrow(
      /public host/i,
    );
    expect(() => assertFetchableVideoUrl("https://169.254.169.254/latest/meta-data")).toThrow(
      /public host/i,
    );
    expect(() => assertFetchableVideoUrl("https://10.0.0.5/clip.mp4")).toThrow(
      /public host/i,
    );
    expect(() => assertFetchableVideoUrl("not-a-url")).toThrow(/valid URL/i);
  });
});

describe("evidence summary", () => {
  it("keeps contradictions and corroborations apart and drops not_visible", async () => {
    const { summariseVideoEvidence } = await import("../utils/siteVideoEvidence");
    const result = summariseVideoEvidence(
      {
        footage_status: "usable",
        footage_status_reason: null,
        summary: "A tote line.",
        observations: [
          {
            field_id: "taskShape",
            operator_answer: "One task",
            stance: "contradicts",
            observation: "Three jobs.",
            confidence: 0.9,
            moments: [{ at_seconds: 12, note: "second job begins" }],
          },
          {
            field_id: "sceneStability",
            operator_answer: "Stable",
            stance: "corroborates",
            observation: "Fixtures unchanged.",
            confidence: 0.8,
            moments: [],
          },
          {
            field_id: "lighting",
            operator_answer: null,
            stance: "not_visible",
            observation: "Cannot tell.",
            confidence: 0.2,
            moments: [],
          },
        ],
        cycle_measurement: {
          cycles: [{ start_seconds: 0, end_seconds: 41, complete: true }],
          median_cycle_seconds: 41,
          implied_band: "thirty_to_two_min",
          note: "",
        },
        people_present: {
          max_visible_at_once: 1,
          relationship_to_work: "performing_the_task",
          note: "",
        },
        not_evidenced: ["lighting through the day"],
        privacy_flag: false,
      },
      "gemini-3.8-flash",
    );

    expect(result.contradictions).toHaveLength(1);
    expect(result.corroborations).toHaveLength(1);
    expect(result.measured_cycle_seconds).toBe(41);
    expect(result.status).toBe("analysed");
  });

  it("marks unusable footage as unreadable rather than analysed", async () => {
    const { summariseVideoEvidence } = await import("../utils/siteVideoEvidence");
    const result = summariseVideoEvidence(
      {
        footage_status: "unusable",
        footage_status_reason: "Too dark to see the station.",
        summary: "Unreadable.",
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
      },
      "gemini-3.8-flash",
    );

    expect(result.status).toBe("unreadable");
    expect(result.error_code).toBe("Too dark to see the station.");
  });
});

describe("operator answers shown to the reader", () => {
  it("resolves enum tokens to the words the operator chose", async () => {
    const { resolveOperatorAnswerLabels } = await import("../utils/siteVideoEvidence");
    const resolved = resolveOperatorAnswerLabels({
      objectVariety: "under_10",
      sceneStability: "stable",
      lighting: "mixed",
    });

    // A contradiction has to be judged against the answer a person clicked,
    // not against the database value behind it.
    expect(resolved.objectVariety).toBe("Fewer than ten");
    expect(resolved.sceneStability).toBe("Fixtures and stations stay where they are");
    expect(resolved.lighting).toBe("Mixed artificial and daylight");
  });

  it("passes through anything it cannot resolve rather than dropping it", async () => {
    const { resolveOperatorAnswerLabels } = await import("../utils/siteVideoEvidence");
    const resolved = resolveOperatorAnswerLabels({
      unknownField: "some_value",
      sceneStability: "not_a_real_option",
    });
    expect(resolved.unknownField).toBe("some_value");
    expect(resolved.sceneStability).toBe("not_a_real_option");
  });
});
