import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Pricing from "@/pages/Pricing";

describe("Pricing", () => {
  it("presents the four stages: free discovery, the paid line, and observable units", () => {
    render(<Pricing />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Free to discover\. You pay when robots are working/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Discovery costs nothing, because it costs us nothing/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Payment starts where scarce work does/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Billed on units both sides can count/i }),
    ).toBeInTheDocument();
  });

  it("gates a capture visit behind a commitment rather than expressed interest", () => {
    render(<Pricing />);
    // Scoped to the gate panel: the FAQ restates these three in prose.
    const panel = screen
      .getByText(/Before Blueprint funds a capture visit/i)
      .closest("div") as HTMLElement;
    expect(within(panel).getByText(/Verified project budget/i)).toBeInTheDocument();
    expect(within(panel).getByText(/Signed pilot-intent document/i)).toBeInTheDocument();
    expect(within(panel).getByText(/Refundable commitment/i)).toBeInTheDocument();
    expect(within(panel).getByText(/Expressed interest does not buy one/i)).toBeInTheDocument();
  });

  it("returns the evaluation credit against the deployment fee", () => {
    render(<Pricing />);
    // 3 robots x 12 months at the $100 floor, plus $5,000 activation, less the
    // $2,500 credit a team that evaluated has already paid.
    expect(screen.getByText("$6,100")).toBeInTheDocument();
    expect(screen.getByText("−$2,500")).toBeInTheDocument();

    // Unchecking the credit is what shows the credit is worth exactly its face value.
    fireEvent.click(
      screen.getByRole("checkbox", { name: /already paid an evaluation credit/i }),
    );
    expect(screen.getByText("$8,600")).toBeInTheDocument();
  });

  it("scales with active robot-months, so an idle robot stops billing", () => {
    render(<Pricing />);
    fireEvent.change(screen.getByLabelText(/^Active robots$/i), { target: { value: "0" } });
    // No activation and no robot-months: an unstarted deployment owes nothing.
    expect(screen.getAllByText("$0").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText(/^Active robots$/i), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText(/^Months$/i), { target: { value: "12" } });
    // 10 x 12 x $100 = $12,000 + $5,000 - $2,500 credit
    expect(screen.getByText("$14,500")).toBeInTheDocument();
  });

  it("states that the posted rates are terms under test, not a market rate", () => {
    render(<Pricing />);
    const faq = screen.getByText(/Are these rates fixed\?/i).closest("div");
    expect(faq).not.toBeNull();
    expect(
      within(faq as HTMLElement).getByText(/starting terms Blueprint intends to test/i),
    ).toBeInTheDocument();
    expect(
      within(faq as HTMLElement).getByText(/vendors selling data services/i),
    ).toBeInTheDocument();
  });

  it("keeps deployment and the data loop with the robot team", () => {
    render(<Pricing />);
    expect(screen.getByText(/Does Blueprint take over our deployment\?/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Robot teams keep the deployment and the data loop/i),
    ).toBeInTheDocument();
  });
});
