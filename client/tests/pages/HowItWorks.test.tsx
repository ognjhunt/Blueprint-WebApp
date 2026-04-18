import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import HowItWorks from "@/pages/HowItWorks";

describe("HowItWorks", () => {
  it("renders the simplified proof-led exact-site loop page", () => {
    render(<HowItWorks />);

    expect(
      screen.getByRole("heading", {
        name: /Start with one real site\. Train around it\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /The exact-site loop\./i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Anchor to the site/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Branch realistic variation/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Run, compare, and export/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Proof path, not abstract positioning\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Where Blueprint fits in the training stack\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: /Inspect the sample listing/i })
        .some((link) => link.getAttribute("href") === "/world-models/siteworld-f5fd54898cfb"),
    ).toBe(true);
    expect(screen.queryByText(/What teams train and ship with this/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Proof stories/i)).not.toBeInTheDocument();
  });
});
