import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import About from "@/pages/About";

describe("About", () => {
  it("renders the simplified company-framing page", () => {
    render(<About />);

    expect(
      screen.getByRole("heading", {
        name: /Blueprint exists to make one real site legible earlier\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Built by Nijel Hunt/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /What Blueprint is and what it is not\./i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^What Blueprint is$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^What Blueprint is not$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Why this matters before the expensive part starts\./i,
      }),
    ).toBeInTheDocument();
    const worldModelLinks = screen.getAllByRole("link", { name: /Explore world models/i });
    expect(worldModelLinks.length).toBeGreaterThanOrEqual(1);
    worldModelLinks.forEach((link) => {
      expect(link).toHaveAttribute("href", "/world-models");
    });
    const contactLinks = screen.getAllByRole("link", { name: /Contact Blueprint/i });
    expect(contactLinks.length).toBeGreaterThanOrEqual(1);
    contactLinks.forEach((link) => {
      expect(link).toHaveAttribute("href", expect.stringContaining("/contact?persona=robot-team"));
      expect(link).toHaveAttribute("href", expect.stringContaining("buyerType=robot_team"));
    });

    expect(screen.queryByText(/Company fact/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Public product surfaces/i)).not.toBeInTheDocument();
  });
});
