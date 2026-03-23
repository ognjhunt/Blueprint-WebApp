import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Pricing from "@/pages/Pricing";

describe("Pricing", () => {
  it("keeps pricing focused on the robot-team buying path", () => {
    render(<Pricing />);

    expect(
      screen.getByRole("heading", {
        name: /Pricing for robot teams, not the whole marketplace story\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/\$2,100 - \$3,400/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\$16 - \$29/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Request hosted eval/i })).toHaveAttribute(
      "href",
      "/contact?persona=robot-team&interest=evaluation-package",
    );
  });
});
