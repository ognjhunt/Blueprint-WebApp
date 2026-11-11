import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SimulationProof } from "@/components/site/SimulationProof";
import { GAP_COULD_BE_CHANCE, GAP_UNLIKELY_CHANCE, NO_POLICY_COMPLETED, projectSimulationProof } from "@/lib/simulationProof";
import { SIMULATION_ACCURACY } from "@/data/simulationAccuracy";
import { SCENE_NOTE_BEYOND_REACH, allZeroEvaluation, preparingEvaluation, readyAnswer, winnerEvaluation } from "../fixtures/siteAnswer";

const pick = readyAnswer.pick!;
const robotFit = { models: [{ name: "UR10e", manufacturer: "Universal Robots", verdict: "fits" as const, openChecks: [] }] };
/** Words a site manager should never meet in the proof, and anything that looks like a raw code. */
const BANNED = /episode|candidate|screening|embodiment|checkpoint|DROID|jointpos|[a-z]_[a-z]|sha256/i;
/** A paper may be called PolaRiS in its title; a policy's name never says so. */
const policyRows = () => screen.queryByRole("list", { name: "Control policies tried" })?.textContent ?? "";

const renderProof = (input: Parameters<typeof projectSimulationProof>[0]) => {
  const proof = projectSimulationProof(input);
  return { proof, ...render(<SimulationProof proof={proof} />) };
};

