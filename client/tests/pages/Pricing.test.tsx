import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Pricing from "@/pages/Pricing";

describe("Pricing", () => {
  it("shows the free site screen, free invited participation, and the separate self-directed price", () => {
    render(<Pricing />);
    expect(screen.getByRole("heading", { level: 1, name: "One task. Clear costs." })).toBeInTheDocument();

    const site = screen.getByRole("heading", { name: "Review an offer" }).closest("section") as HTMLElement;
    expect(within(site).getByText("$0")).toBeInTheDocument();
    expect(within(site).getByText(/No card required/)).toBeInTheDocument();
    expect(within(site).getByRole("link", { name: /Start a task assessment/ })).toHaveAttribute("href", "/contact/site-operator");
    expect(site.textContent).not.toMatch(/\$99|per entry|episode/i);

    const team = screen.getByRole("heading", { name: "Evaluate a matched task" }).closest("section") as HTMLElement;
    expect(within(team).getByText("$0")).toBeInTheDocument();
    expect(within(team).getByText(/Matched evaluations are free/)).toBeInTheDocument();
    expect(within(team).getByText(/Optional self-directed runs cost \$99 per entry/)).toBeInTheDocument();
    expect(within(team).getByText(/site decides whether to buy it/)).toBeInTheDocument();
    expect(within(team).getByText(/no later supplier commission on that entry/)).toBeInTheDocument();
    expect(within(team).getByRole("link", { name: /Apply for early access/ })).toHaveAttribute("href", "/contact/robot-team");
  });

  it("states the agreed purchase-triggered site fee", () => {
    render(<Pricing />);
    const pilot = screen.getByRole("heading", { name: "If you buy a pilot" }).closest("section") as HTMLElement;
    expect(within(pilot).getByText(/5% of the introduced provider's physical pilot price/)).toBeInTheDocument();
    expect(within(pilot).getByText(/\$5,000/)).toBeInTheDocument();
    expect(within(pilot).getByText(/No pilot purchase, no Blueprint fee/)).toBeInTheDocument();
    expect(within(pilot).getByRole("link", { name: /Fee details in our Terms/ })).toHaveAttribute("href", "/terms");
  });

  it("keeps old and hypothetical billing models off the page", () => {
    const { container } = render(<Pricing />);
    expect(container.textContent).not.toMatch(/\$0\.50|per episode|50 episodes|500 episodes|\$1,000 to evaluate|\$10,000 if you win|labor budget|take rate/i);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
