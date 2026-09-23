import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Pricing from "@/pages/Pricing";

describe("Pricing", () => {
  it("splits the site's bill from the robot team's", () => {
    render(<Pricing />);
    expect(
      screen.getByRole("heading", { level: 1, name: /Robot teams pay \$99 an entry/i }),
    ).toBeInTheDocument();

    const site = screen
      .getByRole("heading", { name: /assessment of one task at one site/i })
      .closest("section") as HTMLElement;
    expect(within(site).getByText("$0")).toBeInTheDocument();
    // The claim that makes ten-minute onboarding possible: nothing to approve,
    // so nothing to route through procurement.
    expect(within(site).getByText(/No fee, no card, and nothing per run/i)).toBeInTheDocument();

    const team = screen
      .getByRole("heading", { name: /One price for each policy you put on a task/i })
      .closest("section") as HTMLElement;
    expect(within(team).getByText("$99")).toBeInTheDocument();
  });

  it("states the entries × tasks × $99 arithmetic once, under the worked examples", () => {
    render(<Pricing />);
    expect(screen.getAllByText(/Entries × tasks ×/i)).toHaveLength(1);
    const quote = screen.getByRole("heading", { name: "What it comes to" }).closest("section") as HTMLElement;
    expect(within(quote).getByText(/Entries × tasks × \$99/)).toBeInTheDocument();
  });

  it("keeps the site's column free of anything it has to price", () => {
    render(<Pricing />);
    const site = screen
      .getByRole("heading", { name: /assessment of one task at one site/i })
      .closest("section") as HTMLElement;
    // A site operator should never have to learn what an entry costs, let
    // alone what an episode is.
    expect(site.textContent).not.toMatch(/\$99|per entry|episode/i);
    expect(within(site).getByText(/up to five candidates/i)).toBeInTheDocument();
  });

  it("defines an entry as one policy on one embodiment", () => {
    // The only part of a flat price a buyer can get wrong.
    render(<Pricing />);
    const entry = screen
      .getByRole("heading", { name: "What one entry is" })
      .closest("section") as HTMLElement;
    expect(
      within(entry).getByText(/one policy, running on one embodiment, against one task/i),
    ).toBeInTheDocument();
    expect(
      within(entry).getByText(/same policy on a second embodiment is a second entry/i),
    ).toBeInTheDocument();
    expect(
      within(entry).getByText(/second policy on the same embodiment is a second entry/i),
    ).toBeInTheDocument();
    expect(within(entry).getByText(/one new entry, not two/i)).toBeInTheDocument();
  });

  it("prices the examples straight off entries times tasks", () => {
    render(<Pricing />);
    const threeOnTwo = screen
      .getByRole("rowheader", { name: /Three policies on two tasks/i })
      .closest("tr") as HTMLElement;
    expect(within(threeOnTwo).getByText("6")).toBeInTheDocument();
    expect(within(threeOnTwo).getByText("$594")).toBeInTheDocument();

    const oneOnThree = screen
      .getByRole("rowheader", { name: /One policy on three tasks/i })
      .closest("tr") as HTMLElement;
    expect(within(oneOnThree).getByText("$297")).toBeInTheDocument();
  });

  it("tells a free site what it is giving and what is not free", () => {
    // A site that pays nothing is not the customer. Saying so on the page is
    // the difference between this model and the dishonest version of it.
    render(<Pricing />);
    expect(screen.getByText(/Robot teams pay for evaluation runs/i)).toBeInTheDocument();
    expect(screen.getByText(/never receive your recording/i)).toBeInTheDocument();
    expect(screen.getByText(/A physical pilot/i)).toBeInTheDocument();
  });

  it("promises a robot team that money cannot buy a longer run", () => {
    // The first objection to a model where the seller sizes the run, answered
    // on the page.
    render(<Pricing />);
    expect(screen.getByText(/You cannot buy a longer run than a rival/i)).toBeInTheDocument();
  });

  it("says Blueprint sizes the run, and nothing is owed later", () => {
    render(<Pricing />);
    const covers = screen
      .getByRole("heading", { name: /What \$99 covers/i })
      .closest("section") as HTMLElement;
    expect(
      within(covers).getByText(/no budget to choose, no episode count to size/i),
    ).toBeInTheDocument();
    expect(within(covers).getByText(/the same for every entry on the task/i)).toBeInTheDocument();
    expect(screen.getByText(/Nothing more later, including if you are shortlisted/i)).toBeInTheDocument();
  });

  it("says where the answer stops, next to what it costs", () => {
    // A flat price is a promise about cost, not about certainty.
    render(<Pricing />);
    expect(screen.getByText(/too close to separate/i)).toBeInTheDocument();
    expect(
      screen.getByText(/simulated ranking is still not a real-world ranking/i),
    ).toBeInTheDocument();
  });

  it("marks the price as our own starting price rather than a market rate", () => {
    render(<Pricing />);
    expect(
      screen.getByText(/starting price we intend to test with buyers, not an industry rate/i),
    ).toBeInTheDocument();
  });

  it("keeps the retired per-episode model off the page entirely", () => {
    // The whole point of the change: one number, and no meter behind it.
    const { container } = render(<Pricing />);
    expect(container.textContent).not.toMatch(/\$0\.50|per episode|50 episodes|500 episodes/i);
  });

  it("routes each side to its own intake", () => {
    render(<Pricing />);
    expect(screen.getAllByRole("link", { name: /Start a task assessment/i })[0]).toHaveAttribute(
      "href",
      "/contact/site-operator",
    );
    expect(screen.getAllByRole("link", { name: /Apply for early access/i })[0]).toHaveAttribute(
      "href",
      "/contact/robot-team",
    );
  });
});
