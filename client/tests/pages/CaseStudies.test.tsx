import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import CaseStudies from "@/pages/CaseStudies";

describe("CaseStudies", () => {
  it("presents anonymized proof stories instead of generic examples", () => {
    render(<CaseStudies />);

    expect(screen.getByRole("heading", { name: /Everyday places, made inspectable\./i })).toBeInTheDocument();
    expect(screen.getByText(/Composite stories showing how grocery, retail, lobby, and common-area captures/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Composite public-capture story/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Cedar Market Aisle Loop/i)).toBeInTheDocument();
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
