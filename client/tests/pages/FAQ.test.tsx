import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FAQ from "@/pages/FAQ";

describe("FAQ", () => {
  it("answers the months 0–2 use case in plain English", () => {
    render(<FAQ />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /We find the robot that can do the job, then help you deploy it/i,
      }),
    ).toBeInTheDocument();
    for (const question of [
      "What does Blueprint do?",
      "Why call this months 0–2?",
      "Does Blueprint replace onsite integration?",
      "Do robot teams download the site twin?",
      "How is Blueprint paid?",
    ]) {
      expect(screen.getByText(question)).toBeInTheDocument();
    }
    expect(
      screen.getByText(/Simulation can filter and focus the trip/i),
    ).toBeInTheDocument();
  });
});
