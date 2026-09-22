import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { validDecisionEnvelope } from "../../../server/tests/helpers/decision-evidence-fixtures";
import { DecisionResult, RunRecord } from "@/pages/app/RunDetail";

describe("Task Evaluation Run result hierarchy", () => {
  it("leads with the decision and the questions it answered, keeping evidence and limits one click away", () => {
    render(<DecisionResult envelope={validDecisionEnvelope()} />);

    expect(screen.getByRole("heading", { name: "Partly answered" })).toBeInTheDocument();
    expect(screen.getByText("Candidate A can reach the fixture; onsite performance remains unresolved.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Questions answered" })).toBeInTheDocument();
    expect(screen.getByText("Candidate A can reach the target fixture.")).toBeInTheDocument();
    expect(screen.getByText("Inconclusive")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Next step" })).toBeInTheDocument();
    // The physical-test boundary is stated once on the main view, not per claim.
    expect(screen.getAllByText("A physical test is still needed before relying on this result.")).toHaveLength(1);
    expect(screen.queryByText(/Physical evidence remains necessary/)).not.toBeInTheDocument();

    const evidence = screen.getByText("Evidence and files", { selector: "summary" }).closest("details")!;
    expect(evidence.open).toBe(false);
    expect(within(evidence).getByText(/version 1\.0\.0/)).toBeInTheDocument();
    expect(within(evidence).getByText(/Post-training: not eligible/)).toBeInTheDocument();
    expect(within(evidence).getAllByText(new RegExp(`sha256:${"a".repeat(64)}`)).length).toBeGreaterThan(0);

    const limits = screen.getByText("Limits of this result", { selector: "summary" }).closest("details")!;
    expect(limits.open).toBe(false);
    expect(within(limits).getByText("wet floor")).toBeInTheDocument();
    expect(within(limits).getByText("Both virtual methods reuse the same captured geometry.")).toBeInTheDocument();
    expect(within(limits).getByText("safe for autonomous production deployment")).toBeInTheDocument();
  });

  it("renders abstention explicitly and never infers a winner", () => {
    const envelope = validDecisionEnvelope({
      state: "abstained",
      overall: {
        outcome: "abstained",
        summary: "The current evidence cannot decide between the candidates.",
        decided_claim_ids: [],
        unresolved_claim_ids: ["onsite-outperformance"],
        selected_candidate_ids: [],
      },
    });
    render(<DecisionResult envelope={envelope} />);
    expect(screen.getByRole("heading", { name: "No decision: the evidence couldn't decide" })).toBeInTheDocument();
    expect(screen.getByText(/No candidate or winner is inferred/i)).toBeInTheDocument();
    expect(screen.queryByText(/Selected winner/i)).not.toBeInTheDocument();
  });

  it.each([
    ["bounded_positive", "Yes, within the tested conditions"],
    ["bounded_negative", "No, within the tested conditions"],
  ] as const)("renders a %s without reducing it to a score", (outcome, label) => {
    render(<DecisionResult envelope={validDecisionEnvelope({ overall: { outcome, summary: `${label} inside the stated envelope.`, decided_claim_ids: ["reach-target"], unresolved_claim_ids: [], selected_candidate_ids: outcome === "bounded_positive" ? ["candidate-a"] : [] } })} />);
    expect(screen.getByRole("heading", { name: label })).toBeInTheDocument();
    expect(screen.queryByText(/Overall score/i)).not.toBeInTheDocument();
  });

  it("carries no page navigation, so it can sit inside an evaluation's drawer", () => {
    render(<RunRecord run={{
      job_id: "job-1",
      status: "decision_available",
      decision_projection: { supported: true, envelope: validDecisionEnvelope() },
    }} />);
    expect(screen.queryByRole("link", { name: /back to runs|all runs/i })).not.toBeInTheDocument();
    expect(screen.getByText("Run details", { selector: "summary" })).toBeInTheDocument();
  });

  it("keeps an unsupported result and a pending run visible without inventing a decision", () => {
    const { unmount } = render(<RunRecord run={{
      job_id: "job-2",
      status: "decision_available",
      decision_projection: { supported: false, reason: "Unknown envelope version.", raw_state: "decided" },
    }} />);
    expect(screen.getByText("This result can't be shown yet: Unknown envelope version.")).toBeInTheDocument();
    unmount();
    render(<RunRecord run={{ job_id: "job-3", status: "planning" }} />);
    expect(screen.getByText("No decision yet. Current status: planning.")).toBeInTheDocument();
  });
});
