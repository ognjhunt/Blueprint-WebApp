import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Pricing from "@/pages/Pricing";

describe("Pricing", () => {
  it("renders the subscription-first robot-team pricing ladder", () => {
    render(<Pricing />);

    expect(
      screen.getByRole("heading", {
        name: /Evaluation infrastructure, not one-off tax\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Robot team subscription$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Lite quick-look eval$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Site supply review$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Site monitoring subscription$/i })).toBeInTheDocument();
    expect(screen.getByText(/\$15,000 \/ month/i)).toBeInTheDocument();
    expect(screen.getByText(/\$5,000-\$8,000 \/ eval/i)).toBeInTheDocument();
    expect(screen.getByText(/\$5,000 \/ site/i)).toBeInTheDocument();
    expect(screen.getByText(/\$30,000-\$40,000 \/ site \/ year/i)).toBeInTheDocument();
    expect(screen.getByText(/Overage pricing above the cap/i)).toBeInTheDocument();
    expect(screen.getByText(/Ranking-only report; no failure taxonomy or calibration/i)).toBeInTheDocument();
    expect(screen.getByText(/Multiple policy-update checks up to agreed annual cap/i)).toBeInTheDocument();
    expect(screen.getByText(/Site review is one-time; monitoring is recurring/i)).toBeInTheDocument();
    expect(screen.getByText(/Virtual results do not approve deployment or safety/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Start site review/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/contact/site-operator"),
    );
    expect(screen.queryByText(/Site Data Package/i)).not.toBeInTheDocument();
  });
});
