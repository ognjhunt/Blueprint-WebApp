import { fireEvent, render, screen, within } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import Home from "@/pages/Home";

describe("Site-led homepage", () => {
  it("starts with the job and a low-friction customer action", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Find the right way to automate your work.");
    // One action, offered in the hero and again after the questions.
    const starts = screen.getAllByRole("link", { name: "Submit a job" });
    expect(starts).toHaveLength(2);
    starts.forEach(link => expect(link).toHaveAttribute("href", "/contact/site-operator"));
    expect(screen.getByText(/Free during the beta.*Start with a video/)).toBeInTheDocument();
    // Robot teams reach their own page from the nav, not from the homepage.
    expect(screen.queryByRole("link", { name: /robot-team beta|early access/i })).not.toBeInTheDocument();
    // One example of the deliverable, clearly marked, instead of staged imagery.
    expect(screen.getAllByRole("tab").map(tab => tab.textContent)).toEqual(["Warehouse", "Café", "Laundromat", "Factory", "Hotel", "Lab"]);
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveTextContent(/Job.*full totes.*Possible approach.*Humanoid robot.*Evidence needed.*Site video.*simulation results.*Budget.*before any pilot.*Pilot price.*deployment company.*Support/);
    expect(screen.getByText(/not available offers or measured results/)).toBeInTheDocument();
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

  it("shows three customer steps from video through simulation to a pilot", () => {
    render(<Home />);
    const steps = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    expect(steps[0]).toHaveTextContent(/Show us the work.*analyze the video.*draft a job brief/);
    // Blueprint runs the candidates itself and shows a bounded estimate or "held" (owner, 2026-10-28).
    expect(steps[1]).toHaveTextContent(/Compare robots in simulation.*test robots and policies on the job ourselves.*estimate of what’s likely to work.*“held”/i);
    expect(steps[2]).toHaveTextContent(/Pilot it on your site.*work alongside a deployment company.*measure the result against your criteria/);
    expect(screen.getByRole("region", { name: "From a recurring job to a measured pilot." })).not.toHaveTextContent(/screening runs|scored in full|comparable proposals|recommend the approach/i);
    expect(screen.getByRole("region", { name: "From a recurring job to a measured pilot." })).not.toHaveTextContent(/robot teams?/i);
    expect(screen.getByText(/A simulation result is an estimate/)).toBeInTheDocument();
  });

  it("keeps the closing action short and links to pricing and privacy details", () => {
    render(<Home />);
    const closing = screen.getByRole("region", { name: "What work would you like automated?" });
    expect(closing).toHaveTextContent("We usually reply within an hour.");
    expect(closing).toHaveTextContent("You choose whether to proceed");
    expect(within(closing).getByRole("link", { name: "Costs and responsibilities" })).toHaveAttribute("href", "/beta");
    expect(within(closing).getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
  });

  it("supports keyboard navigation across the illustrative examples", () => {
    render(<Home />);
    const first = screen.getByRole("tab", { name: "Warehouse" });
    fireEvent.keyDown(first, { key: "ArrowRight" });
    const next = screen.getByRole("tab", { name: "Café" });
    expect(next).toHaveFocus();
    expect(next).toHaveAttribute("aria-selected", "true");
    expect(first).toHaveAttribute("tabindex", "-1");
    fireEvent.keyDown(next, { key: "End" });
    expect(screen.getByRole("tab", { name: "Lab" })).toHaveFocus();
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

  it("keeps rotating while the pointer rests on the examples", () => {
    vi.useFakeTimers();
    try {
      render(<Home />);
      // A page that loads under a resting cursor starts out hovered.
      fireEvent.mouseEnter(screen.getByRole("tabpanel").closest("section")!);
      act(() => { vi.advanceTimersByTime(11000); });
      expect(screen.getByRole("tab", { name: "Café" })).toHaveAttribute("aria-selected", "true");
      act(() => { vi.advanceTimersByTime(10000); });
      expect(screen.getByRole("tab", { name: "Laundromat" })).toHaveAttribute("aria-selected", "true");
    } finally {
      vi.useRealTimers();
    }
  });

  it("resumes rotating after pause and play, though the button keeps focus", () => {
    vi.useFakeTimers();
    try {
      render(<Home />);
      act(() => screen.getByRole("button", { name: "Pause examples" }).focus());
      fireEvent.click(screen.getByRole("button", { name: "Pause examples" }));
      act(() => { vi.advanceTimersByTime(11000); });
      expect(screen.getByRole("tab", { name: "Warehouse" })).toHaveAttribute("aria-selected", "true");
      fireEvent.click(screen.getByRole("button", { name: "Play examples" }));
      expect(screen.getByRole("button", { name: "Pause examples" })).toHaveFocus();
      act(() => { vi.advanceTimersByTime(11000); });
      expect(screen.getByRole("tab", { name: "Café" })).toHaveAttribute("aria-selected", "true");
    } finally {
      vi.useRealTimers();
    }
  });
});
