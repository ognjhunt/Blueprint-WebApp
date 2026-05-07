import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import HowItWorks from "@/pages/HowItWorks";

describe("HowItWorks", () => {
  it("renders the simplified proof-led exact-site loop page", () => {
    render(<HowItWorks />);

    expect(
      screen.getByRole("heading", {
        name: /Capture to world model\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Capture$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Package$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Run$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Deliver$/i })).toBeInTheDocument();
    expect(screen.getByText(/Real site\. Real route\. Real package\./i)).toBeInTheDocument();
    expect(screen.getByText(/See the exact site before you start the sales motion\./i)).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: /Inspect a real site/i })
        .some((link) => link.getAttribute("href") === "/world-models/siteworld-f5fd54898cfb"),
    ).toBe(true);
    expect(screen.getByRole("link", { name: /View sample deliverables/i })).toHaveAttribute(
      "href",
      "/proof",
    );
    expect(screen.queryByText(/What teams train and ship with this/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Proof stories/i)).not.toBeInTheDocument();
  });
});
