import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/pages/Home";

describe("Home", () => {
  it("makes the months 0–2 use case and physical boundary obvious", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /robot should arrive after the homework is done/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /path to scaled deployment is 6\+ months/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Do the work once—not again for every robot company/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /One workflow becomes one robot-ready work package/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Onsite integration and the physical pilot stay with the OEM/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /Prepare a deployment/i }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("link", { name: /Submit a site task/i }),
    ).toHaveAttribute(
      "href",
      expect.stringContaining("buyerType=site_operator"),
    );
    expect(screen.queryByText(/12–24h/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/From \$2,500/i)).not.toBeInTheDocument();
  });

  it("links the OEM timeline to primary sources", () => {
    render(<Home />);
    expect(
      screen.getByRole("link", {
        name: /Agility June 2026 investor presentation/i,
      }),
    ).toHaveAttribute("href", expect.stringContaining("sec.gov"));
    expect(
      screen.getByRole("link", { name: /Agility deployment process/i }),
    ).toHaveAttribute("href", expect.stringContaining("agilityrobotics.com"));
  });
});
