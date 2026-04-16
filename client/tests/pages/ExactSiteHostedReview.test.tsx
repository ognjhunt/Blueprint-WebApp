import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ExactSiteHostedReview from "@/pages/ExactSiteHostedReview";

describe("ExactSiteHostedReview", () => {
  it("behaves like a real hosted-evaluation product page", () => {
    render(<ExactSiteHostedReview />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Run the exact site before your robot team travels\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What your team provides/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What Blueprint runs and returns/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /How the hosted loop works/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What happens after inquiry/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Illustrative product preview/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /See a sample hosted flow/i })).toHaveAttribute(
      "href",
      "/sample-deliverables",
    );
    expect(screen.getByRole("link", { name: /Scope hosted evaluation/i })).toHaveAttribute(
      "href",
      "/contact?persona=robot-team&buyerType=robot_team&interest=evaluation-package",
    );
  });
});
