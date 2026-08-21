import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Pricing from "@/pages/Pricing";

describe("Pricing", () => {
  it("renders the scoped run quote and site-paid deployment-network schedule", () => {
    render(<Pricing />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Join free\. Pay when a deployment works/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /Submit an opportunity/i }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", { name: /Join as a robot team/i }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/\$0 opportunity submission/i)).toBeInTheDocument();
    expect(screen.getByText(/\$0 robot-team core/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Both sides enter the network for free/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Professional capture is earned by the opportunity/i),
    ).toBeInTheDocument();

    // Price and annual volume stay server-owned.
    expect(screen.getByText(/Pricing is server-owned/i)).toBeInTheDocument();
    expect(
      screen.getByText(/must come from accepted server-owned records/i),
    ).toBeInTheDocument();
    // A quote buys work, not a favourable verdict.
    expect(screen.getByText(/No guaranteed outcome/i)).toBeInTheDocument();
    expect(screen.getByText(/5% success fee/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /5% to start\. Lower automatically as volume grows/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/First \$1 million in the customer account year/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Next \$9 million in the customer account year/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Renewal revenue/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(
        /The contracting enterprise pays Blueprint separately/i,
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(
        /cash actually collected, not the original headline contract value/i,
      ),
    ).toBeInTheDocument();

    expect(screen.queryByText(/\$3,000/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Policy Shortlist/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Robot Match/i)).not.toBeInTheDocument();
  });

  it("calculates the progressive fee without reducing provider revenue", () => {
    render(<Pricing />);
    fireEvent.change(
      screen.getByLabelText(
        /Enterprise provider revenue paid this account year/i,
      ),
      {
        target: { value: "10000000" },
      },
    );

    expect(screen.getByText("$10,000,000")).toBeInTheDocument();
    expect(screen.getByText("$320,000")).toBeInTheDocument();
    expect(screen.getByText("3.2%")).toBeInTheDocument();
    expect(
      screen.getByText(/Customer total: \$10,320,000/i),
    ).toBeInTheDocument();
  });
});
