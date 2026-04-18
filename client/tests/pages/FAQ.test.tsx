import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FAQ from "@/pages/FAQ";

describe("FAQ", () => {
  it("renders the shortened buyer-objections page", () => {
    render(<FAQ />);

    expect(
      screen.getByRole("heading", {
        name: /The questions that usually decide fit\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/What is a Blueprint world model\?/i)).toBeInTheDocument();
    expect(screen.getByText(/What does a buyer actually receive with the site package\?/i)).toBeInTheDocument();
    expect(screen.getByText(/What is hosted evaluation\?/i)).toBeInTheDocument();
    expect(screen.getByText(/What does exact-site proof mean versus adjacent-site proof\?/i)).toBeInTheDocument();
    expect(screen.getByText(/How close is this to a deployment guarantee\?/i)).toBeInTheDocument();
    expect(screen.getByText(/What if the exact site we care about is not in the catalog\?/i)).toBeInTheDocument();
    expect(screen.getByText(/How fast does Blueprint usually respond\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Can we book time instead of starting with a form\?/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Talk to Blueprint about a real site/i }),
    ).toHaveAttribute("href", "/contact?persona=robot-team");

    expect(screen.queryByText(/What scenario variation controls are live today\?/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/What turns a listing from listing-only into proof-rich\?/i)).not.toBeInTheDocument();
  });
});
