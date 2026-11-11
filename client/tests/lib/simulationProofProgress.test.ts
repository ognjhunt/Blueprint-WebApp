/**
 * How far each policy got (publication v4 `progress`): said as facts, from the closed phrase list,
 * only for compared rows, and never deciding an order, a winner or "ahead".
 */
import { describe, expect, it } from "vitest";

import { readyAnswer } from "../fixtures/siteAnswer";
import { HOW_FAR_EACH_GOT, NO_POLICY_COMPLETED, PROGRESS_LADDER, PROGRESS_NOT_APPROACHED, PROGRESS_NOT_TOUCHED, PROGRESS_PHRASES,
  closestApproachText, projectSimulationProof, type ProgressStage } from "@/lib/simulationProof";
import type { JobManagedEvidenceSummary, JobScreeningProgress } from "@/types/jobMarketplace";

type Candidate = NonNullable<JobManagedEvidenceSummary["screening"]>["candidates"][number];

const pick = readyAnswer.pick!;

/**
 * Progress over a ladder: `counts` per stage in order; with `approached` (and so with the closest
 * approach, median `median` metres) when seven counts are given.
 */
function progress(graded: number, counts: number[], median = 0.0429): JobScreeningProgress {
  const ladder = counts.length === 7 ? PROGRESS_LADDER : PROGRESS_LADDER.slice(1);
  const stages = ladder.map((stage, index) => ({ stage, episodes: counts[index] }));
  return { graded, stages, meanScore: Math.round(counts.reduce((sum, n) => sum + n, 0) / (graded * ladder.length) * 1e4) / 1e4,
    ...(counts.length === 7 ? { closestApproachM: { median, min: 0 } } : {}) };
}
function candidate(candidateId: string, scored: number, succeeded: number, overrides: Partial<Candidate> = {}): Candidate {
  return { candidateId, name: candidateId, state: "completed", planned: 10, scored, succeeded, failed: scored - succeeded, void: 0,
    blockers: [], successRange: { lowerPercent: 0, upperPercent: 30, confidencePercent: 95 }, ...overrides };
}
function evaluation(candidates: Candidate[], overrides: Partial<JobManagedEvidenceSummary> = {}): JobManagedEvidenceSummary {
  return { runId: "run-1", state: "completed", current: true, resultDigest: null, outcome: "estimate", summary: "", nextAction: "",
    limitations: [], href: "#run-1", screening: { candidates }, ...overrides };
}
const comparisonOf = (candidates: Candidate[], overrides: Partial<JobManagedEvidenceSummary> = {}) => {
  const proof = projectSimulationProof({ evaluation: evaluation(candidates, overrides), pick });
  return { proof, comparison: proof.policyComparison! };
};
/** The same candidates with every `progress` removed: what a v3 publication of the same run gives. */
const withoutProgress = (candidates: Candidate[]) => candidates.map(({ progress: _progress, ...row }) => row);

/** Shaped like the one finished website job on record: no policy completed the job. */
const NONE_COMPLETED = [
  candidate("pi05_droid", 9, 0, { progress: progress(9, [9, 6, 5, 4, 2, 0, 0]) }),
  candidate("pi0_droid_jointpos_polaris", 10, 0, { progress: progress(10, [3, 0, 0, 0, 0, 0, 0]) }),
  candidate("groot_n17_droid", 10, 0, { progress: progress(10, [0, 0, 0, 0, 0, 0, 0], 0.0829) }),
  candidate("molmoact2_droid", 10, 0),
];
const GROOT_NOT_REACHED = "did not get its gripper within 2 cm of the object; it typically came within about 8 cm of it";

