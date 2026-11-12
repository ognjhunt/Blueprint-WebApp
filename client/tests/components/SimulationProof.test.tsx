import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SimulationProof, SimulationTestRows, TrustRows, computerTestLine, testNotRunLine, testResultOf } from "@/components/site/SimulationProof";
import { projectSimulationProof, testHeadline } from "@/lib/simulationProof";
import { SIMULATION_ACCURACY } from "@/data/simulationAccuracy";
import { SCENE_NOTE_BEYOND_REACH, allZeroEvaluation, preparingEvaluation, readyAnswer, winnerEvaluation } from "../fixtures/siteAnswer";

const pick = readyAnswer.pick!;
/** Words a site manager should never meet, and anything that looks like a raw code. */
const BANNED = /episode|candidate|screening|embodiment|checkpoint|DROID|jointpos|[a-z]_[a-z]|sha256/i;
const proofOf = (evaluation: Parameters<typeof projectSimulationProof>[0]["evaluation"]) => projectSimulationProof({ evaluation, pick });
const withCounts = (counts: Array<[number, number]>) => ({ ...winnerEvaluation, screening: { candidates: winnerEvaluation.screening!.candidates.map((row, index) =>
  counts[index] ? { ...row, scored: counts[index][1], succeeded: counts[index][0], failed: counts[index][1] - counts[index][0] } : row) } });
const words = (text: string | null) => (text?.match(/[^\s]+/g) ?? []).filter(word => /[\p{L}\p{N}]/u.test(word)).length;

