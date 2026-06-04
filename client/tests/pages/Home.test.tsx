import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/pages/Home";

describe("Home", () => {
  it("renders the simplified buyer story and primary request path", () => {
    const { container } = render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Evaluate robots on real sites before deployment\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Test policies and scenarios against capture-backed sites/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Success rate$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Cycle time$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Intervention rate$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Safety threshold$/i)).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /Request evaluation/i })[0],
    ).toHaveAttribute("href", expect.stringContaining("/contact?persona=robot-team"));
    expect(
      Array.from(container.querySelectorAll("[data-home-section]")).map((node) =>
        node.getAttribute("data-home-section"),
      ),
    ).toEqual(["hero", "offer", "how-it-works", "pricing", "proof", "request"]);
  });

  it("keeps offer, pricing, and proof boundaries visible on one page", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        name: /Real-site evaluations for robot teams\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: /Policy Evaluation Set/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: /Site Data Package/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /Two paid robot-team products\. Operators are free\./i })).toBeInTheDocument();
    expect(screen.getByText(/From \$6,500 \/ Policy Evaluation Run/i)).toBeInTheDocument();
    expect(screen.getByText(/\$3,500\+ \/ site package/i)).toBeInTheDocument();
    expect(screen.getByText(/^Free$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Public samples show the workflow\. Request packets prove one site\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Generated imagery on the public site is illustrative/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Operational Launch Ready claims still require proof/i),
    ).toBeInTheDocument();
  });
});
