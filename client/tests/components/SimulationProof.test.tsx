import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ComputerTestDetails, SimulationProof, computerTestLine } from "@/components/site/SimulationProof";
import { NO_POLICY_COMPLETED, projectSimulationProof } from "@/lib/simulationProof";
import { SIMULATION_ACCURACY } from "@/data/simulationAccuracy";
import { SCENE_NOTE_BEYOND_REACH, allZeroEvaluation, preparingEvaluation, readyAnswer, winnerEvaluation } from "../fixtures/siteAnswer";

const pick = readyAnswer.pick!;
const robotFit = { models: [{ name: "UR10e", manufacturer: "Universal Robots", verdict: "fits" as const, openChecks: [] }] };
/** Words a site manager should never meet, and anything that looks like a raw code. */
const BANNED = /episode|candidate|screening|embodiment|checkpoint|DROID|jointpos|[a-z]_[a-z]|sha256/i;
const line = (evaluation: Parameters<typeof projectSimulationProof>[0]["evaluation"], withPick = pick) =>
  computerTestLine(projectSimulationProof({ evaluation, pick: withPick }), withPick ? withPick.name : null);
const withCounts = (counts: Array<[number, number]>) => ({ ...winnerEvaluation, screening: { candidates: winnerEvaluation.screening!.candidates.map((row, index) =>
  counts[index] ? { ...row, scored: counts[index][1], succeeded: counts[index][0], failed: counts[index][1] - counts[index][0] } : row) } });

describe("the computer test in one line", () => {
  it("says the leader by the projection's own rule, the robot it ran on, and that it is not the pick", () => {
    // 7 of 10 against 3 of 10 is about 0.96: ahead, and it could still be chance.
    expect(line([winnerEvaluation])).toBe("Simulation test: π0.5 was ahead, finishing the job in 7 of 10 tries, on a Franka research arm, not the UR10e. It could still be chance.");
    // 10 of 10 against 3 of 10 is beyond 0.975: did best.
    expect(line([withCounts([[10, 10]])])).toBe("Simulation test: π0.5 did best, finishing the job in 10 of 10 tries, on a Franka research arm, not the UR10e.");
    // 1 of 1 against 0 of 1 is 5/6: no clear winner.
    expect(line([withCounts([[1, 1], [0, 1], [0, 1]])])).toBe("Simulation test: No clear winner yet, on a Franka research arm, not the UR10e.");
    // Without a pick there is nothing to set it against.
    expect(line([winnerEvaluation], null as unknown as typeof pick)).toBe("Simulation test: π0.5 was ahead, finishing the job in 7 of 10 tries, on a Franka research arm. It could still be chance.");
  });

  it("says none finished, held states and waiting in plain words, and nothing before it starts", () => {
    expect(line([allZeroEvaluation])).toBe("Simulation test: None of the robot programs finished the job, on a Franka research arm, not the UR10e.");
    expect(line([{ ...winnerEvaluation, outcome: "held_budget" as const }])).toBe("Simulation test: The test reached the most the free beta can run for one job, before it finished.");
    expect(line([{ ...winnerEvaluation, outcome: "held_capability" as const }])).toBe("Simulation test: Our simulation test can't do this kind of job yet.");
    expect(line([preparingEvaluation])).toBe("Simulation test: Getting ready.");
    expect(line([{ ...preparingEvaluation, state: "running", screening: { candidates: [{ ...preparingEvaluation.screening!.candidates[0], state: "running" }] } }]))
      .toBe("Simulation test: Running now.");
    expect(line([])).toBeNull();
    // One scored program on a robot we cannot name: nothing to compare it with.
    const lone = { ...winnerEvaluation, screening: { candidates: [{ ...winnerEvaluation.screening!.candidates[0], candidateId: "unknown-id", name: "Arm" }] } };
    expect(line([lone])).toBe("Simulation test: Only one robot program could be scored, so there is nothing to compare it with.");
  });
});

