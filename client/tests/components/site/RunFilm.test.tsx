import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RunFilm } from "@/components/site/runFilm";
import {
  runFilmActs,
  runFilmRoutes,
  runFilmRungs,
  runFilmStamps,
} from "@/data/publicSiteCopy";
import { ACT, LAST_ACT } from "@/components/site/runFilm/useActProgress";

/**
 * Pins which telling the film picks. jsdom reports a 1024px-wide window, so the
 * default there is the scrubbing telling — the stepped one has to be asked for
 * explicitly rather than assumed.
 */
function stubViewport(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

/** The prerender / phone / reduced-motion path. */
const useNarrowViewport = () => stubViewport(false);
/** The pinned, scroll-driven path. */
const useWideViewport = () => stubViewport(true);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RunFilm", () => {
  it("tells the whole story with no scrolling, no JavaScript-driven reveal, and no motion", () => {
    useNarrowViewport();
    const { container } = render(<RunFilm />);

    expect(container.querySelector('[data-run-film="stepped"]')).toBeTruthy();
    expect(container.querySelector('[data-run-film="scrub"]')).toBeNull();

    // Every act's caption is present as real text, without any scroll.
    expect(runFilmActs).toHaveLength(7);
    for (const filmAct of runFilmActs) {
      expect(container).toHaveTextContent(filmAct.caption);
      expect(screen.getAllByText(filmAct.label, { exact: false }).length).toBeGreaterThan(0);
    }
  });

  it("marks its schematic values as illustrative", () => {
    useNarrowViewport();
    render(<RunFilm />);
    expect(screen.getAllByText(/^Illustrative$/i).length).toBeGreaterThan(0);
  });

  it("states that a run grants neither deployment approval nor safety certification", () => {
    useNarrowViewport();
    const { container } = render(<RunFilm />);

    // The contract-level guarantee: DecisionEnvelope fails validation unless
    // both of these are false, so both must be legible on the page.
    expect(runFilmStamps.map((stamp) => stamp.label)).toEqual([
      "Deployment approval",
      "Safety certification",
    ]);
    for (const stamp of runFilmStamps) {
      expect(container).toHaveTextContent(new RegExp(`${stamp.label}\\s*No`, "i"));
    }

    // And it is readable, not buried in the decorative stage.
    const limits = screen.getAllByText(/Deployment approval/i);
    expect(limits.some((node) => node.closest('[aria-hidden="true"]') === null)).toBe(true);
  });

  it("carries every verdict as a word, never as colour alone", () => {
    useNarrowViewport();
    const { container } = render(<RunFilm />);
    for (const label of ["Supported", "Rejected", "Unresolved"]) {
      expect(container).toHaveTextContent(new RegExp(`^${label}$`.replace(/[$^]/g, ""), "i"));
    }
    // The closing act names the ordering and the resolution that bounds it,
    // rather than leading on what the run declined to say.
    expect(container).toHaveTextContent(/the smallest gap this run could separate/i);
  });

  it.each([["stepped", useNarrowViewport], ["scrub", useWideViewport]])(
    "exposes the claim-level results to assistive technology in %s mode",
    (_mode, setViewport) => {
      setViewport();
      const { container } = render(<RunFilm />);

      // `toHaveTextContent` ignores aria-hidden, so asserting on the container
      // alone would pass on content a screen reader never receives. The stage is
      // decorative; the evidence has to live outside it.
      const accessible = [...container.querySelectorAll("div.sr-only > table")].filter(
        (node) => node.closest('[aria-hidden="true"]') === null,
      );
      expect(accessible).toHaveLength(1);
      const summary = accessible[0] as HTMLElement;

      for (const route of runFilmRoutes) {
        const row = within(summary).getByRole("rowheader", { name: route.short });
        expect(row).toBeInTheDocument();
      }
      // Verdict, routed rung, basis, refusal reason and next test all reachable.
      for (const label of ["Supported", "Rejected", "Unresolved"]) {
        expect(summary).toHaveTextContent(label);
      }
      const gated = runFilmRoutes.find((route) => route.gate)!;
      expect(summary).toHaveTextContent(gated.gate!.reason.slice(0, 40));
      expect(summary).toHaveTextContent(/Next test that would settle it/i);
      expect(summary).toHaveTextContent(runFilmRungs[gated.rung].label);
      expect(summary).toHaveTextContent(runFilmRungs[gated.rung].basis);

      // `sr-only` on a <table> does not contain it — a table's intrinsic
      // minimum width beats `width: 1px` and blows out horizontal scroll.
      expect(container.querySelector("table.sr-only")).toBeNull();
      expect(summary.parentElement).toHaveClass("sr-only");
    },
  );

  it("shows each claim stopping at its own rung, and one being refused a rung", () => {
    useNarrowViewport();
    const { container } = render(<RunFilm />);

    // The three claims are routed to three different rungs — the thing prose
    // cannot show. If they ever collapse to one rung the film loses its point.
    const rungs = runFilmRoutes.map((route) => route.rung);
    expect(new Set(rungs).size).toBe(runFilmRoutes.length);

    // Exactly one claim is turned away at a gate, and the reason is on screen.
    const gated = runFilmRoutes.filter((route) => route.gate);
    expect(gated).toHaveLength(1);
    expect(container).toHaveTextContent(new RegExp(gated[0].gate!.reason.slice(0, 40), "i"));

    // Cost order is not authority order: the basis of the rung is stated, so a
    // cheaper rung is never read as a weaker standard of proof.
    expect(container).toHaveTextContent(/Real capture/i);
    expect(container).toHaveTextContent(/Computed from capture/i);

    // An unresolved claim carries the next test that would settle it.
    const unresolved = runFilmRoutes.find((route) => route.nextTest !== undefined);
    expect(unresolved).toBeDefined();
    expect(container).toHaveTextContent(
      new RegExp(runFilmRungs[unresolved!.nextTest!].label, "i"),
    );
  });

  it("names no provider, model, or vendor", () => {
    useNarrowViewport();
    const { container } = render(<RunFilm />);
    const text = container.textContent ?? "";
    for (const forbidden of [
      "NVIDIA", "Isaac", "Cosmos", "OpenAI", "GPT", "Gemini", "Claude", "Anthropic",
      "Unreal", "Unity", "MuJoCo", "Genesis", "Luma", "Polycam", "Matterport",
    ]) {
      expect(text).not.toMatch(new RegExp(forbidden, "i"));
    }
  });

  it("gives the act stepper an accessible name for every act, plus a replay control", () => {
    useWideViewport();
    const { container } = render(<RunFilm />);

    expect(container.querySelector('[data-run-film="scrub"]')).toBeTruthy();

    const stepper = screen.getByRole("navigation", { name: /acts of the run/i });
    runFilmActs.forEach((filmAct, index) => {
      const button = within(stepper).getByRole("button", {
        name: new RegExp(`Act ${index + 1}:\\s*${filmAct.label}`, "i"),
      });
      expect(button).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /replay/i })).toBeInTheDocument();
  });

  it("keeps the act list reachable even while the film is scrubbing", () => {
    useWideViewport();
    const { container } = render(<RunFilm />);
    for (const filmAct of runFilmActs) {
      expect(container).toHaveTextContent(filmAct.caption);
    }
    expect(container).toHaveTextContent(/Deployment approval/i);
  });

  it("keeps act indices and the script in the same order", () => {
    // The film's timing is written against ACT.*; if the script is reordered
    // without updating these, every act animates at the wrong moment.
    expect(runFilmActs.map((filmAct) => filmAct.id)).toEqual([
      "capture", "testbed", "decision", "claims", "routing", "measurement", "envelope",
    ]);
    expect(ACT.capture).toBe(0);
    expect(ACT.envelope).toBe(LAST_ACT);
    expect(LAST_ACT).toBe(runFilmActs.length - 1);
  });

  it("keeps every caption inside the 22-word budget and every label inside 8", () => {
    // This is an acceptance criterion from the film's brief, not a style note:
    // a caption that needs more than 22 words is carrying two acts.
    for (const filmAct of runFilmActs) {
      expect(filmAct.caption.trim().split(/\s+/).length).toBeLessThanOrEqual(22);
      expect(filmAct.label.trim().split(/\s+/).length).toBeLessThanOrEqual(8);
    }
    for (const route of runFilmRoutes) {
      expect(route.short.trim().split(/\s+/).length).toBeLessThanOrEqual(8);
    }
  });

  it("renders the compact cut from the same script", () => {
    useNarrowViewport();
    const { container } = render(<RunFilm variant="compact" />);
    for (const filmAct of runFilmActs) {
      expect(container).toHaveTextContent(filmAct.caption);
    }
  });
});
