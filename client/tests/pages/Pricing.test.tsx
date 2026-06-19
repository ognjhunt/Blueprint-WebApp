import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Pricing from "@/pages/Pricing";

describe("Pricing", () => {
  it("renders the two robot-team products", () => {
    render(<Pricing />);

    expect(
      screen.getByRole("heading", {
        name: /Simple pricing for real-site robot evaluation\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Task Evaluation Run$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Policy Improvement Run$/i })).toBeInTheDocument();
    expect(screen.getByText(/From \$6,500 \/ run/i)).toBeInTheDocument();
    expect(
      screen.getByText(/One Task Evaluation Run = 1 site × 1 robot policy\/profile × 1 Task Pack × up to 500 scenarios\./i),
    ).toBeInTheDocument();
    expect(screen.getByText(/From \$35,000 \/ run/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Source access is optional\./i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Black-box evaluation/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Closed-stack improvement support/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Actual improved artifact/i })).toBeInTheDocument();
    expect(screen.getByText(/No source code required/i)).toBeInTheDocument();
    expect(screen.getByText(/requires either a trainable interface or a customer-approved wrapper\/adapter path/i)).toBeInTheDocument();
    expect(screen.queryByText(/Policy Evaluation Set/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Site Data Package/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$3,500\+ \/ site package/i)).not.toBeInTheDocument();
  });

  it("keeps task-pack, free-operator, and evidence boundaries explicit", () => {
    render(<Pricing />);

    expect(
      screen.getByRole("heading", { name: /A Task Pack is one job the robot needs to perform/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Example: Tote Transfer Task Pack/i)).toBeInTheDocument();
    expect(screen.getByText(/A common bundle is 3 Task Evaluation Runs/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Site operators submit sites free\./i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Evaluation output is advisory\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Evaluation and improvement outputs stay scoped to simulator traces/i)).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /Request Task Evaluation Run/i })[0],
    ).toHaveAttribute("href", expect.stringContaining("interest=hosted-evaluation"));
    expect(
      screen.getAllByRole("link", { name: /Request Policy Improvement/i })[0],
    ).toHaveAttribute("href", expect.stringContaining("requestedOutputs=Policy%20Improvement%20Run"));
    expect(
      screen.getAllByRole("link", { name: /Request Policy Improvement/i })[0],
    ).toHaveAttribute("href", expect.stringContaining("path=policy-improvement-run"));
    expect(
      screen.getByRole("link", { name: /Submit site free/i }),
    ).toHaveAttribute("href", expect.stringContaining("/contact/site-operator"));
    expect(
      screen.getByRole("link", { name: /See proof details/i }),
    ).toHaveAttribute("href", "/proof");
  });
});
