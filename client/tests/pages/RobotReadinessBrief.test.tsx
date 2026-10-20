// @vitest-environment jsdom
/**
 * The one-page robot readiness brief: where the job stands, what it takes
 * today, the robot readiness report once shared, what is left to check, and a
 * print button, from the owner's private link. It says so plainly when the
 * report is not shared yet, and when the brief cannot be read.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("wouter", () => ({ useRoute: () => [true, { token: "tok" }] }));

import RobotReadinessBrief from "@/pages/RobotReadinessBrief";
import { SITE_ROBOT_FIT_NOTE } from "@/data/robotFit";
import { READINESS_BRIEF_FOOTER, type SiteReadinessResponse } from "@/data/siteReadiness";

const fetchMock = vi.fn();

const READINESS: SiteReadinessResponse = {
  ok: true, summary: "Pack finished parts into cartons",
  tracker: { steps: [{ id: "brief", label: "Job brief confirmed", state: "done", detail: null, owner: "site" }], meanwhile: null },
  nextThings: [{ id: "times_per_day", action: "Tell us how many times a day the job is done", why: "It lets us work out the hours this job takes.", target: "operations" }],
  operations: { timesPerDay: null, daysPerWeek: null, peopleNearby: null, updatedAtIso: null },
  workload: null,
  speed: { state: "needs_target", sentence: "Your people take about 60 seconds per cycle (measured from your video)." },
  report: null,
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("RobotReadinessBrief", () => {
  it("lays out where things stand, what the job takes, what is left, and prints", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => READINESS });
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    render(<RobotReadinessBrief />);
    expect(await screen.findByRole("heading", { level: 1, name: "Pack finished parts into cartons" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/site-task-brief/tok/readiness");
    expect(screen.getByText("Job brief confirmed")).toBeInTheDocument();
    expect(screen.getByText(READINESS.speed!.sentence)).toBeInTheDocument();
    expect(screen.getByText(/appears here once Blueprint has reviewed your job/)).toBeInTheDocument();
    expect(screen.getByText("Tell us how many times a day the job is done")).toBeInTheDocument();
    expect(screen.getByText(READINESS_BRIEF_FOOTER)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Print or save as PDF" }));
    expect(print).toHaveBeenCalled();
  });

  it("includes the shared report", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ...READINESS, report: {
      robotFit: { needs: ["It has to pick the object up and put it down at another spot."], forms: [], unknowns: [], note: SITE_ROBOT_FIT_NOTE },
      checklist: [], successFactors: [], safety: ["Blueprint's evaluation runs in a simulation of your site."], examples: [], examplesFootnote: "" } }) });
    render(<RobotReadinessBrief />);
    expect(await screen.findByText("Blueprint's evaluation runs in a simulation of your site.")).toBeInTheDocument();
    expect(screen.queryByText(/appears here once Blueprint has reviewed/)).toBeNull();
  });

  it("says when the brief cannot be read", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "This link is for filming only." }) });
    render(<RobotReadinessBrief />);
    expect(await screen.findByRole("alert")).toHaveTextContent("This link is for filming only.");
  });
});
