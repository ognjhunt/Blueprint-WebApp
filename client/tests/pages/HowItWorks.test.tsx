import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import HowItWorks from "@/pages/HowItWorks";

describe("HowItWorks", () => {
  it("pairs conceptual explanation with proof artifacts and proof-path guidance", () => {
    render(<HowItWorks />);

    expect(screen.getByRole("heading", { name: /Exact-site world models beat generic simulation when deployment gets specific\./i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Proof chain, not just product philosophy\./i })).toBeInTheDocument();
    expect(screen.getByText(/Real site capture/i)).toBeInTheDocument();
    expect(screen.getByText(/Sample package manifest/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Hosted run review/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Export bundle/i)).toBeInTheDocument();
    expect(screen.getByText(/Exact-site proof vs adjacent-site proof/i)).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: /Inspect the sample listing/i })
        .some((link) => link.getAttribute("href") === "/world-models/siteworld-f5fd54898cfb"),
    ).toBe(true);
  });
});
