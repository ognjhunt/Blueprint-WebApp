import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/pages/Home";

describe("Home", () => {
  it("leads with the deployment-bottleneck thesis and the months 0–2 scope", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Robots aren't the bottleneck\. Deploying them is/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /China installs nine robots for every one we do/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Two of the six months happen before the robot is crated/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Do the work once\. Not once per vendor/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /One workflow in\. One qualified deployment out/i }),
    ).toBeInTheDocument();
  });

  it("keeps the physical boundary on the page rather than in the terms", () => {
    const { container } = render(<Home />);
    expect(container).toHaveTextContent(
      /Onsite integration, commissioning, and the physical pilot stay with the robot company/i,
    );
    expect(
      screen.getByRole("heading", {
        name: /Prepare the deployment\. Don't pretend you deployed the robot/i,
      }),
    ).toBeInTheDocument();
    expect(container).toHaveTextContent(/Simulation filters, it does not certify/i);
  });

  it("routes both sides of the market", () => {
    render(<Home />);
    expect(
      screen.getAllByRole("link", { name: /Prepare a deployment/i }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Submit a site task/i })).toHaveAttribute(
      "href",
      expect.stringContaining("buyerType=site_operator"),
    );
    expect(screen.getByRole("link", { name: /Join as a robot team/i })).toHaveAttribute(
      "href",
      expect.stringContaining("buyerType=robot_team"),
    );
  });

  it("carries a primary source and an evidence grade on every figure", () => {
    render(<Home />);
    // The installation gap and the OEM timeline are the two load-bearing figures.
    expect(
      screen.getAllByRole("link", { name: /IFR World Robotics 2025/i }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", {
        name: /Agility Robotics investor presentation, June 2026/i,
      })[0],
    ).toHaveAttribute("href", expect.stringContaining("sec.gov"));
    expect(
      screen.getAllByRole("link", { name: /Agility Robotics deployment process/i })[0],
    ).toHaveAttribute("href", expect.stringContaining("agilityrobotics.com"));

    // Modelled numbers are never presented as transactions.
    const economics = screen
      .getByText(/Modelled per-robot deployment economics/i)
      .closest("figure");
    expect(economics).not.toBeNull();
    expect(within(economics as HTMLElement).getByText(/Illustrative model/i)).toBeInTheDocument();
  });

  it("keeps withdrawn offers and unmeasured service levels off the page", () => {
    const { container } = render(<Home />);
    expect(container).not.toHaveTextContent(/12–24h/i);
    expect(container).not.toHaveTextContent(/From \$2,500/i);
    expect(container).not.toHaveTextContent(/Policy Shortlist/i);
    expect(container).not.toHaveTextContent(/guaranteed winner/i);
  });
});
