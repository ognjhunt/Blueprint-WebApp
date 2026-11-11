import { describe, expect, it } from "vitest";

import { readyAnswer } from "../fixtures/siteAnswer";
import { SIMULATION_ACCURACY } from "@/data/simulationAccuracy";
import { SIMULATION_POLICIES } from "@/data/simulationPolicies";
import type { AnswerRobot } from "@/lib/siteAnswer";
import { AHEAD, CLEAR, ROBOT_NOT_CONFIRMED, GAP_COULD_BE_CHANCE, GAP_UNLIKELY_CHANCE, NO_POLICY_COMPLETED, NO_POLICY_SCORED, SCALE_ESTIMATED,
  probabilityAhead, projectSimulationProof } from "@/lib/simulationProof";
import type { JobManagedEvidenceSummary } from "@/types/jobMarketplace";

/** The no-clear-difference headline when the policies ran on the Franka research arm. */
const FRANKA_NO_CLEAR = "No clear difference yet between the policies tried on a Franka research arm in a simulation of your site.";

type Candidate = NonNullable<JobManagedEvidenceSummary["screening"]>["candidates"][number];

const BEYOND_REACH = "Our scene check measured one step of the job as beyond a robot arm's reach from where it stands in the scene.";
const CAVEAT = "Our scene check found a possible set-up cause, so this result may reflect how we set the scene up more than the robots.";

function candidate(candidateId: string, name: string, scored: number, succeeded: number, overrides: Partial<Candidate> = {}): Candidate {
  return { candidateId, name, state: scored > 0 ? "completed" : "deferred", planned: 10, scored, succeeded,
    failed: scored - succeeded, void: 0, blockers: [],
    ...(scored > 0 ? { successRange: { lowerPercent: Math.round((succeeded / scored) * 50), upperPercent: Math.min(100, Math.round((succeeded / scored) * 100) + 25), confidencePercent: 95 } } : {}),
    ...overrides };
}

function evaluation(overrides: Partial<JobManagedEvidenceSummary> = {}, candidates: Candidate[] = []): JobManagedEvidenceSummary {
  return { runId: "run-1", state: "completed", current: true, resultDigest: null, outcome: "estimate", summary: "", nextAction: "",
    limitations: [], href: "#run-1", screening: { candidates }, ...overrides };
}

const scripted: Candidate["executionEvidence"] = { execution_evidence_kind: "scripted_simulator_state_baseline", action_source: "scripted_simulator_state",
  scripted_rollout_count: 10, learned_policy_rollout_count: 0, scripted_controller_invoked: true, candidate_policy_queried: false };

/** Shaped like the one real result on record: four policies scored with no success, one never loaded, two deferred for budget. */
const ALL_ZERO = evaluation({ outcomeCaveat: "scene_setup" }, [
  candidate("pi05_droid", "π0.5 DROID", 9, 0),
  candidate("pi0_droid_jointpos_polaris", "π0 DROID joint position (PolaRiS)", 10, 0),
  candidate("pi0_fast_droid_jointpos_polaris", "π0-FAST DROID joint position (PolaRiS)", 10, 0),
  candidate("groot_n17_droid", "GR00T N1.7 DROID", 10, 0),
  candidate("molmoact2_droid", "MolmoAct 2 DROID", 0, 0, { state: "blocked", blockers: ["policy_canary_session_setup_failed:policy_load"] }),
  candidate("cosmos3_nano_policy_droid", "Cosmos 3 Nano Policy DROID", 0, 0, { blockers: ["site_screening_budget_insufficient"] }),
  candidate("cosmos3_edge_policy_droid", "Cosmos 3 Edge Policy DROID", 0, 0, { blockers: ["site_screening_budget_insufficient"] }),
  candidate("scripted_reference_arm", "Scripted reference arm", 10, 10, { executionEvidence: scripted }),
]);
ALL_ZERO.screening!.setupNotes = [BEYOND_REACH];

const WINNER = evaluation({}, [
  candidate("pi05_droid", "π0.5 DROID", 10, 7),
  candidate("groot_n17_droid", "GR00T N1.7 DROID", 10, 3),
]);

const ur10e = readyAnswer.pick!;
const franka: AnswerRobot = { ...ur10e, modelId: "franka_emika_panda", name: "Panda (FER)", manufacturer: "Franka Robotics" };

