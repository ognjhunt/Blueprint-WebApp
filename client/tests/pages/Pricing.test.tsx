import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Pricing from "@/pages/Pricing";

describe("Pricing", () => {
  it("leads with the two charges and that the site pays nothing", () => {
    render(<Pricing />);
    expect(
      screen.getByRole("heading", { level: 1, name: /Two charges\. The site pays nothing/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Sites pay nothing\. Ever/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Lose and it stays \$1,000\. Win and it is \$10,000/i }),
    ).toBeInTheDocument();
  });

  it("walks the worked example without anyone disclosing a contract", () => {
    render(<Pricing />);
    expect(screen.getByText(/\$12,000 to Blueprint/i)).toBeInTheDocument();
    expect(screen.getByText(/\$9,000 more from Team A/i)).toBeInTheDocument();
    expect(screen.getByText(/\$12,000 from Team A/i)).toBeInTheDocument();
    // Appears in the example row and again in the FAQ; both are intended.
    expect(screen.getAllByText(/Nothing further/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Warehouse pays \$0/i).length).toBeGreaterThan(0);
  });

  it("adds up to $10,000 for a win and $1,000 for a loss", () => {
    render(<Pricing />);
    // Three evaluated, one won: $3,000 + $9,000.
    expect(screen.getAllByText("$12,000").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText(/Of those, won/i), { target: { value: "0" } });
    // Same three evaluations, no win: nothing more is owed.
    expect(screen.getAllByText("$3,000").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText(/Site-tasks evaluated/i), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(/Of those, won/i), { target: { value: "1" } });
    expect(screen.getAllByText("$10,000").length).toBeGreaterThan(0);
  });

  it("states that there is nothing else to pay", () => {
    render(<Pricing />);
    expect(screen.getByText(/Is there anything else\?/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(/Growing the deployment .* costs nothing further/i).length,
    ).toBeGreaterThan(0);
  });

  it("explains why the model avoids a contract percentage", () => {
    render(<Pricing />);
    const faq = screen
      .getByText(/Why no percentage of the contract\?/i)
      .closest("div") as HTMLElement;
    expect(within(faq).getByText(/not collectible unless we control invoicing/i)).toBeInTheDocument();
    expect(within(faq).getByText(/Two flat numbers need no visibility into anyone's contract/i)).toBeInTheDocument();
  });

  it("states the rates are terms under test rather than a market rate", () => {
    render(<Pricing />);
    const faq = screen.getByText(/Are these rates fixed\?/i).closest("div") as HTMLElement;
    expect(within(faq).getByText(/starting terms we intend to test/i)).toBeInTheDocument();
    expect(within(faq).getByText(/No independent source establishes a market price/i)).toBeInTheDocument();
  });

  it("supports a robot team paying the site to host, separately", () => {
    render(<Pricing />);
    expect(screen.getByText(/Vendor-funded pilots are fine/i)).toBeInTheDocument();
    // The vendor-funded arrangement is stated beside the calculator.
    expect(screen.getByText(/access, disruption or data/i)).toBeInTheDocument();
  });
});
