import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketSignalsSection } from "@/components/site/MarketSignalsSection";

describe("MarketSignalsSection", () => {
  it("renders the humanoid evidence cards, takeaway, and sources", () => {
    render(<MarketSignalsSection />);

    expect(
      screen.getByRole("heading", {
        name: /Humanoids look good in controlled spaces\. Deployment still breaks at the site\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Home demo/i)).toBeInTheDocument();
    expect(screen.getByText(/Live workflow/i)).toBeInTheDocument();
    expect(screen.getByText(/Scale bottleneck/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Watch demo/i })).toHaveAttribute(
      "href",
      "https://www.figure.ai/news/helix-02-living-room-tidy",
    );
    expect(screen.getAllByRole("link", { name: /Read source/i })).toHaveLength(2);
    expect(screen.getByText(/If AI only worked on benchmark prompts/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /BMW x Figure pilot/i })).toHaveAttribute(
      "href",
      "https://www.bmwgroup.com/en/news/general/2024/Figure.html",
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
