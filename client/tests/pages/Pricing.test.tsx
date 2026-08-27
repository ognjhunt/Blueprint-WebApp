import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Pricing from "@/pages/Pricing";

describe("Pricing", () => {
  it("shows free core access, gated human capture, and the site-paid success fee", () => {
    render(<Pricing />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Free to evaluate\. You pay when a robot is working/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Both sides get through months 0–2 without a platform fee/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Free to submit does not mean free camera crew for everyone/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /5% to start\. Lower automatically as annual volume grows/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/First \$1 million in the customer account year/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /cash actually collected, not the original headline contract value/i,
      ),
    ).toBeInTheDocument();
  });

  it("calculates the progressive fee without reducing provider revenue", () => {
    render(<Pricing />);
    fireEvent.change(
      screen.getByLabelText(
        /Enterprise provider revenue paid this account year/i,
      ),
      { target: { value: "10000000" } },
    );
    expect(screen.getByText("$320,000")).toBeInTheDocument();
    expect(screen.getByText("3.2%")).toBeInTheDocument();
    expect(
      screen.getByText(/Customer total: \$10,320,000/i),
    ).toBeInTheDocument();
  });
});
