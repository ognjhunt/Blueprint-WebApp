import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FAQ from "@/pages/FAQ";

describe("FAQ", () => {
  it("renders one product with decision and evidence boundaries", () => {
    render(<FAQ />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /One service, and the limits printed on it\./i,
      }),
    ).toBeInTheDocument();

    expect(screen.getByText(/What does Blueprint sell\?/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Do robot teams and site operators use different products\?/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Does every run produce a ranking\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Is post-training a separate product\?/i)).toBeInTheDocument();
    expect(screen.getByText(/What happened to the other products\?/i)).toBeInTheDocument();

    expect(screen.getByText(/One service: a Task Evaluation Run/i)).toBeInTheDocument();
    expect(
      screen.getByText(/ordering a gap the design cannot separate is just reporting noise/i),
    ).toBeInTheDocument();
    // Withdrawn names may be described as withdrawn, but never offered.
    expect(
      screen.getByText(/no longer offered as current products/i),
    ).toBeInTheDocument();
  });
});
