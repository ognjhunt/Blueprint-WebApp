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
        /Use this path when your team already has a real facility or listing in mind and wants to confirm whether Blueprint package access, hosted evaluation, or a custom scope makes the most sense\./i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open scheduling/i })).toHaveAttribute(
      "href",
      "https://calendly.com/blueprintar/30min",
    );
    expect(screen.getByRole("link", { name: /Send a written brief instead/i })).toHaveAttribute(
      "href",
      "/contact?persona=robot-team&interest=evaluation-package",
    );
  });
});
