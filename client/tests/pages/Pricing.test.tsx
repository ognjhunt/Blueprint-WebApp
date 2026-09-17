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
      .getByRole("heading", { name: /assessment of one task at one site/i })
      .closest("section") as HTMLElement;
    expect(within(site).getByText("$0")).toBeInTheDocument();
    // The claim that makes ten-minute onboarding possible: nothing to approve,
    // so nothing to route through procurement.
    expect(within(site).getByText(/No fee, no per-episode charge, and no card/i)).toBeInTheDocument();

    const team = screen
      .getByRole("heading", { name: /Screening is the only thing a robot team buys/i })
      .closest("section") as HTMLElement;
    expect(within(team).getByText("$0.50")).toBeInTheDocument();
  });

  it("keeps per-episode pricing out of the site's column entirely", () => {
    render(<Pricing />);
    const site = screen
      .getByRole("heading", { name: /assessment of one task at one site/i })
      .closest("section") as HTMLElement;
    // A site operator should never have to learn what an episode is.
    expect(site.textContent).not.toMatch(/\$0\.50|per episode/i);
    expect(within(site).getByText(/No per-episode charge/i)).toBeInTheDocument();
    expect(within(site).getByText(/up to five finalists/i)).toBeInTheDocument();
  });

  it("states the finalist comparison is covered", () => {
    render(<Pricing />);
    expect(
      screen.getByText(/finalist comparison run for every shortlisted candidate/i),
    ).toBeInTheDocument();
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
    // The first objection to vendors funding the system, answered on the page.
    render(<Pricing />);
    expect(screen.getByText(/You cannot buy more episodes than a rival/i)).toBeInTheDocument();
  });

  it("offers exactly two rounds and names who funds each", () => {
    render(<Pricing />);
    const rounds = screen.getByRole("heading", { name: "The two rounds" }).closest("section") as HTMLElement;
    expect(within(rounds).getByText("Screening")).toBeInTheDocument();
    expect(within(rounds).getByText("Finalist comparison")).toBeInTheDocument();
    expect(within(rounds).getByText("50")).toBeInTheDocument();
    expect(within(rounds).getByText("500")).toBeInTheDocument();
    expect(within(rounds).getByText(/Paid by the robot team/i)).toBeInTheDocument();
    expect(within(rounds).getByText(/Funded and run by Blueprint/i)).toBeInTheDocument();
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
    expect(screen.getAllByRole("link", { name: /Start a task assessment/i })[0]).toHaveAttribute(
      "href",
      "/contact/site-operator",
    );
    expect(screen.getAllByRole("link", { name: /Apply as a robot team/i })[0]).toHaveAttribute(
      "href",
      "/contact/robot-team",
    );
  });
});

describe("the finalist subsidy is not presented as settled", () => {
  it("says on the page that it is the current offer rather than an entitlement", () => {
    // A subsidy of ten unpaid episodes per paid one, whose sustainability is
    // unmeasured, must not read as a permanent feature. It also must not read
    // as a threat to people who already entered -- the commitment is kept for
    // whoever entered under it.
    render(<Pricing />);

    expect(screen.getByText(/current offer rather than a permanent entitlement/i)).toBeInTheDocument();
    expect(screen.getByText(/A team that enters under it keeps it/i)).toBeInTheDocument();
  });

  it("states the floor where a team reads the rule", () => {
    render(<Pricing />);

    // Stated in two places -- the shortlist rule and the billing rules -- which
    // is right: a team reading either one should learn it.
    expect(
      screen.getAllByText(/more than one candidate to separate/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/field of one is not a comparison/i)).toBeInTheDocument();
  });
});
