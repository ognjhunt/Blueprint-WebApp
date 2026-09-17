/**
 * Three definitions of "enough", and the dead end that came from having one.
 */
import { describe, expect, it } from "vitest";

import {
  assessReadiness,
  captureBlockingGates,
  evaluationBlockingGates,
  shouldSpendOnReconstruction,
  type ReadinessInput,
} from "@/lib/siteTaskReadiness";
import { gateFields } from "@/data/siteTaskQualification";

/** Every binding gate answered with its first option. */
function allAnswers(): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const field of gateFields) {
    answers[field.id] = field.options[0]!.value;
  }
  return answers;
}

function input(overrides: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    answers: {},
    captureMode: "self_capture",
    briefDrafted: true,
    briefConfirmed: false,
    evidence: { hasAny: true, hasVisual: true, explainsTask: true, coversScene: false },
    reconstructed: false,
    ...overrides,
  };
}

describe("a capture and a sale are blocked by different things", () => {
  it("holds a recording on fewer gates than it holds a sale", () => {
    // The whole point. If these were the same set we would have rebuilt the
    // six-question screen with new labels.
    const capture = captureBlockingGates("self_capture");
    const evaluation = evaluationBlockingGates("self_capture");

    expect(capture.length).toBeGreaterThan(0);
    expect(capture.length).toBeLessThan(evaluation.length);
    for (const field of capture) {
      expect(evaluation.map((other) => other.id)).toContain(field.id);
    }
  });

  it("puts the gates that change what to film in the capture set", () => {
    const ids = captureBlockingGates("self_capture").map((field) => field.id);

    // Does the area stay put, is it one repeated job, how many item types.
    // Each one changes what we would ask them to record.
    expect(ids).toContain("sceneStability");
    expect(ids).toContain("taskShape");
    expect(ids).toContain("objectVariety");
  });

  it("keeps the gates that only bind a robot team's result out of it", () => {
    const ids = captureBlockingGates("self_capture").map((field) => field.id);

    // When they want a robot running, and when the station is clear. Neither
    // changes a single frame of what gets filmed.
    expect(ids).not.toContain("deploymentTimeline");
    expect(ids).not.toContain("accessWindow");
  });

  it("drops the service-area gate for a self-capture, and keeps it for a visit", () => {
    expect(captureBlockingGates("self_capture").map((f) => f.id)).not.toContain("serviceArea");
    expect(captureBlockingGates("site_visit").map((f) => f.id)).toContain("serviceArea");
  });
});

describe("what the operator is told", () => {
  it("says we are reading it before we have drafted anything", () => {
    const verdict = assessReadiness(input({ briefDrafted: false }));

    expect(verdict.stage).toBe("received");
    expect(verdict.nextAction).toMatch(/reading what you sent/i);
  });

  it("asks them to correct our reading once there is a draft", () => {
    const verdict = assessReadiness(input());

    expect(verdict.stage).toBe("needs_clarification");
    expect(verdict.nextAction).toMatch(/correct anything we read wrong/i);
  });

  it("asks only the capture-blocking questions once the brief is confirmed", () => {
    const verdict = assessReadiness(input({ briefConfirmed: true }));

    expect(verdict.stage).toBe("brief_confirmed");
    expect(verdict.nextAction).toMatch(/would change what we need you to film/i);
  });

  it("lets them film while answers a robot team needs are still outstanding", () => {
    // The behaviour that makes the split worth having: an unknown carton weight
    // does not stop us documenting where the conveyor is.
    const answers = allAnswers();
    delete answers.deploymentTimeline;

    const verdict = assessReadiness(
      input({
        answers,
        briefConfirmed: true,
        // A description that explains the job, and nothing to look at yet.
        evidence: { hasAny: true, hasVisual: false, explainsTask: true, coversScene: false },
      }),
    );

    expect(verdict.stage).toBe("capture_needed");
    expect(verdict.blockingCapture).toHaveLength(0);
    expect(verdict.blockingEvaluation).toContain("deploymentTimeline");
    expect(verdict.nextAction).toMatch(/you can film the work area now/i);
  });
});

