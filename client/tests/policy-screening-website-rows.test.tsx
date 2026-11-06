import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ManagedScreeningResults } from "../src/components/shared/ManagedScreeningResults";
import type { JobManagedEvidenceSummary } from "../src/types/jobMarketplace";
import allRows from "../../server/tests/fixtures/pipeline-beta-policy-screening-website-all-rows.v2.json";
import runnableRows from "../../server/tests/fixtures/pipeline-beta-policy-screening-website-runnable-rows.v2.json";

afterEach(cleanup);

/** The site's view of a real Pipeline publication, as the server projects its rows. */
function evaluation(runId: string, publication: typeof allRows, summary: string): JobManagedEvidenceSummary {
  return { runId, state: "completed", outcome: "estimate", current: true, resultDigest: publication.publication_digest, summary,
    nextAction: "", limitations: [], href: `#managed-evidence-${runId}`,
    screening: { candidates: publication.candidates.map(row => ({ candidateId: row.candidate_id, name: row.display_name,
      state: row.status, planned: row.episodes_planned, scored: row.episodes_scored, succeeded: row.episodes_succeeded,
      failed: row.episodes_failed, void: row.episodes_void, blockers: row.blockers })) } };
}

/**
 * P-DT-12: a new website campaign lists only candidates that can run on a website job (54 of the
 * 136 catalog rows); one planned before lists all 136. A job page can hold both, newest first.
 */
it("shows a new campaign's runnable candidates and an earlier campaign's full list, each folding what did not run", () => {
  render(<ManagedScreeningResults evidence={[
    evaluation("campaign-new", runnableRows as typeof allRows, "In the simulation, 1 of 54 candidates ran."),
    evaluation("campaign-old", allRows, "In the simulation, 1 of 136 candidates ran.")]} />);
  const [current, earlier] = screen.getAllByRole("region", { name: "Simulation results for your job" });
  expect(within(current).getByText("In the simulation, 1 of 54 candidates ran.")).toBeInTheDocument();
  expect(within(earlier).getByText("From an earlier evaluation run of your job.")).toBeInTheDocument();
  // The candidate that ran is listed in each; the rest sit behind one toggle, each still saying why.
  for (const [section, notRun] of [[current, 53], [earlier, 135]] as const) {
    const rows = within(section).getAllByRole("row").slice(1).filter(row => !row.closest("tbody[hidden]"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("Cosmos");
    fireEvent.click(within(section).getByRole("button", { name: `Show the ${notRun} candidates that did not run, and why` }));
    expect(within(section).getAllByRole("row").slice(1)).toHaveLength(1 + notRun);
  }
  // A robot × route template or scripted baseline shows only in the earlier campaign's list.
  expect(within(current).queryByText(/Customer planning endpoint|Blueprint scripted/)).toBeNull();
  expect(within(earlier).getAllByText(/Customer planning endpoint/).length).toBeGreaterThan(0);
  expect(document.body.textContent).not.toMatch(/prepared_robot_policy_registration_missing|candidate_disabled/);
});
