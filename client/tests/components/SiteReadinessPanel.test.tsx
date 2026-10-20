// @vitest-environment jsdom
/**
 * The owner's robot readiness report on the job page: nothing at all until
 * Blueprint shares it, then one folded section whose title counts the kinds of
 * robot that fit, with a link to the printable brief by its own read-only
 * link. The site sends its video and nothing else, so nothing here asks it
 * anything.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SiteReadinessPanel } from "@/components/site/SiteReadinessPanel";
import { SITE_ROBOT_FIT_NOTE } from "@/data/robotFit";
import type { SiteReadinessReport, SiteReadinessResponse } from "@/data/siteReadiness";

const fetchMock = vi.fn();

const REPORT: SiteReadinessReport = {
  robotFit: { needs: ["It has to pick the object up and put it down at another spot."], forms: [
    { id: "wheeled_humanoid", label: "Wheeled humanoid", description: "A human-like upper body with two arms, on a wheeled base.",
      verdict: "fits", reasons: [] }], note: SITE_ROBOT_FIT_NOTE },
  checklist: [{ id: "floor_space", title: "Floor space at the station", state: "confirm",
    detail: "There is about 80 cm (estimated from your video) of open floor in front of the starting surface, tight for a robot's stand or base. Confirm the space with the robot team." }],
  successFactors: [{ id: "speed", title: "Speed", detail: "Your target, 45 seconds per cycle, is faster than today's 60 seconds (estimated from your video).",
    test: "The evaluation measures cycle time against your target.", where: "simulation" }],
  safety: ["Before a robot works at your site, ask the robot team for its risk assessment of the job."],
  examples: [{ id: "parcel-sorting", name: "Parcel sorting", sources: [{ label: "China Daily", href: "https://example.org/source" }] }],
  examplesFootnote: "None is a Blueprint customer and none was prepared by Blueprint.",
};

function readiness(overrides: Partial<SiteReadinessResponse> = {}): SiteReadinessResponse {
  return {
    ok: true, summary: "Sort parcels onto outbound chutes",
    tracker: { steps: [{ id: "video", label: "Video received", state: "done", owner: "site" }], meanwhile: null },
    report: null, briefPath: "/capture-upload/brief/brief-token.signature",
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
  it("shows nothing at all until Blueprint shares the report", async () => {
    fetchMock.mockResolvedValue(respond(readiness()));
    const { container } = render(<SiteReadinessPanel token="tok" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/site-task-brief/tok/readiness"));
    expect(container).toBeEmptyDOMElement();
  });

  it("folds the shared report under one title that counts the kinds of robot that fit", async () => {
    fetchMock.mockResolvedValue(respond(readiness({ report: REPORT })));
    const { container } = render(<SiteReadinessPanel token="tok" />);
    const summary = await screen.findByText("Your robot readiness report · 1 kind of robot fits");
    const report = summary.closest("details")!;
    expect(report.open).toBe(false);
    expect(container.querySelectorAll("details")).toHaveLength(1);
    expect(within(report).getByText("Confirm with the robot team")).toBeInTheDocument();
    expect(within(report).getByText("Tested in the simulation")).toBeInTheDocument();
    expect(within(report).getByText("Jobs like this on the public record")).toBeInTheDocument();
    expect(within(report).getByRole("link", { name: "China Daily" })).toHaveAttribute("href", "https://example.org/source");
    expect(within(report).getByText(REPORT.examplesFootnote)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\bmatch|Blueprint checks/i);
  });

  it("links the printable brief by its own read-only link, never the owner's job link", async () => {
    fetchMock.mockResolvedValue(respond(readiness({ report: REPORT })));
    render(<SiteReadinessPanel token="tok" />);
    const link = await screen.findByRole("link", { name: "Print or save the brief" });
    expect(link).toHaveAttribute("href", "/capture-upload/brief/brief-token.signature");
    expect(link.getAttribute("href")).not.toContain("tok/");
  });

  it("asks the site nothing: no form, no button, no question", async () => {
    fetchMock.mockResolvedValue(respond(readiness({ report: REPORT })));
    const { container } = render(<SiteReadinessPanel token="tok" />);
    await screen.findByText(/Your robot readiness report/);
    expect(container.querySelector("form, input, select, textarea, button")).toBeNull();
    expect(container.textContent).not.toMatch(/\?|tell us|answer|add measurements|weigh one/i);
  });

  it("shows nothing it could not read", async () => {
    fetchMock.mockResolvedValueOnce(respond({ error: "unavailable" }, 503));
    const { container } = render(<SiteReadinessPanel token="tok" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(container).toBeEmptyDOMElement();
  });
});
