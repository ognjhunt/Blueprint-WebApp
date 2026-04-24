import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Pricing from "@/pages/Pricing";

describe("Pricing", () => {
  it("renders the simplified comparison-led pricing page", () => {
    render(<Pricing />);

    expect(
      screen.getByRole("heading", {
        name: /Choose the right path\./i,
      }),
    ).toBeInTheDocument();

    expect(screen.getAllByRole("heading", { name: /^Site Package$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: /^Hosted Evaluation$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: /^Enterprise$/i }).length).toBeGreaterThan(0);

    expect(screen.getAllByText(/\$2,100 – \$3,400/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\$16 – \$29 \/ session-hour/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/\$50,000\+ scoped/i)).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /What the first bill usually means\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/First exact-site evaluation/i)).toBeInTheDocument();
    expect(screen.getByText(/Hosted-only fit check/i)).toBeInTheDocument();
    expect(screen.getByText(/Bring your site/i)).toBeInTheDocument();

    expect(screen.getByText(/Scope changes with/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /A simpler visual comparison\./i })).toBeInTheDocument();

    expect(
      screen
        .getAllByRole("link", { name: /Book scoping call/i })
        .some((link) => link.getAttribute("href") === "https://calendly.com/blueprintar/30min"),
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
