import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Pricing from "@/pages/Pricing";

describe("Pricing", () => {
  it("splits the site's bill from the robot team's", () => {
    render(<Pricing />);
    expect(
      screen.getByRole("heading", { level: 1, name: /Robot teams pay to be screened/i }),
    ).toBeInTheDocument();

    const site = screen
      .getByRole("heading", { name: /scoped assessment of one task at one site/i })
      .closest("section") as HTMLElement;
    expect(within(site).getByText("$2,500")).toBeInTheDocument();

    const team = screen
      .getByRole("heading", { name: /Screening is the only thing a robot team buys/i })
      .closest("section") as HTMLElement;
    expect(within(team).getByText("$0.50")).toBeInTheDocument();
  });

  it("keeps per-episode pricing out of the site's column entirely", () => {
    render(<Pricing />);
    const site = screen
      .getByRole("heading", { name: /scoped assessment of one task at one site/i })
      .closest("section") as HTMLElement;
    // A site operator should never have to learn what an episode is.
    expect(site.textContent).not.toMatch(/\$0\.50|per episode/i);
    expect(within(site).getByText(/No per-episode charge/i)).toBeInTheDocument();
    expect(within(site).getByText(/up to five finalists/i)).toBeInTheDocument();
  });

  it("states the site fee covers the finalist comparison", () => {
    render(<Pricing />);
    expect(
      screen.getByText(/finalist comparison run for every shortlisted candidate, at Blueprint's cost/i),
    ).toBeInTheDocument();
  });

  it("offers exactly two rounds and names who funds each", () => {
    render(<Pricing />);
    const rounds = screen.getByRole("heading", { name: "The two rounds" }).closest("section") as HTMLElement;
    expect(within(rounds).getByText("Screening")).toBeInTheDocument();
    expect(within(rounds).getByText("Finalist comparison")).toBeInTheDocument();
    expect(within(rounds).getByText("50")).toBeInTheDocument();
    expect(within(rounds).getByText("500")).toBeInTheDocument();
    expect(within(rounds).getByText(/Paid by the robot team/i)).toBeInTheDocument();
    expect(within(rounds).getByText(/Included in the site's assessment fee/i)).toBeInTheDocument();
  });

  it("states the shortlist rule where the rounds are described", () => {
    render(<Pricing />);
    expect(
      screen.getByText(/Everything screening cannot separate from the leader goes forward, up to five/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/only cuts a candidate it can rule out/i),
    ).toBeInTheDocument();
  });

  it("says what each round cannot do, next to what it costs", () => {
    render(<Pricing />);
    expect(screen.getByText(/It never names a winner, and it is not a ranking/i)).toBeInTheDocument();
    expect(screen.getByText(/too close to separate rather than naming a winner/i)).toBeInTheDocument();
  });

  it("tells a shortlisted team it owes nothing more", () => {
    render(<Pricing />);
    expect(
      screen.getByRole("heading", { name: /Being shortlisted never costs you more/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/no top-up to make and no deadline to miss/i)).toBeInTheDocument();
    expect(screen.getByText(/Nothing more if you are shortlisted/i)).toBeInTheDocument();
  });

  it("prices screening straight off checkpoints times fifty", () => {
    render(<Pricing />);
    const six = screen
      .getByRole("rowheader", { name: /Six checkpoints/i })
      .closest("tr") as HTMLElement;
    expect(within(six).getByText("300")).toBeInTheDocument();
    expect(within(six).getByText("$150")).toBeInTheDocument();
  });

  it("marks the budgets as Blueprint's own rather than a standard", () => {
    render(<Pricing />);
    expect(
      screen.getByText(/Blueprint's budgets, not an industry standard/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/simulated ranking is still not a real-world ranking/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/starting prices we intend to test with buyers, not an industry rate/i),
    ).toBeInTheDocument();
  });

  it("routes each side to its own intake", () => {
    render(<Pricing />);
    expect(screen.getAllByRole("link", { name: /Discuss your site/i })[0]).toHaveAttribute(
      "href",
      "/contact/site-operator",
    );
    expect(screen.getAllByRole("link", { name: /Apply as a robot team/i })[0]).toHaveAttribute(
      "href",
      "/contact/robot-team",
    );
  });
});
