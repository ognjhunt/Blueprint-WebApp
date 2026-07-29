import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HowItWorks from "@/pages/HowItWorks";

describe("HowItWorks", () => {
  it("shows decision-oriented intake, Pipeline routing, abstention, and the next experiment", () => {
    render(<HowItWorks />);
    expect(
      screen.getByRole("heading", { name: /One real task in\. One bounded answer out\./i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Say what you need to decide/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Plan the cheapest qualified evidence/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Decide, or abstain out loud/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Name the next cheapest experiment/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/There is no simulator menu/i)).toBeInTheDocument();
    expect(screen.getByText(/Pipeline owns method qualification/i)).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /Request a Task Evaluation Run/i })[0],
    ).toHaveAttribute("href", expect.stringContaining("/contact/robot-team"));
    expect(screen.queryByText(/Policy Improvement Run/i)).not.toBeInTheDocument();
  });
});
