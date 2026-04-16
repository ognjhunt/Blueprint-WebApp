import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Pricing from "@/pages/Pricing";

describe("Pricing", () => {
  it("keeps pricing focused on the robot-team buying path", () => {
    render(<Pricing />);

    expect(
      screen.getByRole("heading", {
        name: /Start with the package or the hosted runtime\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/session-hour is one hour of self-serve hosted runtime/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\$2,100 - \$3,400/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\$16 - \$29/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /Compare the three commercial paths\./i })).toBeInTheDocument();
    expect(screen.getByText(/Typical first purchase/i)).toBeInTheDocument();
    expect(screen.getByText(/What happens after inquiry/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Request a custom quote/i })).toHaveAttribute(
      "href",
      "/contact?persona=robot-team&interest=enterprise",
    );
    expect(screen.getByRole("link", { name: /Email a short brief/i })).toHaveAttribute(
      "href",
      "mailto:hello@tryblueprint.io?subject=Blueprint%20brief",
    );
  });
});
