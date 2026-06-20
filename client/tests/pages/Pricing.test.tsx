import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Pricing from "@/pages/Pricing";

describe("Pricing", () => {
  it("renders the simple policy evaluation package ladder", () => {
    render(<Pricing />);

    expect(
      screen.getByRole("heading", {
        name: /Simple packages for robot policy evaluation\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Policy Evaluation Run$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Validated Evaluation Pack$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Policy Improvement Run$/i })).toBeInTheDocument();
    expect(screen.getByText(/From \$6,500 \/ run/i)).toBeInTheDocument();
    expect(screen.getByText(/100 or 500 virtual episodes/i)).toBeInTheDocument();
    expect(screen.getByText(/Pearson\/Spearman or rank-fidelity/i)).toBeInTheDocument();
    expect(screen.getByText(/Virtual results do not guarantee real-world success/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Submit site free/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/contact/site-operator"),
    );
    expect(screen.queryByText(/Site Data Package/i)).not.toBeInTheDocument();
  });
});
