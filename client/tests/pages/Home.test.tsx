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
    expect(screen.queryByText(/Free\.|~0|months 0–2/i)).not.toBeInTheDocument();
  });
  it("lets a reader inspect the task, comparison, and physical-pilot boundaries", () => {
    const { container } = render(<Home />);
    const steps = container.querySelectorAll("details");
    expect(steps).toHaveLength(3);
    fireEvent.click(screen.getByText("Decide what follows"));
    expect(steps[2]).toHaveAttribute("open");
    expect(steps[2]).toHaveTextContent(/stop, change, extend, or deploy regularly/);
    expect(steps[2]).toHaveTextContent(/physical results settle physical claims/);
  });
});
