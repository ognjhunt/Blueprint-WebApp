import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import About from "@/pages/About";

describe("About", () => {
  it("renders the simplified company-framing page", () => {
    render(<About />);

    expect(
      screen.getByRole("heading", {
        name: /The gap between a good demo and a real building\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/built by Nijel Hunt/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Five rules that decide what we refuse to say\./i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Capture first\. Claim later\.$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Rights travel with the evidence$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Bring one exact site-task\./i,
      }),
    ).toBeInTheDocument();
    const siteLinks = screen.getAllByRole("link", { name: /Explore captured sites/i });
    expect(siteLinks.length).toBeGreaterThanOrEqual(1);
    siteLinks.forEach((link) => {
      expect(link).toHaveAttribute("href", "/sites");
    });
    const contactLinks = screen.getAllByRole("link", { name: /Request a Task Evaluation Run/i });
    expect(contactLinks.length).toBeGreaterThanOrEqual(1);
    contactLinks.forEach((link) => {
      expect(link.getAttribute("href")).toMatch(/^\/contact\/robot-team/);
    });

    expect(screen.queryByText(/Company fact/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Public product surfaces/i)).not.toBeInTheDocument();
  });
});
