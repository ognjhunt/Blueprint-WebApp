import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Pricing from "@/pages/Pricing";

describe("Pricing", () => {
  it("renders the subscription-first robot-team pricing ladder", () => {
    render(<Pricing />);

    expect(
      screen.getByRole("heading", {
        name: /Priced as evaluation infrastructure\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Robot-team subscription$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Quick-look eval$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Site supply$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Site monitoring$/i })).toBeInTheDocument();
    expect(screen.getByText(/^\$15k$/i)).toBeInTheDocument();
    expect(screen.getByText(/^\/ mo$/i)).toBeInTheDocument();
    expect(screen.getByText(/^\$5–8k$/i)).toBeInTheDocument();
    expect(screen.getByText(/^\/ eval$/i)).toBeInTheDocument();
    expect(screen.getByText(/^\$5k$/i)).toBeInTheDocument();
    expect(screen.getByText(/^\/ site$/i)).toBeInTheDocument();
    expect(screen.getByText(/^\$30–40k$/i)).toBeInTheDocument();
    expect(screen.getByText(/^\/ site \/ yr$/i)).toBeInTheDocument();
    expect(screen.getByText(/Overage pricing above the cap/i)).toBeInTheDocument();
    expect(screen.getByText(/^Ranking-only report$/i)).toBeInTheDocument();
    expect(screen.getByText(/Failure taxonomy and calibration stay in subscription scope\./i)).toBeInTheDocument();
    expect(screen.getByText(/Multiple scoped checks up to annual cap/i)).toBeInTheDocument();
    expect(screen.getByText(/Monitoring is a separate, recurring option\./i)).toBeInTheDocument();
    expect(
      screen.getByText(/not a deployment-ready claim or a\s+guarantee of field success/i),
    ).toBeInTheDocument();
    // Site-operator tiers must land on the site-operator intake form, not the
    // generic /contact redirect (which routes to the robot-team form).
    expect(screen.getByRole("link", { name: /Start a site review/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/contact/site-operator"),
    );
    expect(screen.getByRole("link", { name: /Discuss monitoring/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/contact/site-operator"),
    );
    expect(screen.queryByText(/Site Data Package/i)).not.toBeInTheDocument();
  });
});
