import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ForSiteOperators from "@/pages/ForSiteOperators";

describe("ForSiteOperators", () => {
  it("frames submission as queue position and keeps the access ladder visible", () => {
    render(<ForSiteOperators />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Show us the job\. We find the robot that can do it/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Show the job\. Set the rules\. See who fits/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Robot teams see more only as they earn it/i,
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
      screen.getAllByRole("link", { name: /Submit a job/i })[0],
    ).toHaveAttribute("href", expect.stringContaining("intent=pilot-opportunity"));
  });
});
