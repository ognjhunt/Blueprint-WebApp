import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/pages/Home";

describe("Home", () => {
  it("renders the simplified buyer story and primary request path", () => {
    const { container } = render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Know what breaks before the robot pilot\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/one real facility, one robot task, and one pass bar/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Success rate$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Cycle time$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Intervention rate$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Safety threshold$/i)).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /Request readiness review/i })[0],
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
        name: /A readiness answer for one site, not a giant marketplace\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Site\/task readiness report/i })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: /Hosted evaluation/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /Three ways to start\./i })).toBeInTheDocument();
    expect(screen.getByText(/\$2,100 - \$3,400/i)).toBeInTheDocument();
    expect(screen.getByText(/\$16 - \$29 \/ session-hour/i)).toBeInTheDocument();
    expect(screen.getByText(/\$50,000\+ scoped/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Public samples show the product shape\. Request packets prove one site\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Generated imagery on the public site is illustrative/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Operational Launch Ready claims still require proof/i),
    ).toBeInTheDocument();
  });
});
