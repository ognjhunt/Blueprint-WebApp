import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HowItWorks from "@/pages/HowItWorks";

describe("HowItWorks", () => {
  it("shows decision-oriented intake, routing owned by the pipeline, abstention, and the next experiment", () => {
    render(<HowItWorks />);
    expect(
      screen.getByRole("heading", { level: 1, name: /Six steps, and one of them is allowed to say no/i }),
    ).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: /Say what you need to decide/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Route every claim separately/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Return the answer and its edges/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Name the next cheapest test/i })).toBeInTheDocument();

    // The customer does not choose the evidence backend, and the split says so.
    expect(screen.getByText(/Choosing is our job/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /The pipeline owns the verdict/i })).toBeInTheDocument();
    expect(screen.getByText(/including the decision to abstain/i)).toBeInTheDocument();

    // Unknown states fail closed rather than defaulting to a pass.
    expect(screen.getAllByText(/Unknown states fail closed/i).length).toBeGreaterThan(0);

    expect(
      screen.getAllByRole("link", { name: /Request a Task Evaluation Run/i })[0],
    ).toHaveAttribute("href", expect.stringContaining("/contact/robot-team"));
    expect(screen.queryByText(/Policy Improvement Run/i)).not.toBeInTheDocument();
  });
});
