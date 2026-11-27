/**
 * Outreach audit, 2026-11-27 (gap 5: a site gets less than the pitch implies). What the site's own job page says in
 * its "Simulation of your site" section for each real outcome, word for word, beside what a deployment company reads
 * for the same job (`client/src/lib/companyJobPage.ts`).
 *
 * Tests named "GAP:" use `it.fails`: they state what the page should do and pass only while the page does not do it.
 * When the page is fixed they turn red; then change `it.fails` to `it` and keep them.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NO_COMPANY_CAN_SEE_LINE, NOT_SHARED_YET, NOT_VISIBLE_LINE, NOTHING_IS_SHARED, OLDER_JOB_AGREE, OLDER_JOB_LINES,
  PREPARING_TO_SHARE_LINE, SHARED_LINE, SiteAnswer, JobCompanyResponses } from "@/components/site/SiteAnswer";
import { OUTLOOK_SENTENCES, SIMULATION_BUILDING, SIMULATION_READY, type JobOutlook } from "@/lib/jobOutlook";
import { SIMULATION_NOT_FINISHED, SIMULATION_STATUS, SIMULATION_WITHOUT_OBJECT } from "@/lib/companyJobPage";
import { readyAnswer } from "./fixtures/siteAnswer";

vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => headers }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const RULE = "The carton is on the cart";
const VISIBLE = { state: "visible" as const, sharedAtIso: "2026-11-27T00:00:00.000Z" };

function simulationSection(outlook: JobOutlook, extra: { successRule?: string | null; sceneViewUrl?: string | null } = {}) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })));
  render(<SiteAnswer token="t" answer={{ ...readyAnswer, sharing: VISIBLE }} outlook={outlook}
    successRule={extra.successRule ?? RULE} sceneViewUrl={extra.sceneViewUrl ?? null} />);
  const section = document.querySelector("#site-job-simulation")?.closest("section") ?? null;
  return section?.textContent ?? "";
}

describe("step 7: the simulation section of the site's page, by outcome", () => {
  it("full package, or room only: the same two lines, and nothing about the object", () => {
    // The page has no input for whether the package holds the object (`SiteAnswerProps`): both outcomes read alike.
    const text = simulationSection({ phase: "simulation_ready", reason: null, sentence: null });
    expect(text).toContain(SIMULATION_READY);
    expect(SIMULATION_READY).toBe("The simulation of your site is ready.");
    // The site's own success rule is printed under "ready", as if the simulation holds it.
    expect(text).toContain(`Done means: ${RULE}.`);
    expect(text).not.toMatch(/object|room/i);
  });

  it.fails("GAP: a room-only package says so on the site's page, as the company is told", () => {
    // A company reads this beside the download when object_included is false (`CompanyJob.tsx:281`).
    expect(SIMULATION_WITHOUT_OBJECT).toBe("This simulation is the site's room without the job's object in it.");
    const text = simulationSection({ phase: "simulation_ready", reason: null, sentence: null });
    expect(text).toMatch(/without the job's object|room only/i);
  });

  it("still building", () => {
    expect(simulationSection({ phase: "building", reason: null, sentence: null })).toContain(SIMULATION_BUILDING);
    // The company reads, for the same stage (`taskBrowse.ts:libraryJobStage`):
    expect(SIMULATION_STATUS.simulation_building).toBe("The simulation is being built from the site's video.");
  });

  it("stopped at the job's spending cap", () => {
    const text = simulationSection({ phase: "no_test", reason: "spending_cap_reached", sentence: OUTLOOK_SENTENCES.spending_cap_reached });
    expect(text).toContain("We stopped building the simulation of your site before it was finished.");
  });

  it("failed: the site is told it could not be built; a company is told only that it is not finished", () => {
    const text = simulationSection({ phase: "no_test", reason: "preparation_failed", sentence: OUTLOOK_SENTENCES.preparation_failed });
    expect(text).toContain("We could not build a simulation of your site.");
    // `libraryJobStage` returns null for every ending, so the company's box reads "unknown" (`companyJobPage.ts:410`).
    expect(SIMULATION_STATUS.unknown).toBe("The simulation of the site is not finished yet.");
    expect(SIMULATION_NOT_FINISHED).toBe(SIMULATION_STATUS.unknown);
  });

  it("the job's time ran out: said in place of the simulation, even beside a link to view one", () => {
    const text = simulationSection({ phase: "no_test", reason: "window_expired", sentence: OUTLOOK_SENTENCES.window_expired },
      { sceneViewUrl: "https://example.test/scene" });
    expect(text).toContain("The time for this job ran out.");
    expect(text).toContain("View the simulation of your site");
    expect(text).not.toContain(SIMULATION_READY);
  });
});

describe("step 6: the Applicants section's first line, by the server's sharing state", () => {
  function lead(sharing: Parameters<typeof JobCompanyResponses>[0]["sharing"], ended: "withdrawn" | "closed" | null = null) {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, companies: [] }) })));
    render(<JobCompanyResponses token="t" sharing={sharing} ended={ended} />);
    return document.querySelector(".site-company-panel")?.textContent ?? "";
  }
  it.each([
    ["listed, a company may see it", VISIBLE, SHARED_LINE],
    ["listed, no company approved", { ...VISIBLE, noCompanyCanSee: true }, NO_COMPANY_CAN_SEE_LINE],
    ["preparing, video in", { state: "preparing" as const, sharedAtIso: null, videoReceived: true }, "Video received. We're preparing your job for posting."],
    ["preparing, no video", { state: "preparing" as const, sharedAtIso: null, videoReceived: false }, "Send a video to post your job."],
    ["preparing, video unknown", { state: "preparing" as const, sharedAtIso: null }, PREPARING_TO_SHARE_LINE],
    ["held (Blueprint, rights, closed, ended)", { state: "not_visible" as const, sharedAtIso: VISIBLE.sharedAtIso }, NOT_VISIBLE_LINE],
    ["older statement", { state: "not_shared" as const, sharedAtIso: null, olderStatement: true }, OLDER_JOB_LINES],
    ["never shared", { state: "not_shared" as const, sharedAtIso: null }, NOT_SHARED_YET],
  ])("%s", (_name, sharing, line) => {
    expect(lead(sharing as never)).toContain(line);
  });
  it("the older statement offers the button under the v6 sentence", () => {
    expect(lead({ state: "not_shared", sharedAtIso: null, olderStatement: true })).toContain(OLDER_JOB_AGREE);
    expect(screen.getByRole("button", { name: OLDER_JOB_AGREE })).toBeTruthy();
  });
  it("a withdrawn job says nothing is shared", () => {
    expect(lead(VISIBLE, "withdrawn")).toContain(NOTHING_IS_SHARED);
  });
  it("a held job gives the site no reason and no step", () => {
    const text = lead({ state: "not_visible", sharedAtIso: VISIBLE.sharedAtIso });
    expect(text.replace(/Applicants/, "").trim().startsWith(NOT_VISIBLE_LINE)).toBe(true);
  });
});

describe("step 6: the tracker while no company is approved (today's production state)", () => {
  it("says 'Posted' done and 'Waiting for companies to open it' while the lead line says no approved company can see it", async () => {
    const { jobTrackerSteps } = await import("@/lib/jobTracker");
    const steps = jobTrackerSteps({ ...VISIBLE, noCompanyCanSee: true }, undefined);
    expect(steps.find(step => step.key === "posted")?.state).toBe("done");
    expect(steps.find(step => step.key === "looking")).toMatchObject({ state: "current", detail: "Waiting for companies to open it" });
  });
  it.fails("GAP: the tracker agrees with the lead line when no company is approved", async () => {
    const { jobTrackerSteps } = await import("@/lib/jobTracker");
    const looking = jobTrackerSteps({ ...VISIBLE, noCompanyCanSee: true }, undefined).find(step => step.key === "looking");
    expect(looking?.detail).toMatch(/no approved company/i);
  });
});
