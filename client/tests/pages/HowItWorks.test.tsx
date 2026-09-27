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
    expect(screen.getByText(/authorize the \$2,500 match fee/)).toHaveTextContent(/even if you do not buy the pilot/);
    expect(screen.getByText(/No match, no fee\. One fee per task/)).toBeInTheDocument();
    expect(screen.getByText(/Blueprint takes no cut of the pilot or any deployment/)).toBeInTheDocument();
    expect(screen.getByText(/provider or integrator installs and operates the robot/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start a task assessment" })).toHaveAttribute("href", "/contact/site-operator");
    expect(screen.getByRole("link", { name: "Apply for early access" })).toHaveAttribute("href", "/contact/robot-team");
    expect(screen.queryByText(/guaranteed deployment|5%|authorized buyer/i)).not.toBeInTheDocument();
  });
});
