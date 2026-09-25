import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Pricing from "@/pages/Pricing";

describe("Pricing", () => {
  it("shows each party only its current price and intake", () => {
    render(<Pricing />);
    expect(screen.getByRole("heading", { level: 1, name: "One task. Clear costs." })).toBeInTheDocument();

    const site = screen.getByRole("heading", { name: "Initial task assessment" }).closest("section") as HTMLElement;
    expect(within(site).getByText("$0")).toBeInTheDocument();
    expect(within(site).getByText(/No card required/)).toBeInTheDocument();
    expect(within(site).getByRole("link", { name: /Start a task assessment/ })).toHaveAttribute("href", "/contact/site-operator");
    expect(site.textContent).not.toMatch(/\$99|per entry|episode/i);

    const team = screen.getByRole("heading", { name: "Task evaluation" }).closest("section") as HTMLElement;
    expect(within(team).getByText("$99")).toBeInTheDocument();
    expect(within(team).getByText(/One entry is one policy, running on one embodiment, against one task at one site/)).toBeInTheDocument();
    expect(within(team).getByText(/Applying is free/)).toBeInTheDocument();
    expect(within(team).getByText(/No subscription or later supplier commission on that entry/)).toBeInTheDocument();
    expect(within(team).getByRole("link", { name: /Apply for early access/ })).toHaveAttribute("href", "/contact/robot-team");
  });

  it("separates Blueprint's site-approved pilot fee from provider charges", () => {
    render(<Pricing />);
    const pilot = screen.getByRole("heading", { name: "Physical pilots" }).closest("section") as HTMLElement;
    expect(within(pilot).getByText(/fixed, site-approved fee/)).toBeInTheDocument();
    expect(within(pilot).getByText(/provider or integrator quotes installation and operation separately/)).toBeInTheDocument();
    expect(within(pilot).getByText(/site approves the scope and costs before work begins/)).toBeInTheDocument();
    expect(within(pilot).getByRole("link", { name: /billing details in our Terms/ })).toHaveAttribute("href", "/terms");
  });

  it("keeps old and hypothetical billing models off the page", () => {
    const { container } = render(<Pricing />);
    expect(container.textContent).not.toMatch(/\$0\.50|per episode|50 episodes|500 episodes|\$1,000 to evaluate|\$10,000 if you win|labor budget|take rate/i);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
