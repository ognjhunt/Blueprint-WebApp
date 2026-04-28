import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ExactSiteHostedReview from "@/pages/ExactSiteHostedReview";

describe("ExactSiteHostedReview", () => {
  it("renders the simplified hosted-review product page", () => {
    render(<ExactSiteHostedReview />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Review before you buy\./i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /Hosted evaluation of one exact-site world model\. See how the robot perceives, plans, and acts inside the selected place before your team commits\./i,
      ),
    ).toBeInTheDocument();

    expect(screen.getAllByText(/^Hosted evaluation workspace$/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /Setup, run evidence, and export scope are visible\./i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /A hosted review can start from a public-facing place\./i })).toBeInTheDocument();
    expect(screen.getByText(/Example sample, not a customer result/i)).toBeInTheDocument();
    expect(screen.getByText(/Run evidence example/i)).toBeInTheDocument();
    expect(screen.getByText(/Export evidence/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What happens in a hosted review\./i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /What this path is good for and what it does not claim\./i,
      }),
    ).toBeInTheDocument();

    expect(
      screen
	        .getAllByRole("link", { name: /Inspect sample review/i })
	        .some((link) => link.getAttribute("href") === "/sample-evaluation"),
    ).toBe(true);
    expect(screen.getByRole("link", { name: /Open sample report/i })).toHaveAttribute(
      "href",
      "/samples/sample-hosted-review-report.md",
    );
    expect(
      screen
	        .getAllByRole("link", { name: /Request capture/i })
	        .some(
	          (link) =>
	            link.getAttribute("href")
	            === "/contact?persona=robot-team&buyerType=robot_team&interest=evaluation-package&path=request-capture&source=hosted-review",
	        ),
    ).toBe(true);

    expect(screen.queryByRole("heading", { name: /Hosted integration contract/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /What happens after inquiry/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /What Blueprint runs and returns/i })).not.toBeInTheDocument();
  });
});
