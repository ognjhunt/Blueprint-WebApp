import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Pricing from "@/pages/Pricing";

describe("Pricing", () => {
  it("shows the free site screen, free invited participation, and the separate self-directed price", () => {
    render(<Pricing />);
    expect(screen.getByRole("heading", { level: 1, name: "One task. Clear costs." })).toBeInTheDocument();

    const site = screen.getByRole("heading", { name: "Initial task assessment" }).closest("section") as HTMLElement;
    expect(within(site).getByText("$0")).toBeInTheDocument();
    expect(within(site).getByText(/No card required/)).toBeInTheDocument();
    expect(within(site).getByRole("link", { name: /Start a task assessment/ })).toHaveAttribute("href", "/contact/site-operator");
    expect(site.textContent).not.toMatch(/\$99|per entry|episode/i);

    const team = screen.getByRole("heading", { name: "Bring a credible solution" }).closest("section") as HTMLElement;
    expect(within(team).getByText("$0")).toBeInTheDocument();
    expect(within(team).getByText(/Invited teams pay no evaluation entry fee for a site-funded pilot project/)).toBeInTheDocument();
    expect(within(team).getByText(/Optional self-directed runs outside that project cost \$99 per entry/)).toBeInTheDocument();
    expect(within(team).getByText(/One entry is one policy, running on one embodiment, against one task at one site/)).toBeInTheDocument();
    expect(within(team).getByText(/no later supplier commission on a paid entry/)).toBeInTheDocument();
    expect(within(team).getByRole("link", { name: /Apply for early access/ })).toHaveAttribute("href", "/contact/robot-team");
  });

  it("shows a starting Blueprint pilot fee and a full quote before commitment", () => {
    render(<Pricing />);
    const pilot = screen.getByRole("heading", { name: "Physical pilots" }).closest("section") as HTMLElement;
    expect(within(pilot).getByText(/fee starts at \$5,000/)).toBeInTheDocument();
    expect(within(pilot).getByText(/Provider installation and operation cost extra/)).toBeInTheDocument();
    expect(within(pilot).getByText(/itemized quote for the full trial/)).toBeInTheDocument();
    expect(within(pilot).getByText(/result adds no extra Blueprint fee/)).toBeInTheDocument();
    expect(within(pilot).getByRole("link", { name: /billing details in our Terms/ })).toHaveAttribute("href", "/terms");
  });

  it("keeps old and hypothetical billing models off the page", () => {
    const { container } = render(<Pricing />);
    expect(container.textContent).not.toMatch(/\$0\.50|per episode|50 episodes|500 episodes|\$1,000 to evaluate|\$10,000 if you win|labor budget|take rate/i);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
