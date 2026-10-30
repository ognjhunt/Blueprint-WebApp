import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { PolicyScreeningCandidates } from "../src/components/shared/PolicyScreeningCandidates";

afterEach(cleanup);

it("shows the typed scripted scope independently of a candidate's display name", () => {
  render(<PolicyScreeningCandidates screening={{ candidates: [{ candidateId: "candidate", name: "Candidate A",
    state: "completed", planned: 3, scored: 3, succeeded: 2, failed: 1, void: 0, blockers: [],
    executionEvidence: { execution_evidence_kind: "scripted_simulator_state_baseline", action_source: "scripted_simulator_state",
      scripted_rollout_count: 3, learned_policy_rollout_count: 0, scripted_controller_invoked: true, candidate_policy_queried: false } }] }} />);
  expect(screen.getByText(/Scripted simulator-state baseline/)).toHaveTextContent("Does not establish learned-policy or vendor-policy performance");
  expect(screen.getByText("2 succeeded · 1 failed · 0 unscorable")).toBeInTheDocument();
});
