import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import HowItWorks from "@/pages/HowItWorks";

describe("HowItWorks", () => {
  it("renders the simplified proof-led exact-site loop page", () => {
    render(<HowItWorks />);

    expect(
      screen.getByRole("heading", {
        name: /Indoor capture to world model\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Capture$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Package$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Review$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Decide$/i })).toBeInTheDocument();
    expect(screen.getByText(/Real site\. Real route\. Real package\./i)).toBeInTheDocument();
    expect(screen.getByText(/See the indoor site before field time\./i)).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: /Open sample world model/i })
        .some((link) => link.getAttribute("href") === "/world-models/siteworld-f5fd54898cfb"),
    ).toBe(true);
    expect(screen.getByRole("link", { name: /Request world model/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/contact?persona=robot-team"),
    );
    expect(screen.getByText(/Teams, robot agents, and Blueprint agents have different jobs\./i)).toBeInTheDocument();
    expect(screen.queryByText(/Proof stories/i)).not.toBeInTheDocument();
  });
});
