import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HowItWorks from "@/pages/HowItWorks";

// Bare bones (owner, 2026-11-11): three steps, one line each, leading with the test in simulation; which jobs fit
// (the old "Jobs we support" page) in one line; one button; the limits of the check in one line.
describe("How it works", () => {
  it("shows three steps, leading with the test in simulation, and one button", () => {
    render(<HowItWorks />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("How it works");
    const steps = within(screen.getByRole("list", { name: "Steps" })).getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    expect(steps[0]).toHaveTextContent(/Send a video\s*One job that repeats, filmed on any phone\./);
    expect(steps[1]).toHaveTextContent(/We test the top AI robots on your job\s*In a simulation of your site, built from your video\. Each gets about ten tries, with things moved between tries\. You see which did best and how sure we are\./);
    expect(steps[1]).not.toHaveTextContent(/published specifications|when we can/i);
    expect(steps[2]).toHaveTextContent(/Find a company to set it up\s*Shared with companies we've approved, without your name, only if you press the button\./);
    expect(screen.getAllByRole("link", { name: "Start a job" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Questions ›" })).toHaveAttribute("href", "/beta");
    expect(screen.getByText(/Best for one job that repeats, with known objects, where something is picked up and put down/)).toBeInTheDocument();
    expect(screen.getByText("We check pick-up-and-put-down jobs. Not a test at your site, or a safety check.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });
});
