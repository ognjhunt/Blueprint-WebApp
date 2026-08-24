import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ForSiteOperators from "@/pages/ForSiteOperators";

describe("ForSiteOperators", () => {
  it("frames submission as queue position and keeps the access ladder visible", () => {
    render(<ForSiteOperators />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Robot-ready sites get robots first/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Show the job\. Set the rules\. Review the fit/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Robot capacity is allocated, not just sold/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Teams learn more only when the opportunity earns it/i,
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
    ).toHaveAttribute("href", expect.stringContaining("intent=pilot-opportunity"));
  });
});
