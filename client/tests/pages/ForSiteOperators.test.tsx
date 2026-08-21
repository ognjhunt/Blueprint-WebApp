import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ForSiteOperators from "@/pages/ForSiteOperators";

describe("ForSiteOperators", () => {
  it("explains one-time task submission, controlled access, and the OEM handoff", () => {
    render(<ForSiteOperators />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Explain the job once\. Let robot teams test it before they visit/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Show the job\. Set the rules\. Review the fit/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Stop rebuilding the same opportunity for every vendor/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Robot teams learn more only when the opportunity earns it/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/site model stays hosted by Blueprint/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /robot provider still owns onsite deployment/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /Submit a site task/i })[0],
    ).toHaveAttribute(
      "href",
      expect.stringContaining("intent=pilot-opportunity"),
    );
  });
});
