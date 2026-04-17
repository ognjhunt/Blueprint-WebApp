import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import CaseStudies from "@/pages/CaseStudies";

describe("CaseStudies", () => {
  it("presents anonymized proof stories instead of generic examples", () => {
    render(<CaseStudies />);

    expect(screen.getByRole("heading", { name: /Anonymized deployment-decision stories\./i })).toBeInTheDocument();
    expect(screen.getByText(/These are anonymized proof stories/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Anonymized proof story/i).length).toBeGreaterThan(0);
    expect(
      screen
        .getAllByRole("link", { name: /Inspect the sample listing/i })
        .some((link) => link.getAttribute("href") === "/world-models/siteworld-f5fd54898cfb"),
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: /Scope your site/i })
        .some((link) => link.getAttribute("href") === "/contact?persona=robot-team"),
    ).toBe(true);
  });
});
