import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ForSiteOperators from "@/pages/ForSiteOperators";

describe("ForSiteOperators", () => {
  it("renders the Robot Match site-operator offering", () => {
    render(<ForSiteOperators />);

    expect(screen.getAllByText(/For Site Operators/i).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", {
        name: /Find the robot teams worth piloting\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /From a workflow to a short, credible pilot list\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Site-task brief$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Qualify a candidate pool$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Shortlist & pilot brief$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Your site stays yours\./i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /One campaign\. \$5,000\. A shortlist you can pilot\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^\$5,000$/)).toBeInTheDocument();

    const matchLinks = screen.getAllByRole("link", {
      name: /Find robot teams for my site/i,
    });
    expect(matchLinks.length).toBeGreaterThan(0);
    matchLinks.forEach((link) => {
      expect(link).toHaveAttribute(
        "href",
        expect.stringContaining("/contact/site-operator"),
      );
    });

    // The retired supply-review / monitoring model is gone.
    expect(screen.queryByText(/Site monitoring/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$30–40k/)).not.toBeInTheDocument();
  });
});
