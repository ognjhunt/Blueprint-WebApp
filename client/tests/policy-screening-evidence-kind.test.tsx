import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { PolicyScreeningCandidates } from "../src/components/shared/PolicyScreeningCandidates";

afterEach(cleanup);

it("shows the typed scripted scope independently of a candidate's display name", () => {
  render(<PolicyScreeningCandidates screening={{ candidates: [{ candidateId: "candidate", name: "Candidate A",
    state: "completed", planned: 3, scored: 3, succeeded: 2, failed: 1, void: 0, blockers: [],
    executionEvidence: { execution_evidence_kind: "scripted_simulator_state_baseline", action_source: "scripted_simulator_state",
      scripted_rollout_count: 3, learned_policy_rollout_count: 0, scripted_controller_invoked: true, candidate_policy_queried: false } }] }} />);
  expect(screen.getByText(/Scripted baseline: a hand-coded reference run/)).toHaveTextContent("It does not show how those policies perform");
  expect(screen.getByText("2 succeeded · 1 failed · 0 unscorable")).toBeInTheDocument();
});

const row = (candidateId: string, state: string, succeeded = 0, blockers: string[] = []) => ({ candidateId, name: `Candidate ${candidateId}`,
  state, planned: 3, scored: state === "completed" ? 3 : 0, succeeded, failed: state === "completed" ? 3 - succeeded : 0, void: 0, blockers });

it("shows the rule's choice as a simulation estimate with its recorded companies and every candidate's outcome", () => {
  render(<PolicyScreeningCandidates screening={{ candidates: [row("a", "completed", 2), row("b", "completed", 1),
    row("c", "infeasible", 0, ["candidate_infeasible_measured_geometry"])],
    selection: { status: "chosen", selectionDigest: "sha256:selection", tiedWith: [],
      chosen: { candidateId: "a", name: "Candidate a", successRate: 2 / 3, scored: 3, succeeded: 2, configurationId: "fanuc_m710ic_45m",
        policyRouteId: "planning_endpoint", deploymentCompanies: ["Jacobi Robotics", "Delta Technology"], relationship: "company_deployment",
        evidenceUrl: "https://jacobirobotics.com/platform", relatedTeams: ["Jacobi Robotics"], partnerBlockers: [],
        registryTeams: [{ id: "jacobi", name: "Jacobi Robotics" }] },
      candidates: [{ candidateId: "a", resultRank: 1, choiceBlocker: null }, { candidateId: "b", resultRank: 2, choiceBlocker: null },
        { candidateId: "c", resultRank: null, choiceBlocker: "not_evaluated" }] } }} />);
  expect(screen.getByText(/^Chosen in simulation: Candidate a\. 2 of 3 scored episodes succeeded \(estimated success rate 67%\)\.$/)).toBeInTheDocument();
  expect(screen.getByText(/Deployment companies recorded for this configuration: Jacobi Robotics, Delta Technology/))
    .toHaveTextContent("(company deployment) · source. A recorded association, not a commitment to this site.");
  expect(screen.getByRole("link", { name: "source" })).toHaveAttribute("href", "https://jacobirobotics.com/platform");
  expect(screen.getByText("In Blueprint's robot team registry by name: Jacobi Robotics.")).toBeInTheDocument();
  expect(screen.getByText(/estimate for development only; it is not a guarantee of physical performance or safety/)).toBeInTheDocument();
  expect(screen.getAllByRole("row").slice(1).map(value => value.lastElementChild?.textContent)).toEqual(["Chosen", "Ranked 2", "Not chosen: not evaluated"]);
  expect(screen.getByText(/^infeasible · 0\/3 scored/)).toBeInTheDocument();
});

it("says when nothing succeeded and names no partner without a recorded one", () => {
  const { rerender } = render(<PolicyScreeningCandidates screening={{ candidates: [row("a", "completed", 0)],
    selection: { status: "no_successful_candidate", selectionDigest: "sha256:selection", tiedWith: [], chosen: null,
      candidates: [{ candidateId: "a", resultRank: 1, choiceBlocker: null }] } }} />);
  expect(screen.getByText("No successful candidate: no evaluated candidate succeeded in simulation.")).toBeInTheDocument();
  expect(screen.queryByText(/Deployment companies/)).toBeNull();
  rerender(<PolicyScreeningCandidates screening={{ candidates: [row("a", "completed", 1)],
    selection: { status: "chosen", selectionDigest: "sha256:selection", tiedWith: [], candidates: [{ candidateId: "a", resultRank: 1, choiceBlocker: null }],
      chosen: { candidateId: "a", name: "Candidate a", successRate: 1 / 3, scored: 3, succeeded: 1, configurationId: null, policyRouteId: null,
        deploymentCompanies: [], relationship: null, evidenceUrl: null, relatedTeams: [], registryTeams: [],
        partnerBlockers: ["no_recorded_deployment_partner_for_configuration"] } } }} />);
  expect(screen.getByText("No recorded deployment partner for this configuration.")).toBeInTheDocument();
  expect(screen.queryByText(/robot team registry/)).toBeNull();
});
