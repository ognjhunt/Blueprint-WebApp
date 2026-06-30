import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import About from "@/pages/About";

describe("About", () => {
  it("renders the simplified company-framing page", () => {
    render(<About />);

    expect(
      screen.getByRole("heading", {
        name: /Blueprint turns one real site into a decision a robot team can trust\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/built by Nijel Hunt/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Four principles that keep the product honest\./i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Capture first, claim later\.$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Rights stay attached\.$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Start with the public proof or bring one exact site\./i,
      }),
    ).toBeInTheDocument();
    const siteLinks = screen.getAllByRole("link", { name: /Explore site packages/i });
    expect(siteLinks.length).toBeGreaterThanOrEqual(1);
    siteLinks.forEach((link) => {
      expect(link).toHaveAttribute("href", "/sites");
    });
    const contactLinks = screen.getAllByRole("link", { name: /Request evaluation/i });
    expect(contactLinks.length).toBeGreaterThanOrEqual(1);
    contactLinks.forEach((link) => {
      expect(link).toHaveAttribute("href", "/contact/robot-team");
    });

    expect(screen.queryByText(/Company fact/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Public product surfaces/i)).not.toBeInTheDocument();
  });
});
