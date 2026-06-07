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
      screen.getByText(/Blueprint turns captured facilities into robot task packs/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Choose the integration mode/i })).toBeInTheDocument();
    expect(screen.getByText(/policy API, container, private-cloud run, action trace/i)).toBeInTheDocument();
    expect(
      screen.getByAltText(/humanoid robot in a warehouse evaluation bay/i),
    ).toHaveAttribute(
      "src",
      "/editorial/2026-06-06/robot-team-eval-workflow.png",
    );
    expect(screen.getByText(/^Success rate$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Cycle time$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Intervention rate$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Safety threshold$/i)).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /Request evaluation/i })[0],
    ).toHaveAttribute("href", expect.stringContaining("/contact/robot-team?persona=robot-team"));
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
        name: /Two robot-team products\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: /Task Evaluation Run/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: /Post-Training Data Package/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /Two paid robot-team products\. Site operators submit free\./i })).toBeInTheDocument();
    expect(screen.getByText(/From \$6,500 \/ run/i)).toBeInTheDocument();
    expect(screen.getByText(/From \$25,000\+/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Site operators submit sites free\./i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Public examples show the workflow shape\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Evaluation output remains advisory until supported by simulator traces/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Site Data Package/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$3,500\+ \/ site package/i)).not.toBeInTheDocument();
  });
});
