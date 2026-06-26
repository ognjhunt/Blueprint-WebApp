import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ExactSiteHostedReview from "@/pages/ExactSiteHostedReview";

describe("ExactSiteHostedReview", () => {
  it("renders the product page as a buyer workflow from capture to decision", () => {
    render(<ExactSiteHostedReview />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Turn the exact site into a rank-fidelity report\./i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /Blueprint packages indoor capture, task suites, robot profiles, generated support assets, hosted review, and buyer proof around one site/i,
      ),
    ).toBeInTheDocument();

    expect(screen.getAllByText(/^Indoor site capture$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Readiness report and pilot protocol$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Hosted evaluation$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Proceed to short-pilot protocol$/i).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", {
        name: /The site package is the substrate, not a detached demo\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Representative product evidence, not a customer result/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /A buyer room for readiness evidence, limits, and next steps\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Proceed to short-pilot protocol/i)).toBeInTheDocument();
    expect(screen.getByText(/Package preview/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Commercially confident, verdicts evidence-gated\./i,
      }),
    ).toBeInTheDocument();

    expect(screen.getAllByRole("link", { name: /Inspect proof/i })[0]).toHaveAttribute("href", "/proof");
    expect(screen.getByRole("link", { name: /Inspect sample package/i })).toHaveAttribute(
      "href",
      "/sample-deliverables",
    );
    expect(screen.getByRole("link", { name: /Open raw sample report/i })).toHaveAttribute(
      "href",
      "/samples/sample-hosted-review-report.md",
    );
    expect(
      screen
        .getAllByRole("link", { name: /Request evaluation/i })
        .some(
          (link) =>
            link.getAttribute("href")
            === "/contact?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=hosted-evaluation&source=product-bottom",
        ),
    ).toBe(true);

    expect(screen.queryByRole("heading", { name: /Hosted integration contract/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /What happens after inquiry/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /What Blueprint runs and returns/i })).not.toBeInTheDocument();
  });
});
