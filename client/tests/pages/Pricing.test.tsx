import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Pricing from "@/pages/Pricing";

describe("Pricing", () => {
  it("renders the simplified comparison-led pricing page", () => {
    render(<Pricing />);

    expect(
      screen.getByRole("heading", {
        name: /Public pricing for the exact-site paths that matter first\./i,
      }),
    ).toBeInTheDocument();

    expect(screen.getAllByText(/^Site package$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Hosted session-hour$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Custom scope only when needed$/i).length).toBeGreaterThan(0);

    expect(screen.getAllByText(/\$2,100 - \$3,400/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\$16 - \$29/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Compare the three commercial paths\./i)).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /How to choose the first move\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Package first/i)).toBeInTheDocument();
    expect(screen.getByText(/Hosted first/i)).toBeInTheDocument();
    expect(screen.getByText(/Custom first/i)).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: /What changes scope\./i })).toBeInTheDocument();
    expect(screen.getByText(/What pricing does not claim/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Need a site that is not in the public catalog yet\?/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen
        .getAllByRole("link", { name: /Book scoping call/i })
        .some((link) => link.getAttribute("href") === "/book-exact-site-review"),
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
