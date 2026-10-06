import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/pages/Home";

describe("Site-led homepage", () => {
  it("offers a site inquiry first and a separate robot-team application", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("One recurring job.A measured robot pilot.");
    expect(screen.getByRole("link", { name: "Start a job assessment" })).toHaveAttribute("href", "/contact/site-operator");
    expect(screen.getByRole("link", { name: "Apply for early access" })).toHaveAttribute("href", "/contact/robot-team");
    expect(screen.getByRole("link", { name: "Join the robot-team beta" })).toHaveAttribute("href", "/contact/robot-team");
    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAccessibleName(/Illustrative task capture/);
    expect(images[1]).toHaveAccessibleName(/Illustrative simulation view/);
    expect(screen.getByRole("heading", { name: "Can the robot take a case from the tote and place it flat in the empty pocket?" })).toBeInTheDocument();
    expect(screen.queryByText(/months 0–2/i)).not.toBeInTheDocument();
  });
  it("lets a reader inspect the job, robot fit before a recommended pilot, and the pilot", () => {
    const { container } = render(<Home />);
    const steps = container.querySelectorAll("details");
    expect(steps).toHaveLength(3);
    fireEvent.click(screen.getByText("Check robot fit"));
    expect(steps[1]).toHaveAttribute("open");
    expect(steps[1]).toHaveTextContent(/send you one recommended pilot to book/i);
    expect(steps[1]).toHaveTextContent(/No pilot, no fee\./);
    fireEvent.click(screen.getByText("Run the pilot"));
    expect(steps[2]).toHaveAttribute("open");
    expect(steps[2]).toHaveTextContent(/provider installs and operates the robot/i);
    expect(steps[2]).toHaveTextContent(/Blueprint takes no cut/i);
  });
});
