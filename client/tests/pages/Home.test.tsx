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
    expect(screen.getAllByRole("tab").map(tab => tab.textContent)).toEqual(["Packaging", "Warehouse", "Café", "Laundromat", "Factory", "Lab"]);
    // No more than two tabs are held, so the card mostly shows answers.
    const heldTabs = screen.getAllByRole("tab").filter(tab => { fireEvent.click(tab); return /Held\./.test(screen.getByRole("tabpanel").textContent ?? ""); });
    expect(heldTabs.map(tab => tab.textContent)).toEqual(["Laundromat", "Lab"]);
    fireEvent.click(screen.getByRole("tab", { name: "Packaging" }));
    const panel = screen.getByRole("tabpanel");
    // The example is an answer: the job, the pick, a runner-up, one ruled out with its
    // reason, the proof in simulation, how sure and the next step (owner, 2026-11-11).
    // The default example is a job the answer covers well, with every robot figure published:
    // UR20 1.75 m and 20 kg, HC20DTP 1.9 m and 20 kg, the UR5e ruled out on its 5 kg payload.
    expect(panel).toHaveTextContent(/Job.*cartons.*about 12 kg.*pallet.*Most likely fits.*Universal Robots UR20.*reach 1\.75 m, payload 20 kg.*Runner-up.*Yaskawa HC20DTP.*reach 1\.9 m, payload 20 kg.*Ruled out.*Universal Robots UR5e.*payload is 5 kg.*Who uses it.*palletizing cells built on both arms.*each with its source.*Proof in simulation.*reach, path and cycle time.*how much that result can be trusted.*How sure.*Fair.*Next step.*anonymised job card.*approved/);
    // No customer is named on the home page.
    expect(panel).not.toHaveTextContent(/Ornua|Bob.s Red Mill|Verla|Georgia Nut|Danish Crown|Napco/);
    expect(screen.getByRole("heading", { name: "One job. One answer, with its proof." })).toBeInTheDocument();
    expect(screen.getByText("Illustrative answer")).toBeInTheDocument();
    expect(screen.getByText(/not available offers or measured results/)).toBeInTheDocument();
    expect(screen.getByText(/the jobs, distances, weights and answers are made up for illustration/)).toBeInTheDocument();
    // The old pilot-plan rows are gone, and no example invents a score, a customer or a price.
    expect(panel).not.toHaveTextContent(/Passed on your task|Pilot price|Budget|Delivery scope|\d+ of \d+ tries|%/);
    expect(screen.queryByText("Book this pilot")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Café" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent(/dish rack/);
    expect(screen.getByRole("img", { name: /café example/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause examples" })).toBeInTheDocument();
    expect(screen.queryByText(/Your criteria/)).not.toBeInTheDocument();
  });

  it.each([
    ["Packaging", /fixed robot arm/i, /sealed cartons.*packing conveyor.*pallet.*Most likely fits.*Universal Robots UR20, a fixed robot arm/i],
    ["Warehouse", /humanoid robot/i, /light totes.*shelf.*outbound cart.*Most likely fits.*Unitree G1, a walking humanoid robot/i],
    ["Café", /fixed robot arm/i, /clean cups.*dish rack.*counter.*Most likely fits.*FANUC CRX-10iA, a fixed robot arm.*1\.249 m.*10 kg/i],
    // Jobs that are not one solid object picked up and put down are held, as the real answer does.
    ["Laundromat", /wheeled humanoid/i, /folding towels.*wash-and-fold.*Answer.*Held.*Folding cloth is another kind of job/i],
    ["Factory", /mobile manipulator/i, /loading small blanks.*CNC machine.*unloading finished parts.*Most likely fits.*Stretch 3, a mobile manipulator/i],
    ["Lab", /fixed robot arm/i, /opening the sample drawer before each batch.*Answer.*Held.*Opening a drawer/i],
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

  // Owner direction, 2026-11-11: video, then the answer, then proof in simulation, then a deployment company.
  it("shows four customer steps from video through the answer and simulation to a deployment company", () => {
    render(<Home />);
    const steps = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(steps).toHaveLength(4);
    expect(steps[0]).toHaveTextContent(/Send a video of the job.*email and a video.*draft the job description from the video/);
    expect(steps[1]).toHaveTextContent(/See which robot fits.*published specifications.*most likely fits.*runner-up.*ruled out and why.*with sources.*how sure we are/i);
    expect(steps[2]).toHaveTextContent(/Proof in simulation.*simulation of your site.*control policies.*which did best.*how much that result can be trusted.*“held”/i);
    expect(steps[3]).toHaveTextContent(/Find a deployment company.*anonymised job card.*approved.*agree any pilot directly/);
    const method = screen.getByRole("region", { name: "From one video to a robot that fits." });
    expect(method).not.toHaveTextContent(/screening|scored in full|comparable proposals|recommend the approach|candidates?|episodes?|embodiment/i);
    expect(method).not.toHaveTextContent(/robot teams?/i);
    expect(screen.getByText(/the software that drives a robot/)).toBeInTheDocument();
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
