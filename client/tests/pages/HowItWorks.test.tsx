import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HowItWorks from "@/pages/HowItWorks";

describe("HowItWorks", () => {
  it("shows the four-step preparation workflow and where it stops", () => {
    render(<HowItWorks />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Record the job\. Rebuild it\. Run the robots\. Hand it off/i,
      }),
    ).toBeInTheDocument();
    for (const heading of [
      "Record the job",
      "Rebuild it as a test",
      "Run the robots",
      "Hand off the deployment",
    ]) {
      expect(screen.getAllByText(heading).length).toBeGreaterThan(0);
    }
    expect(
      screen.getByRole("heading", {
        name: /We stop where the install begins/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Real hardware still settles physical performance and safety/i,
      ),
    ).toBeInTheDocument();
  });
});
