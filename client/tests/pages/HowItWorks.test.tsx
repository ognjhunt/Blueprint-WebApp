import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HowItWorks from "@/pages/HowItWorks";

describe("How it works", () => {
  it("shows the warehouse walkthrough and retains the job-fit assessment links", () => {
    render(<HowItWorks />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Start with your task.");
    expect(screen.getByRole("heading", { name: "One task, from phone video to a pilot." })).toBeInTheDocument();
    const robotFit = screen.getByRole("heading", { name: "Any robot that fits the task can take part." }).closest("aside")!;
    expect(robotFit).toHaveTextContent(/Fixed arms, humanoids, wheeled humanoids and mobile manipulators are welcome/);
    expect(robotFit).toHaveTextContent(/multiple robots, policies or checkpoints/);
    expect(robotFit).toHaveTextContent(/task fit and simulation compatibility for each job/);
    expect(robotFit).toHaveTextContent(/A description is enough to start/);
    expect(screen.queryByRole("heading", { name: "How matching works." })).not.toBeInTheDocument();
    expect(screen.queryByText("See what a match includes")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Same task. Different policies." })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Show us a task" })).toHaveAttribute("href", "/contact/site-operator");
    expect(screen.getByRole("link", { name: "Apply for early access" })).toHaveAttribute("href", "/contact/robot-team");
    expect(screen.queryByText(/guaranteed deployment|5%|authorized buyer/i)).not.toBeInTheDocument();
  });
});
