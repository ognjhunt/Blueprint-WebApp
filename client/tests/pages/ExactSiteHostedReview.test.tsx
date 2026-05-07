import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ExactSiteHostedReview from "@/pages/ExactSiteHostedReview";

describe("ExactSiteHostedReview", () => {
  it("renders the simplified hosted-review product page", () => {
    render(<ExactSiteHostedReview />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /One real place, packaged for robot evaluation\./i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /Blueprint starts with real capture of a facility or public-facing place/i,
      ),
    ).toBeInTheDocument();

    expect(screen.getAllByText(/^Site package$/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Review: routes, observations, exports/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Hosted review sits between listing and commitment\./i })).toBeInTheDocument();
    expect(screen.getByText(/Example sample, not a customer result/i)).toBeInTheDocument();
    expect(screen.getByText(/Run evidence example/i)).toBeInTheDocument();
    expect(screen.getByText(/Export evidence/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What leaves the session\./i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /What this path is good for and what it does not claim\./i,
      }),
    ).toBeInTheDocument();

    expect(
      screen
        .getAllByRole("link", { name: /Inspect proof/i })
        .some((link) => link.getAttribute("href") === "/proof"),
    ).toBe(true);
    expect(screen.getByRole("link", { name: /Open sample report/i })).toHaveAttribute(
      "href",
      "/samples/sample-hosted-review-report.md",
    );
    expect(
      screen
	        .getAllByRole("link", { name: /Request site review/i })
	        .some(
	          (link) =>
	            link.getAttribute("href")
	            === "/contact?persona=robot-team&buyerType=robot_team&interest=evaluation-package&path=hosted-evaluation&source=product-bottom",
	        ),
    ).toBe(true);

    expect(screen.queryByRole("heading", { name: /Hosted integration contract/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /What happens after inquiry/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /What Blueprint runs and returns/i })).not.toBeInTheDocument();
  });
});
