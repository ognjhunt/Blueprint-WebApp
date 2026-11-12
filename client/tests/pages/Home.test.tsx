import { fireEvent, render, screen, within } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import Home from "@/pages/Home";
import { COMPANY_RESPONSE_LABELS } from "@/lib/companyResponses";

const SITES = ["Warehouse", "Café", "Laundromat", "Factory", "Hotel", "Lab"];

describe("Site-led homepage", () => {
  // Owner, 2026-11-12: the 11 Nov layout with the new words. The title is the outcome, not "job packet"; the home page
  // does not lead with privacy; the fine line goes; the moving example card is back where it was.
  it("says the outcome, shows three steps and offers one button", () => {
    const { container } = render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Get repetitive work done by robots.");
    expect(container).toHaveTextContent("Film the job once. Robot deployment companies can test it on a simulation of your site and tell you if they can do it.");
    const starts = screen.getAllByRole("link", { name: "Start a job" });
    expect(starts).toHaveLength(1);
    expect(starts[0]).toHaveAttribute("href", "/contact/site-operator");
    expect(screen.getByText("Free for sites")).toBeInTheDocument();
    expect(screen.getByText("A video, where the job is, and an email.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "How it works ›" })).toHaveAttribute("href", "/how-it-works");
    expect(screen.getByRole("link", { name: "Deploy robots? See how jobs reach you ›" })).toHaveAttribute("href", "/partners");
    expect(container.textContent).not.toMatch(/pick-up-and-put-down|safety check|job packet|contact details/i);
    // No price, no invented test result, no model or product names.
    expect(container.textContent).not.toMatch(/\$\s?\d|beta|did best|AI robot|AI software|how sure|confidence|%/i);
  });

  it("shows three steps from the video through the simulation to the companies' answers", () => {
    render(<Home />);
    const steps = within(screen.getByRole("list", { name: "How it works" })).getAllByRole("listitem");
    expect(steps.map(step => step.textContent)).toEqual([
      "Send a video of one job that repeats.",
      "We send the job to robot deployment companies we approve and build a simulation of your site for them to test.",
      "Their answers come back to you: interested, can do, not a fit, or would need something. You pick who to meet.",
    ]);
    expect(screen.getByRole("list", { name: "How it works" })).toHaveAttribute("id", "how-it-works");
  });

  // The card: a small job page once companies answer. Every example says "Example" in words, its accessible name says
  // it is an example, and its answers use only the real labels and aliases a site sees.
  it("marks every example as an example and uses only the real answer labels", () => {
    render(<Home />);
    const card = screen.getByRole("region", { name: "Example of a job page once deployment companies answer" });
    expect(within(card).getByText("Everything in this example is made up.")).toBeInTheDocument();
    expect(within(card).getAllByRole("tab").map(tab => tab.textContent)).toEqual(SITES);
    const labels = Object.values(COMPANY_RESPONSE_LABELS);
    const counts = new Set<number>();
    for (const tab of within(card).getAllByRole("tab")) {
      fireEvent.click(tab);
      const panel = within(card).getByRole("tabpanel");
      expect(panel).toHaveTextContent(/^Example/);
      const sent = (panel.textContent ?? "").match(/Sent to (\d) deployment companies/);
      expect(sent, tab.textContent!).not.toBeNull();
      const count = Number(sent![1]);
      expect(count).toBeGreaterThanOrEqual(3);
      expect(count).toBeLessThanOrEqual(8);
      counts.add(count);
      const answers = within(panel).queryAllByRole("listitem").map(item => item.textContent);
      expect(answers.length).toBeLessThanOrEqual(3);
      answers.forEach((answer, i) => {
        const [alias, label] = answer!.split(" · ");
        expect(alias).toBe(`Company ${"ABC"[i]}`);
        expect(labels).toContain(label);
      });
      expect(panel).not.toHaveTextContent(/did best|AI robot|AI software|how sure|confidence|held|%|\$|tries/i);
    }
    expect(counts.size).toBeGreaterThan(1);
    fireEvent.click(within(card).getByRole("tab", { name: "Warehouse" }));
    expect(within(card).getByRole("tabpanel")).toHaveTextContent(
      /Example.*Warehouse: Picking small parcels.*Sent to 6 deployment companies.*Company A · Tested it: can do.*Company B · Would need something.*Company C · Not a fit/);
    // One example shows the state before any answer.
    fireEvent.click(within(card).getByRole("tab", { name: "Lab" }));
    expect(within(card).getByRole("tabpanel")).toHaveTextContent(/Example.*Sent to 5 deployment companies.*No answers yet\./);
  });

  it.each([
    ["Warehouse", /humanoid robot/i],
    ["Café", /fixed robot arm/i],
    ["Laundromat", /wheeled humanoid/i],
    ["Factory", /mobile manipulator/i],
    ["Hotel", /mobile robot/i],
    ["Lab", /fixed robot arm/i],
  ])("pairs the %s example with its matching illustration", (site, embodiment) => {
    render(<Home />);
    const tab = screen.getByRole("tab", { name: site });
    fireEvent.click(tab);
    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: site })).toHaveTextContent(site);
    expect(screen.getByRole("img", { name: new RegExp(`${site} example`, "i") })).toHaveAccessibleName(embodiment);
  });

  it("keeps a chosen example selected and still while paused", () => {
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
      expect(screen.getByRole("tabpanel")).toHaveTextContent(/folded towels/i);
      expect(art.innerHTML).toBe(stillFrame);
    } finally {
      matchMedia.mockRestore();
      vi.useRealTimers();
    }
  });

  it("supports keyboard navigation across the examples", () => {
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

  it("keeps rotating while the pointer rests on the card, and holds while a keyboard user is inside it", () => {
    vi.useFakeTimers();
    try {
      render(<Home />);
      const section = screen.getByRole("tabpanel").closest("section")!;
      fireEvent.mouseEnter(section);
      act(() => { vi.advanceTimersByTime(11000); });
      expect(screen.getByRole("tab", { name: "Café" })).toHaveAttribute("aria-selected", "true");
      act(() => screen.getByRole("tab", { name: "Café" }).focus());
      act(() => { vi.advanceTimersByTime(11000); });
      expect(screen.getByRole("tab", { name: "Café" })).toHaveAttribute("aria-selected", "true");
      act(() => screen.getByRole("tab", { name: "Café" }).blur());
      act(() => { vi.advanceTimersByTime(11000); });
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