describe("the computer test on the details screen", () => {
  it("says the projection's sentences word for word, every program's count, the scene's line and how far to trust it, with sources", () => {
    const proof = projectSimulationProof({ evaluation: [winnerEvaluation], robotFit, pick });
    const { container } = render(<ComputerTestDetails proof={proof} />);
    const test = screen.getByRole("region", { name: "Simulation test" });
    expect(within(test).getByText(proof.policyComparison!.line)).toBeVisible();
    expect(within(test).getByText(/the Universal Robots UR10e reaches the pick-up and put-down points with a clear arm path/)).toBeVisible();
    expect(test).toHaveTextContent(/π0\.5 Physical IntelligenceFinished 7 of 10 tries · likely between \d+% and \d+% · Ahead/);
    expect(test).toHaveTextContent("1 more robot program was planned but did not run.");
    const trust = screen.getByRole("region", { name: "How far to trust it" });
    expect(within(trust).getByText(SIMULATION_ACCURACY.statement)).toBeVisible();
    for (const source of SIMULATION_ACCURACY.sources) {
      expect(within(trust).getByRole("link", { name: source.title })).toHaveAttribute("href", source.url);
    }
    expect(container.textContent).not.toMatch(BANNED);
  });

  it("all at zero: says why, with the scene notes, how far each got, and no leader", () => {
    const proof = projectSimulationProof({ evaluation: [allZeroEvaluation], pick });
    render(<ComputerTestDetails proof={proof} />);
    expect(screen.getByText(new RegExp(`^${NO_POLICY_COMPLETED.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`))).toBeVisible();
    expect(screen.getByText(SCENE_NOTE_BEYOND_REACH)).toBeVisible();
    expect(screen.queryByText(/Ahead|Did best/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/likely between/);
  });

  it("with a policy that completed the job, the row of one that completed nothing says how far it got", () => {
    const rows = winnerEvaluation.screening!.candidates.map(row => row.candidateId === "groot_n17_droid"
      ? { ...row, succeeded: 0, failed: 10, progress: { graded: 10, meanScore: 0, stages: ["contact", "moved", "lifted", "translated", "placed",
        "released_and_settled"].map((stage, index) => ({ stage: stage as "contact", episodes: [6, 4, 0, 0, 0, 0][index] })) } } : row);
    render(<ComputerTestDetails proof={projectSimulationProof({ evaluation: [{ ...winnerEvaluation, screening: { ...winnerEvaluation.screening!, candidates: rows } }], pick })} />);
    expect(screen.getByRole("region", { name: "Simulation test" })).toHaveTextContent(/GR00T N1\.7 NVIDIAFinished 0 of 10 tries · moved the object in 4 of 10 tries/);
  });

  it("never shows a working name as a policy's name", () => {
    const evaluation = { ...winnerEvaluation, screening: { candidates: [winnerEvaluation.screening!.candidates[0],
      { ...winnerEvaluation.screening!.candidates[1], candidateId: "unknown-id", name: "Current candidate" }] } };
    const { container } = render(<ComputerTestDetails proof={projectSimulationProof({ evaluation: [evaluation], pick })} />);
    expect(screen.getByText("An unnamed AI control policy")).toBeVisible();
    expect(container.textContent).not.toMatch(/Current candidate|could not name/);
  });
});

describe("tested in simulation, for an older job with no answer", () => {
  it("says the one line and everything behind it", () => {
    render(<SimulationProof proof={projectSimulationProof({ evaluation: [allZeroEvaluation], pick: null })} />);
    const section = screen.getByRole("region", { name: "Tested in simulation" });
    expect(within(section).getByText(/^Simulation test: None of the robot programs finished the job/)).toBeVisible();
    expect(within(section).getByText("This result may come from how we set up the simulation of your site, not from the robots.")).toBeVisible();
    expect(within(section).getByRole("region", { name: "Simulation test" })).toBeVisible();
  });
});
