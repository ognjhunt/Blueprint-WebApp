import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Pricing from "@/pages/Pricing";

describe("Pricing", () => {
  it("renders the three public planning ranges", () => {
    render(<Pricing />);

    expect(
      screen.getByRole("heading", {
        name: /Robot teams pay for evaluation sets and site data\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Policy Evaluation Set$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Site Data Package$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Site Operator Participation$/i })).toBeInTheDocument();
    expect(screen.getByText(/\$6,500 \/ site evaluation/i)).toBeInTheDocument();
    expect(screen.getByText(/\$3,500\+ \/ site package/i)).toBeInTheDocument();
    expect(screen.getByText(/^Free$/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Robot teams only/i).length).toBe(2);
  });

  it("keeps buyer choice and pricing claim boundaries explicit", () => {
    render(<Pricing />);

    expect(
      screen.getByRole("heading", { name: /Start with what your robot team needs to use\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Choose policy evaluation first/i)).toBeInTheDocument();
    expect(screen.getByText(/Choose site data first/i)).toBeInTheDocument();
    expect(screen.getByText(/Site operators do not pay/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /A request is not a payment/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Public prices help robot teams plan/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Request policy evaluation/i }),
    ).toHaveAttribute("href", expect.stringContaining("interest=hosted-evaluation"));
    expect(
      screen.getByRole("link", { name: /Submit site free/i }),
    ).toHaveAttribute("href", expect.stringContaining("/contact/site-operator"));
  });
});