/** Raw strings a site must never read as a policy's name. */
const BANNED = [/DROID/, /PolaRiS/i, /jointpos/i, /_/, /gs:\/\//, /huggingface/i, /checkpoint/i, /sha256/i];
const expectPlainPolicies = (rows: Array<{ policy: string }>) => {
  for (const row of rows) for (const pattern of BANNED) expect(row.policy).not.toMatch(pattern);
};

describe("projectSimulationProof", () => {
  it("has not started with no evaluation, and carries the published accuracy with its sources", () => {
    const proof = projectSimulationProof({ evaluation: null, pick: ur10e });
    expect(proof).toMatchObject({ state: "not_started", headline: "The simulation of your site has not started yet.", policyComparison: null,
      robotCheck: null, forThisJob: [] });
    expect(proof.accuracy.statement).toBe(SIMULATION_ACCURACY.statement);
    expect(proof.accuracy.sources.map(source => source.url)).toEqual(["https://arxiv.org/abs/2610.17521",
      "https://arxiv.org/abs/2512.16881", "https://arxiv.org/abs/2609.23910"]);
    expect(projectSimulationProof({ evaluation: [], pick: null }).state).toBe("not_started");
  });

  it("is preparing while queued or waiting, and running once a policy runs or is scored", () => {
    expect(projectSimulationProof({ evaluation: evaluation({ outcome: null, state: "queued" }), pick: ur10e }).state).toBe("preparing");
    const waiting = projectSimulationProof({ evaluation: evaluation({ outcome: "awaiting_spend_approval", state: "blocked" }), pick: ur10e });
    expect(waiting).toMatchObject({ state: "preparing", headline: "Blueprint is deciding whether to continue the simulation." });
    expect(projectSimulationProof({ evaluation: evaluation({ outcome: "setup_repair" }), pick: ur10e }).state).toBe("preparing");
    const running = projectSimulationProof({ evaluation: evaluation({ outcome: null, state: "running" },
      [candidate("pi05_droid", "π0.5 DROID", 0, 0, { state: "running" })]), pick: ur10e });
    expect(running).toMatchObject({ state: "running", headline: "The simulation of your site is running.", policyComparison: null });
    expect(running.forThisJob).toContain(SCALE_ESTIMATED);
  });

  it("could not run: one plain sentence about the simulation, never about the site's job", () => {
    for (const outcome of ["held_capability", "held_unprepared", "infeasible", "no_match", "held_setup", "held_budget",
      "held_scene_check", "reference_only"] as const) {
      const proof = projectSimulationProof({ evaluation: evaluation({ outcome }), pick: ur10e });
      expect(proof.state).toBe("could_not_run");
      expect(proof.headline).toMatch(/simulation|simulated scene/i);
      expect(proof.headline).not.toMatch(/your job is held|^Held/i);
      expect(proof.headline.split(/(?<=\.)\s/).length).toBe(1);
    }
  });

  it("all policies at zero: says it could not rank them, with the scene notes, never an estimate", () => {
    const proof = projectSimulationProof({ evaluation: ALL_ZERO, pick: ur10e });
    expect(proof.state).toBe("done");
    expect(proof.headline).toBe(NO_POLICY_COMPLETED);
    const comparison = proof.policyComparison!;
    expect(comparison.separated).toBe(false);
    expect(comparison.winner).toBeNull();
    expect(comparison.line).toBe(NO_POLICY_COMPLETED);
    // Ordered by the mean of each rate's Beta(s + 1, n − s + 1): 0 of 9 sits above 0 of 10.
    expect(comparison.rows.map(row => [row.policy, row.succeeded, row.scored])).toEqual([
      ["π0.5", 0, 9], ["π0", 0, 10], ["π0-FAST", 0, 10], ["GR00T N1.7", 0, 10]]);
    expect(comparison.rows.every(row => row.rangeText === null && !row.chosen)).toBe(true);
    expect(comparison.didNotRun).toBe(3);
    expect(comparison.didNotRunLine).toBe("3 more policies were planned and did not run. “Simulation details” further down says why.");
    expect(comparison.sceneNotes).toEqual([BEYOND_REACH, CAVEAT]);
    expect(comparison.robotName).toBe("a Franka research arm");
    for (const sentence of [proof.headline, comparison.line]) expect(sentence).not.toMatch(/estimate|pilot/i);
    expectPlainPolicies(comparison.rows);
  });

  // Rewritten from "names a winner when one policy did clearly better": under the probability rule 7 of 10
  // against 3 of 10 is about 0.96, so the leader is named as ahead, not as having done best.
  it("names the leader as ahead, not best, at 7 of 10 against 3 of 10", () => {
    const proof = projectSimulationProof({ evaluation: WINNER, pick: ur10e });
    const comparison = proof.policyComparison!;
    expect(comparison.separated).toBe(false);
    expect(comparison.winner).toEqual({ policy: "π0.5", maker: "Physical Intelligence" });
    expect(comparison.line).toBe("In a simulation of your site, on a Franka research arm, π0.5, an AI control policy from Physical Intelligence, was ahead: it completed the job in 7 of 10 tries, "
      + `against 3 of 10 for GR00T N1.7. ${GAP_COULD_BE_CHANCE}`);
    expect(proof.headline).toBe("In a simulation of your site, on a Franka research arm, π0.5, an AI control policy from Physical Intelligence, was ahead: it completed the job in 7 of 10 tries, against 3 of 10 for GR00T N1.7.");
    expect(comparison.rows[0]).toMatchObject({ policy: "π0.5", chosen: true, rangeText: expect.stringMatching(/^likely between \d+% and \d+%$/) });
    expect(comparison.rows[1].chosen).toBe(false);
    expectPlainPolicies(comparison.rows);
  });

  it("does not separate a tie, or a single policy", () => {
    const tie = projectSimulationProof({ evaluation: evaluation({}, [candidate("pi05_droid", "π0.5 DROID", 10, 4),
      candidate("molmoact2_droid", "MolmoAct 2 DROID", 10, 4)]), pick: ur10e }).policyComparison!;
    expect(tie).toMatchObject({ separated: false, winner: null });
    expect(tie.line).toBe(`${FRANKA_NO_CLEAR} Tries that completed the job: π0.5, 4 of 10; MolmoAct 2, 4 of 10.`);
    const one = projectSimulationProof({ evaluation: evaluation({}, [candidate("pi05_droid", "π0.5 DROID", 10, 4)]), pick: ur10e }).policyComparison!;
    expect(one).toMatchObject({ separated: false, winner: null });
  });

  it("says when the simulated robot is not the pick, and not when it is", () => {
    const other = projectSimulationProof({ evaluation: WINNER, pick: ur10e });
    expect(other.policyComparison!.sameRobotAsPick).toBe(false);
    expect(other.forThisJob).toEqual([SCALE_ESTIMATED,
      "We have no public AI policy to run on the Universal Robots UR10e, so we ran the public policies on the arm they are trained for, a Franka research arm, in a simulation of your site."]);
    const same = projectSimulationProof({ evaluation: WINNER, pick: franka, scaleMeasured: true });
    expect(same.policyComparison!.sameRobotAsPick).toBe(true);
    expect(same.forThisJob).toEqual([]);
  });

  // Rewritten from "falls back to the evaluation's own name for an unknown id": a stored name never
  // reaches the page now; an unmapped policy is a neutral phrase, lettered when there are several.
  it("never shows a stored name for an unknown id: a neutral phrase, lettered in a stable order", () => {
    const proof = projectSimulationProof({ evaluation: evaluation({}, [candidate("pi05_droid", "π0.5 DROID", 10, 6),
      candidate("zz_new_policy", "Guaranteed safe production-ready policy", 10, 2), candidate("aa_new_policy", "Acme Grasp 1", 10, 1)]), pick: ur10e });
    const comparison = proof.policyComparison!;
    expect(comparison.rows.map(row => [row.policy, row.maker, row.compared])).toEqual([
      ["π0.5", "Physical Intelligence", true],
      ["an unnamed AI control policy (B)", null, false],
      ["an unnamed AI control policy (A)", null, false]]);
    expect(JSON.stringify(proof)).not.toMatch(/Guaranteed|Acme|production-ready/);
    expect(comparison.line).toContain("2 more policies ran on a robot we could not confirm is the same, and are not compared with these.");
    expectPlainPolicies(comparison.rows);
  });

  it("names no winner among policies whose robot is unknown: their counts, no ranking, and why", () => {
    const proof = projectSimulationProof({ evaluation: evaluation({}, [candidate("new_a", "Acme Grasp", 10, 10),
      candidate("new_b", "Northwind", 10, 0)]), pick: ur10e });
    const comparison = proof.policyComparison!;
    expect(comparison).toMatchObject({ winner: null, separated: false });
    expect(comparison.rows.every(row => !row.chosen && !row.compared)).toBe(true);
    expect(comparison.line).toBe(`${ROBOT_NOT_CONFIRMED} Tries that completed the job: an unnamed AI control policy (A), 10 of 10; `
      + "an unnamed AI control policy (B), 0 of 10.");
    expect(proof.headline).toBe(ROBOT_NOT_CONFIRMED);
    // No "we ran the public policies on …" when no robot is known.
    expect(proof.forThisJob).toEqual([SCALE_ESTIMATED]);
  });

  it("in a mixed-robot run, says the compared policies are the ones that run on the main arm", () => {
    const proof = projectSimulationProof({ evaluation: evaluation({}, [candidate("humanoidarena_pi05_g1_dex3_sonic", "HumanoidArena", 10, 9),
      candidate("pi05_droid", "π0.5 DROID", 10, 1), candidate("groot_n17_droid", "GR00T N1.7 DROID", 10, 1)]), pick: ur10e });
    expect(proof.forThisJob).toEqual([SCALE_ESTIMATED, "We have no public AI policy to run on the Universal Robots UR10e. "
      + "The policies compared here are the ones that run on a Franka research arm, in a simulation of your site."]);
  });

  it("counts as not run only policies planned for this run: deferred for budget or failed to load, never the catalog rows that were never available", () => {
    const never: Candidate[] = Array.from({ length: 100 }, (_, index) => index % 2
      ? candidate(`template_${index}`, `Template ${index}`, 0, 0, { state: "blocked", planned: 0, blockers: ["prepared_robot_policy_registration_missing"] })
      : candidate(`other_robot_${index}`, `Other robot ${index}`, 0, 0, { state: index % 4 ? "unavailable" : "infeasible", planned: 0,
        blockers: ["task_kind_not_supported_by_candidate"] }));
    const proof = projectSimulationProof({ evaluation: evaluation({}, [
      candidate("pi05_droid", "π0.5 DROID", 10, 0),
      candidate("groot_n17_droid", "GR00T N1.7 DROID", 10, 0),
      candidate("cosmos3_nano_policy_droid", "Cosmos 3 Nano Policy DROID", 0, 0, { state: "deferred", planned: 0, blockers: ["site_screening_budget_insufficient"] }),
      candidate("molmoact2_droid", "MolmoAct 2 DROID", 0, 0, { state: "blocked", planned: 10, blockers: ["policy_canary_session_setup_failed:policy_load"] }),
      candidate("pi0_droid_jointpos_polaris", "π0 DROID", 0, 0, { state: "blocked", planned: 10, blockers: ["beta_screening_replanned_for_new_implementation"] }),
      ...never,
    ]), pick: ur10e });
    expect(proof.policyComparison!.rows).toHaveLength(2);
    expect(proof.policyComparison!.didNotRun).toBe(2);
    expect(proof.policyComparison!.didNotRunLine).toBe("2 more policies were planned and did not run. “Simulation details” further down says why.");
    const one = projectSimulationProof({ evaluation: evaluation({}, [candidate("pi05_droid", "π0.5 DROID", 10, 2),
      candidate("molmoact2_droid", "MolmoAct 2 DROID", 0, 0, { state: "completed", planned: 10 })]), pick: ur10e });
    expect(one.policyComparison!.didNotRunLine).toBe("1 more policy was planned and did not run. “Simulation details” further down says why.");
  });

  it("shows a neutral phrase for a working label or a code, never the label itself", () => {
    for (const name of ["Current candidate", "Candidate 3", "Baseline policy", "acme_grasp_v2_ckpt", "gs://bucket/model", "Policy v2.1", "sha256:abcdef"]) {
      const proof = projectSimulationProof({ evaluation: evaluation({}, [candidate("pi05_droid", "π0.5 DROID", 10, 6),
        candidate("unknown_id", name, 10, 2)]), pick: ur10e });
      // An unknown id has no known robot, so it is shown but not compared with the Franka policies.
      expect(proof.policyComparison!.rows[1]).toMatchObject({ policy: "an unnamed AI control policy", maker: null, compared: false, robot: null, chosen: false });
      expect(proof.policyComparison!.line).toBe("The simulation scored one policy on a Franka research arm: π0.5 completed the job in 6 of 10 tries. "
        + "With nothing to compare it to on that robot, it could not rank policies. "
        + "1 more policy ran on a robot we could not confirm is the same, and is not compared with these.");
    }
  });

  it("leaves scripted reference rows out of the policies", () => {
    const proof = projectSimulationProof({ evaluation: evaluation({}, [candidate("pi05_droid", "π0.5 DROID", 10, 2),
      candidate("scripted_pick_place", "Scripted pick and place", 10, 10, { executionEvidence: scripted })]), pick: ur10e });
    expect(proof.policyComparison!.rows.map(row => row.policy)).toEqual(["π0.5"]);
    expect(proof.policyComparison!.didNotRun).toBe(0);
    expect(proof.policyComparison!.didNotRunLine).toBeNull();
  });

  it("never ranks or names a development-only reference the winner, even when it succeeded", () => {
    const run = evaluation({}, [
      candidate("pi05_droid", "π0.5 DROID", 10, 0),
      candidate("groot_n17_droid", "GR00T N1.7 DROID", 10, 0),
      candidate("dev_reference_policy", "Development reference policy", 10, 9),
    ]);
    run.screening!.selection = { status: "no_successful_candidate", selectionDigest: `sha256:${"f".repeat(64)}`, chosen: null, tiedWith: [],
      candidates: [{ candidateId: "pi05_droid", resultRank: 1, choiceBlocker: null }, { candidateId: "groot_n17_droid", resultRank: 2, choiceBlocker: null },
        { candidateId: "dev_reference_policy", resultRank: null, choiceBlocker: "development_only_reference" }] };
    const comparison = projectSimulationProof({ evaluation: run, pick: ur10e }).policyComparison!;
    expect(comparison.line).toBe(NO_POLICY_COMPLETED);
    expect(comparison.winner).toBeNull();
    expect(comparison.separated).toBe(false);
    expect(comparison.rows.map(row => [row.policy, row.succeeded, row.scored])).toEqual([["π0.5", 0, 10], ["GR00T N1.7", 0, 10]]);
    expect(comparison.rows.some(row => row.succeeded > 0)).toBe(false);
  });

  it("reads the pick's verdict from the measured scene", () => {
    const fit = (verdict: "fits" | "fits_spec" | "doesnt_fit" | "unknown") => projectSimulationProof({ evaluation: null, pick: ur10e,
      robotFit: { models: [{ name: "UR10e", manufacturer: "Universal Robots", verdict, openChecks: [] }] } }).robotCheck;
    expect(fit("fits")).toEqual({ pickChecked: true,
      line: "In the scene rebuilt from your video, the Universal Robots UR10e reaches the pick-up and put-down points with a clear arm path." });
    expect(fit("doesnt_fit")!.pickChecked).toBe(true);
    expect(fit("unknown")!.pickChecked).toBe(false);
    expect(projectSimulationProof({ evaluation: null, pick: null, robotFit: { models: [] } }).robotCheck).toBeNull();
  });

  it("maps the twelve enabled policies with plain names", () => {
    expect(Object.keys(SIMULATION_POLICIES)).toHaveLength(12);
    expectPlainPolicies(Object.values(SIMULATION_POLICIES));
  });

  it("never throws on junk", () => {
    for (const value of [null, undefined, {}, { evaluation: "x", pick: 3 }, { evaluation: [{ screening: { candidates: [null, { scored: "a" }] } }], pick: null }]) {
      expect(() => projectSimulationProof(value as never)).not.toThrow();
    }
  });

  it("matches the pick against the scene table by maker and model, ignoring case and punctuation", () => {
    const line = projectSimulationProof({ evaluation: null, pick: ur10e,
      robotFit: { models: [{ name: "ur10E", manufacturer: "universal-Robots", verdict: "fits", openChecks: [] }] } }).robotCheck!;
    expect(line.pickChecked).toBe(true);
    const other = projectSimulationProof({ evaluation: null, pick: ur10e,
      robotFit: { models: [{ name: "UR10e", manufacturer: "Another Maker", verdict: "fits", openChecks: [] }] } }).robotCheck!;
    expect(other).toEqual({ pickChecked: false, line: "The scene rebuilt from your video has not been checked against the Universal Robots UR10e yet." });
  });
});

const tries = (succeeded: number, scored: number) => ({ succeeded, scored });

describe("probabilityAhead", () => {
  it("1 of 1 against 0 of 1 is 5/6", () => {
    expect(Math.abs(probabilityAhead(tries(1, 1), tries(0, 1)) - 5 / 6)).toBeLessThan(1e-6);
  });

  it("equal counts are 0.5", () => {
    for (const [s, n] of [[0, 1], [4, 10], [10, 10], [37, 50]]) expect(probabilityAhead(tries(s, n), tries(s, n))).toBeCloseTo(0.5, 6);
  });

  it("7 of 10 against 3 of 10 is about 0.96: ahead, not clear", () => {
    const p = probabilityAhead(tries(7, 10), tries(3, 10));
    expect(p).toBeCloseTo(0.957, 3);
    expect(p).toBeGreaterThanOrEqual(AHEAD);
    expect(p).toBeLessThan(CLEAR);
  });

  it("9 of 10 against 3 of 10 is above 0.99", () => {
    expect(probabilityAhead(tries(9, 10), tries(3, 10))).toBeGreaterThan(0.99);
  });

  it("is symmetric: P(A > B) + P(B > A) = 1", () => {
    for (const [a, b] of [[tries(1, 1), tries(0, 1)], [tries(7, 10), tries(3, 10)], [tries(0, 3), tries(5, 20)], [tries(150, 200), tries(140, 200)]]) {
      expect(probabilityAhead(a, b) + probabilityAhead(b, a)).toBeCloseTo(1, 6);
    }
  });

  it("grows with the leader's successes and falls with the other's", () => {
    for (let s = 0; s < 10; s += 1) {
      expect(probabilityAhead(tries(s + 1, 10), tries(3, 10))).toBeGreaterThan(probabilityAhead(tries(s, 10), tries(3, 10)));
      expect(probabilityAhead(tries(5, 10), tries(s + 1, 10))).toBeLessThan(probabilityAhead(tries(5, 10), tries(s, 10)));
    }
  });

  it("reads junk counts as zero, and never more successes than tries", () => {
    expect(probabilityAhead({ succeeded: Number.NaN, scored: -1 }, tries(0, 0))).toBeCloseTo(0.5, 6);
    expect(probabilityAhead(tries(12, 10), tries(10, 10))).toBeCloseTo(0.5, 6);
  });
});

describe("the comparison sentence: the leader against every other policy on the same robot, by one rule", () => {
  const run = (...rows: Candidate[]) => projectSimulationProof({ evaluation: evaluation({}, rows), pick: ur10e });

  it("did best at P ≥ CLEAR: 9 of 10 against 3 of 10", () => {
    const proof = run(candidate("pi05_droid", "π0.5 DROID", 10, 9), candidate("groot_n17_droid", "GR00T N1.7 DROID", 10, 3));
    const comparison = proof.policyComparison!;
    expect(comparison).toMatchObject({ separated: true, winner: { policy: "π0.5", maker: "Physical Intelligence" } });
    expect(comparison.line).toBe("In a simulation of your site, on a Franka research arm, π0.5, an AI control policy from Physical Intelligence, did best: it completed the job in 9 of 10 tries, "
      + `against 3 of 10 for GR00T N1.7. ${GAP_UNLIKELY_CHANCE}`);
    expect(comparison.rows.map(row => row.chosen)).toEqual([true, false]);
    expect(proof.headline).toBe(comparison.line.split(/(?<=\.)\s/)[0]);
  });

  it("no clear difference below AHEAD: 1 of 1 against 0 of 1 is 5/6", () => {
    const comparison = run(candidate("pi05_droid", "π0.5 DROID", 1, 1), candidate("groot_n17_droid", "GR00T N1.7 DROID", 1, 0)).policyComparison!;
    expect(comparison).toMatchObject({ separated: false, winner: null });
    expect(comparison.line).toBe(`${FRANKA_NO_CLEAR} Tries that completed the job: π0.5, 1 of 1; GR00T N1.7, 0 of 1.`);
    expect(comparison.rows.some(row => row.chosen)).toBe(false);
  });

  it("with three or more policies, cites the next best and lists the rest", () => {
    const comparison = run(candidate("molmoact2_droid", "MolmoAct 2 DROID", 10, 1), candidate("pi05_droid", "π0.5 DROID", 10, 10),
      candidate("groot_n17_droid", "GR00T N1.7 DROID", 10, 2), candidate("pi0_fast_droid_jointpos_polaris", "π0-FAST", 10, 0)).policyComparison!;
    expect(comparison.separated).toBe(true);
    expect(comparison.line).toBe("In a simulation of your site, on a Franka research arm, π0.5, an AI control policy from Physical Intelligence, did best: it completed the job in 10 of 10 tries, "
      + `against 2 of 10 for the next best, GR00T N1.7. ${GAP_UNLIKELY_CHANCE} The others: MolmoAct 2, 1 of 10; π0-FAST, 0 of 10.`);
    expect(comparison.rows.map(row => [row.policy, row.succeeded, row.chosen])).toEqual([
      ["π0.5", 10, true], ["GR00T N1.7", 2, false], ["MolmoAct 2", 1, false], ["π0-FAST", 0, false]]);
    // The next best being close decides, even when the third is far behind.
    const close = run(candidate("pi05_droid", "π0.5 DROID", 10, 9), candidate("groot_n17_droid", "GR00T N1.7 DROID", 10, 8),
      candidate("molmoact2_droid", "MolmoAct 2 DROID", 10, 0)).policyComparison!;
    expect(close).toMatchObject({ separated: false, winner: null });
    expect(close.line.startsWith(FRANKA_NO_CLEAR)).toBe(true);
  });

  it("a tie at the top is no clear difference, however far behind the rest are", () => {
    const comparison = run(candidate("pi05_droid", "π0.5 DROID", 10, 8), candidate("groot_n17_droid", "GR00T N1.7 DROID", 10, 8),
      candidate("molmoact2_droid", "MolmoAct 2 DROID", 10, 0)).policyComparison!;
    expect(comparison).toMatchObject({ separated: false, winner: null });
    expect(comparison.line).toBe(`${FRANKA_NO_CLEAR} Tries that completed the job: π0.5, 8 of 10; GR00T N1.7, 8 of 10; MolmoAct 2, 0 of 10.`);
  });

  it("the counts decide the sentence when the Pipeline's chosen policy disagrees with them", () => {
    const evaluated = evaluation({}, [candidate("pi05_droid", "π0.5 DROID", 10, 2), candidate("groot_n17_droid", "GR00T N1.7 DROID", 10, 9)]);
    evaluated.screening!.selection = { status: "chosen", selectionDigest: `sha256:${"e".repeat(64)}`, chosen: { candidateId: "pi05_droid" } as never,
      tiedWith: [], candidates: [{ candidateId: "pi05_droid", resultRank: 1, choiceBlocker: null }, { candidateId: "groot_n17_droid", resultRank: 2, choiceBlocker: null }] };
    const comparison = projectSimulationProof({ evaluation: evaluated, pick: ur10e }).policyComparison!;
    expect(comparison.winner).toEqual({ policy: "GR00T N1.7", maker: "NVIDIA" });
    expect(comparison.line).toMatch(/^In a simulation of your site, on a Franka research arm, GR00T N1\.7, an AI control policy from NVIDIA, did best: it completed the job in 9 of 10 tries, against 2 of 10 for π0\.5\./);
    expect(comparison.rows.find(row => row.policy === "π0.5")!.chosen).toBe(false);
    expect(comparison.rows.filter(row => row.chosen).map(row => row.policy)).toEqual(["GR00T N1.7"]);
  });

  it("weighs the leader against every compared row: 20 of 20 is only ahead of a 1 of 1 (P = 0.913), not best", () => {
    const comparison = run(candidate("pi05_droid", "π0.5 DROID", 20, 20), candidate("groot_n17_droid", "GR00T N1.7 DROID", 40, 30),
      candidate("molmoact2_droid", "MolmoAct 2 DROID", 1, 1)).policyComparison!;
    expect(probabilityAhead(tries(20, 20), tries(1, 1))).toBeCloseTo(0.913, 3);
    expect(comparison).toMatchObject({ separated: false, winner: { policy: "π0.5" } });
    // The next best by posterior mean is still the one cited.
    expect(comparison.line).toBe("In a simulation of your site, on a Franka research arm, π0.5, an AI control policy from Physical Intelligence, was ahead: "
      + `it completed the job in 20 of 20 tries, against 30 of 40 for the next best, GR00T N1.7. ${GAP_COULD_BE_CHANCE} The others: MolmoAct 2, 1 of 1.`);
  });

  it("a third row with few tries can hold the minimum under AHEAD: 10 of 10 against 1 of 1 is 11/13", () => {
    const comparison = run(candidate("pi05_droid", "π0.5 DROID", 10, 10), candidate("groot_n17_droid", "GR00T N1.7 DROID", 10, 3),
      candidate("molmoact2_droid", "MolmoAct 2 DROID", 1, 1)).policyComparison!;
    expect(probabilityAhead(tries(10, 10), tries(3, 10))).toBeGreaterThan(CLEAR);
    expect(probabilityAhead(tries(10, 10), tries(1, 1))).toBeCloseTo(11 / 13, 6);
    expect(comparison).toMatchObject({ separated: false, winner: null });
    expect(comparison.line).toBe(`${FRANKA_NO_CLEAR} Tries that completed the job: π0.5, 10 of 10; MolmoAct 2, 1 of 1; GR00T N1.7, 3 of 10.`);
    expect(comparison.rows.some(row => row.chosen)).toBe(false);
  });

  it("compares only policies on the same robot: a humanoid's 9 of 10 is shown, counted and never the winner", () => {
    const proof = run(candidate("humanoidarena_pi05_g1_dex3_sonic", "HumanoidArena", 10, 9), candidate("pi05_droid", "π0.5 DROID", 10, 1),
      candidate("groot_n17_droid", "GR00T N1.7 DROID", 10, 1));
    const comparison = proof.policyComparison!;
    expect(comparison).toMatchObject({ winner: null, separated: false, robotName: "a Franka research arm" });
    expect(comparison.line).toBe(`${FRANKA_NO_CLEAR} Tries that completed the job: π0.5, 1 of 10; GR00T N1.7, 1 of 10. `
      + "1 more policy ran on a Unitree G1 humanoid, a different robot, and is not compared with these.");
    expect(comparison.rows.map(row => [row.policy, row.compared, row.robot, row.chosen])).toEqual([
      ["π0.5", true, "a Franka research arm", false], ["GR00T N1.7", true, "a Franka research arm", false],
      ["HumanoidArena π0.5 (handling objects)", false, "a Unitree G1 humanoid", false]]);
    // With a success only on the other robot, the main robot's policies are said not to have completed it.
    const zero = run(candidate("humanoidarena_pi05_g1_dex3_sonic", "HumanoidArena", 10, 9), candidate("pi05_droid", "π0.5 DROID", 10, 0),
      candidate("groot_n17_droid", "GR00T N1.7 DROID", 10, 0)).policyComparison!;
    expect(zero.line).toBe("No policy run on a Franka research arm completed the job in the simulation of your site, so it could not rank them. "
      + "1 more policy ran on a Unitree G1 humanoid, a different robot, and is not compared with these.");
  });

  it("a pair exactly on a threshold stays on it: 2 of 2 against 6 of 12 reads \"was ahead\"", () => {
    const comparison = run(candidate("pi05_droid", "π0.5 DROID", 2, 2), candidate("groot_n17_droid", "GR00T N1.7 DROID", 12, 6)).policyComparison!;
    expect(Math.abs(probabilityAhead(tries(2, 2), tries(6, 12)) - AHEAD)).toBeLessThan(1e-9);
    expect(comparison).toMatchObject({ separated: false, winner: { policy: "π0.5" } });
    expect(comparison.line).toMatch(/π0\.5, an AI control policy from Physical Intelligence, was ahead: it completed the job in 2 of 2 tries, against 6 of 12 for GR00T N1\.7\./);
  });

  it("one scored policy: its count, no comparison", () => {
    const comparison = run(candidate("pi05_droid", "π0.5 DROID", 10, 4)).policyComparison!;
    expect(comparison).toMatchObject({ separated: false, winner: null });
    expect(comparison.line).toBe("The simulation scored one policy on a Franka research arm: π0.5 completed the job in 4 of 10 tries. With nothing to compare it to on that robot, it could not rank policies.");
  });

  it("a policy that never completed the job is never ahead, even against a weaker count", () => {
    const comparison = run(candidate("pi05_droid", "π0.5 DROID", 1, 0), candidate("groot_n17_droid", "GR00T N1.7 DROID", 100, 1)).policyComparison!;
    expect(comparison).toMatchObject({ separated: false, winner: null });
    expect(comparison.line.startsWith(FRANKA_NO_CLEAR)).toBe(true);
  });

  it("says nothing ran when no policy has a scored try", () => {
    const proof = projectSimulationProof({ evaluation: evaluation({}, [
      candidate("pi05_droid", "π0.5 DROID", 0, 0, { blockers: ["site_screening_budget_insufficient"] })]), pick: ur10e });
    expect(proof.headline).toBe(NO_POLICY_SCORED);
    expect(proof.policyComparison).toMatchObject({ line: NO_POLICY_SCORED, rows: [],
      didNotRunLine: "1 policy was planned and did not run. “Simulation details” further down says why." });
    // No "we ran the public policies" before anything ran.
    expect(proof.forThisJob).toEqual([SCALE_ESTIMATED]);
    const onlyScripted = projectSimulationProof({ evaluation: evaluation({}, [candidate("scripted_pick_place", "Scripted", 10, 10, { executionEvidence: scripted })]), pick: ur10e });
    expect(onlyScripted.headline).toBe(NO_POLICY_SCORED);
    expect(onlyScripted.forThisJob).toEqual([SCALE_ESTIMATED]);
  });

  it("held for budget, or could not run, says what happened and never that policies ran", () => {
    for (const outcome of ["held_budget", "held_setup", "held_scene_check", "reference_only"] as const) {
      const proof = projectSimulationProof({ evaluation: evaluation({ outcome }, [candidate("pi05_droid", "π0.5 DROID", 0, 0, { state: "deferred" })]), pick: ur10e });
      expect(proof.state).toBe("could_not_run");
      for (const sentence of [proof.headline, proof.policyComparison!.line, ...proof.forThisJob]) {
        expect(sentence).not.toMatch(/we ran|did best|was ahead|completed the job|tries/i);
      }
    }
  });
});
