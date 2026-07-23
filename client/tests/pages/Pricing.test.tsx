import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Pricing from "@/pages/Pricing";

describe("Pricing", () => {
  it("renders the two-campaign shortlist pricing model", () => {
    render(<Pricing />);

    expect(
      screen.getByRole("heading", {
        name: /Priced per campaign, not per seat\./i,
      }),
    ).toBeInTheDocument();

    // The two — and only two — campaigns.
    expect(screen.getByRole("heading", { name: /^Policy Shortlist$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Robot Match$/i })).toBeInTheDocument();
    expect(screen.getByText(/^\$3,000$/)).toBeInTheDocument();
    expect(screen.getByText(/^\$5,000$/)).toBeInTheDocument();
    expect(screen.getAllByText(/^\/ campaign$/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Up to five policies or checkpoints/i)).toBeInTheDocument();
    expect(screen.getByText(/Up to five qualified robot teams/i)).toBeInTheDocument();
    expect(screen.getByText(/Onsite pilot recommendation/i)).toBeInTheDocument();

    // Participation paths for robot teams entering a Robot Match.
    expect(screen.getByRole("heading", { name: /^Sponsored participation$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Open-benchmark submission$/i })).toBeInTheDocument();
    expect(screen.getAllByText(/\$250–500/).length).toBeGreaterThan(0);
    expect(screen.getByText(/placement is never pay-to-play/i)).toBeInTheDocument();

    // Ranking honesty — no manufactured winner.
    expect(screen.getByText(/^Shortlisted$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Insufficient evidence$/i)).toBeInTheDocument();
    expect(screen.getAllByText(/never\s+manufactures a winner/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/better pilot decision, not a deployment\s+guarantee/i)).toBeInTheDocument();

    // CTAs land on the correct persona intake.
    const rankLinks = screen.getAllByRole("link", { name: /Rank my policies/i });
    expect(rankLinks[0]).toHaveAttribute(
      "href",
      expect.stringContaining("/contact/robot-team"),
    );
    const matchLinks = screen.getAllByRole("link", { name: /Find robot teams for my site/i });
    expect(matchLinks[0]).toHaveAttribute(
      "href",
      expect.stringContaining("/contact/site-operator"),
    );

    // The retired subscription / supply-review / monitoring model is gone.
    expect(screen.queryByText(/Quick-look/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Robot-team subscription/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Site monitoring/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^\$15k$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Site Data Package/i)).not.toBeInTheDocument();
  });
});
