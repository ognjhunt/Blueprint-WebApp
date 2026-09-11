import { afterEach, describe, expect, it } from "vitest";

import { clampRecommendationToGates } from "../agents/workflows";
import type { InboundRequest } from "../types/inbound-request";

type Triage = InboundRequest["site_task_triage"];

function triage(
  disposition: "qualified" | "needs_conversation" | "not_now",
  overrides: Partial<NonNullable<Triage>> = {},
): Triage {
  return {
    disposition,
    blocking_field_ids: disposition === "not_now" ? ["serviceArea"] : [],
    blockers: disposition === "not_now" ? ["Outside Texas"] : [],
    open_questions: disposition === "needs_conversation" ? ["Scene drift is unclear"] : [],
    unanswered_field_ids: [],
    incomplete: false,
    evaluated_at: "2026-08-24T00:00:00.000Z",
    ...overrides,
  };
}

/** The four states that move a site toward a visit. */
const FORWARD = [
  "qualified_ready",
  "qualified_risky",
  "capture_requested",
  "qa_passed",
] as const;

const ALL_STATES = [
  ...FORWARD,
  "submitted",
  "needs_more_evidence",
  "in_review",
  "needs_refresh",
  "not_ready_yet",
] as const;

/**
 * These tests exist because a prompt is guidance and this clamp is a guarantee.
 *
 * The rule they enforce: the deterministic gate verdict can veto the model, and
 * the model can never veto the gates. A site outside the service area, or with
 * a cell that gets rearranged between shifts, does not become eligible because
 * a model liked the write-up. The worst a hallucination can do is cost a call.
 */
describe("clampRecommendationToGates", () => {
  it("blocks every forward state when the gates said not_now", () => {
    for (const state of FORWARD) {
      const clamped = clampRecommendationToGates(triage("not_now"), {
        qualification_state_recommendation: state,
        requires_human_review: false,
      });
      expect(clamped.qualificationState, `"${state}" survived a not_now verdict`).toBe(
        "not_ready_yet",
      );
      expect(clamped.requiresHumanReview).toBe(true);
    }
  });

  it("holds a needs_conversation submission at in_review rather than letting it run ahead", () => {
    for (const state of FORWARD) {
      const clamped = clampRecommendationToGates(triage("needs_conversation"), {
        qualification_state_recommendation: state,
        requires_human_review: false,
      });
      expect(clamped.qualificationState).toBe("in_review");
      expect(clamped.requiresHumanReview).toBe(true);
    }
  });

  it("leaves the model's recommendation alone when the gates qualified", () => {
    // The rules do not force an outcome upward either — a clear screen still
    // lets the model be cautious about everything it is actually good at.
    for (const state of ALL_STATES) {
      const clamped = clampRecommendationToGates(triage("qualified"), {
        qualification_state_recommendation: state,
        requires_human_review: false,
      });
      expect(clamped.qualificationState).toBe(state);
    }
  });

  it("never upgrades a conservative recommendation, whatever the gates said", () => {
    // The door opens one way. A clear gate verdict must not turn the model's
    // "needs_more_evidence" into something faster.
    for (const disposition of ["qualified", "needs_conversation", "not_now"] as const) {
      const clamped = clampRecommendationToGates(triage(disposition), {
        qualification_state_recommendation: "needs_more_evidence",
        requires_human_review: true,
      });
      expect(clamped.qualificationState).toBe("needs_more_evidence");
      expect(clamped.requiresHumanReview).toBe(true);
    }
  });

  it("forces human review when the prose contradicts the dropdowns", () => {
    // One of the two is wrong, and only a conversation establishes which.
    const clamped = clampRecommendationToGates(triage("qualified"), {
      qualification_state_recommendation: "qualified_ready",
      requires_human_review: false,
      narrative_review: {
        finding: "contradicts_structured",
        note: 'Ticked "one task, done the same way"; described picking, sorting, and palletising.',
      },
    });
    expect(clamped.qualificationState).toBe("in_review");
    expect(clamped.requiresHumanReview).toBe(true);
  });

  it("does not let a consistent narrative review relax anything", () => {
    const clamped = clampRecommendationToGates(triage("not_now"), {
      qualification_state_recommendation: "qualified_ready",
      requires_human_review: false,
      narrative_review: { finding: "consistent", note: "Reads well." },
    });
    expect(clamped.qualificationState).toBe("not_ready_yet");
    expect(clamped.requiresHumanReview).toBe(true);
  });

  it("passes submissions through untouched when no gate answers were collected", () => {
    // Legacy submissions predate the structured intake and must keep working.
    const clamped = clampRecommendationToGates(undefined, {
      qualification_state_recommendation: "qualified_ready",
      requires_human_review: false,
    });
    expect(clamped.qualificationState).toBe("qualified_ready");
    expect(clamped.requiresHumanReview).toBe(false);
  });

  it("preserves an existing human-review flag rather than clearing it", () => {
    const clamped = clampRecommendationToGates(triage("qualified"), {
      qualification_state_recommendation: "in_review",
      requires_human_review: true,
    });
    expect(clamped.requiresHumanReview).toBe(true);
  });
});

