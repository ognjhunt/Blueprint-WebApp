import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Pricing from "@/pages/Pricing";

describe("Pricing", () => {
  it("renders one scoped quote without fixed campaign prices or guaranteed outcomes", () => {
    render(<Pricing />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Buy one decision before you buy the field time/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Task Evaluation Run$/i)).toBeInTheDocument();
    // Scoped to the heading: the same string also appears as a hero chip.
    expect(
      screen.getByRole("heading", { name: /^From \$2,500$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /Scope a benchmark/i }).length,
    ).toBeGreaterThan(0);

    // Price is set server-side; a client-supplied number is not authoritative.
    expect(screen.getByText(/Pricing is server-owned/i)).toBeInTheDocument();
    expect(
      screen.getByText(/does not treat a client-supplied number as authoritative/i),
    ).toBeInTheDocument();
    // A quote buys work, not a favourable verdict.
    expect(screen.getByText(/No guaranteed outcome/i)).toBeInTheDocument();
    // The "not a packaged tier" promise survives the rebuild, restated as the
    // absence of a subscription rather than the absence of tiers.
    expect(screen.getByText(/No subscription required/i)).toBeInTheDocument();

    expect(screen.queryByText(/\$3,000/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$5,000/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Policy Shortlist/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Robot Match/i)).not.toBeInTheDocument();
  });
});
