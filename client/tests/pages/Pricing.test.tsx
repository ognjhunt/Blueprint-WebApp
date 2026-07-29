import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Pricing from "@/pages/Pricing";

describe("Pricing", () => {
  it("renders one scoped quote without fixed campaign prices or guaranteed outcomes", () => {
    render(<Pricing />);
    expect(screen.getByRole("heading", { name: /Price the decision and evidence it actually requires/i })).toBeInTheDocument();
    expect(screen.getByText(/^Task Evaluation Run$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Scoped quote$/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Request a Task Evaluation Run/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/does not accept a client-supplied price as authoritative/i)).toBeInTheDocument();
    expect(screen.getByText(/No guaranteed outcome/i)).toBeInTheDocument();
    expect(screen.queryByText(/\$3,000/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$5,000/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Policy Shortlist/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Robot Match/i)).not.toBeInTheDocument();
  });
});
