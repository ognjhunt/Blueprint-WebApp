import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Pricing from "@/pages/Pricing";

describe("Pricing", () => {
  it("keeps pricing focused on the robot-team buying path", () => {
    render(<Pricing />);

    expect(
      screen.getByRole("heading", {
        name: /Three ways to buy in\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/You can start with a short brief/i)).toBeInTheDocument();
    expect(screen.getAllByText(/\$2,100 - \$3,400/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\$16 - \$29/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Request hosted evaluation/i })).toHaveAttribute(
      "href",
      "/contact?persona=robot-team&interest=evaluation-package",
    );
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
