import { fireEvent, render, screen, within } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import Home from "@/pages/Home";

describe("Site-led homepage", () => {
  // Bare bones (owner, 2026-11-11): one question, three steps, one button; the moving example is a small answer screen.
  it("asks one question, shows three steps and offers one button", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Which robot could do your job?");
    const starts = screen.getAllByRole("link", { name: "Start a job" });
    expect(starts).toHaveLength(1);
    expect(starts[0]).toHaveAttribute("href", "/contact/site-operator");
    expect(screen.getByText("Free during the beta")).toBeInTheDocument();
    expect(screen.getByText("A video, where the job is, and an email.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "How it works ›" })).toHaveAttribute("href", "/how-it-works");
    expect(screen.getByRole("link", { name: "For robot companies ›" })).toHaveAttribute("href", "/partners");
    // The limits of the check, in one line.
    expect(screen.getByText("We check pick-up-and-put-down jobs. Not a test at your site, or a safety check.")).toBeInTheDocument();
    // The example: real robot names, made-up jobs, marked as an example.
    expect(screen.getAllByRole("tab").map(tab => tab.textContent)).toEqual(["Packaging", "Warehouse", "Café", "Laundromat", "Factory", "Lab"]);
    const heldTabs = screen.getAllByRole("tab").filter(tab => { fireEvent.click(tab); return /Held\./.test(screen.getByRole("tabpanel").textContent ?? ""); });
    expect(heldTabs.map(tab => tab.textContent)).toEqual(["Laundromat", "Lab"]);
    fireEvent.click(screen.getByRole("tab", { name: "Packaging" }));
    const panel = screen.getByRole("tabpanel");
    // The answer a site gets is the test result (owner, 2026-11-11). The results are invented, so the names are made up.
    expect(panel).toHaveTextContent(/Example.*12 kg cartons.*pallet.*Did best on your job.*Robot B \+ AI software 2.*Did your job in 8 of 10 tries.*Ahead of the 3 other AI robots we tested.*How sure are we\?.*Fairly sure/);
    expect(panel).not.toHaveTextContent(/Universal Robots|UR20|FANUC|Unitree|Hello Robot|Stretch/);
    expect(panel).not.toHaveTextContent(/Ornua|Bob.s Red Mill|Verla|Georgia Nut|Danish Crown|Napco/);
    expect(panel).not.toHaveTextContent(/cycle time|Pilot price|Budget|%/i);
    expect(screen.getByText("The names, jobs and results are made up.")).toBeInTheDocument();
    // Not every example has a winner.
    fireEvent.click(screen.getByRole("tab", { name: "Café" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent(/Tested on your job.*No clear winner yet/);
    fireEvent.click(screen.getByRole("tab", { name: "Café" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent(/dish rack/);
    expect(screen.getByRole("img", { name: /café example/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause examples" })).toBeInTheDocument();
  });

  it.each([
    ["Packaging", /fixed robot arm/i, /cartons.*conveyor.*pallet.*Did best on your job.*Robot B \+ AI software 2.*8 of 10 tries/i],
    ["Warehouse", /humanoid robot/i, /totes.*shelf.*cart.*Did best on your job.*Robot D \+ AI software 1.*6 of 10 tries.*Not sure yet/i],
    ["Café", /fixed robot arm/i, /clean cups.*dish rack.*counter.*Tested on your job.*No clear winner yet.*5 of 10 tries/i],
    // Jobs that are not one solid object picked up and put down are held, as the real answer does.
    ["Laundromat", /wheeled humanoid/i, /folding towels.*wash-and-fold.*Answer.*Held\..*can't test this kind of job yet/i],
    ["Factory", /mobile manipulator/i, /small blanks.*machine.*Did best on your job.*Robot E \+ AI software 3.*9 of 10 tries/i],
    ["Lab", /fixed robot arm/i, /opening the sample drawer before each batch.*Answer.*Held\./i],
  ])("pairs the %s example with its answer and matching illustration", (site, embodiment, task) => {
    render(<Home />);
    const tab = screen.getByRole("tab", { name: site });
    fireEvent.click(tab);
    expect(tab).toHaveAttribute("aria-selected", "true");
    const panel = screen.getByRole("tabpanel", { name: site });
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
      site: "Packaging",
      // The pallet, the arm's pedestal and the packing conveyor.
      landmarks: ['rect[x="58"][y="168"][width="92"][height="6"]', 'rect[x="160"][y="118"][width="20"][height="62"]', 'rect[x="206"][y="120"][width="104"][height="10"]'],
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
  });

  it("keeps a restored example selected and still while paused", () => {
    vi.useFakeTimers();
    try {
      render(<Home />);
      fireEvent.click(screen.getByRole("button", { name: "Pause examples" }));
      fireEvent.click(screen.getByRole("tab", { name: "Factory" }));
      const art = screen.getByRole("img", { name: /factory example/i });
      const stillFrame = art.innerHTML;
      act(() => { vi.advanceTimersByTime(31000); });
      expect(screen.getByRole("tab", { name: "Factory" })).toHaveAttribute("aria-selected", "true");
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
      expect(screen.getByRole("tabpanel")).toHaveTextContent(/folding towels/i);
      expect(art.innerHTML).toBe(stillFrame);
    } finally {
      matchMedia.mockRestore();
      vi.useRealTimers();
    }
  });

  // Owner direction, 2026-11-11: three steps. Step 2 is the owner's: Blueprint tests the top AI robots on the job in a
  // simulation of the site and shows which did best; step 3 stays "Find a company to set it up".
  it("shows three steps from the video through the test in simulation to a company", () => {
    render(<Home />);
    const steps = within(screen.getByRole("list", { name: "How it works" })).getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    expect(steps[0]).toHaveTextContent("Send a video of one job that repeats");
    expect(steps[1]).toHaveTextContent(/We test the top AI robots on your job\s*in a simulation of your site, and show you which did best\./);
    expect(steps[2]).toHaveTextContent("Find a company to set it up");
    expect(screen.getByRole("list", { name: "How it works" })).toHaveAttribute("id", "how-it-works");
  });

  it("supports keyboard navigation across the illustrative examples", () => {
    render(<Home />);
    const first = screen.getByRole("tab", { name: "Packaging" });
    fireEvent.keyDown(first, { key: "ArrowRight" });
    const next = screen.getByRole("tab", { name: "Warehouse" });
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
      act(() => screen.getByRole("tab", { name: "Packaging" }).focus());
      fireEvent.mouseLeave(section);
      act(() => { vi.advanceTimersByTime(11000); });
      expect(screen.getByRole("tab", { name: "Packaging" })).toHaveAttribute("aria-selected", "true");
      act(() => screen.getByRole("tab", { name: "Packaging" }).blur());
      act(() => { vi.advanceTimersByTime(11000); });
      expect(screen.getByRole("tab", { name: "Warehouse" })).toHaveAttribute("aria-selected", "true");
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
      expect(screen.getByRole("tab", { name: "Warehouse" })).toHaveAttribute("aria-selected", "true");
      act(() => { vi.advanceTimersByTime(10000); });
      expect(screen.getByRole("tab", { name: "Café" })).toHaveAttribute("aria-selected", "true");
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
      expect(screen.getByRole("tab", { name: "Packaging" })).toHaveAttribute("aria-selected", "true");
      fireEvent.click(screen.getByRole("button", { name: "Play examples" }));
      expect(screen.getByRole("button", { name: "Pause examples" })).toHaveFocus();
      act(() => { vi.advanceTimersByTime(11000); });
      expect(screen.getByRole("tab", { name: "Warehouse" })).toHaveAttribute("aria-selected", "true");
    } finally {
      vi.useRealTimers();
    }
  });
});
