import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ExactSiteHostedReview from "@/pages/ExactSiteHostedReview";

describe("ExactSiteHostedReview", () => {
  it("renders the simplified hosted-review product page", () => {
    render(<ExactSiteHostedReview />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Run one exact site before your team travels\./i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /Blueprint hosts the review, keeps it tied to the same capture-backed package, and returns the run evidence your team needs to decide the next move\./i,
      ),
    ).toBeInTheDocument();

    expect(screen.getAllByText(/^One exact site$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Capture-backed hosted path$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Package or hosted next step$/i).length).toBeGreaterThan(0);

    expect(screen.getAllByText(/Illustrative product preview/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /What your team brings/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What comes back/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What stays explicit/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Choose the next step for this site\./i,
      }),
    ).toBeInTheDocument();

    expect(
      screen
        .getAllByRole("link", { name: /See sample deliverables/i })
        .some((link) => link.getAttribute("href") === "/sample-deliverables"),
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: /Scope hosted review/i })
        .some(
          (link) =>
            link.getAttribute("href")
            === "/contact?persona=robot-team&buyerType=robot_team&interest=evaluation-package",
        ),
    ).toBe(true);

    expect(screen.queryByRole("heading", { name: /Hosted integration contract/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /What happens after inquiry/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /What Blueprint runs and returns/i })).not.toBeInTheDocument();
  });
});
