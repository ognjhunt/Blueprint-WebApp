// @vitest-environment jsdom
/**
 * The printable robot readiness brief: where the job stands, the robot
 * readiness report once shared, and a print button. It opens by its own
 * read-only link, never the owner's job link, because browsers print a page's
 * address on the paper. It asks the site nothing, and says so plainly when the
 * brief cannot be read.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("wouter", () => ({ useRoute: () => [true, { briefToken: "brief-token.signature" }] }));

import RobotReadinessBrief from "@/pages/RobotReadinessBrief";
import { SITE_ROBOT_FIT_NOTE } from "@/data/robotFit";
import { READINESS_BRIEF_FOOTER, type SiteReadinessResponse } from "@/data/siteReadiness";

const fetchMock = vi.fn();

const READINESS: SiteReadinessResponse = {
  ok: true, summary: "Sort parcels onto outbound chutes",
  tracker: { steps: [{ id: "brief", label: "Job brief confirmed", state: "done", owner: "site" }],
    meanwhile: "Blueprint is rebuilding your work area in 3D from your video." },
  report: null,
  briefPath: null,
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("RobotReadinessBrief", () => {
  it("reads by its own read-only link, lays out where things stand, and prints", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => READINESS });
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    const { container } = render(<RobotReadinessBrief />);
    expect(await screen.findByRole("heading", { level: 1, name: "Sort parcels onto outbound chutes" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/site-task-brief/readiness-brief/brief-token.signature");
    expect(screen.getByText("Job brief confirmed")).toBeInTheDocument();
    expect(screen.getByText(READINESS.tracker.meanwhile!)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Robot readiness report" })).toBeNull();
    expect(screen.getByText(READINESS_BRIEF_FOOTER)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/left to check|tell us|measure/i);
    fireEvent.click(screen.getByRole("button", { name: "Print or save as PDF" }));
    expect(print).toHaveBeenCalled();
  });

  it("includes the shared report", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ...READINESS, report: {
      robotFit: { needs: ["It has to pick the object up and put it down at another spot."], forms: [], note: SITE_ROBOT_FIT_NOTE },
      checklist: [], successFactors: [], safety: ["Blueprint's evaluation runs in a simulation of your site."], examples: [], examplesFootnote: "" } }) });
    render(<RobotReadinessBrief />);
    expect(await screen.findByText("Blueprint's evaluation runs in a simulation of your site.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Robot readiness report" })).toBeInTheDocument();
  });

  it("says when the brief cannot be read", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "This brief link is not valid or has expired. Open the brief again from your job page." }) });
    render(<RobotReadinessBrief />);
    expect(await screen.findByRole("alert")).toHaveTextContent("This brief link is not valid or has expired.");
  });
});
