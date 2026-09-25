import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HowItWorks from "@/pages/HowItWorks";

describe("How it works", () => {
  it("explains the scoped pilot and the purchasing decision after physical results", () => {
    render(<HowItWorks />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("From one task to a measured pilot.");
    expect(screen.getByRole("heading", { name: "Scope the job." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Check whether a pilot makes sense." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Agree on a paid physical trial." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Decide what to do next." })).toBeInTheDocument();
    expect(screen.getByText(/approved robot teams see a task card, never your footage/)).toBeInTheDocument();
    expect(screen.getByText(/ready for a trial, specific changes needed, or no credible fit yet/i)).toBeInTheDocument();
    expect(screen.getByText(/site and delivery parties approve the safety plan/i)).toBeInTheDocument();
    expect(screen.getByText(/any further work and fee are agreed separately/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start a task assessment" })).toHaveAttribute("href", "/contact/site-operator");
    expect(screen.getByRole("link", { name: "Apply for early access" })).toHaveAttribute("href", "/contact/robot-team");
    expect(screen.queryByText(/guaranteed deployment/i)).not.toBeInTheDocument();
  });
});
