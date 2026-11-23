import { describe, expect, it } from "vitest";
import { jobTrackerSteps } from "@/lib/jobTracker";
import type { SiteCompanyActivity } from "@/lib/companyResponses";

/** Where a site's job stands, as a shipment tracker shows a load (owner, 2026-11-23). Nothing is guessed. */
const visible = { state: "visible" as const, sharedAtIso: "2026-11-10T09:00:00.000Z" };
const answered = (alias: string, state: "interested" | "declined" | "needs_something", extra: Record<string, unknown> = {}) =>
  ({ kind: "answered" as const, alias, atIso: "2026-11-12T09:00:00.000Z", state, ...extra });
const states = (steps: ReturnType<typeof jobTrackerSteps>) => steps.map(step => `${step.key}:${step.state}`);

describe("the site's job tracker", () => {
  it("is posted with the date, and says it waits for companies to open it", () => {
    const steps = jobTrackerSteps(visible, { interested: false, entries: [], views: 0, sent: { count: 4, firstAtIso: "2026-11-10T09:00:00.000Z" } });
    expect(states(steps)).toEqual(["posted:done", "looking:current", "responses:upcoming", "introduced:upcoming", "visit:upcoming",
      "pilot:upcoming"]);
    expect(steps[0]).toMatchObject({ label: "Posted", atIso: "2026-11-10T09:00:00.000Z", detail: null });
    expect(steps[1].detail).toBe("Sent to 4 approved companies; waiting for one to open it");
    expect(steps.slice(2).every(step => step.detail === null)).toBe(true);
  });

  it("asks the site to press Introduce us once a company is interested", () => {
    const activity: SiteCompanyActivity = { interested: true, views: 3, firstAnswerAtIso: "2026-11-12T09:00:00.000Z",
      entries: [answered("Company A", "interested"), answered("Company B", "declined")] };
    const steps = jobTrackerSteps(visible, activity);
    expect(states(steps).slice(0, 4)).toEqual(["posted:done", "looking:done", "responses:done", "introduced:current"]);
    expect(steps[2].atIso).toBe("2026-11-12T09:00:00.000Z");
    expect(steps[3].detail).toBe("Press Introduce us below to meet a company");
    // With only a "Not a fit", it waits for a company to say Interested.
    expect(jobTrackerSteps(visible, { ...activity, interested: false, entries: [answered("Company B", "declined")] })[3].detail)
      .toBe("Waiting for a company to say Interested");
  });

  it("counts a visit and a pilot only from the site's own marks, and a later mark completes the steps before it", () => {
    const introduced = (alias: string, progress?: Record<string, string>) => answered(alias, "interested", {
      introducedAtIso: "2026-11-14T09:00:00.000Z", company: { name: "N", email: "n@example.com" }, ...(progress ? { progress } : {}) });
    const before = jobTrackerSteps(visible, { interested: true, views: 2, entries: [introduced("Company A")] });
    expect(states(before).slice(3)).toEqual(["introduced:done", "visit:current", "pilot:upcoming"]);
    expect(before[3]).toMatchObject({ detail: "1 company", atIso: "2026-11-14T09:00:00.000Z" });
    expect(before[4].detail).toBe("Mark it below when a company visits");
    const after = jobTrackerSteps(visible, { interested: true, views: 2, entries: [introduced("Company A", { pilotAtIso: "2026-11-20T09:00:00.000Z" }),
      introduced("Company B", { visitAtIso: "2026-11-18T09:00:00.000Z" })] });
    expect(states(after)).toEqual(["posted:done", "looking:done", "responses:done", "introduced:done", "visit:done", "pilot:done"]);
    expect(after[4]).toMatchObject({ detail: "1 company", atIso: "2026-11-18T09:00:00.000Z" });
    expect(after[5]).toMatchObject({ detail: "1 company", atIso: "2026-11-20T09:00:00.000Z" });
  });

  it("says the job is being readied while it is not posted yet", () => {
    const steps = jobTrackerSteps({ state: "preparing", sharedAtIso: null }, undefined);
    expect(states(steps)[0]).toBe("posted:current");
    expect(steps[0].detail).toBe("Getting your job ready to post");
  });
});