describe("what our early trial found", () => {
  it("names row 1 and says did best or was ahead only by the probability rule", () => {
    // 7 of 10 against 3 of 10 and 2 of 10 is about 0.96 against the next: was ahead.
    expect(testResultOf(proofOf([winnerEvaluation]))).toMatchObject({ kind: "winner", wording: "was_ahead", others: 2, top: { label: "Franka arm + π0.5" } });
    // 10 of 10 is beyond 0.975 against every other: did best.
    expect(testResultOf(proofOf([withCounts([[10, 10]])]))).toMatchObject({ kind: "winner", wording: "did_best" });
    // 1 of 1 against 0 of 1: no clear winner, though one finished.
    expect(testResultOf(proofOf([withCounts([[1, 1], [0, 1], [0, 1]])]))).toMatchObject({ kind: "no_clear_winner", top: { succeeded: 1 } });
    expect(testResultOf(proofOf([allZeroEvaluation]))).toMatchObject({ kind: "none_finished", count: 4, setupFlag: true });
    expect(testResultOf(proofOf([preparingEvaluation]))).toEqual({ kind: "testing", entered: 2 });
    expect(testResultOf(proofOf([]))).toBeNull();
    // One option, which did the job: the only one tested, never "best".
    const lone = { ...winnerEvaluation, screening: { candidates: [winnerEvaluation.screening!.candidates[0]] } };
    expect(testResultOf(proofOf([lone]))).toMatchObject({ kind: "one_option" });
    expect(proofOf([lone]).options.winner).toBeNull();
  });

  it("never makes an option of a scripted row; a learned policy our list does not name is an option with a neutral name", () => {
    const rows = [...winnerEvaluation.screening!.candidates,
      { ...winnerEvaluation.screening!.candidates[0], candidateId: "unmapped-policy", name: "Current candidate", succeeded: 10, scored: 10, failed: 0,
        executionEvidence: { execution_evidence_kind: "learned_policy" as const, action_source: "learned_policy", scripted_rollout_count: 0,
          learned_policy_rollout_count: 10, scripted_controller_invoked: false, candidate_policy_queried: true } },
      { ...winnerEvaluation.screening!.candidates[0], candidateId: "scripted-arm", name: "Scripted arm", succeeded: 10, scored: 10, failed: 0,
        executionEvidence: { execution_evidence_kind: "scripted_simulator_state_baseline" as const, action_source: "scripted_simulator_state",
          scripted_rollout_count: 10, learned_policy_rollout_count: 0, scripted_controller_invoked: true, candidate_policy_queried: false } }];
    const proof = proofOf([{ ...winnerEvaluation, screening: { candidates: rows } }]);
    // The unnamed policy did best (10 of 10): it leads, ranks and counts like any other, under a neutral name.
    expect(proof.options.options.map(option => option.label)).toEqual(["Unlisted robot software A", "Franka arm + π0.5", "Franka arm + GR00T N1.7", "Franka arm + MolmoAct 2"]);
    expect(testResultOf(proof)).toMatchObject({ top: { label: "Unlisted robot software A", maker: null, software: null } });
    const { container } = render(<SimulationTestRows proof={proof} />);
    expect(container).toHaveTextContent("1. Unlisted robot software AFinished 10 of 10 tries");
    expect(container.textContent).not.toMatch(/Scripted|Current candidate|not compared|could not confirm/);
  });

  it("never makes an option of a row it cannot identify as an AI policy, even one that did the job every time", () => {
    const base = winnerEvaluation.screening!.candidates[0];
    const rows = [{ ...base, candidateId: "pi05_droid", succeeded: 3, scored: 10, failed: 7 },
      // An older publication's scripted baseline: no execution kind, no reference mark, not in our list.
      { ...base, candidateId: "pick_baseline_v1", name: "Scripted pick", succeeded: 10, scored: 10, failed: 0 },
      // A scripted-baseline id, even with learned-policy evidence.
      { ...base, candidateId: "scripted_pick", name: "Scripted", succeeded: 10, scored: 10, failed: 0,
        executionEvidence: { execution_evidence_kind: "learned_policy" as const, action_source: "learned_policy", scripted_rollout_count: 0,
          learned_policy_rollout_count: 10, scripted_controller_invoked: false, candidate_policy_queried: true } }];
    const proof = proofOf([{ ...winnerEvaluation, screening: { candidates: rows } }]);
    expect(proof.options.options.map(option => option.label)).toEqual(["Franka arm + π0.5"]);
    expect(proof.options.unidentified).toBe(1);
    expect(testResultOf(proof)).toMatchObject({ kind: "one_option", top: { label: "Franka arm + π0.5" } });
    const { container } = render(<SimulationTestRows proof={proof} />);
    expect(container).toHaveTextContent("1 other run could not be identified as a robot we tried, so it is not counted.");
    expect(container.textContent).not.toMatch(/Unlisted robot software A|AI robot|Scripted|Did best/);
  });

  it("counts as running only the robots that were scored, are running or are still going to run", () => {
    const rows = [
      { ...preparingEvaluation.screening!.candidates[0], candidateId: "pi05_droid", state: "running" },
      { ...preparingEvaluation.screening!.candidates[0], candidateId: "groot_n17_droid", state: "pending" },
      { ...preparingEvaluation.screening!.candidates[0], candidateId: "molmoact2_droid", state: "unavailable" },
      { ...preparingEvaluation.screening!.candidates[0], candidateId: "cosmos3_edge_policy_droid", state: "infeasible" },
      { ...preparingEvaluation.screening!.candidates[0], candidateId: "pi0_droid_jointpos_polaris", state: "blocked" },
    ];
    const proof = proofOf([{ ...preparingEvaluation, state: "running", screening: { candidates: rows } }]);
    expect(proof.options.entered).toBe(2);
    expect(testResultOf(proof)).toEqual({ kind: "testing", entered: 2 });
    expect(testHeadline(testResultOf(proof))).toBe("Our early trial is running: 2 robots on your job.");
  });

  it("says the headline a company reads, the same result, in a sentence", () => {
    expect(testHeadline(testResultOf(proofOf([winnerEvaluation])))).toBe("Was ahead in our early trial: Franka arm + π0.5, doing your job in 7 of 10 tries.");
    expect(testHeadline(testResultOf(proofOf([allZeroEvaluation])))).toBe("No robot finished the job in our trial.");
    expect(testHeadline(null)).toBeNull();
  });

  it("says why the test is not the answer, in plain words, when that is known", () => {
    expect(testNotRunLine(proofOf([{ ...winnerEvaluation, outcome: "held_capability" as const }])))
      .toBe("Our early trial did not run. Our trial can't do this kind of job yet.");
    expect(testNotRunLine(proofOf([]))).toBeNull();
    expect(testNotRunLine(proofOf([{ ...winnerEvaluation, screening: { candidates: [] } }]))).toBe("Our early trial finished, but no robot could be scored in it.");
  });

  it("says the same in one line for an older job's own view", () => {
    expect(computerTestLine(proofOf([winnerEvaluation]))).toBe("Early trial: Franka arm + π0.5 was ahead, doing your job in 7 of 10 tries.");
    expect(computerTestLine(proofOf([allZeroEvaluation]))).toBe("Early trial: No robot finished the job in our trial.");
    expect(computerTestLine(proofOf([]))).toBeNull();
  });
});

