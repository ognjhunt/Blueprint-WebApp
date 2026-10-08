// @vitest-environment node
import { writeFileSync, mkdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateAssessmentEvidence } from "../agents/site-assessment";
import { judgmentCases, replayInput, JUDGMENT_VERSION } from "../../scripts/reliability/judgment-cases";

const results: Array<Record<string, unknown>> = [];
describe("frozen provisional source-admission mutations", () => {
  it.each(judgmentCases)("$id", row => {
    const { assessment, sources, duration } = replayInput(row);
    const original = structuredClone(assessment);
    const attempts = Array.from({ length: 3 }, () => {
      let error: string | null = null;
      try { validateAssessmentEvidence(assessment, sources, duration); }
      catch (failure) { error = (failure as Error).message; }
      return { admitted: error === null, error };
    });
    const { admitted, error } = attempts[0];
    expect(attempts.every(attempt => attempt.admitted === admitted && attempt.error === error)).toBe(true);
    results.push({ id: row.id, semantic_hash: row.semantic_hash, attempted: true, admitted,
      attempts, expected_admitted: row.parameters.admitted, passed: admitted === row.parameters.admitted, error });
    expect(assessment).toEqual(original);
    expect(admitted).toBe(row.parameters.admitted);
  });
  it("retains portable offline results and the frozen denominator", () => {
    expect(new Set(judgmentCases.map(row => row.semantic_hash)).size).toBe(120);
    expect(results).toHaveLength(120);
    const path = process.env.RELIABILITY_PEER_JUDGMENT_OUTPUT;
    if (!path) return;
    mkdirSync(path, { recursive: true });
    writeFileSync(`${path}/results.json`, JSON.stringify({ schema: JUDGMENT_VERSION, mode: "offline_real_validator_synthetic_sources",
      generated: 120, deduplicated: 120, attempted: results.length, repetitions_per_case: 3, total_attempts: results.length * 3, passed: results.filter(row => row.passed).length,
      failed: results.filter(row => !row.passed).length, skipped: 0, blocked: 0, provider_calls: 0,
      perception_accuracy: "not_evaluated", semantic_entailment: "not_evaluated", results }, null, 2));
  });
});

describe("source admission neighbors and semantic limits", () => {
  const base = () => replayInput(judgmentCases[0]);
  it("a point observation with no end supports exactly its start", () => {
    const value = base();
    const source = value.sources.values().next().value!;
    (source.content as any).evidence.observations[0].end_seconds = null;
    expect(() => validateAssessmentEvidence(value.assessment, value.sources, 30)).not.toThrow();
    value.assessment.job[0].evidence[0].at_seconds = 9;
    expect(() => validateAssessmentEvidence(value.assessment, value.sources, 30)).toThrow("assessment_observation_not_supported");
  });
  it("does not admit a retained interval beyond the bound video", () => {
    const value = base();
    const source = value.sources.values().next().value!;
    (source.content as any).evidence.observations[0].end_seconds = 40;
    expect(() => validateAssessmentEvidence(value.assessment, value.sources, 30)).toThrow("assessment_video_timestamp_invalid");
  });
  it("preserves supported observations beside unsupported siblings", () => {
    const value = base();
    const source = value.sources.values().next().value!;
    (source.content as any).evidence.observations.push({ category: "motion", finding: "Uncertain event", basis: "estimate", start_seconds: 0, end_seconds: 30, uncertainty: "Occluded" });
    expect(() => validateAssessmentEvidence(value.assessment, value.sources, 30)).not.toThrow();
  });
  it("rejects non-finite and negative references in the exported validator", () => {
    for (const at of [NaN, Infinity, -1]) {
      const value = base(); value.assessment.job[0].evidence[0].at_seconds = at;
      expect(() => validateAssessmentEvidence(value.assessment, value.sources, 30)).toThrow("reference_timestamp_invalid");
    }
  });
  it("rejects invalid references even when an estimate does not need an observed interval", () => {
    for (const at of [NaN, Infinity, -1]) {
      const value = base();
      value.assessment.job[0].basis = "estimate";
      value.assessment.job[0].evidence[0].at_seconds = at;
      expect(() => validateAssessmentEvidence(value.assessment, value.sources, 30)).toThrow("reference_timestamp_invalid");
    }
  });
  it("does not mistake interval admissibility for citation entailment", () => {
    const value = base();
    value.assessment.job[0].text = "A robot completed every dish-loading cycle safely.";
    // Deliberately documents a remaining semantic gap. The source only says a
    // rack moves; software admission cannot certify this fabricated conclusion.
    expect(() => validateAssessmentEvidence(value.assessment, value.sources, 30)).not.toThrow();
  });
});
