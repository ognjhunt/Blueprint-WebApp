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
    expect(panel).toHaveTextContent(/Example.*Robot team.*Evaluation scope.*Illustrative workflow.*per task.*full totes.*Blueprint fee.*Free during the beta.*Pilot cost.*Quoted by the robot team/);
    expect(panel).not.toHaveTextContent(/Passed on your task/);
    expect(screen.queryByText("Book this pilot")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Café" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent(/dish rack/);
    expect(screen.getByRole("img", { name: /café example/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause examples" })).toBeInTheDocument();
    expect(screen.queryByText(/Your criteria/)).not.toBeInTheDocument();
  });

  it.each([
    ["Warehouse", /humanoid robot/i, /full totes.*packing line.*outbound carts/i],
    ["Café", /fixed robot arm/i, /clean cups.*dish rack.*counter/i],
    ["Laundromat", /wheeled humanoid/i, /folding towels.*wash-and-fold/i],
    ["Factory", /mobile manipulator/i, /loading blanks.*CNC machine.*unloading finished parts/i],
    ["Hotel", /mobile robot/i, /linen carts.*laundry room.*each floor/i],
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

  it.each([
    {
      site: "Warehouse",
      // The original shelving, outbound cart and carried tote surround a biped.
      landmarks: ['rect[x="20"][y="40"][width="110"][height="140"]', 'rect[x="222"][y="128"][width="88"][height="36"]', 'ellipse[rx="11"][ry="13"]', 'rect[width="32"][height="18"]'],
    },
    {
      site: "Café",
      // Keep clean cups laid out side by side on the counter.
      landmarks: ['path[d="M152 130 h16 l-2 10 h-12 z"]', 'path[d="M138 130 h16 l-2 10 h-12 z"]', 'rect[x="204"][y="128"][width="84"][height="12"]'],
    },
    {
      site: "Laundromat",
      // Washers and folded towels identify the original folding-table scene.
      landmarks: ['rect[x="18"][y="70"][width="68"][height="110"]', 'rect[x="92"][y="70"][width="68"][height="110"]', 'rect[width="18"][height="6"]', 'path[d="M206 124 H306 M214 124 V180 M298 124 V180"]'],
    },
    {
      site: "Factory",
      // The full-height CNC, spindle, conveyor and wheeled base remain intact.
      landmarks: ['rect[x="22"][y="44"][width="118"][height="136"]', 'path[d^="M71 62 V"]', 'rect[x="204"][y="140"][width="100"][height="12"]', 'rect[width="48"][height="18"][rx="4"]'],
    },
    {
      site: "Hotel",
      // The original elevator, delivery-robot mast and linen on its towed cart.
      landmarks: ['rect[x="14"][y="36"][width="126"][height="144"]', 'rect[width="8"][height="42"]', 'rect[width="21"][height="12"]', 'rect[width="18"][height="10"]'],
    },
    {
      site: "Lab",
      // Preserve the existing sample cabinet and fixed-arm pedestal.
      landmarks: ['rect[x="176"][y="60"][width="114"][height="120"]', 'rect[x="52"][y="128"][width="36"][height="52"]', 'rect[y="104"][width="4"][height="36"]'],
    },
  ])("preserves the $site scene landmarks in its paused frame", ({ site, landmarks }) => {
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "Pause examples" }));
    fireEvent.click(screen.getByRole("tab", { name: site }));
    const illustration = screen.getByRole("img", { name: new RegExp(`${site} example`, "i") });
    for (const landmark of landmarks) {
      expect(illustration.querySelector(landmark), landmark).toBeInTheDocument();
    }
    if (site === "Laundromat") {
      expect(illustration.querySelector('rect[x="258"][y="60"][width="52"][height="120"]')).not.toBeInTheDocument();
    }
    if (site === "Hotel") {
      expect(illustration.querySelector('circle[cy="112"][r="5"]')).not.toBeInTheDocument();
    }
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
    expect(steps[1]).toHaveTextContent(/Robot teams evaluate it.*Invited teams test it in a simplified simulation of your task, informed by your footage\./);
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
