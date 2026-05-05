import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import BookExactSiteReview from "@/pages/BookExactSiteReview";

describe("BookExactSiteReview", () => {
  it("renders a dedicated scoping-call path with external scheduling and fallback contact options", () => {
    render(<BookExactSiteReview />);

    expect(
      screen.getByRole("heading", { name: /Book an exact-site scoping call\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Use this page when one real site, one workflow, and one deployment question are ready for a focused scoping pass\./i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open scheduling/i })).toHaveAttribute(
      "href",
      "https://calendly.com/blueprintar/30min",
    );
    expect(screen.getByRole("link", { name: /What a good scoping call resolves/i })).toHaveAttribute(
      "href",
      "/exact-site-hosted-review",
    );
  });
});