/* ------------------------------------------------- footage, through the clamp */

function evidence(
  overrides: Partial<NonNullable<InboundRequest["site_video_evidence"]>> = {},
): InboundRequest["site_video_evidence"] {
  return {
    status: "analysed",
    footage_status: "usable",
    contradictions: [],
    corroborations: [],
    not_evidenced: [],
    measured_cycle_seconds: null,
    measured_cycle_band: null,
    people_relationship_to_work: "none_visible",
    privacy_flag: false,
    summary: null,
    error_code: null,
    model: "gemini-3.8-flash",
    evaluated_at: "2026-08-24T00:00:00.000Z",
    ...overrides,
  };
}

const recommendation = {
  qualification_state_recommendation: "qualified_ready" as const,
  requires_human_review: false,
};

describe("clampRecommendationToGates with footage", () => {
  const APPLY = "BLUEPRINT_SITE_VIDEO_EVIDENCE_APPLY";

  afterEach(() => {
    delete process.env[APPLY];
  });

  it("leaves the recommendation alone while the apply flag is off", () => {
    process.env[APPLY] = "";
    const result = clampRecommendationToGates(
      triage("qualified"),
      recommendation,
      evidence({
        contradictions: [{ field_id: "taskShape", observation: "Three jobs", confidence: 0.9 }],
      }),
    );
    // Shadow mode: the finding is recorded elsewhere, but nothing moves.
    expect(result.qualificationState).toBe("qualified_ready");
  });

  it("downgrades a forward state once footage is trusted", () => {
    process.env[APPLY] = "1";
    const result = clampRecommendationToGates(
      triage("qualified"),
      recommendation,
      evidence({
        contradictions: [{ field_id: "taskShape", observation: "Three jobs", confidence: 0.9 }],
      }),
    );
    expect(result.qualificationState).toBe("in_review");
    expect(result.requiresHumanReview).toBe(true);
  });

  it("ignores a contradiction it is not confident about", () => {
    process.env[APPLY] = "1";
    const result = clampRecommendationToGates(
      triage("qualified"),
      recommendation,
      evidence({
        contradictions: [{ field_id: "taskShape", observation: "Maybe", confidence: 0.3 }],
      }),
    );
    expect(result.qualificationState).toBe("qualified_ready");
  });

  it("never raises anything on corroboration, flag on or off", () => {
    for (const flag of ["", "1"]) {
      process.env[APPLY] = flag;
      const result = clampRecommendationToGates(
        triage("not_now"),
        recommendation,
        evidence({
          corroborations: [
            { field_id: "sceneStability", observation: "Rock solid", confidence: 1 },
          ],
        }),
      );
      // The site failed a gate. A flattering clip cannot undo that.
      expect(result.qualificationState).toBe("not_ready_yet");
    }
  });

  it("routes a privacy flag to a human even in shadow mode", () => {
    process.env[APPLY] = "";
    const result = clampRecommendationToGates(
      triage("qualified"),
      recommendation,
      evidence({ privacy_flag: true }),
    );
    // Consent is not a shadowed concern.
    expect(result.requiresHumanReview).toBe(true);
  });

  it("is a no-op when there is no footage", () => {
    const result = clampRecommendationToGates(triage("qualified"), recommendation, null);
    expect(result.qualificationState).toBe("qualified_ready");
    expect(result.requiresHumanReview).toBe(false);
  });
});
