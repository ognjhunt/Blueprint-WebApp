// @vitest-environment jsdom
/**
 * The owner's readiness panel: the site rebuilt in 3D, the steps to a pilot,
 * the next three things (each opens the step that answers it), how the job
 * runs today and what it takes today, then the robot readiness report once
 * Blueprint shares it. It reads again after the measurements step or the
 * how-it-runs form saves, and shows nothing it could not load.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: async (headers: Record<string, string>) => ({ ...headers, "X-CSRF-Token": "csrf" }),
}));

import { SiteReadinessPanel } from "@/components/site/SiteReadinessPanel";
import { SITE_MEASUREMENTS_SAVED_EVENT, SITE_ROBOT_FIT_NOTE } from "@/data/robotFit";
import type { SiteReadinessReport, SiteReadinessResponse } from "@/data/siteReadiness";

const fetchMock = vi.fn();

const REPORT: SiteReadinessReport = {
  robotFit: { needs: ["It has to pick the object up and put it down at another spot."], forms: [
    { id: "wheeled_humanoid", label: "Wheeled humanoid", description: "A human-like upper body with two arms, on a wheeled base.",
      verdict: "fits", reasons: [] }], unknowns: [], note: SITE_ROBOT_FIT_NOTE },
  checklist: [{ id: "floor_space", title: "Floor space at the station", state: "check",
    detail: "There is 80 cm of open floor in front of the starting surface (you measured this). That is tight for a robot's stand or base, so Blueprint checks it in the rebuilt scene.",
    why: "A robot needs room to stand, or to drive up, beside the work." }],
  successFactors: [{ id: "speed", title: "Speed", detail: "Your target, 45 seconds per cycle, is faster than today's 60 seconds (measured from your video).",
    test: "The evaluation measures cycle time against your target.", where: "simulation" }],
  safety: ["Before a robot works at your site, the robot team does a risk assessment of the job with you."],
  examples: [{ id: "line-side-packing", name: "Line-side packing", status: "emerging", evidence: "Reported on an assembly line.",
    sources: [{ label: "China Daily", href: "https://example.org/source" }] }],
  examplesFootnote: "None is a Blueprint customer and none was prepared by Blueprint.",
};

function readiness(overrides: Partial<SiteReadinessResponse> = {}): SiteReadinessResponse {
  return {
    ok: true, summary: "Pack finished parts into cartons",
    tracker: { steps: [
      { id: "video", label: "Video received", state: "done", detail: null, owner: "site" },
      { id: "measurements", label: "Measurements", state: "partial", detail: "2 of 6", owner: "site" },
      { id: "scene", label: "Your site rebuilt in 3D", state: "in_progress", detail: null, owner: "blueprint" },
    ], meanwhile: "Blueprint is rebuilding your work area in 3D from your video." },
    nextThings: [{ id: "measure_distance", action: "Measure how far the object moves", why: "It tells us which robots can reach both spots.", target: "measurements" }],
    operations: { timesPerDay: null, daysPerWeek: null, peopleNearby: null, updatedAtIso: null },
    workload: null, speed: null, report: null,
    ...overrides,
  };
}

const respond = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("SiteReadinessPanel", () => {
  it("shows only the next steps, as links, with everything else folded", async () => {
    fetchMock.mockResolvedValue(respond(readiness()));
    const { container } = render(<SiteReadinessPanel token="tok" />);
    const steps = await screen.findByRole("region", { name: "Your next steps" });
    expect(within(steps).getByRole("button", { name: "Measure how far the object moves" })).toBeInTheDocument();
    // No explanations, status lines or robot lists on the job page: the brief carries them.
    expect(steps.textContent).toBe("Your next stepsMeasure how far the object moves →");
    expect(fetchMock).toHaveBeenCalledWith("/api/site-task-brief/tok/readiness");
    // The full tracker lives on the printable brief, not the job page.
    expect(screen.queryByText("2 of 6")).toBeNull();
    const folded = [...container.querySelectorAll("details")];
    expect(folded.map((details) => details.querySelector("summary")?.textContent)).toEqual(["How the job runs today (optional)"]);
    expect(folded.every((details) => !details.open)).toBe(true);
  });

  it("says when nothing is needed from the site", async () => {
    fetchMock.mockResolvedValue(respond(readiness({ nextThings: [] })));
    render(<SiteReadinessPanel token="tok" />);
    expect(await screen.findByText("Nothing is needed from you right now.")).toBeInTheDocument();
  });

  it("opens the step that answers a next thing", async () => {
    fetchMock.mockResolvedValue(respond(readiness()));
    const details = document.createElement("details");
    details.id = "site-measurements";
    details.innerHTML = "<summary>Add measurements (optional)</summary>";
    details.scrollIntoView = vi.fn();
    document.body.appendChild(details);
    render(<SiteReadinessPanel token="tok" />);
    fireEvent.click(await screen.findByRole("button", { name: "Measure how far the object moves" }));
    expect(details.open).toBe(true);
    expect(details.scrollIntoView).toHaveBeenCalled();
  });

  it("saves how the job runs, then reads again and shows the hours in the next steps", async () => {
    fetchMock.mockResolvedValueOnce(respond(readiness()));
    render(<SiteReadinessPanel token="tok" />);
    const form = await screen.findByRole("form", { name: "How the job runs today" });
    fireEvent.change(within(form).getByLabelText("How many times a day is the job done?"), { target: { value: "120" } });
    fireEvent.change(within(form).getByLabelText("On how many days a week?"), { target: { value: "5" } });
    fireEvent.click(within(form).getByLabelText("People work in the same space"));
    fetchMock.mockResolvedValueOnce(respond({ ok: true, operations: { timesPerDay: 120, daysPerWeek: 5, peopleNearby: "shared", updatedAtIso: "t" } }));
    fetchMock.mockResolvedValueOnce(respond(readiness({
      operations: { timesPerDay: 120, daysPerWeek: 5, peopleNearby: "shared", updatedAtIso: "t" },
      workload: { headline: "about 10 person-hours a week", hoursPerDay: 2, hoursPerWeek: 10, sentence: "This job takes about 2 person-hours a day, about 10 a week.",
        basis: "120 times a day, 5 days a week (you told us), at about 60 seconds per cycle (measured from your video). It counts time on this job only." },
    })));
    fireEvent.click(within(form).getByRole("button", { name: "Save answers" }));
    expect(await screen.findByText("How the job runs today · about 10 person-hours a week")).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/site-task-brief/tok/operations");
    expect(init).toMatchObject({ method: "PUT", headers: { "X-CSRF-Token": "csrf" } });
    expect(JSON.parse(init.body)).toEqual({ timesPerDay: 120, daysPerWeek: 5, peopleNearby: "shared" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("refuses a times-a-day answer that is not a whole number without sending it", async () => {
    fetchMock.mockResolvedValueOnce(respond(readiness()));
    render(<SiteReadinessPanel token="tok" />);
    const form = await screen.findByRole("form", { name: "How the job runs today" });
    fireEvent.change(within(form).getByLabelText("How many times a day is the job done?"), { target: { value: "2.5" } });
    fireEvent.click(within(form).getByRole("button", { name: "Save answers" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("whole number");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("counts the kinds of robot that fit in the folded report's title, with its sources and brief inside", async () => {
    fetchMock.mockResolvedValue(respond(readiness({ report: REPORT })));
    const { container } = render(<SiteReadinessPanel token="tok" />);
    await screen.findByRole("region", { name: "Your next steps" });
    const report = [...container.querySelectorAll("details")]
      .find((details) => details.querySelector("summary")?.textContent === "Your robot readiness report · 1 kind of robot fits")!;
    expect(report.open).toBe(false);
    expect(within(report).getByText("Check this")).toBeInTheDocument();
    expect(within(report).getByText("Tested in the simulation")).toBeInTheDocument();
    expect(within(report).getByRole("link", { name: "China Daily" })).toHaveAttribute("href", "https://example.org/source");
    expect(within(report).getByText(REPORT.examplesFootnote)).toBeInTheDocument();
    expect(within(report).getByRole("link", { name: "Print or save a one-page brief" })).toHaveAttribute("href", "/capture-upload/tok/brief");
    expect(container.textContent).not.toMatch(/\bmatch/i);
  });

  it("reads again when measurements are saved, and shows nothing it could not read", async () => {
    fetchMock.mockResolvedValueOnce(respond({ error: "unavailable" }, 503));
    const { container } = render(<SiteReadinessPanel token="tok" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(container).toBeEmptyDOMElement();
    fetchMock.mockResolvedValueOnce(respond(readiness()));
    await act(async () => { window.dispatchEvent(new Event(SITE_MEASUREMENTS_SAVED_EVENT)); });
    expect(await screen.findByRole("region", { name: "Your next steps" })).toBeInTheDocument();
  });
});