describe("the ranked list", () => {
  it("lists every option in the display order, with its maker and count, the winner's mark and the gap", () => {
    const { container } = render(<SimulationTestRows proof={proofOf([winnerEvaluation])} />);
    expect(screen.getByText("In our early trial we ran 3 robots on your job, about 10 tries each, in a simulation of your site.")).toBeVisible();
    expect([...container.querySelectorAll("dt")].map(node => node.textContent)).toEqual([
      "1. Franka arm + π0.5 · Physical Intelligence", "2. Franka arm + GR00T N1.7 · NVIDIA", "3. Franka arm + MolmoAct 2 · Ai2"]);
    expect(container).toHaveTextContent(/Finished 7 of 10 tries · likely between \d+% and \d+% · Ahead/);
    expect(screen.getByText("With this few tries the gap could still be chance.")).toBeVisible();
    expect(screen.getByText("1 more robot was planned but did not run. Job settings › Simulation details says why.")).toBeVisible();
    expect(container.textContent).not.toMatch(BANNED);
  });

  it("orders options that finished nothing by how far they got, and says it on each row", () => {
    const ladder = ["approached", "contact", "moved", "lifted", "translated", "placed", "released_and_settled"] as const;
    const progress = (graded: number, counts: number[], median: number) => ({ graded, meanScore: 0, closestApproachM: { median, min: 0 },
      stages: ladder.map((stage, index) => ({ stage, episodes: counts[index] ?? 0 })) });
    const counts: Record<string, [number[], number]> = { pi05_droid: [[9, 6, 5, 4, 2], 0.01], groot_n17_droid: [[3], 0.02], pi0_droid_jointpos_polaris: [[], 0.065] };
    const graded = { ...allZeroEvaluation, screening: { ...allZeroEvaluation.screening!, candidates: allZeroEvaluation.screening!.candidates.map(row =>
      counts[row.candidateId] ? { ...row, progress: progress(row.scored, ...counts[row.candidateId]) } : row) } };
    const proof = proofOf([graded]);
    expect(proof.options.options.map(option => option.label)).toEqual(["Franka arm + π0.5", "Franka arm + GR00T N1.7", "Franka arm + π0", "Franka arm + π0-FAST"]);
    expect(testResultOf(proof)).toMatchObject({ kind: "none_finished", top: { furthestText: "lifted and carried the object" } });
    const { container } = render(<SimulationTestRows proof={proof} />);
    expect(container).toHaveTextContent("1. Franka arm + π0.5 · Physical IntelligenceFinished 0 of 9 tries · lifted and carried the object in 2 of 9 tries");
    // The set-up flag, said as a notice in plain words; the run's own notes as they were sent.
    expect(screen.getByText("This result may come from how we set up the simulation of your site, not from the robots.")).toBeVisible();
    expect(screen.getByText(SCENE_NOTE_BEYOND_REACH)).toBeVisible();
    expect(container.textContent).not.toMatch(/Did best|Ahead/);
  });
});

describe("how far to trust it", () => {
  it("says every published figure and condition in short rows, with every source", () => {
    const { container } = render(<TrustRows proof={proofOf([winnerEvaluation])} />);
    expect(screen.getByText(/picked the better of two policies in 8 of 9 comparisons/)).toBeVisible();
    expect(screen.getByText(/a correlation of about 0\.9 on average/)).toBeVisible();
    expect(screen.getByText(/fell to 7 or 6 of 9/)).toBeVisible();
    for (const source of SIMULATION_ACCURACY.sources) expect(screen.getByRole("link", { name: source.title })).toHaveAttribute("href", source.url);
    expect(words(container.textContent)).toBeLessThanOrEqual(190);
  });
});

describe("tested in simulation, for an older job with no answer", () => {
  it("says the one line and everything behind it", () => {
    render(<SimulationProof proof={projectSimulationProof({ evaluation: [allZeroEvaluation], pick: null })} />);
    const section = screen.getByRole("region", { name: "Early trial of openly available robot software" });
    expect(within(section).getByText("Early trial: No robot finished the job in our trial.")).toBeVisible();
    expect(within(section).getAllByText("This result may come from how we set up the simulation of your site, not from the robots.").length).toBeGreaterThan(0);
    expect(within(section).getByRole("region", { name: "Ranked" })).toBeVisible();
  });
});
