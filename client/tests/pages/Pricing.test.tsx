import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Pricing from "@/pages/Pricing";

describe("Pricing", () => {
  it("renders the three public planning ranges", () => {
    render(<Pricing />);

    expect(
      screen.getByRole("heading", {
        name: /Price the readiness question before the pilot\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Site\/Task Readiness Review$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Hosted Evaluation$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Custom Multi-Site Benchmark$/i })).toBeInTheDocument();
    expect(screen.getByText(/\$2,100 - \$3,400/i)).toBeInTheDocument();
    expect(screen.getByText(/\$16 - \$29 \/ session-hour/i)).toBeInTheDocument();
    expect(screen.getByText(/\$50,000\+ scoped/i)).toBeInTheDocument();
  });

  it("keeps buyer choice and pricing claim boundaries explicit", () => {
    render(<Pricing />);

    expect(
      screen.getByRole("heading", { name: /Start with the decision that blocks field time\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Choose readiness review first/i)).toBeInTheDocument();
    expect(screen.getByText(/Choose hosted evaluation first/i)).toBeInTheDocument();
    expect(screen.getByText(/Choose custom benchmark first/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /A request is not a payment/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Public ranges help buyers plan/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Request hosted evaluation/i }),
    ).toHaveAttribute("href", expect.stringContaining("interest=hosted-evaluation"));
  });
});
