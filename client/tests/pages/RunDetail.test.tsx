import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { validDecisionEnvelope } from "../../../server/tests/helpers/decision-evidence-fixtures";
import { DecisionResult } from "@/pages/app/RunDetail";

describe("Task Evaluation Run result hierarchy", () => {
  it("renders partial decision evidence, envelope, warnings, next experiment, and exact artifact", () => {
    render(<DecisionResult envelope={validDecisionEnvelope()} />);

    // The envelope is split across Decision / Evidence / Limits. The outcome
    // stays above the split; everything else is asserted in the tab that owns
    // it, so the hierarchy is still checked end to end.
    expect(screen.getByText("Partial decision")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Claims answered, rejected, and unresolved/i })).toBeInTheDocument();
    // The exact testbed digest is scoped to the decision, so it is asserted here.
    expect(screen.getAllByText(`sha256:${"a".repeat(64)}`).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("tab", { name: /Evidence/i }));
    expect(screen.getByText(/version 1.0.0/i)).toBeInTheDocument();
    expect(screen.getByText(/Post-training not eligible/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Limits/i }));
    expect(screen.getByRole("heading", { name: /Validation envelope and unsupported conditions/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Disagreements and correlated evidence/i })).toBeInTheDocument();
    // Claim ceiling is now a warn ProofBoundary rather than a section heading.
    expect(screen.getByText(/Claim ceiling/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Next cheapest experiment/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Physical evidence still needed/i })).toBeInTheDocument();
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
    expect(screen.getByText("Explicit abstention")).toBeInTheDocument();
    expect(screen.getByText(/No candidate or winner is inferred/i)).toBeInTheDocument();
    expect(screen.queryByText(/Selected winner/i)).not.toBeInTheDocument();
  });

  it.each([
    ["bounded_positive", "Bounded positive decision"],
    ["bounded_negative", "Bounded negative decision"],
  ] as const)("renders a %s without reducing it to a score", (outcome, label) => {
    render(<DecisionResult envelope={validDecisionEnvelope({ overall: { outcome, summary: `${label} inside the stated envelope.`, decided_claim_ids: ["reach-target"], unresolved_claim_ids: [], selected_candidate_ids: outcome === "bounded_positive" ? ["candidate-a"] : [] } })} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByText(/Overall score/i)).not.toBeInTheDocument();
  });
});
