import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HowItWorks from "@/pages/HowItWorks";

describe("HowItWorks", () => {
  it("shows decision-oriented intake, Pipeline routing, abstention, and the next experiment", () => {
    render(<HowItWorks />);
    expect(screen.getByRole("heading", { name: /How a Task Evaluation Run works/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Describe the site-task and decision/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Plan the cheapest qualified evidence/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Return a decision or abstention/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Run the next cheapest experiment/i })).toBeInTheDocument();
    expect(screen.getByText(/WebApp does not select the backend/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Request a Task Evaluation Run/i })).toHaveAttribute("href", expect.stringContaining("/contact/robot-team"));
    expect(screen.queryByText(/Policy Improvement Run/i)).not.toBeInTheDocument();
  });
});
