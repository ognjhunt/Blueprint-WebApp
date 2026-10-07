import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/pages/Home";

describe("Site-led homepage", () => {
  it("speaks to sites only, with one call to action and the price", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Could a robot take over a repetitive task at your site?");
    expect(screen.getByRole("link", { name: "Show us a task" })).toHaveAttribute("href", "/contact/site-operator");
    expect(screen.getByText("Free to start. No pilot, no fee.")).toBeInTheDocument();
    // Robot teams reach their own page from the nav, not from the homepage.
    expect(screen.queryByRole("link", { name: /robot-team beta|early access/i })).not.toBeInTheDocument();
    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAccessibleName(/Illustrative task capture/);
    expect(images[1]).toHaveAccessibleName(/Illustrative simulation view/);
    expect(screen.queryByText(/Your criteria/)).not.toBeInTheDocument();
  });

  it("shows the three steps without a click, ending in booking the recommended pilot", () => {
    const { container } = render(<Home />);
    expect(container.querySelectorAll("details")).toHaveLength(0);
    const steps = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    expect(steps[0]).toHaveTextContent(/Show us the task.*Describe it or film it on your phone\./);
    expect(steps[1]).toHaveTextContent(/We find the right robot.*We test it with robot teams and pick one that fits\./);
    expect(steps[2]).toHaveTextContent(/Book the pilot.*One click\. We coordinate the rest\./);
  });
});
