import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Pricing from "@/pages/Pricing";

describe("Pricing", () => {
  it("renders the simple policy evaluation package ladder", () => {
    render(<Pricing />);

    expect(
      screen.getByRole("heading", {
        name: /Pick a run\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Test policies$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Validate with robot$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Improve policy$/i })).toBeInTheDocument();
    expect(screen.getByText(/Policy Evaluation Run/i)).toBeInTheDocument();
    expect(screen.getByText(/Validated Evaluation Pack/i)).toBeInTheDocument();
    expect(screen.getByText(/Policy Improvement Run/i)).toBeInTheDocument();
    expect(screen.getByText(/100 episodes/i)).toBeInTheDocument();
    expect(screen.getByText(/500 episodes/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Real rollouts/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Confidence bounds/i)).toBeInTheDocument();
    expect(screen.getByText(/Virtual results do not approve deployment or safety/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Submit site/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/contact/site-operator"),
    );
    expect(screen.queryByText(/Site Data Package/i)).not.toBeInTheDocument();
  });
});
