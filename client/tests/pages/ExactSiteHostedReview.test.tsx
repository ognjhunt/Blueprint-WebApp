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
    expect(screen.getByText(/What your team provides/i)).toBeInTheDocument();
    expect(screen.getByText(/What Blueprint runs and returns/i)).toBeInTheDocument();
    expect(screen.getByText(/How the hosted loop works/i)).toBeInTheDocument();
    expect(screen.getByText(/What happens after inquiry/i)).toBeInTheDocument();
    expect(screen.getByText(/Illustrative product preview/i)).toBeInTheDocument();
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

