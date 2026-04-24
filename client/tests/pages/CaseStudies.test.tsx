import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import CaseStudies from "@/pages/CaseStudies";

describe("CaseStudies", () => {
  it("presents public capture examples instead of internal proof notes", () => {
    render(<CaseStudies />);

    expect(screen.getByRole("heading", { name: /Complete stories, clearly marked as composite\./i })).toBeInTheDocument();
    expect(screen.getByText(/Launch-ready placeholder studies for grocery, retail, lobby, and common-area routes/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Example public capture/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Composite placeholder/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Cedar Market Aisle Loop/i)).toBeInTheDocument();
    expect(screen.getByText(/Composite outcome board/i)).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: /Inspect sample listing/i })
        .some((link) => link.getAttribute("href") === "/world-models/siteworld-f5fd54898cfb"),
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: /Open capture app/i })
        .some((link) => link.getAttribute("href") === "/capture-app"),
    ).toBe(true);
  });
});
