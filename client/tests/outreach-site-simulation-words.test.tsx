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
import { SIMULATION_NO_RULE, simulationContentsOf, readSimulationContents, type SimulationContents } from "@/lib/simulationContents";

vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => headers }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const RULE = "The carton is on the cart";
const VISIBLE = { state: "visible" as const, sharedAtIso: "2026-11-27T00:00:00.000Z" };

function simulationSection(outlook: JobOutlook, extra: { successRule?: string | null; sceneViewUrl?: string | null;
  simulationContents?: SimulationContents | null } = {}) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })));
  render(<SiteAnswer token="t" answer={{ ...readyAnswer, sharing: VISIBLE }} outlook={outlook}
    successRule={extra.successRule ?? RULE} sceneViewUrl={extra.sceneViewUrl ?? null} simulationContents={extra.simulationContents ?? null} />);
  const section = document.querySelector("#site-job-simulation")?.closest("section") ?? null;
  return section?.textContent ?? "";
}

const READY_OUTLOOK: JobOutlook = { phase: "simulation_ready", reason: null, sentence: null };

describe("step 7: the simulation section of the site's page, by outcome", () => {
  it("full package: ready, and the site's rule as what counts as done; nothing about the object", () => {
    const text = simulationSection(READY_OUTLOOK, { simulationContents: { objectIncluded: true, successRuleIncluded: true } });
    expect(text).toContain(SIMULATION_READY);
    expect(SIMULATION_READY).toBe("The simulation of your site is ready.");
    expect(text).toContain(`Done means: ${RULE}.`);
    expect(text).not.toMatch(/object|room/i);
  });

  it("contents not known (an older page, or none delivered): ready, as before", () => {
    const text = simulationSection(READY_OUTLOOK);
    expect(text).toContain(SIMULATION_READY);
    expect(text).toContain(`Done means: ${RULE}.`);
  });

  // Fixed 2026-11-27 (D2): this was an `it.fails` gap test.
  it("a room-only package says so on the site's page, as the company is told", () => {
    // A company reads this beside the download when the package has no object (`CompanyJob.tsx:281`).
    expect(SIMULATION_WITHOUT_OBJECT).toBe("This simulation is the site's room without the job's object in it.");
    const text = simulationSection(READY_OUTLOOK, { simulationContents: { objectIncluded: false, successRuleIncluded: false } });
    expect(text).toContain(SIMULATION_READY);
    expect(text).toContain("It shows your room without the job's object in it, so it does not check what counts as done.");
    // The site's rule is said as its own words, not under "ready" as if the simulation checked it.
    expect(text).toContain(`You said done means: ${RULE}.`);
    expect(text).not.toContain(`Done means: ${RULE}.`);
  });

  it("the object without a success rule: says the simulation does not check what counts as done", () => {
    const text = simulationSection(READY_OUTLOOK, { simulationContents: { objectIncluded: true, successRuleIncluded: false } });
    expect(text).toContain(SIMULATION_NO_RULE);
    expect(text).toContain(`You said done means: ${RULE}.`);
    expect(text).not.toMatch(/without the job's object/);
  });

  it("the contents line shows only while the simulation is ready", () => {
    const text = simulationSection({ phase: "building", reason: null, sentence: null },
      { simulationContents: { objectIncluded: false, successRuleIncluded: false } });
    expect(text).toContain(SIMULATION_BUILDING);
    expect(text).not.toMatch(/without the job's object/);
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

  it("failed: the site is told it could not be built; a company is told there is no simulation", () => {
    const text = simulationSection({ phase: "no_test", reason: "preparation_failed", sentence: OUTLOOK_SENTENCES.preparation_failed });
    expect(text).toContain("We could not build a simulation of your site.");
    // Fixed 2026-11-27 (D7): `libraryJobStage` gives `no_simulation` for an ending after which nothing is built.
    expect(SIMULATION_STATUS.no_simulation).toBe("There is no simulation for this job.");
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
  it("says 'Posted' done, and 'No approved company can see it yet.' for the next step, as the lead line does", async () => {
    const { jobTrackerSteps } = await import("@/lib/jobTracker");
    const steps = jobTrackerSteps({ ...VISIBLE, noCompanyCanSee: true }, undefined);
    expect(steps.find(step => step.key === "posted")?.state).toBe("done");
    expect(steps.find(step => step.key === "looking")).toMatchObject({ state: "current", detail: "No approved company can see it yet." });
    // Once a company may see jobs, the step waits for one to open it, as before.
    expect(jobTrackerSteps(VISIBLE, undefined).find(step => step.key === "looking")?.detail).toBe("Waiting for companies to open it");
  });
  // Fixed 2026-11-27 (D5): this was an `it.fails` gap test.
  it("the tracker agrees with the lead line when no company is approved", async () => {
    const { jobTrackerSteps } = await import("@/lib/jobTracker");
    const looking = jobTrackerSteps({ ...VISIBLE, noCompanyCanSee: true }, undefined).find(step => step.key === "looking");
    expect(looking?.detail).toMatch(/no approved company/i);
  });
});

describe("what a stored package holds, read the same for the site and the company", () => {
  const ROOM = ["README.txt", "scene.usda", "scene/room.usdz", "scene/room_collision.usdz"];
  const FULL = ["README.txt", "object.usdz", "scene.usda", "scene/room.usdc", "scene/room_collision.usdc", "success_rule.json"];
  it("the Pipeline's flag decides when it is sent", () => {
    expect(simulationContentsOf({ object_included: false, files: FULL }).objectIncluded).toBe(false);
    expect(simulationContentsOf({ object_included: true, files: ROOM }).objectIncluded).toBe(true);
  });
  it("with no flag (5 of the 7 live room packages), the files decide: object.* at the top, and success_rule.json", () => {
    expect(simulationContentsOf({ files: ROOM })).toEqual({ objectIncluded: false, successRuleIncluded: false });
    expect(simulationContentsOf({ files: FULL })).toEqual({ objectIncluded: true, successRuleIncluded: true });
    expect(simulationContentsOf({ files: ["scene.usda", "scene/files/object.usdz"] }).objectIncluded).toBe(false);
  });
  it("the page reads the status field strictly", () => {
    expect(readSimulationContents({ objectIncluded: false, successRuleIncluded: true })).toEqual({ objectIncluded: false, successRuleIncluded: true });
    expect(readSimulationContents({ objectIncluded: "no", successRuleIncluded: true })).toBeNull();
    expect(readSimulationContents(null)).toBeNull();
  });
});
