import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Proof from "@/pages/Proof";

describe("Proof", () => {
  it("separates published process evidence, illustrative economics, and physical proof", () => {
    render(<Proof />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /first two months are real work/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Three facts\. Three direct links/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Published anchor—not a market price/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Illustrative one-time deployment cost per Digit/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Published split between prep and onsite work/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /A useful filter is not a deployment certificate/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^Physical proof$/i }),
    ).toBeInTheDocument();
  });
});
