import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketSignalsSection } from "@/components/site/MarketSignalsSection";

describe("MarketSignalsSection", () => {
  it("renders the humanoid evidence cards, takeaway, and sources", () => {
    render(<MarketSignalsSection />);

    expect(
      screen.getByRole("heading", {
        name: /Humanoid programs are scaling faster than sites are getting ready\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Why Blueprint exists/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Humanoids do not fail because the demo was fake\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Market trajectory/i)).toBeInTheDocument();
    expect(screen.getAllByText(/RoboFab opens/i)).toHaveLength(2);
    expect(screen.getAllByText(/Tesla line start/i)).toHaveLength(2);
    expect(screen.getByText(/Home demo/i)).toBeInTheDocument();
    expect(screen.getByText(/Live workflow/i)).toBeInTheDocument();
    expect(screen.getByText(/Volume signal/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Watch demo/i })).toHaveAttribute(
      "href",
      "https://www.figure.ai/news/helix-02-living-room-tidy",
    );
    expect(screen.getAllByRole("link", { name: /Read source/i })).toHaveLength(1);
    expect(screen.getByRole("link", { name: /Read Tesla update/i })).toHaveAttribute(
      "href",
      "https://ir.tesla.com/_flysystem/s3/sec/000162828026003837/tsla-20260128-gen.pdf",
    );
    expect(screen.getByText(/Humanoid supply is starting to move\./i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Figure at BMW Spartanburg/i })).toHaveAttribute(
      "href",
      "https://www.figure.ai/news/production-at-bmw",
    );
    expect(screen.getByRole("link", { name: /Tesla Q4 2025 update/i })).toHaveAttribute(
      "href",
      "https://ir.tesla.com/_flysystem/s3/sec/000162828026003837/tsla-20260128-gen.pdf",
    );
  });

  it("honors custom eyebrow, title, and description overrides", () => {
    render(
      <MarketSignalsSection
        eyebrow="Why This Matters"
        title="Why pre-deployment qualification matters more in humanoids"
        description="Broad robotics already has scale. Humanoid programs are attracting capital faster than they are producing reliable, repeatable rollouts."
      />,
    );

    expect(screen.getByText(/Why This Matters/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Why pre-deployment qualification matters more in humanoids/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Broad robotics already has scale\. Humanoid programs are attracting capital faster than they are producing reliable, repeatable rollouts\./i,
      ),
    ).toBeInTheDocument();
  });
});
