import { fireEvent, render, screen, within } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import Home from "@/pages/Home";
import { COMPANY_RESPONSE_LABELS } from "@/lib/companyResponses";

const SITES = ["Warehouse", "Café", "Lab"];

describe("Site-led homepage", () => {
  it("says the outcome, shows three steps and offers one button", () => {
    const { container } = render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Post a job for robots.");
    expect(container).toHaveTextContent("Film one repetitive job and find out who wants to deploy robots for it.");
    const starts = screen.getAllByRole("link", { name: "Start a job" });
    expect(starts).toHaveLength(1);
    expect(starts[0]).toHaveAttribute("href", "/contact/site-operator");
    expect(screen.getByText("Free for sites.")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/pick-up-and-put-down|safety check|contact details/i);
    // No price, no invented test result, no model or product names.
    expect(container.textContent).not.toMatch(/\$\s?\d|beta|did best|AI robot|AI software|how sure|confidence|%/i);
  });

  it("shows three steps from the video through responses and introductions", () => {
    render(<Home />);
    const steps = within(screen.getByRole("list", { name: "How it works" })).getAllByRole("listitem");
    expect(steps.map(step => step.textContent)).toEqual([
      "Film the job",
      "Companies review it",
      "Choose who to meet",
    ]);
    expect(screen.getByRole("list", { name: "How it works" })).toHaveAttribute("id", "how-it-works");
  });

  // The card: a small job page once companies answer. Every example says "Example" in words, its accessible name says
  // it is an example, and its answers use only the real labels and aliases a site sees.
  it("marks every example as an example and uses only the real answer labels", () => {
    render(<Home />);
    const card = screen.getByRole("region", { name: "Example job" });
    expect(within(card).getByText("Example job")).toBeVisible();
    expect(within(card).getAllByRole("tab").map(tab => tab.textContent)).toEqual(SITES);
    const labels = Object.values(COMPANY_RESPONSE_LABELS);
    const counts = new Set<number>();
    for (const tab of within(card).getAllByRole("tab")) {
      fireEvent.click(tab);
      const panel = within(card).getByRole("tabpanel");
      expect(within(panel).getByRole("heading", { level: 2 })).toBeVisible();
      const sent = (panel.textContent ?? "").match(/(\d) views/);
      expect(sent, tab.textContent!).not.toBeNull();
      const count = Number(sent![1]);
      expect(count).toBeGreaterThanOrEqual(3);
      expect(count).toBeLessThanOrEqual(8);
      counts.add(count);
      const answers = within(panel).queryAllByRole("listitem");
      expect(answers.length).toBeLessThanOrEqual(3);
      answers.forEach((answer, i) => {
        const alias = `Company ${"ABC"[i]}`;
        expect(within(answer).getByText(alias)).toBeVisible();
        expect(labels).toContain(answer.textContent?.slice(alias.length));
      });
      expect(panel).not.toHaveTextContent(/did best|AI robot|AI software|how sure|confidence|held|%|\$|tries/i);
    }
    expect(counts.size).toBeGreaterThan(1);
    fireEvent.click(within(card).getByRole("tab", { name: "Warehouse" }));
    expect(within(card).getByRole("tabpanel")).toHaveTextContent(
      /Picking small parcels.*6 views.*3 responses.*Company A.*Interested.*Company B.*Need more details.*Company C.*Not a fit/);
    // No example shows a "Tested it" answer: no company can give one until a job's simulation can be downloaded.
    for (const tab of within(card).getAllByRole("tab")) {
      fireEvent.click(tab);
      expect(within(card).getByRole("tabpanel")).not.toHaveTextContent(/Tested it/);
    }
    // One example shows the state before any answer.
    fireEvent.click(within(card).getByRole("tab", { name: "Lab" }));
    expect(within(card).getByRole("tabpanel")).toHaveTextContent(/5 views.*0 responses.*No responses yet\./);
  });

  it.each([
    ["Warehouse", /humanoid robot/i],
    ["Café", /fixed robot arm/i],
    ["Lab", /fixed robot arm/i],
  ])("pairs the %s example with its matching illustration", (site, embodiment) => {
    render(<Home />);
    const tab = screen.getByRole("tab", { name: site });
    fireEvent.click(tab);
    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: site })).toBeVisible();
    expect(screen.getByRole("img", { name: new RegExp(`${site} example`, "i") })).toHaveAccessibleName(embodiment);
  });

  it("keeps a chosen example selected and still while paused", () => {
    vi.useFakeTimers();
    try {
      render(<Home />);
      fireEvent.click(screen.getByRole("button", { name: "Pause examples" }));
      fireEvent.click(screen.getByRole("tab", { name: "Lab" }));
      const art = screen.getByRole("img", { name: /lab example/i });
      const stillFrame = art.innerHTML;
      act(() => { vi.advanceTimersByTime(31000); });
      expect(screen.getByRole("tab", { name: "Lab" })).toHaveAttribute("aria-selected", "true");
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
      fireEvent.click(screen.getByRole("tab", { name: "Café" }));
      const art = screen.getByRole("img", { name: /café example/i });
      const stillFrame = art.innerHTML;
      act(() => { vi.advanceTimersByTime(31000); });
      expect(screen.getByRole("tab", { name: "Café" })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("tabpanel")).toHaveTextContent(/clean cups/i);
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
      expect(screen.getByRole("tab", { name: "Lab" })).toHaveAttribute("aria-selected", "true");
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
