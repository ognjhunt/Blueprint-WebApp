import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ManagedScreeningResults } from "../src/components/shared/ManagedScreeningResults";
import type { JobManagedEvidenceSummary } from "../src/types/jobMarketplace";

afterEach(cleanup);

const CAVEAT = "Our scene check found a possible set-up cause, so this result may reflect how we set the scene up more than the robots.";
const NOTE = "Our scene check could not find a path for a robot arm to carry the object from where it starts to where the job places it.";

/** A zero-success estimate as the server projects it for the site: sentences only, never a flag code. */
function evaluation(setupNotes?: string[]): JobManagedEvidenceSummary {
  const summary = `Your simulation estimate is ready. It is an estimate from a simulation of your site, not a certified result.${
    setupNotes ? ` ${CAVEAT}` : ""} In the simulation, 1 of 1 candidates ran, with 10 episodes scored against the job's success criteria.`;
  return { runId: "campaign-one", state: "completed", outcome: "estimate", ...(setupNotes ? { outcomeCaveat: "scene_setup" as const } : {}),
    current: true, resultDigest: "sha256:result", summary, nextAction: "", limitations: [], href: "#managed-evidence-campaign-one",
    screening: { candidates: [{ candidateId: "pi05_droid", name: "pi0.5 DROID", state: "completed", planned: 10, scored: 10, succeeded: 0,
      failed: 10, void: 0, blockers: [], successRange: { lowerPercent: 0, upperPercent: 28, confidencePercent: 95 } }],
    ...(setupNotes ? { setupNotes } : {}) } };
}

it("shows the caveat in the result sentence and what our checks recorded about the scene, in plain sentences", () => {
  render(<ManagedScreeningResults evidence={[evaluation([NOTE])]} />);
  const section = screen.getByRole("region", { name: "Simulation results for your job" });
  expect(within(section).getByText(new RegExp(CAVEAT.replace(/[.]/g, "\\.")))).toBeInTheDocument();
  const notes = within(section).getByLabelText("What our checks recorded about the simulated scene");
  expect(within(notes).getAllByRole("listitem").map(item => item.textContent)).toEqual([NOTE]);
  // The measured count and its range are still stated as they are.
  expect(section).toHaveTextContent("Succeeded in 0 of 10 scored tries; likely between 0% and 28%.");
  expect(section.textContent).not.toMatch(/[a-z]_[a-z]/);
});

it("adds nothing to a result with no flag", () => {
  render(<ManagedScreeningResults evidence={[evaluation()]} />);
  const section = screen.getByRole("region", { name: "Simulation results for your job" });
  expect(within(section).queryByLabelText("What our checks recorded about the simulated scene")).toBeNull();
  expect(section.textContent).not.toMatch(/scene check|set-up/i);
});
