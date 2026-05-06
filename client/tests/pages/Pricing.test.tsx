import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Pricing from "@/pages/Pricing";

describe("Pricing", () => {
  it("renders the simplified comparison-led pricing page", () => {
    render(<Pricing />);

    expect(
      screen.getByRole("heading", {
        name: /Pricing for package access and hosted review\./i,
      }),
    ).toBeInTheDocument();

    expect(screen.getAllByRole("heading", { name: /^Site Package Access$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: /^Hosted Review$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: /^Custom Scope$/i }).length).toBeGreaterThan(0);

    expect(screen.getAllByText(/\$2,100 – \$3,400/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\$16 – \$29 \/ session-hour/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/\$50,000\+ scoped/i)).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /Choose by what your team needs first\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Package access first/i)).toBeInTheDocument();
    expect(screen.getByText(/Hosted review first/i)).toBeInTheDocument();
    expect(screen.getByText(/Custom scope first/i)).toBeInTheDocument();
    expect(screen.getByText(/Package access means files and approved exports/i)).toBeInTheDocument();
    expect(screen.getByText(/managed browser sessions and run evidence/i)).toBeInTheDocument();

    expect(screen.getByText(/Scope changes with/i)).toBeInTheDocument();
    expect(screen.getByText(/What pricing does not claim/i)).toBeInTheDocument();
    expect(screen.getByText(/not a package license by itself/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What each path unlocks first\./i })).toBeInTheDocument();

    expect(
      screen
        .getAllByRole("link", { name: /Request hosted review/i })
        .some((link) =>
          link.getAttribute("href") ===
          "/contact?persona=robot-team&buyerType=robot_team&interest=evaluation-package&path=hosted-evaluation&source=pricing",
        ),
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: /Request custom quote/i })
        .some((link) => link.getAttribute("href") === "/contact?persona=robot-team&interest=enterprise"),
    ).toBe(true);

    expect(screen.queryByText(/What happens after inquiry/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/When not to buy exact-site work yet\./i)).not.toBeInTheDocument();
  });
});
