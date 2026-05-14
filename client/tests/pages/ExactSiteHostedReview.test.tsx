import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ExactSiteHostedReview from "@/pages/ExactSiteHostedReview";

describe("ExactSiteHostedReview", () => {
  it("renders the product page as a buyer workflow from capture to decision", () => {
    render(<ExactSiteHostedReview />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Turn the exact site into a decision-ready world model\./i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /Blueprint packages real capture, world-model output, hosted evaluation, and buyer proof around one site/i,
      ),
    ).toBeInTheDocument();

    expect(screen.getAllByText(/^Exact-site capture$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^World model package$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Hosted evaluation$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Buyer decision$/i).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", {
        name: /The sellable product is the site package, not a detached demo\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Representative product evidence, not a customer result/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /A buyer room for runs, limits, and next-step calls\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Approve a scoped export/i)).toBeInTheDocument();
    expect(screen.getByText(/Package preview/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Commercially confident, proof honest\./i,
      }),
    ).toBeInTheDocument();

    expect(
      screen
        .getAllByRole("link", { name: /Inspect sample proof/i })
        .some((link) => link.getAttribute("href") === "/proof"),
    ).toBe(true);
    expect(screen.getByRole("link", { name: /Open sample report/i })).toHaveAttribute(
      "href",
      "/samples/sample-hosted-review-report.md",
    );
    expect(
      screen
        .getAllByRole("link", { name: /Request evaluation/i })
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
