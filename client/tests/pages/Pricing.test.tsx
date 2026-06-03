import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Pricing from "@/pages/Pricing";

describe("Pricing", () => {
  it("renders the simplified comparison-led pricing page", () => {
    render(<Pricing />);

    expect(
      screen.getByRole("heading", {
        name: /Price the readiness question before the pilot\./i,
      }),
    ).toBeInTheDocument();

    expect(screen.getAllByRole("heading", { name: /^Site\/Task Readiness Review$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: /^Hosted Evaluation$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: /^Custom Multi-Site Benchmark$/i }).length).toBeGreaterThan(0);

    expect(screen.getAllByText(/\$2,100 – \$3,400/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\$16 – \$29 \/ session-hour/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\$50,000\+ scoped/i).length).toBeGreaterThan(0);

    expect(
      screen.getByRole("heading", { name: /Pick by the first buyer decision\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Choose by the first decision your team needs to make\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Readiness review first/i)).toBeInTheDocument();
    expect(screen.getByText(/Hosted review first/i)).toBeInTheDocument();
    expect(screen.getByText(/Multi-site benchmark first/i)).toBeInTheDocument();
    expect(screen.getByText(/Readiness review means advisory evidence/i)).toBeInTheDocument();
    expect(screen.getByText(/managed browser sessions and run notes/i)).toBeInTheDocument();

    expect(screen.getByText(/Scope changes with/i)).toBeInTheDocument();
    expect(screen.getByText(/Planning ranges/i)).toBeInTheDocument();
    expect(screen.getByText(/not claim a robot is ready to deploy/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What each path unlocks first\./i })).toBeInTheDocument();

    expect(
      screen
        .getAllByRole("link", { name: /Request hosted evaluation/i })
        .some((link) =>
          link.getAttribute("href") ===
          "/contact?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=hosted-evaluation&source=pricing",
        ),
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: /Request readiness evaluation/i })
        .some((link) =>
          link.getAttribute("href") ===
          "/contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=pricing",
        ),
    ).toBe(true);

    expect(screen.queryByText(/What happens after inquiry/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/When not to buy exact-site work yet\./i)).not.toBeInTheDocument();
  });
});
