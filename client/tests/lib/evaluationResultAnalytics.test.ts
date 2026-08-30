import { describe, expect, it } from "vitest";

import {
  buildEvaluationResultAnalytics,
  type EvaluationEpisodeForAnalytics,
} from "@/lib/evaluationResultAnalytics";

const episodes: EvaluationEpisodeForAnalytics[] = [
  {
    episode_id: "pi-canonical-1",
    episode_kind: "learned_candidate",
    subject_id: "pi05_droid",
    score: { task_succeeded: true },
    variation: { cell_id: "canonical-1", family_id: "canonical_anchor", label: "Canonical", seed: 11 },
    metrics: { contact_count: 2 },
    evidence: { complete: true },
  },
  {
    episode_id: "groot-canonical-1",
    episode_kind: "learned_candidate",
    subject_id: "groot_n17_droid",
    score: { task_succeeded: false },
    variation: { cell_id: "canonical-1", family_id: "canonical_anchor", label: "Canonical", seed: 11 },
    metrics: { contact_count: 1 },
    failure: { code: "missed_target", phase: "contact", summary: "Missed the mug." },
    evidence: { complete: true },
  },
  {
    episode_id: "pi-light-1",
    episode_kind: "learned_candidate",
    subject_id: "pi05_droid",
    score: { task_succeeded: false },
    variation: { cell_id: "illumination-1", family_id: "illumination", label: "Low light", seed: 12 },
    failure: { code: "no_contact", phase: "approach", summary: "No object contact." },
    evidence: { complete: false },
  },
  {
    episode_id: "zero-canonical-1",
    episode_kind: "control",
    subject_id: "zero_action",
    score: { task_succeeded: false },
    variation: { cell_id: "canonical-1", family_id: "canonical_anchor", label: "Canonical", seed: 11 },
    evidence: { complete: true },
  },
];

describe("evaluation result analytics", () => {
  it("keeps the canonical candidate order and excludes controls from policy rates", () => {
    const analytics = buildEvaluationResultAnalytics(episodes);

    expect(analytics.candidates.map((candidate) => candidate.candidateId)).toEqual([
      "pi05_droid",
      "groot_n17_droid",
    ]);
    expect(analytics.candidates[0]).toMatchObject({
      scoredEpisodes: 2,
      successfulEpisodes: 1,
      successRate: 0.5,
      evidenceCompleteEpisodes: 1,
      contactCount: 2,
    });
    expect(analytics.candidates[1]).toMatchObject({
      scoredEpisodes: 1,
      successfulEpisodes: 0,
      successRate: 0,
      failureCount: 1,
    });
    expect(analytics.controlEpisodes).toBe(1);
    expect(analytics.paired).toEqual({
      comparablePairs: 1,
      discordantPairs: 1,
      ties: 0,
      pi05Wins: 1,
      grootWins: 0,
    });
  });

  it("builds per-family rows, failure counts, and reports missing contacts honestly", () => {
    const analytics = buildEvaluationResultAnalytics(episodes);

    expect(analytics.families).toEqual(expect.arrayContaining([
      expect.objectContaining({
        familyId: "canonical_anchor",
        candidates: expect.arrayContaining([
          expect.objectContaining({ candidateId: "pi05_droid", successRate: 1 }),
          expect.objectContaining({ candidateId: "groot_n17_droid", successRate: 0 }),
        ]),
      }),
      expect.objectContaining({
        familyId: "illumination",
        candidates: expect.arrayContaining([
          expect.objectContaining({ candidateId: "pi05_droid", contactCount: null }),
        ]),
      }),
    ]));
    expect(analytics.failures).toEqual([
      { code: "missed_target", count: 1 },
      { code: "no_contact", count: 1 },
    ]);
  });
});
