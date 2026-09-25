import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HowItWorks from "@/pages/HowItWorks";

describe("How it works", () => {
  it("explains the scoped pilot and the purchasing decision after physical results", () => {
    render(<HowItWorks />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("From one task to a measured pilot.");
    expect(screen.getByRole("heading", { name: "Show us the task." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Review results, then an offer." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Approve and measure the trial." })).toBeInTheDocument();
    expect(screen.getByText(/You see anonymized results; each team sees its own/)).toBeInTheDocument();
    expect(screen.getByText(/A promising team may accept your proposed terms, request changes, or decline/)).toBeInTheDocument();
    expect(screen.getByText(/provider or integrator installs and operates the robot/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start a task assessment" })).toHaveAttribute("href", "/contact/site-operator");
    expect(screen.getByRole("link", { name: "Apply for early access" })).toHaveAttribute("href", "/contact/robot-team");
    expect(screen.queryByText(/guaranteed deployment/i)).not.toBeInTheDocument();
  });
});