describe("tested in simulation", () => {
  // Rewritten from "names the policy that did best": the fixture's 7 of 10 against 3 of 10 is about 0.96 under
  // the probability rule, so the leader is ahead, marked "Ahead", and the page says the gap could still be chance.
  it("names the policy that was ahead, with every row, the robot check and how far to trust it", () => {
    const { proof, container } = renderProof({ evaluation: [winnerEvaluation], robotFit, pick });
    const section = screen.getByRole("region", { name: "Tested in simulation" });
    expect(within(section).getByText(proof.headline)).toBeVisible();
    expect(proof.headline).toBe("In a simulation of your site, on a Franka research arm, π0.5, an AI control policy from Physical Intelligence, was ahead: it completed the job in 7 of 10 tries, against 3 of 10 for the next best, GR00T N1.7.");
    expect(within(section).getByText(`${GAP_COULD_BE_CHANCE} The others: MolmoAct 2, 2 of 10.`)).toBeVisible();
    expect(screen.getByRole("heading", { name: "Your robot in your scene" })).toBeVisible();
    expect(screen.getByText(/the Universal Robots UR10e reaches the pick-up and put-down points with a clear arm path/)).toBeVisible();
    expect(screen.getByRole("heading", { name: "Control policies on your job" })).toBeVisible();
    const rows = within(screen.getByRole("list", { name: "Control policies tried" })).getAllByRole("listitem");
    expect(rows.map(row => row.textContent)).toEqual([
      expect.stringMatching(/^π0\.5 from Physical Intelligence7 of 10 tries · likely between \d+% and \d+%Ahead$/),
      expect.stringMatching(/^GR00T N1\.7 from NVIDIA3 of 10 tries/),
      expect.stringMatching(/^MolmoAct 2 from Ai22 of 10 tries/),
    ]);
    expect(within(rows[0]).getByText("Ahead")).toBeVisible();
    expect(within(rows[1]).queryByText("Ahead")).toBeNull();
    expect(screen.queryByText("Did best")).toBeNull();
    expect(screen.getByText("1 more policy was planned and did not run. “Simulation details” further down says why.")).toBeVisible();
    expect(screen.queryByText(/we set up did not run/)).toBeNull();
    expect(container.textContent).not.toMatch(BANNED);
    expect(policyRows()).not.toMatch(/PolaRiS/i);
  });

  it("marks the leader \"Did best\" only when the gap is unlikely to be chance", () => {
    const clear = { ...winnerEvaluation, screening: { candidates: [{ ...winnerEvaluation.screening!.candidates[0], succeeded: 10, failed: 0 },
      ...winnerEvaluation.screening!.candidates.slice(1)] } };
    renderProof({ evaluation: [clear], pick });
    const rows = within(screen.getByRole("list", { name: "Control policies tried" })).getAllByRole("listitem");
    expect(within(rows[0]).getByText("Did best")).toBeVisible();
    expect(screen.getByText(new RegExp(`^${GAP_UNLIKELY_CHANCE}`))).toBeVisible();
    expect(screen.queryByText("Ahead")).toBeNull();
  });

  it("renders the published accuracy, its conditions, its sources as links and what holds for this job", () => {
    renderProof({ evaluation: [winnerEvaluation], pick });
    expect(screen.getByRole("heading", { name: "How far to trust this" })).toBeVisible();
    expect(screen.getByText(SIMULATION_ACCURACY.statement)).toBeVisible();
    expect(screen.getByText(SIMULATION_ACCURACY.conditions)).toBeVisible();
    for (const source of SIMULATION_ACCURACY.sources) {
      const link = screen.getByRole("link", { name: source.title });
      expect(link).toHaveAttribute("href", source.url);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noreferrer");
    }
    expect(screen.getByText("For your job:")).toBeVisible();
    expect(screen.getByText("The scale of your scene was estimated from your video, not measured.")).toBeVisible();
    expect(screen.getByText(/^We have no public AI policy to run on the Universal Robots UR10e, so we ran the public policies/)).toBeVisible();
  });

  it("all at zero: says it could not rank them, with the scene notes right under it and no winner", () => {
    const { container } = renderProof({ evaluation: [allZeroEvaluation], pick });
    expect(screen.getByText(NO_POLICY_COMPLETED)).toBeVisible();
    expect(screen.queryByText("Did best")).toBeNull();
    const note = screen.getByText(SCENE_NOTE_BEYOND_REACH);
    const list = screen.getByRole("list", { name: "Control policies tried" });
    expect(note.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByText("1 more policy was planned and did not run. “Simulation details” further down says why.")).toBeVisible();
    // Zero successes is never an estimate and never offers a pilot.
    expect(container.textContent).not.toMatch(/likely between|pilot/i);
    for (const text of [screen.getByText(NO_POLICY_COMPLETED).textContent, policyRows(), note.textContent]) expect(text).not.toMatch(/estimate/i);
    expect(container.textContent).not.toMatch(BANNED);
    expect(policyRows()).not.toMatch(/PolaRiS/i);
  });

  it("all at zero with progress: says how far each got, in plain words, under the could-not-rank headline", () => {
    const ladder = ["approached", "contact", "moved", "lifted", "translated", "placed", "released_and_settled"] as const;
    const progress = (graded: number, counts: number[]) => ({ graded, meanScore: 0,
      stages: ladder.map((stage, index) => ({ stage, episodes: counts[index] })), closestApproachM: { median: 0.065, min: 0.01 } });
    const counts: Record<string, number[]> = { pi05_droid: [9, 6, 5, 4, 2, 0, 0], groot_n17_droid: [3, 0, 0, 0, 0, 0, 0],
      pi0_droid_jointpos_polaris: [0, 0, 0, 0, 0, 0, 0] };
    const graded = { ...allZeroEvaluation, screening: { ...allZeroEvaluation.screening!, candidates: allZeroEvaluation.screening!.candidates.map(row =>
      counts[row.candidateId] ? { ...row, progress: progress(row.scored, counts[row.candidateId]) } : row) } };
    const { proof, container } = renderProof({ evaluation: [graded], pick });
    expect(proof.headline).toBe(NO_POLICY_COMPLETED);
    expect(screen.getByText(NO_POLICY_COMPLETED)).toBeVisible();
    expect(screen.getByText("How far each got: π0.5 carried the object toward where it goes in 2 of 9 tries; "
      + "π0 did not get within reach of the object in 10 of 10 tries, and it typically came within about 7 cm of it; "
      + "GR00T N1.7 got within reach of the object in 3 of 10 tries.")).toBeVisible();
    // Said once, in the sentence, not again on the rows; and nothing is marked on it.
    expect(policyRows()).not.toMatch(/object|typically/);
    expect(screen.queryByText("Did best")).toBeNull();
    expect(screen.queryByText("Ahead")).toBeNull();
    expect(container.textContent).not.toMatch(BANNED);
  });

  it("with a policy that completed the job: the row of one that completed nothing says how far it got", () => {
    const rows = winnerEvaluation.screening!.candidates.map(row => row.candidateId === "groot_n17_droid"
      ? { ...row, succeeded: 0, failed: 10, progress: { graded: 10, meanScore: 0, stages: ["contact", "moved", "lifted", "translated", "placed",
        "released_and_settled"].map((stage, index) => ({ stage: stage as "contact", episodes: [6, 4, 0, 0, 0, 0][index] })) } } : row);
    renderProof({ evaluation: [{ ...winnerEvaluation, screening: { ...winnerEvaluation.screening!, candidates: rows } }], pick });
    const items = within(screen.getByRole("list", { name: "Control policies tried" })).getAllByRole("listitem");
    const groot = items.find(item => item.textContent!.startsWith("GR00T N1.7"))!;
    expect(groot.textContent).toMatch(/0 of 10 tries · moved the object in 4 of 10 tries$/);
    expect(screen.queryByText(/How far each got/)).toBeNull();
  });

  it.each([
    ["not_started", null, "The simulation of your site has not started yet."],
    ["preparing", [preparingEvaluation], "We are preparing the simulation of your site."],
    ["running", [{ ...preparingEvaluation, state: "running", screening: { candidates: [{ ...preparingEvaluation.screening!.candidates[0], state: "running" }] } }],
      "The simulation of your site is running."],
    ["could_not_run", [{ ...winnerEvaluation, outcome: "held_capability" as const }], "The simulation can't model this kind of task yet."],
  ] as const)("says %s in one short line, with no results or study figures", (state, evaluation, line) => {
    const { proof, container } = renderProof({ evaluation, pick });
    expect(proof.state).toBe(state);
    expect(screen.getByRole("heading", { name: "Tested in simulation" })).toBeVisible();
    expect(screen.getByText(line)).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Control policies on your job" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "How far to trust this" })).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(container.textContent).not.toMatch(/your job is held|^Held/i);
    expect(container.textContent).not.toMatch(BANNED);
  });

  it("never shows a working name as a policy's name", () => {
    const evaluation = { ...winnerEvaluation, screening: { candidates: [winnerEvaluation.screening!.candidates[0],
      { ...winnerEvaluation.screening!.candidates[1], candidateId: "unknown-id", name: "Current candidate" }] } };
    const { container } = renderProof({ evaluation: [evaluation], pick });
    expect(screen.getByText("An unnamed AI control policy")).toBeVisible();
    expect(screen.getByText(/on a robot we could not confirm, not compared/)).toBeVisible();
    expect(container.textContent).not.toMatch(/Current candidate|could not name/);
    expect(container.textContent).not.toMatch(BANNED);
  });
});
