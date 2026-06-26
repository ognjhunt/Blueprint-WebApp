import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ReadinessPack from "@/pages/ReadinessPack";

describe("ReadinessPack", () => {
  it("renders a visual humanoid readiness page with bounded claims", () => {
    render(<ReadinessPack />);

    expect(screen.getByText(/Humanoid eval cards.*one real site\./i)).toBeInTheDocument();

    expect(
      screen.getByText(/Less prose\. More proof state\./i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Humanoid task lanes/i)).toBeInTheDocument();
    expect(screen.getByText(/What must be proven\./i)).toBeInTheDocument();

    expect(
      screen
        .getAllByRole("img")
        .some((image) =>
          image
            .getAttribute("src")
            ?.includes("/generated/humanoid-readiness-2026-06-03/humanoid-warehouse-readiness-hero.png"),
        ),
    ).toBe(true);
    expect(
      screen.getByAltText(/Hosted readiness dashboard showing route/i),
    ).toHaveAttribute(
      "src",
      expect.stringContaining("humanoid-hosted-readiness-dashboard.png"),
    );
    expect(
      screen.getByAltText(/Humanoid generated-world rank fidelity proof board/i),
    ).toHaveAttribute(
      "src",
      expect.stringContaining("humanoid-proof-board.png"),
    );

    expect(
      screen.getByText(/No deployment verdict without robot trials/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Requests do not charge, clear rights/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Action logs/i).length).toBeGreaterThan(1);
    expect(screen.getAllByText(/Robot trial/i).length).toBeGreaterThan(0);

    expect(
      screen
        .getAllByRole("link", { name: /Request eval dataset/i })
        .some((link) =>
          link.getAttribute("href")?.includes("source=readiness-hero"),
        ),
    ).toBe(true);
    expect(
      screen.queryByText(/The deliverable is a readiness packet/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        /Estimate site\/task fit before the expensive pilot/i,
      ),
    ).not.toBeInTheDocument();
  });
});
