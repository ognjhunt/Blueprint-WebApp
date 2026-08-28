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
      screen.getByRole("heading", { name: /Evaluate for \$1,000\. Pay again only if you win/i }),
    ).toBeInTheDocument();
  });

  it("walks the worked example without anyone disclosing a contract", () => {
    render(<Pricing />);
    expect(screen.getByText(/\$12,000 to Blueprint/i)).toBeInTheDocument();
    expect(screen.getByText(/\$9,000 more from Team A/i)).toBeInTheDocument();
    expect(screen.getByText(/\$30,000 more from Team A/i)).toBeInTheDocument();
    // The side deal is supported and Blueprint takes none of it.
    // Appears in the example row and again in the FAQ; both are intended.
    expect(screen.getAllByText(/Blueprint takes none of it/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Warehouse pays \$0/i).length).toBeGreaterThan(0);
  });

  it("shows the greater-of flipping from the floor to the per-robot rate", () => {
    render(<Pricing />);
    // Five robots sits exactly on the floor: $10,000 less the $1,000 credit.
    expect(screen.getByText("$9,000")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Robots deployed on this task/i), {
      target: { value: "20" },
    });
    // Twenty robots clears the floor: 20 x $2,000 = $40,000 less the credit.
    expect(screen.getByText("$39,000")).toBeInTheDocument();
  });

  it("explains why the model avoids a contract percentage", () => {
    render(<Pricing />);
    const faq = screen
      .getByText(/Why is there no percentage of the contract\?/i)
      .closest("div") as HTMLElement;
    expect(within(faq).getByText(/not reliably collectible unless Blueprint controls invoicing/i))
      .toBeInTheDocument();
    expect(within(faq).getByText(/visible in the deployment and acceptance record/i))
      .toBeInTheDocument();
  });

  it("states the rates are terms under test rather than a market rate", () => {
    render(<Pricing />);
    const faq = screen.getByText(/Are these rates fixed\?/i).closest("div") as HTMLElement;
    expect(within(faq).getByText(/starting terms Blueprint intends to test/i)).toBeInTheDocument();
    expect(within(faq).getByText(/vendors selling data services/i)).toBeInTheDocument();
  });

  it("supports a robot team paying the site to host, separately", () => {
    render(<Pricing />);
    expect(screen.getByText(/Vendor-funded pilots are fine/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Can a robot team pay the site to host a pilot\?/i),
    ).toBeInTheDocument();
  });
});