describe("one recording, two purposes", () => {
  it("never asks for a second upload when the footage already covers the scene", () => {
    const verdict = assessReadiness(
      input({
        answers: allAnswers(),
        briefConfirmed: true,
        evidence: { hasAny: true, hasVisual: true, explainsTask: true, coversScene: true },
      }),
    );

    expect(verdict.nextAction).toMatch(/meets our capture requirements/i);
    expect(verdict.nextAction).toMatch(/no additional recording/i);
  });

  it("asks for the specific missing views, not for a better video", () => {
    // "Upload a better video" is a message an operator cannot act on. This is
    // the difference between a request and a complaint.
    const verdict = assessReadiness(
      input({
        answers: allAnswers(),
        briefConfirmed: true,
        evidence: {
          hasAny: true,
          hasVisual: true,
          explainsTask: true,
          coversScene: false,
          missingCoverage: ["views of the pallet area", "the space beside the conveyor"],
        },
      }),
    );

    expect(verdict.nextAction).toMatch(/shows the task clearly/i);
    expect(verdict.nextAction).toMatch(/views of the pallet area/);
    expect(verdict.nextAction).not.toMatch(/again|better/i);
  });
});

describe("supply is the strict conjunction", () => {
  it("is not supply on a confirmed brief alone", () => {
    const verdict = assessReadiness({
      answers: allAnswers(),
      captureMode: "self_capture",
      briefDrafted: true,
      briefConfirmed: true,
      evidence: { hasAny: true, hasVisual: true, explainsTask: true, coversScene: true },
      reconstructed: false,
    });

    expect(verdict.isSupply).toBe(false);
  });

  it("is not supply on a scene alone, however good the footage", () => {
    // The dead end, from the other side. Reconstructing an unconfirmed
    // submission produced a scene nothing could offer to anybody -- and we had
    // already paid for it.
    const verdict = assessReadiness({
      answers: allAnswers(),
      captureMode: "self_capture",
      briefDrafted: true,
      briefConfirmed: false,
      evidence: { hasAny: true, hasVisual: true, explainsTask: true, coversScene: true },
      reconstructed: true,
    });

    expect(verdict.isSupply).toBe(false);
  });

  it("is not supply with a gate still blank, even confirmed and reconstructed", () => {
    const answers = allAnswers();
    delete answers.accessWindow;

    const verdict = assessReadiness({
      answers,
      captureMode: "self_capture",
      briefDrafted: true,
      briefConfirmed: true,
      evidence: { hasAny: true, hasVisual: true, explainsTask: true, coversScene: true },
      reconstructed: true,
    });

    expect(verdict.isSupply).toBe(false);
    expect(verdict.blockingEvaluation).toContain("accessWindow");
  });

  it("is supply once all three hold", () => {
    const verdict = assessReadiness({
      answers: allAnswers(),
      captureMode: "self_capture",
      briefDrafted: true,
      briefConfirmed: true,
      evidence: { hasAny: true, hasVisual: true, explainsTask: true, coversScene: true },
      reconstructed: true,
    });

    expect(verdict.isSupply).toBe(true);
    expect(verdict.stage).toBe("evaluation_ready");
  });
});

describe("what we will spend a reconstruction on", () => {
  it("refuses an unconfirmed submission, whatever its gates say", () => {
    const decision = shouldSpendOnReconstruction(
      input({ answers: allAnswers(), briefConfirmed: false }),
    );

    expect(decision.spend).toBe(false);
    expect(decision.reason).toMatch(/has not been confirmed/i);
  });

  it("refuses while a gate a robot team's result depends on is blank", () => {
    const answers = allAnswers();
    delete answers.accessWindow;

    const decision = shouldSpendOnReconstruction(
      input({ answers, briefConfirmed: true }),
    );

    expect(decision.spend).toBe(false);
    expect(decision.reason).toMatch(/unsellable/i);
  });

  it("spends once the brief is confirmed and every binding gate is answered", () => {
    const decision = shouldSpendOnReconstruction(
      input({ answers: allAnswers(), briefConfirmed: true }),
    );

    expect(decision.spend).toBe(true);
  });
});

describe("a description is not footage", () => {
  it("does not tell someone their footage needs more views when they have none", () => {
    // The bug this caught. `explainsTask` is satisfied by two clear sentences,
    // so a text-only submission was being told "your footage shows the task
    // clearly, we need a few more views" -- of footage that did not exist.
    const verdict = assessReadiness(
      input({
        answers: allAnswers(),
        briefConfirmed: true,
        evidence: { hasAny: true, hasVisual: false, explainsTask: true, coversScene: false },
      }),
    );

    expect(verdict.nextAction).not.toMatch(/your footage/i);
    expect(verdict.nextAction).toMatch(/film the work area/i);
  });

  it("still guides a submission with nothing readable at all", () => {
    const verdict = assessReadiness(
      input({
        answers: allAnswers(),
        briefConfirmed: true,
        evidence: { hasAny: false, hasVisual: false, explainsTask: false, coversScene: false },
      }),
    );

    expect(verdict.nextAction).toMatch(/film the work area/i);
  });
});
