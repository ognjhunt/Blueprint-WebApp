import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FAQ from "@/pages/FAQ";

describe("FAQ", () => {
  it("explains the managed pilot and provider path in plain English", () => {
    render(<FAQ />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /We help turn one task into a measured pilot/i,
      }),
    ).toBeInTheDocument();
    for (const question of [
      "What does Blueprint do?",
      "How do you find a robot team for my task?",
      "Does Blueprint replace onsite integration?",
      "Do robot teams download the site twin?",
      "How is Blueprint paid?",
    ]) {
      expect(screen.getByText(question)).toBeInTheDocument();
    }
    expect(
      screen.getByText(/We can help coordinate and measure an agreed physical pilot/i),
    ).toBeInTheDocument();
  });
});
