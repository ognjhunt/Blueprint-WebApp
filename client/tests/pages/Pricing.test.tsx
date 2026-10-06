import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Pricing from "@/pages/Pricing";

const section = (heading: string) =>
  screen.getByRole("heading", { name: heading }).closest("section") as HTMLElement;

describe("Pricing", () => {
  it("leads with no pilot, no fee", () => {
    render(<Pricing />);
    expect(screen.getByRole("heading", { level: 1, name: "No pilot, no fee." })).toBeInTheDocument();
    expect(screen.getByText(/Pay \$2,500 only when you book it/)).toBeInTheDocument();
  });

  it("charges a site $2,500 per task, only when the site books the one recommended pilot", () => {
    render(<Pricing />);
    const site = section("Get a recommended pilot");
    expect(within(site).getByText("$2,500")).toBeInTheDocument();
    expect(within(site).getByText("per job, only when you book the pilot")).toBeInTheDocument();
    expect(within(site).getByText(/passed the evaluation for your job, fits your budget, and wants to run your pilot/)).toBeInTheDocument();
    expect(within(site).getByText(/You get one recommended pilot: what it tests, what you provide/)).toBeInTheDocument();
    expect(within(site).getByText(/Book it in one step. One fee per job/)).toBeInTheDocument();
    expect(within(site).getByRole("link", { name: /Start a job assessment/ })).toHaveAttribute("href", "/contact/site-operator");
  });

  it("keeps invited robot-team evaluation free", () => {
    render(<Pricing />);
    const team = section("Evaluate real site jobs");
    expect(within(team).getByText("$0")).toBeInTheDocument();
    expect(within(team).getByText(/The site sees your results and can consider you for the pilot/)).toBeInTheDocument();
    expect(team.textContent).not.toMatch(/commission/i);
    expect(within(team).queryByText(/Private evaluation/)).not.toBeInTheDocument();
    expect(within(team).getByRole("link", { name: /Apply for early access/ })).toHaveAttribute("href", "/contact/robot-team");
  });

  it("takes no cut of the pilot or what follows it", () => {
    render(<Pricing />);
    const pilot = section("The pilot itself");
    expect(within(pilot).getByText(/the recommended pilot shows that cost before\s+you book/)).toBeInTheDocument();
    expect(within(pilot).getByText(/takes no cut of the pilot or any deployment that follows/)).toBeInTheDocument();
    expect(within(pilot).getByRole("link", { name: /Fee details in our Terms/ })).toHaveAttribute("href", "/terms");
  });

  it("puts the fee at booking and states the replacement remedy", () => {
    render(<Pricing />);
    expect(screen.getByText(/when you book the recommended pilot/)).toHaveTextContent(/If you do not book, or we find no credible\s+fit, you owe nothing/);
    expect(screen.getByText(/If the recommended team withdraws/)).toHaveTextContent(/If none fits, we refund your fee/);
    expect(screen.getByRole("link", { name: "See how a pilot works" })).toHaveAttribute("href", "/how-it-works#warehouse-task");
  });

  it("keeps retired and hypothetical billing models off the page", () => {
    const { container } = render(<Pricing />);
    expect(container.textContent).not.toMatch(/5%|capped|\$5,000|authorized buyer|introduced provider|\$0\.50|per episode|\$1,000 to evaluate|\$10,000 if you win|labor budget|take rate/i);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
