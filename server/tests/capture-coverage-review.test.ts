// @vitest-environment node
/**
 * Establishing what the footage never showed.
 *
 * `coversScene` and `missingCoverage` were inferred from adjacent facts -- a
 * scene exists, therefore coverage sufficed. That is sound where it is used and
 * useless for the case in between: footage uploaded, nothing reconstructed, and
 * an operator who could add one view in thirty seconds if we could name it.
 *
 * The capture page now promises exactly that ("including if one more view would
 * finish the job"), so these tests pin the two properties that keep the promise
 * honest: a contradictory reading is taken the cautious way, and "nobody
 * checked" never reads as either answer.
 */
import { describe, expect, it } from "vitest";

import { coverageEvidenceFrom } from "../utils/captureCoverageReview";
import { assessReadiness } from "../../client/src/lib/siteTaskReadiness";
import { gateFields } from "../../client/src/data/siteTaskQualification";

function allAnswers(): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const field of gateFields) answers[field.id] = field.options[0]!.value;
  return answers;
}

describe("reading a stored coverage finding", () => {
  it("returns null when nobody has reviewed coverage", () => {
    // The distinction the whole module turns on. "We do not know" is not
    // "it does not cover the scene", and it is very far from "it does".
    expect(coverageEvidenceFrom({})).toBeNull();
    expect(coverageEvidenceFrom({ capture_coverage: null })).toBeNull();
  });

  it("returns null when the stored verdict is not a boolean", () => {
    // A half-written record must not be read as a verdict either way.
    expect(
      coverageEvidenceFrom({ capture_coverage: { missing_coverage: ["the pallet area"] } }),
    ).toBeNull();
  });

  it("reports a measured shortfall with the views to film", () => {
    const evidence = coverageEvidenceFrom({
      capture_coverage: {
        covers_scene: false,
        missing_coverage: ["a view of where the cartons are placed"],
        supplement_would_finish: true,
      },
    });

    expect(evidence).toEqual({
      coversScene: false,
      missingCoverage: ["a view of where the cartons are placed"],
    });
  });

  it("tolerates a missing list on a positive verdict", () => {
    const evidence = coverageEvidenceFrom({ capture_coverage: { covers_scene: true } });

    expect(evidence).toEqual({ coversScene: true, missingCoverage: [] });
  });
});

describe("what the operator is told from a measured shortfall", () => {
  it("names the views rather than asking for a better video", () => {
    // "Upload a better video" is a message nobody can act on. This is the
    // difference between a request and a complaint, and it is now driven by a
    // measurement rather than by a hardcoded string.
    const measured = coverageEvidenceFrom({
      capture_coverage: {
        covers_scene: false,
        missing_coverage: ["a view of the pallet position", "the space beside the conveyor"],
      },
    })!;

    const verdict = assessReadiness({
      answers: allAnswers(),
      captureMode: "self_capture",
      briefDrafted: true,
      briefConfirmed: true,
      evidence: {
        hasAny: true,
        hasVisual: true,
        explainsTask: true,
        coversScene: measured.coversScene,
        missingCoverage: measured.missingCoverage,
      },
      reconstructed: false,
    });

    expect(verdict.nextAction).toMatch(/shows the task clearly/i);
    expect(verdict.nextAction).toMatch(/a view of the pallet position/);
    expect(verdict.nextAction).not.toMatch(/better|again/i);
  });

  it("stops asking for anything once coverage is measured as sufficient", () => {
    const measured = coverageEvidenceFrom({ capture_coverage: { covers_scene: true } })!;

    const verdict = assessReadiness({
      answers: allAnswers(),
      captureMode: "self_capture",
      briefDrafted: true,
      briefConfirmed: true,
      evidence: {
        hasAny: true,
        hasVisual: true,
        explainsTask: true,
        coversScene: measured.coversScene,
        missingCoverage: measured.missingCoverage,
      },
      reconstructed: false,
    });

    expect(verdict.nextAction).toMatch(/meets our capture requirements/i);
    expect(verdict.nextAction).toMatch(/no additional recording/i);
  });
});

describe("a measurement cannot authorise a spend on its own", () => {
  it("does not make an unconfirmed submission supply", async () => {
    // The one-way door. Coverage can withhold a reconstruction and never grant
    // one: `shouldSpendOnReconstruction` still wants a confirmed brief and
    // every binding gate answered, so a model that likes the footage cannot
    // move money.
    const { shouldSpendOnReconstruction } = await import(
      "../../client/src/lib/siteTaskReadiness"
    );

    const decision = shouldSpendOnReconstruction({
      answers: allAnswers(),
      captureMode: "self_capture",
      briefDrafted: true,
      briefConfirmed: false,
      evidence: { hasAny: true, hasVisual: true, explainsTask: true, coversScene: true },
      reconstructed: false,
    });

    expect(decision.spend).toBe(false);
    expect(decision.reason).toMatch(/has not been confirmed/i);
  });
});
