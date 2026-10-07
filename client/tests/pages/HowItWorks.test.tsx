import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HowItWorks from "@/pages/HowItWorks";

describe("How it works", () => {
  it("shows the warehouse walkthrough and retains the job-fit assessment links", () => {
    render(<HowItWorks />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("From one job to a measured pilot.");
    expect(screen.getByRole("heading", { name: "One task, from phone video to a pilot." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Is your job a fit?" })).toBeInTheDocument();
    expect(screen.getByText(/Start with repeatable parts handling/)).toHaveTextContent(/A description is enough to start/);
    expect(screen.queryByRole("heading", { name: "How matching works." })).not.toBeInTheDocument();
    expect(screen.queryByText("See what a match includes")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Same task. Different policies." })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Show us a task" })).toHaveAttribute("href", "/contact/site-operator");
    expect(screen.getByRole("link", { name: "Apply for early access" })).toHaveAttribute("href", "/contact/robot-team");
    expect(screen.queryByText(/guaranteed deployment|5%|authorized buyer/i)).not.toBeInTheDocument();
  });
});
