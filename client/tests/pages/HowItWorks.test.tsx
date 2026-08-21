import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HowItWorks from "@/pages/HowItWorks";

describe("HowItWorks", () => {
  it("shows the four-step preparation workflow and where it stops", () => {
    render(<HowItWorks />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Capture the job\. Recreate it\. Test fit\. Hand it off/i,
      }),
    ).toBeInTheDocument();
    for (const heading of [
      "Capture one workflow",
      "Build the testbed",
      "Test robot fit",
      "Hand off the homework",
    ]) {
      expect(screen.getAllByText(heading).length).toBeGreaterThan(0);
    }
    expect(
      screen.getByRole("heading", {
        name: /Blueprint ends where onsite deployment begins/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Real hardware is still required to settle physical performance and safety claims/i,
      ),
    ).toBeInTheDocument();
  });
});