describe("how far each policy got", () => {
  it("adds one sentence after the no-completion sentence, for the compared rows that have progress", () => {
    const { proof, comparison } = comparisonOf(NONE_COMPLETED);
    expect(comparison.line).toBe(`${NO_POLICY_COMPLETED} How far each got: π0.5 lifted and carried the object in 2 of 9 tries; `
      + "π0 got its gripper within 2 cm of the object in 3 of 10 tries; "
      + "GR00T N1.7 did not get its gripper within 2 cm of the object in any of its 10 tries, typically coming within about 8 cm of it.");
    // The headline, the job card's one line, stays the first sentence.
    expect(proof.headline).toBe(NO_POLICY_COMPLETED);
    // A row without progress is left out of the sentence and carries no stage.
    expect(comparison.line).not.toContain("MolmoAct 2");
    expect(comparison.rows.map(row => [row.policy, row.furthest, row.furthestText, row.furthestShown])).toEqual([
      ["π0.5", { stage: "translated", episodes: 2, graded: 9 }, PROGRESS_PHRASES.translated, false],
      ["π0", { stage: "approached", episodes: 3, graded: 10 }, PROGRESS_PHRASES.approached, false],
      ["GR00T N1.7", null, GROOT_NOT_REACHED, false],
      ["MolmoAct 2", null, null, false],
    ]);
    // Nothing is ranked on progress.
    expect(comparison.winner).toBeNull();
    expect(comparison.separated).toBe(false);
    expect(comparison.rows.some(row => row.chosen)).toBe(false);
    expect(comparison.line).not.toMatch(/did best|was ahead|\bahead\b|furthest|best|most/i);
  });

  it("is the same comparison as without progress in every other way: order, winner and the line before it", () => {
    for (const rows of [NONE_COMPLETED, [
      candidate("pi05_droid", 10, 0, { progress: progress(10, [0, 0, 0, 0, 0, 0]) }),
      candidate("groot_n17_droid", 10, 7, { progress: progress(10, [10, 9, 9, 8, 7, 7]) }),
      candidate("molmoact2_droid", 10, 1, { progress: progress(10, [10, 10, 10, 10, 10, 10, 1]) }),
    ]]) {
      const plain = comparisonOf(withoutProgress(rows)).comparison;
      const graded = comparisonOf(rows).comparison;
      expect(graded.rows.map(row => [row.policy, row.succeeded, row.scored, row.chosen, row.compared]))
        .toEqual(plain.rows.map(row => [row.policy, row.succeeded, row.scored, row.chosen, row.compared]));
      expect([graded.winner, graded.separated]).toEqual([plain.winner, plain.separated]);
      expect(graded.line.startsWith(plain.line.split(" 1 more")[0])).toBe(true);
      for (const row of plain.rows) expect([row.furthest, row.furthestText, row.furthestShown]).toEqual([null, null, false]);
    }
  });

  it("says each stage by its closed phrase, and the no-stage phrase by the ladder's first stage", () => {
    const expected: Record<ProgressStage, string> = {
      approached: "got its gripper within 2 cm of the object", contact: "touched the object", moved: "moved the object",
      lifted: "lifted the object", translated: "lifted and carried the object", placed: "put the object in place",
      released_and_settled: "put the object in place and let go",
    };
    expect(PROGRESS_PHRASES).toEqual(expected);
    PROGRESS_LADDER.forEach((stage, depth) => {
      const counts = PROGRESS_LADDER.map((_, index) => (index <= depth ? 4 : 0));
      const { comparison } = comparisonOf([candidate("pi05_droid", 10, 0, { progress: progress(10, counts) })]);
      expect(comparison.rows[0].furthest).toEqual({ stage, episodes: 4, graded: 10 });
      expect(comparison.rows[0].furthestText).toBe(expected[stage]);
      expect(comparison.line).toBe(`${NO_POLICY_COMPLETED} How far each got: π0.5 ${expected[stage]} in 4 of 10 tries.`);
    });
    const none = (counts: number[]) => comparisonOf([candidate("pi05_droid", 10, 0, { progress: progress(10, counts) })]).comparison;
    expect(none([0, 0, 0, 0, 0, 0, 0]).rows[0].furthestText).toBe("did not get its gripper within 2 cm of the object; it typically came within about 4 cm of it");
    expect(none([0, 0, 0, 0, 0, 0]).rows[0].furthestText).toBe("did not touch the object");
    expect(PROGRESS_NOT_TOUCHED).toBe("did not touch the object");
    expect(PROGRESS_NOT_APPROACHED).toBe("did not get its gripper within 2 cm of the object");
  });

  it("says how close a policy that reached no stage came: whole centimetres, at least 1, metres with one decimal from 100 cm", () => {
    const said = (median: number) => closestApproachText(median).replace("did not get its gripper within 2 cm of the object; it typically came within about ", "");
    expect([0, 0.0001, 0.0049, 0.005, 0.0149, 0.015, 0.0429, 0.065, 0.0829, 0.2, 0.9949, 0.995, 1.0, 1.04, 1.05, 2.3456].map(said)).toEqual([
      "1 cm of it", "1 cm of it", "1 cm of it", "1 cm of it", "1 cm of it", "2 cm of it", "4 cm of it", "7 cm of it", "8 cm of it",
      "20 cm of it", "99 cm of it", "1.0 m of it", "1.0 m of it", "1.0 m of it", "1.1 m of it", "2.3 m of it"]);
    // A row that reached a stage never mentions the distance, whatever it was.
    const reached = comparisonOf([candidate("pi05_droid", 10, 0, { progress: progress(10, [4, 1, 0, 0, 0, 0, 0], 0.3) })]).comparison;
    expect(reached.rows[0].furthestText).toBe(PROGRESS_PHRASES.contact);
    expect(reached.line).not.toMatch(/cm|typically/);
  });

  it("says a policy that reached no stage did so in any of its tries, or in its one try, in the list and on its row", () => {
    const line = comparisonOf([
      candidate("pi05_droid", 1, 0, { progress: progress(1, [0, 0, 0, 0, 0, 0, 0], 0.2) }),
      candidate("groot_n17_droid", 1, 0, { progress: progress(1, [0, 0, 0, 0, 0, 0]) }),
      candidate("molmoact2_droid", 10, 0, { progress: progress(10, [0, 0, 0, 0, 0, 0, 0], 1.37) }),
    ]).comparison.line;
    expect(line).toBe(`${NO_POLICY_COMPLETED} How far each got: `
      + "π0.5 did not get its gripper within 2 cm of the object in its one try, typically coming within about 20 cm of it; "
      + "GR00T N1.7 did not touch the object in its one try; "
      + "MolmoAct 2 did not get its gripper within 2 cm of the object in any of its 10 tries, typically coming within about 1.4 m of it.");
    // On a row, beside a policy that completed the job: the same words, never "in 10 of 10 tries".
    const { comparison } = comparisonOf([
      candidate("pi05_droid", 10, 6),
      candidate("groot_n17_droid", 10, 0, { progress: progress(10, [0, 0, 0, 0, 0, 0, 0], 0.0829) }),
      candidate("molmoact2_droid", 10, 0, { progress: progress(10, [0, 0, 0, 0, 0, 0]) }),
    ]);
    expect(comparison.rows.slice(1).map(row => [row.furthestShown, row.furthestText, row.furthestDetail])).toEqual([
      [true, "did not get its gripper within 2 cm of the object; it typically came within about 8 cm of it",
        "did not get its gripper within 2 cm of the object in any of its 10 tries, typically coming within about 8 cm of it"],
      [true, "did not touch the object", "did not touch the object in any of its 10 tries"]]);
  });

  it("never words the graded tries as the policy's total when fewer were graded than scored", () => {
    const line = comparisonOf([
      candidate("pi05_droid", 10, 0, { progress: progress(9, [6, 4, 0, 0, 0, 0, 0]) }),
      candidate("groot_n17_droid", 10, 0, { progress: progress(9, [0, 0, 0, 0, 0, 0, 0], 0.0829) }),
      candidate("molmoact2_droid", 10, 0, { progress: progress(1, [0, 0, 0, 0, 0, 0]) }),
      candidate("pi0_droid_jointpos_polaris", 10, 0, { progress: progress(1, [1, 1, 0, 0, 0, 0]) }),
    ]).comparison.line;
    expect(line).toBe(`${NO_POLICY_COMPLETED} How far each got: `
      + "π0.5 touched the object in 4 of the 9 tries we could grade; "
      + "GR00T N1.7 did not get its gripper within 2 cm of the object in any of the 9 tries we could grade, typically coming within about 8 cm of it; "
      + "MolmoAct 2 did not touch the object in the one try we could grade; "
      + "π0 moved the object in the one try we could grade.");
    // The same on a row beside a policy that completed the job.
    const { comparison } = comparisonOf([
      candidate("pi05_droid", 10, 6),
      candidate("groot_n17_droid", 10, 0, { progress: progress(9, [0, 0, 0, 0, 0, 0]) }),
      candidate("molmoact2_droid", 10, 0, { progress: progress(7, [5, 2, 2, 1, 0, 0]) }),
    ]);
    expect(comparison.rows.slice(1).map(row => [row.scored, row.furthestDetail])).toEqual([
      [10, "did not touch the object in any of the 9 tries we could grade"],
      [10, "lifted and carried the object in 1 of the 7 tries we could grade"]]);
  });

  it("reads a ladder without `approached`: it starts at contact", () => {
    const { comparison } = comparisonOf([
      candidate("pi05_droid", 10, 0, { progress: progress(10, [5, 3, 0, 0, 0, 0]) }),
      candidate("groot_n17_droid", 10, 0, { progress: progress(10, [0, 0, 0, 0, 0, 0]) }),
    ]);
    expect(comparison.line).toBe(`${NO_POLICY_COMPLETED} How far each got: π0.5 moved the object in 3 of 10 tries; `
      + "GR00T N1.7 did not touch the object in any of its 10 tries.");
    expect(comparison.rows[0].furthest).toEqual({ stage: "moved", episodes: 3, graded: 10 });
  });

  it("leaves the line unchanged when a policy completed the job, and shows how far only on rows that completed nothing", () => {
    const rows = [
      candidate("pi05_droid", 10, 7, { progress: progress(10, [10, 10, 9, 8, 8, 7, 7]) }),
      candidate("groot_n17_droid", 10, 0, { progress: progress(10, [8, 2, 1, 0, 0, 0, 0]) }),
      candidate("molmoact2_droid", 10, 0),
    ];
    const plain = comparisonOf(withoutProgress(rows)).comparison;
    const { comparison } = comparisonOf(rows);
    expect(comparison.line).toBe(plain.line);
    expect(comparison.line).not.toContain(HOW_FAR_EACH_GOT);
    expect(comparison.rows.map(row => [row.policy, row.furthestText, row.furthestShown])).toEqual([
      ["π0.5", PROGRESS_PHRASES.released_and_settled, false],
      ["GR00T N1.7", PROGRESS_PHRASES.moved, true],
      ["MolmoAct 2", null, false],
    ]);
  });

  it("leaves non-compared rows out of the sentence", () => {
    // Two policies on the Franka arm (compared) and one on the G1 humanoid (another robot, not compared).
    const { comparison } = comparisonOf([
      candidate("pi05_droid", 10, 0, { progress: progress(10, [6, 4, 0, 0, 0, 0, 0]) }),
      candidate("groot_n17_droid", 10, 0, { progress: progress(10, [2, 0, 0, 0, 0, 0, 0]) }),
      candidate("humanoidarena_pi05_g1_dex3_sonic", 10, 0, { progress: progress(10, [9, 9, 9, 9, 9, 0, 0]) }),
    ]);
    expect(comparison.line).toBe(`${NO_POLICY_COMPLETED} How far each got: π0.5 touched the object in 4 of 10 tries; `
      + "GR00T N1.7 got its gripper within 2 cm of the object in 2 of 10 tries. "
      + "1 more policy ran on a Unitree G1 humanoid, a different robot, and is not compared with these.");
    expect(comparison.line).not.toContain("HumanoidArena");
    expect(comparison.rows[2]).toMatchObject({ compared: false, furthestText: PROGRESS_PHRASES.translated, furthestShown: false });

    // The humanoid completed the job, the arm policies did not: the arm sentence keeps its own words and adds how far.
    const mixed = comparisonOf([
      candidate("pi05_droid", 10, 0, { progress: progress(10, [6, 4, 0, 0, 0, 0, 0]) }),
      candidate("groot_n17_droid", 10, 0),
      candidate("humanoidarena_pi05_g1_dex3_sonic", 10, 3, { progress: progress(10, [9, 9, 9, 9, 9, 3, 3]) }),
    ]).comparison;
    expect(mixed.line).toBe("No policy run on a Franka research arm completed the job in the simulation of your site, so it could not rank them. "
      + "How far each got: π0.5 touched the object in 4 of 10 tries. "
      + "1 more policy ran on a Unitree G1 humanoid, a different robot, and is not compared with these.");
    // Already said in the sentence, so not again on its row.
    expect(mixed.rows.map(row => row.furthestShown)).toEqual([false, false, false]);
  });

  it("says nothing about progress without a compared row: unknown robots, a run that could not finish, or no progress at all", () => {
    const unmapped = comparisonOf([candidate("acme_grasp", 10, 0, { progress: progress(10, [3, 1, 0, 0, 0, 0, 0]) })]).comparison;
    expect(unmapped.line).toBe(NO_POLICY_COMPLETED);
    expect(unmapped.rows[0]).toMatchObject({ compared: false, furthestShown: false });
    expect(comparisonOf(withoutProgress(NONE_COMPLETED)).comparison.line).toBe(NO_POLICY_COMPLETED);
    const held = projectSimulationProof({ evaluation: evaluation(NONE_COMPLETED, { outcome: "held_setup" }), pick });
    expect(held.policyComparison?.line ?? "").not.toContain(HOW_FAR_EACH_GOT);
    expect(held.policyComparison?.rows.every(row => !row.furthestShown) ?? true).toBe(true);
  });

  it("reads only well-formed progress, and never a deeper stage than the data", () => {
    const good = progress(10, [6, 4, 2, 0, 0, 0, 0]);
    const broken: unknown[] = [
      null, "contact", { ...good, graded: 0 }, { ...good, graded: 11 }, { ...good, graded: 2.5 },
      { ...good, stages: good.stages.slice(0, 5) },
      { ...good, stages: [...good.stages].reverse() },
      { ...good, stages: good.stages.map((entry, index) => (index === 3 ? { ...entry, episodes: 5 } : entry)) },
      { ...good, stages: good.stages.map((entry, index) => (index === 0 ? { ...entry, episodes: 12 } : entry)) },
      { ...good, stages: good.stages.map((entry, index) => (index === 2 ? { ...entry, stage: "grasped" } : entry)) },
      { ...good, stages: good.stages.map((entry, index) => (index === 1 ? { ...entry, episodes: -1 } : entry)) },
      { ...good, stages: [...good.stages.slice(1), { stage: "approached", episodes: 0 }] },
      // The closest approach: required with `approached`, refused without it, and well formed.
      (({ closestApproachM: _distance, ...rest }) => rest)(good),
      { ...progress(10, [4, 2, 0, 0, 0, 0]), closestApproachM: { median: 0.05, min: 0 } },
      { ...good, closestApproachM: { median: 0.02, min: 0.03 } },
      { ...good, closestApproachM: { median: -0.01, min: -0.02 } },
      { ...good, closestApproachM: { median: Number.NaN, min: 0 } },
      { ...good, closestApproachM: "4 cm" },
    ];
    for (const value of broken) {
      const { comparison } = comparisonOf([candidate("pi05_droid", 10, 0, { progress: value as JobScreeningProgress })]);
      expect(comparison.rows[0], JSON.stringify(value)).toMatchObject({ furthest: null, furthestText: null, furthestShown: false });
      expect(comparison.line).toBe(NO_POLICY_COMPLETED);
    }
    const { comparison } = comparisonOf([candidate("pi05_droid", 10, 0, { progress: good })]);
    expect(comparison.rows[0].furthest).toEqual({ stage: "moved", episodes: 2, graded: 10 });
  });
});
