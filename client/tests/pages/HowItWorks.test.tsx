import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HowItWorks from "@/pages/HowItWorks";

describe("How it works", () => {
  it("explains matching, the fee, and the pilot the two sides run", () => {
    render(<HowItWorks />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("From one task to a measured pilot.");
    expect(screen.getByRole("heading", { name: "Show us the task." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Meet your match." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Run the pilot." })).toBeInTheDocument();
    expect(screen.getByText(/\$2,500 per task, only if we find a match\. No match, no fee\./)).toBeInTheDocument();
    expect(screen.getByText(/we introduce you right away and send our invoice\. Teams that don't match stay anonymous\./)).toBeInTheDocument();
    expect(screen.getByText(/Blueprint takes no cut of the pilot or any deployment/)).toBeInTheDocument();
    expect(screen.getByText(/provider or integrator installs and operates the robot/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start a task assessment" })).toHaveAttribute("href", "/contact/site-operator");
    expect(screen.getByRole("link", { name: "Apply for early access" })).toHaveAttribute("href", "/contact/robot-team");
    expect(screen.queryByText(/guaranteed deployment|5%|authorized buyer/i)).not.toBeInTheDocument();
  });
});
