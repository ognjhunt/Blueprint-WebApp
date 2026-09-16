import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Pricing from "@/pages/Pricing";

describe("Pricing", () => {
  it("splits the site's bill from the robot team's", () => {
    render(<Pricing />);
    expect(
      screen.getByRole("heading", { level: 1, name: /Robot teams pay for episodes/i }),
    ).toBeInTheDocument();

    const site = screen
      .getByRole("heading", { name: /scoped assessment of one task at one site/i })
      .closest("section") as HTMLElement;
    expect(within(site).getByText("$2,500")).toBeInTheDocument();
    expect(within(site).getByText(/one-time, per site-task/i)).toBeInTheDocument();

    const team = screen
      .getByRole("heading", { name: /Add funds, run episodes, top up/i })
      .closest("section") as HTMLElement;
    expect(within(team).getByText("$0.50")).toBeInTheDocument();
    expect(within(team).getByText(/per episode/i)).toBeInTheDocument();
  });

  it("defines the episode before pricing one", () => {
    render(<Pricing />);
    expect(
      screen.getByText(/One episode is one run of one policy on one scenario/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Six checkpoints attempting the same scenario is six episodes, not one/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/One robot driven by several models is still one episode/i),
    ).toBeInTheDocument();
  });

  it("prices the quote table straight off checkpoints times episodes", () => {
    render(<Pricing />);
    const screenSix = screen
      .getByRole("rowheader", { name: /Screen six checkpoints/i })
      .closest("tr") as HTMLElement;
    // 6 × 50 = 300 episodes at $0.50.
    expect(within(screenSix).getByText("300")).toBeInTheDocument();
    expect(within(screenSix).getByText("$150")).toBeInTheDocument();

    const deep = screen
      .getByRole("rowheader", { name: /Run six checkpoints deep/i })
      .closest("tr") as HTMLElement;
    expect(within(deep).getByText("3,000")).toBeInTheDocument();
    expect(within(deep).getByText("$1,500")).toBeInTheDocument();
  });

  it("shows staged screening costing less than testing everything deeply", () => {
    render(<Pricing />);
    // 6 × 50 + 2 × 200 = 700 episodes ($350) against 6 × 500 = 3,000 ($1,500).
    expect(screen.getByText(/700 episodes — \$350/)).toBeInTheDocument();
    expect(screen.getByText(/3,000 — \$1,500/)).toBeInTheDocument();
  });

  it("says the budgets are Blueprint's own rather than a standard", () => {
    render(<Pricing />);
    expect(
      screen.getByText(/Blueprint's starting budgets, not an industry standard/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no published episode count settles a close comparison/i),
    ).toBeInTheDocument();
  });

  it("states who eats a failure and that nothing recurs", () => {
    render(<Pricing />);
    expect(
      screen.getByRole("heading", { name: /A failed attempt is billable\. A failure of ours is not/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/An environment that will not launch is not a result, and you do not/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/No subscription and no monthly minimum/i)).toBeInTheDocument();
    expect(screen.getByText(/No percentage of whatever you sign with the site/i)).toBeInTheDocument();
  });

  it("marks the prices as terms under test rather than a market rate", () => {
    render(<Pricing />);
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
