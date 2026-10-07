import { fireEvent, render, screen, within } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import Home from "@/pages/Home";

describe("Site-led homepage", () => {
  it("speaks to sites only, with one call to action and the price", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Could a robot take over a repetitive task at your site?");
    expect(screen.getByRole("link", { name: "Show us a task" })).toHaveAttribute("href", "/contact/site-operator");
    expect(screen.getByText("Free to start. No pilot, no fee.")).toBeInTheDocument();
    // Robot teams reach their own page from the nav, not from the homepage.
    expect(screen.queryByRole("link", { name: /robot-team beta|early access/i })).not.toBeInTheDocument();
    // One example of the deliverable, clearly marked, instead of staged imagery.
    expect(screen.getAllByRole("tab").map(tab => tab.textContent)).toEqual(["Warehouse", "Café", "Laundromat", "Factory", "Hotel"]);
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveTextContent(/Example.*Robot team.*Moving full totes.*Pilot cost.*Quoted by the robot team/);
    fireEvent.click(screen.getByRole("tab", { name: "Café" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent(/dish rack/);
    expect(screen.getByRole("img", { name: /café example/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play examples" })).toBeInTheDocument();
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

  it("keeps the example still while a keyboard user is inside it, even after the pointer leaves", () => {
    vi.useFakeTimers();
    try {
      render(<Home />);
      const section = screen.getByRole("tabpanel").closest("section")!;
      fireEvent.mouseEnter(section);
      act(() => screen.getByRole("tab", { name: "Warehouse" }).focus());
      fireEvent.mouseLeave(section);
      act(() => { vi.advanceTimersByTime(7000); });
      expect(screen.getByRole("tab", { name: "Warehouse" })).toHaveAttribute("aria-selected", "true");
      act(() => screen.getByRole("tab", { name: "Warehouse" }).blur());
      act(() => { vi.advanceTimersByTime(7000); });
      expect(screen.getByRole("tab", { name: "Café" })).toHaveAttribute("aria-selected", "true");
    } finally {
      vi.useRealTimers();
    }
  });
});
