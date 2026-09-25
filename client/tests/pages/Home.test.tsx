import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/pages/Home";

describe("Site-led homepage", () => {
  it("offers a site inquiry first and a separate robot-team application", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("One recurring task.A measured robot pilot.");
    expect(screen.getByRole("link", { name: "Start a task assessment" })).toHaveAttribute("href", "/contact/site-operator");
    expect(screen.getByRole("link", { name: "Apply for early access" })).toHaveAttribute("href", "/contact/robot-team");
    expect(screen.getByRole("img")).toHaveAccessibleName(/Illustration/);
    expect(screen.queryByText(/months 0–2/i)).not.toBeInTheDocument();
  });
  it("lets a reader inspect the task, comparison, and physical-pilot boundaries", () => {
    const { container } = render(<Home />);
    const steps = container.querySelectorAll("details");
    expect(steps).toHaveLength(3);
    fireEvent.click(screen.getByText("Review results and an offer"));
    expect(steps[1]).toHaveAttribute("open");
    expect(steps[1]).toHaveTextContent(/anonymized results first/i);
    fireEvent.click(screen.getByText("Approve and measure"));
    expect(steps[2]).toHaveAttribute("open");
    expect(steps[2]).toHaveTextContent(/provider installs and operates the robot/i);
    expect(steps[2]).toHaveTextContent(/records the results so you can decide what follows/i);
  });
});
