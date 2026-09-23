import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HowItWorks from "@/pages/HowItWorks";

describe("How it works", () => {
  it("explains task-first comparison and the physical pilot for different manipulation embodiments", () => {
    render(<HowItWorks />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("How we find the robot that fits your task.");
    expect(screen.getByRole("heading", { name: "Bring in the right robot teams." })).toBeInTheDocument();
    expect(screen.getByText(/robot teams see a card for your task, never your footage/)).toBeInTheDocument();
    // No templated two-beat fragments.
    expect(screen.queryByText(/Teams evaluate\. We make|Different robots\. Different policies/)).not.toBeInTheDocument();
    expect(screen.getByText(/single team can evaluate multiple checkpoints/)).toBeInTheDocument();
    expect(screen.getByText(/practical shortlist/)).toBeInTheDocument();
    expect(screen.queryByText(/two compatible|exactly two|two-candidate limit/i)).not.toBeInTheDocument();
    expect(screen.getByText(/All robotics teams can apply/)).toBeInTheDocument();
    expect(screen.getByText(/clear reason to pause/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start a task assessment" })).toHaveAttribute("href", "/contact/site-operator");
    expect(screen.getByRole("link", { name: "Find a task for your robot" })).toHaveAttribute("href", "/contact/robot-team");
    expect(screen.queryByText(/quadruped|inspection/i)).not.toBeInTheDocument();
  });
});
