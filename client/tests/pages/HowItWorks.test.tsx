import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HowItWorks from "@/pages/HowItWorks";

describe("HowItWorks", () => {
  it("shows decision-oriented intake, routing owned by the pipeline, abstention, and the next experiment", () => {
    const { container } = render(<HowItWorks />);
    expect(
      screen.getByRole("heading", { level: 1, name: /Walk the site\. We build the benchmark\. You get the decision\./i }),
    ).toBeInTheDocument();

    // The walkthrough is now the run film. Its acts carry the same beats the
    // stepped prose list used to: the decision, per-claim routing, the answer
    // with its edges, and the next cheapest test.
    expect(container).toHaveTextContent(/The actual call, the threshold it turns on/i);
    expect(container).toHaveTextContent(/The decision splits into claims/i);
    expect(container).toHaveTextContent(/the smallest gap this run could separate/i);
    expect(container).toHaveTextContent(/Next test/i);

    // The customer does not choose the evidence backend, and the film says so.
    expect(container).toHaveTextContent(/You never pick the method — that is our job/i);
    expect(screen.getByRole("heading", { name: /The pipeline owns the verdict/i })).toBeInTheDocument();
    expect(
      screen.getByText(/The ranking, its margin, and anything the evidence could not separate/i),
    ).toBeInTheDocument();

    // Unknown states fail closed rather than defaulting to a pass.
    expect(screen.getAllByText(/Unknown states fail closed/i).length).toBeGreaterThan(0);

    // The two things a run never grants, stated on the page.
    expect(container).toHaveTextContent(/Deployment approval/i);
    expect(container).toHaveTextContent(/Safety certification/i);

    expect(
      screen.getAllByRole("link", { name: /Scope a benchmark/i })[0],
    ).toHaveAttribute("href", expect.stringContaining("/contact/robot-team"));
    expect(screen.queryByText(/Policy Improvement Run/i)).not.toBeInTheDocument();
  });
});
