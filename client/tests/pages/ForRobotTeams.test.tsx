import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ForRobotTeams from "@/pages/ForRobotTeams";

describe("ForRobotTeams", () => {
  it("offers both request-led and API-backed site-record entry paths", () => {
    render(<ForRobotTeams />);

    expect(
      screen.getByRole("heading", { name: /Rank robot policies on real sites before field time/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Request evaluation/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Configure policy inputs/i })).toHaveAttribute(
      "href",
      "/robot-team/eval",
    );
    const siteLinks = screen.getAllByRole("link", { name: /Browse site records/i });
    expect(siteLinks.length).toBeGreaterThan(0);
    for (const link of siteLinks) {
      expect(link).toHaveAttribute("href", "/sites");
    }
  });
});
