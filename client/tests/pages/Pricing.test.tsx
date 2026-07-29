import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Pricing from "@/pages/Pricing";

describe("Pricing", () => {
  it("renders one scoped quote without fixed campaign prices or guaranteed outcomes", () => {
    render(<Pricing />);
    expect(
      screen.getByRole("heading", { name: /You pay for the evidence the decision needs/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^One scoped run$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /What no quote will include\./i }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Request a Task Evaluation Run/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/never accepts a client-supplied price as authoritative/i)).toBeInTheDocument();
    expect(screen.getByText(/No guaranteed outcome/i)).toBeInTheDocument();
    // Scope drivers are a conceptual figure, never a price table.
    expect(screen.getByText(/Conceptual ranges, not a price table/i)).toBeInTheDocument();
    expect(screen.queryByText(/\$3,000/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$5,000/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Policy Shortlist/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Robot Match/i)).not.toBeInTheDocument();
  });
});
