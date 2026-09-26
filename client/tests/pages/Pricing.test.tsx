import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Pricing from "@/pages/Pricing";

const section = (heading: string) =>
  screen.getByRole("heading", { name: heading }).closest("section") as HTMLElement;

describe("Pricing", () => {
  it("leads with no match, no fee", () => {
    render(<Pricing />);
    expect(screen.getByRole("heading", { level: 1, name: "No match, no fee." })).toBeInTheDocument();
    expect(screen.getByText(/we introduce you right away\. Our fee is \$2,500\. If we don't find one, you pay nothing/)).toBeInTheDocument();
  });

  it("charges a site $2,500 per task, only when we find a match, and says what a match is", () => {
    render(<Pricing />);
    const site = section("Find a robot team");
    expect(within(site).getByText("$2,500")).toBeInTheDocument();
    expect(within(site).getByText("per task, only if we find a match")).toBeInTheDocument();
    expect(within(site).getByText(/passed the evaluation for your task, fits your budget, and wants to run your pilot/)).toBeInTheDocument();
    expect(within(site).getByText(/every team that matches, their full results, and a pilot brief you both start from/)).toBeInTheDocument();
    expect(within(site).getByText(/One fee per task, however many teams match/)).toBeInTheDocument();
    expect(within(site).getByRole("link", { name: /Start a task assessment/ })).toHaveAttribute("href", "/contact/site-operator");
  });

  it("keeps robot teams free", () => {
    render(<Pricing />);
    const team = section("Evaluate real site tasks");
    expect(within(team).getByText("$0")).toBeInTheDocument();
    expect(within(team).getByText(/If you pass and want the pilot, we introduce you to the site/)).toBeInTheDocument();
    expect(team.textContent).not.toMatch(/\$99|per entry|commission/i);
    expect(within(team).getByRole("link", { name: /Apply for early access/ })).toHaveAttribute("href", "/contact/robot-team");
  });

  it("takes no cut of the pilot or what follows it", () => {
    render(<Pricing />);
    const pilot = section("The pilot itself");
    expect(within(pilot).getByText(/You and the robot team agree the pilot's price and terms directly/)).toBeInTheDocument();
    expect(within(pilot).getByText(/Blueprint takes no cut of the pilot or any deployment that follows/)).toBeInTheDocument();
    expect(within(pilot).getByRole("link", { name: /Fee details in our Terms/ })).toHaveAttribute("href", "/terms");
  });

  it("keeps retired and hypothetical billing models off the page", () => {
    const { container } = render(<Pricing />);
    expect(container.textContent).not.toMatch(/5%|capped|\$5,000|authorized buyer|introduced provider|\$0\.50|per episode|\$1,000 to evaluate|\$10,000 if you win|labor budget|take rate/i);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
