import { describe, expect, it } from "vitest";

import { readyAnswer } from "../fixtures/siteAnswer";
import { SIMULATION_ACCURACY } from "@/data/simulationAccuracy";
import { SIMULATION_POLICIES } from "@/data/simulationPolicies";
import type { AnswerRobot } from "@/lib/siteAnswer";
import { NO_POLICY_COMPLETED, SCALE_ESTIMATED, projectSimulationProof } from "@/lib/simulationProof";
import type { JobManagedEvidenceSummary } from "@/types/jobMarketplace";

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
    expect(comparison.rows.map(row => [row.policy, row.succeeded, row.scored])).toEqual([
      ["π0", 0, 10], ["π0-FAST", 0, 10], ["GR00T N1.7", 0, 10], ["π0.5", 0, 9]]);
    expect(comparison.rows.every(row => row.rangeText === null && !row.chosen)).toBe(true);
    expect(comparison.didNotRun).toBe(3);
    expect(comparison.didNotRunLine).toBe("3 more policies were planned and did not run. “Simulation details” further down says why.");
    expect(comparison.sceneNotes).toEqual([BEYOND_REACH, CAVEAT]);
    expect(comparison.robotName).toBe("a Franka research arm");
    for (const sentence of [proof.headline, comparison.line]) expect(sentence).not.toMatch(/estimate|pilot/i);
    expectPlainPolicies(comparison.rows);
  });

  it("names a winner when one policy did clearly better: 7 of 10 against 3 of 10", () => {
    const proof = projectSimulationProof({ evaluation: WINNER, pick: ur10e });
    const comparison = proof.policyComparison!;
    expect(comparison.separated).toBe(true);
    expect(comparison.winner).toEqual({ policy: "π0.5", maker: "Physical Intelligence" });
    expect(comparison.line).toBe("In a simulation of your site, π0.5, an AI control policy from Physical Intelligence, did best: it completed the job in 7 of 10 tries. The others: GR00T N1.7, 3 of 10.");
    expect(proof.headline).toBe("In a simulation of your site, π0.5, an AI control policy from Physical Intelligence, did best: it completed the job in 7 of 10 tries.");
    expect(comparison.rows[0]).toMatchObject({ policy: "π0.5", chosen: true, rangeText: expect.stringMatching(/^likely between \d+% and \d+%$/) });
    expect(comparison.rows[1].chosen).toBe(false);
    expectPlainPolicies(comparison.rows);
  });

  it("does not separate a tie, or a single policy", () => {
    const tie = projectSimulationProof({ evaluation: evaluation({}, [candidate("pi05_droid", "π0.5 DROID", 10, 4),
      candidate("molmoact2_droid", "MolmoAct 2 DROID", 10, 4)]), pick: ur10e }).policyComparison!;
    expect(tie).toMatchObject({ separated: false, winner: null });
    expect(tie.line).toBe("The simulation ran, but the policies completed the job equally often, so it could not rank them: π0.5, 4 of 10; MolmoAct 2, 4 of 10.");
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

  it("falls back to the evaluation's own name for an unknown id, with no maker", () => {
    const proof = projectSimulationProof({ evaluation: evaluation({}, [candidate("pi05_droid", "π0.5 DROID", 10, 6),
      candidate("new_policy_2027", "Acme Grasp 1", 10, 2), candidate("other_new_policy", "acme_grasp_v2_ckpt", 10, 1)]), pick: ur10e });
    const rows = proof.policyComparison!.rows;
    expect(rows.find(row => row.policy === "Acme Grasp 1")).toMatchObject({ maker: null });
    expect(rows.map(row => row.policy)).toContain("an AI control policy");
    expect(rows.find(row => row.policy === "an AI control policy")).toMatchObject({ maker: null });
    expectPlainPolicies(rows);
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

  it("falls back to a plain phrase for a working label or a code, never the label itself", () => {
    for (const name of ["Current candidate", "Candidate 3", "Baseline policy", "acme_grasp_v2_ckpt", "gs://bucket/model", "Policy v2.1", "sha256:abcdef"]) {
      const proof = projectSimulationProof({ evaluation: evaluation({}, [candidate("pi05_droid", "π0.5 DROID", 10, 6),
        candidate("unknown_id", name, 10, 2)]), pick: ur10e });
      expect(proof.policyComparison!.rows[1]).toMatchObject({ policy: "an AI control policy", maker: null });
      expect(proof.policyComparison!.line).toBe("In a simulation of your site, π0.5, an AI control policy from Physical Intelligence, did best: it completed the job in 6 of 10 tries. The others: an AI control policy, 2 of 10.");
    }
  });

  it("leaves scripted reference rows out of the policies", () => {
    const proof = projectSimulationProof({ evaluation: evaluation({}, [candidate("pi05_droid", "π0.5 DROID", 10, 2),
      candidate("scripted_pick_place", "Scripted pick and place", 10, 10, { executionEvidence: scripted })]), pick: ur10e });
    expect(proof.policyComparison!.rows.map(row => row.policy)).toEqual(["π0.5"]);
    expect(proof.policyComparison!.didNotRun).toBe(0);
    expect(proof.policyComparison!.didNotRunLine).toBeNull();
  });

  it("reads the pick's verdict from the measured scene", () => {
    const fit = (verdict: "fits" | "fits_spec" | "doesnt_fit" | "unknown") => projectSimulationProof({ evaluation: null, pick: ur10e,
      robotFit: { models: [{ name: "UR10e", manufacturer: "Universal Robots", verdict, openChecks: [] }] } }).robotCheck;
    expect(fit("fits")).toEqual({ pickChecked: true,
      line: "In the scene measured from your video, the Universal Robots UR10e reaches the pick-up and put-down points with a clear arm path." });
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
});
