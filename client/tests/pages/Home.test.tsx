import { fireEvent, render, screen, within } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import Home from "@/pages/Home";

describe("Site-led homepage", () => {
  it("speaks to sites only, with one call to action and the price", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Could a robot take over a repetitive task at your site?");
    expect(screen.getByRole("link", { name: "Show us a task" })).toHaveAttribute("href", "/contact/site-operator");
    expect(screen.getByText("Free during the beta, for sites and robot teams.")).toBeInTheDocument();
    // Robot teams reach their own page from the nav, not from the homepage.
    expect(screen.queryByRole("link", { name: /robot-team beta|early access/i })).not.toBeInTheDocument();
    // One example of the deliverable, clearly marked, instead of staged imagery.
    expect(screen.getAllByRole("tab").map(tab => tab.textContent)).toEqual(["Warehouse", "Café", "Laundromat", "Factory", "Hotel", "Lab"]);
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveTextContent(/Example.*Robot team.*Evaluated in simulation.*Passed on your task \(example\).*small boxed parts.*Blueprint fee.*None during the beta.*Pilot cost.*Quoted by the robot team/);
    expect(screen.getByText("Book this pilot")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Café" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent(/dish rack/);
    expect(screen.getByRole("img", { name: /café example/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause examples" })).toBeInTheDocument();
    expect(screen.queryByText(/Your criteria/)).not.toBeInTheDocument();
  });

  it.each([
    ["Warehouse", /humanoid robot/i, /small boxed parts.*scale.*outbound tray/i],
    ["Café", /fixed robot arm/i, /clean cups.*dish rack.*counter/i],
    ["Laundromat", /wheeled humanoid/i, /opening.*supply drawer/i],
    ["Factory", /mobile manipulator/i, /rigid blanks.*conveyor.*tray/i],
    ["Hotel", /mobile robot with arm/i, /boxed amenities.*stock tray.*service tray/i],
    ["Lab", /fixed robot arm/i, /opening the sample drawer before each batch/i],
  ])("pairs the %s example with its robot and matching illustration", (site, embodiment, task) => {
    render(<Home />);
    const tab = screen.getByRole("tab", { name: site });
    fireEvent.click(tab);
    expect(tab).toHaveAttribute("aria-selected", "true");
    const panel = screen.getByRole("tabpanel", { name: site });
    expect(panel).toHaveTextContent(embodiment);
    expect(panel).toHaveTextContent(task);
    const illustration = screen.getByRole("img", { name: new RegExp(`${site} example`, "i") });
    expect(illustration).toHaveAccessibleName(embodiment);
  });

  it("keeps a restored example selected and still while paused", () => {
    vi.useFakeTimers();
    try {
      render(<Home />);
      fireEvent.click(screen.getByRole("button", { name: "Pause examples" }));
      fireEvent.click(screen.getByRole("tab", { name: "Hotel" }));
      const art = screen.getByRole("img", { name: /hotel example/i });
      const stillFrame = art.innerHTML;
      act(() => { vi.advanceTimersByTime(31000); });
      expect(screen.getByRole("tab", { name: "Hotel" })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("button", { name: "Play examples" })).toBeInTheDocument();
      expect(art.innerHTML).toBe(stillFrame);
    } finally {
      vi.useRealTimers();
    }
  });

  it("allows manual selection without motion when reduced motion is preferred", () => {
    vi.useFakeTimers();
    const matchMedia = vi.spyOn(window, "matchMedia").mockImplementation(query => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
    }) as MediaQueryList);
    try {
      render(<Home />);
      expect(screen.getByRole("button", { name: "Play examples" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("tab", { name: "Laundromat" }));
      const art = screen.getByRole("img", { name: /laundromat example/i });
      const stillFrame = art.innerHTML;
      act(() => { vi.advanceTimersByTime(31000); });
      expect(screen.getByRole("tab", { name: "Laundromat" })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("tabpanel")).toHaveTextContent(/wheeled humanoid/i);
      expect(art.innerHTML).toBe(stillFrame);
    } finally {
      matchMedia.mockRestore();
      vi.useRealTimers();
    }
  });

  it("shows the three steps without a click, ending in the recommended pilot", () => {
    const { container } = render(<Home />);
    expect(container.querySelectorAll("details")).toHaveLength(0);
    const steps = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    expect(steps[0]).toHaveTextContent(/Show us the task.*Describe it or film it on your phone\./);
    expect(steps[1]).toHaveTextContent(/Robot teams evaluate it.*Invited teams test it in a simulation built from your site\./);
    expect(steps[2]).toHaveTextContent(/Book the recommended pilot.*One team whose evaluation passed\. You agree dates and terms with them\./);
    expect(screen.getByText(/A simulated evaluation is an estimate, not proof/)).toBeInTheDocument();
  });

  it("keeps the example still while a keyboard user is inside it, even after the pointer leaves", () => {
    vi.useFakeTimers();
    try {
      render(<Home />);
      const section = screen.getByRole("tabpanel").closest("section")!;
      fireEvent.mouseEnter(section);
      act(() => screen.getByRole("tab", { name: "Warehouse" }).focus());
      fireEvent.mouseLeave(section);
      act(() => { vi.advanceTimersByTime(11000); });
      expect(screen.getByRole("tab", { name: "Warehouse" })).toHaveAttribute("aria-selected", "true");
      act(() => screen.getByRole("tab", { name: "Warehouse" }).blur());
      act(() => { vi.advanceTimersByTime(11000); });
      expect(screen.getByRole("tab", { name: "Café" })).toHaveAttribute("aria-selected", "true");
    } finally {
      vi.useRealTimers();
    }
  });
});
