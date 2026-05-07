import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import BookExactSiteReview from "@/pages/BookExactSiteReview";

describe("BookExactSiteReview", () => {
  it("renders structured intake as the primary path with scheduling secondary", () => {
    render(<BookExactSiteReview />);

    expect(
      screen.getByRole("heading", { name: /Start with exact-site intake\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Submit the site context first; book only when the scope is concrete enough for a focused call\./i,
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Submit site review intake/i })[0]).toHaveAttribute(
      "href",
      expect.stringContaining("/contact?persona=robot-team"),
    );
    expect(screen.getByRole("link", { name: /Open scheduling/i })).toHaveAttribute(
      "href",
      "https://calendly.com/blueprintar/30min",
    );
    expect(screen.getByRole("link", { name: /Book only if scope is concrete/i })).toHaveAttribute(
      "href",
      "https://calendly.com/blueprintar/30min",
    );
  });
});
