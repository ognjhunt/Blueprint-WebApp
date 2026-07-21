import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FAQ from "@/pages/FAQ";

describe("FAQ", () => {
  it("renders the current-wedge FAQ in eval/policy-improvement vocabulary", () => {
    render(<FAQ />);

    expect(
      screen.getByRole("heading", {
        name: /The questions that usually decide fit\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/What does Blueprint actually sell\?/i)).toBeInTheDocument();
    expect(screen.getByText(/What is a task pack\?/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Do we have to hand over our policy weights\?/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Is a ranking a deployment guarantee\?/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Are the sites in the public library real customer sites\?/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/How do capturers and site operators fit in\?/i),
    ).toBeInTheDocument();
    // Honest boundaries stay explicit.
    expect(screen.getByText(/not live operator supply/i)).toBeInTheDocument();
    expect(screen.getByText(/source-access optional/i)).toBeInTheDocument();
    // Retired world-model-first vocabulary must not resurface.
    expect(screen.queryByText(/Blueprint world model/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/policy evaluation set/i)).not.toBeInTheDocument();
    // CTAs point at the live funnel.
    expect(
      screen.getAllByRole("link", { name: /Request evaluation/i })[0],
    ).toHaveAttribute("href", expect.stringContaining("/contact/robot-team"));
    expect(
      screen.getByRole("link", { name: /Browse sample site packages/i }),
    ).toHaveAttribute("href", "/sites");
  });
});
