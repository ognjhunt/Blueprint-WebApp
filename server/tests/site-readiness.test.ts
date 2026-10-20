// @vitest-environment node
/**
 * The site readiness report: an expert's first read of a site's job, in the
 * site's own numbers.
 *
 * What this pins:
 * - the arithmetic uses only the site's answers and its video's measured pace;
 * - the tracker reports only recorded states, and says what Blueprint is doing
 *   only from a real one;
 * - the next three things follow their priority, and skip pick-and-place
 *   readings where they mean nothing;
 * - the checklist, success factors and safety copy follow the rules in the
 *   design note;
 * - the simulation is credited only with what the evaluation contract tests;
 * - examples match precisely or not at all;
 * - the report reaches the site only while shared and while consent stands;
 * - people nearby comes from the site's answer, then earlier answers, then its video.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

const walkthrough = vi.hoisted(() => ({ received: true as boolean | null }));

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return {
    default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore,
    storageAdmin: null,
  };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/siteWalkthrough", () => ({
  siteWalkthroughIdentity: (requestId: string) => ({ requestId, sceneId: `site-${requestId}`, captureId: `walkthrough-${requestId}` }),
  savedWalkthrough: async () => (walkthrough.received === null ? null : { received: walkthrough.received }),
}));

const readiness = await import("../utils/siteReadiness");
const fit = await import("../utils/siteRobotFit");
const { checklistOf, examplesOf, getSiteReadiness, nextThingsOf, safetyOf, speedOf, successFactorsOf, trackerOf, workloadOf,
  buildReadinessReport } = readiness;
const { computeRobotFitJob, jobFactsOf, projectSiteRobotFit } = fit;
type Inputs = Parameters<typeof trackerOf>[0];

const NOW = "2026-10-20T12:00:00.000Z";
const SCREENED = { site_task_scope: { supported: true, kind: "rigid_pick_and_place", reason: null } };
const VIDEO = (seconds: number | null, people: string | null = null) => ({ site_video_evidence: { status: "analysed",
  footage_status: "usable", measured_cycle_seconds: seconds, people_relationship_to_work: people } });

function reading(value: number, unit: string, si: number) {
  return { value, unit, si, basis: unit === "kg" ? "scale" : "tape", recordedAtIso: NOW, recordedByScope: "owner", recordedByName: null };
}

function inputs(overrides: Partial<Inputs> & { readings?: Record<string, ReturnType<typeof reading>> } = {}): Inputs {
  const { readings, ...rest } = overrides;
  return {
    request: { requestId: "job-1", request: {}, ...SCREENED },
    brief: { requestId: "job-1", summary: "Move sealed cartons from the conveyor onto a pallet", confirmedAtIso: NOW } as never,
    measurements: readings ? { requestId: "job-1", family: "rigid_pick_place", articulation: null, referencePaper: null, readings,
      measuredBy: null, note: null, revision: 1, updatedAtIso: NOW } as never : null,
    operations: null,
    walkthroughReceived: true,
    reconstructionState: null,
    itemPhotosMissing: false,
    shared: false,
    ...rest,
  };
}

const report = (value: Inputs) => buildReadinessReport(value, computeRobotFitJob(value))!;

describe("what the job takes today", () => {
  it("multiplies the site's times a day by its video's measured pace, and says what it rests on", () => {
    const value = inputs({ request: { request: {}, ...SCREENED, ...VIDEO(84) },
      operations: { timesPerDay: 120, daysPerWeek: 5, peopleNearby: null, updatedAtIso: NOW } });
    expect(workloadOf(value)).toEqual({ headline: "about 14 person-hours a week", hoursPerDay: 2.8, hoursPerWeek: 14,
      sentence: "This job takes about 2.8 person-hours a day, about 14 a week.",
      basis: "120 times a day, 5 days a week (you told us), at about 84 seconds per cycle (measured from your video). It counts time on this job only." });
  });

  it("waits for both the answer and a measured cycle, and never guesses the days a week", () => {
    expect(workloadOf(inputs({ request: { request: {}, ...VIDEO(84) } }))).toBeNull();
    expect(workloadOf(inputs({ operations: { timesPerDay: 10, daysPerWeek: null, peopleNearby: null, updatedAtIso: NOW } }))).toBeNull();
    const perDay = workloadOf(inputs({ request: { request: {}, ...VIDEO(360) },
      operations: { timesPerDay: 10, daysPerWeek: null, peopleNearby: null, updatedAtIso: NOW } }));
    expect(perDay).toMatchObject({ headline: "about 1 person-hour a day", hoursPerDay: 1, hoursPerWeek: null,
      sentence: "This job takes about 1 person-hour a day." });
    expect(perDay?.basis).toContain("10 times a day (you told us), at about 6 minutes per cycle");
  });

  it("checks the site's target against today's measured pace", () => {
    const target = (cycleTimeSeconds: number | null) => ({ requestId: "job-1", summary: "x", successCriteria:
      { successDefinition: null, successRate: null, cycleTimeSeconds, unknown: false } }) as never;
    expect(speedOf(inputs({ request: { request: {}, ...VIDEO(60) }, brief: target(45) }))).toMatchObject({
      state: "target_faster_than_today", sentence: expect.stringContaining("faster than your people take today: about 60 seconds") });
    expect(speedOf(inputs({ request: { request: {}, ...VIDEO(40) }, brief: target(45) }))?.state).toBe("target_within_today");
    expect(speedOf(inputs({ request: { request: {}, ...VIDEO(40) }, brief: target(null) }))?.state).toBe("needs_target");
    expect(speedOf(inputs({ brief: target(45) }))?.state).toBe("needs_measurement");
    expect(speedOf(inputs())).toBeNull();
  });
});

describe("steps to a pilot", () => {
  it("reports recorded states only, with the measurements counted against six key readings", () => {
    const tracker = trackerOf(inputs({ readings: { pick_to_place_distance: reading(90, "cm", 0.9), object_length: reading(40, "cm", 0.4) },
      operations: { timesPerDay: 50, daysPerWeek: null, peopleNearby: null, updatedAtIso: NOW }, reconstructionState: "processing" }));
    const state = Object.fromEntries(tracker.steps.map((entry) => [entry.id, [entry.state, entry.detail]]));
    expect(state).toEqual({ video: ["done", null], brief: ["done", null], measurements: ["partial", "2 of 6"],
      operations: ["partial", null], success_target: ["todo", null], access_window: ["todo", null], scene: ["in_progress", null],
      evaluation: ["pending", null], recommendation: ["pending", null], booking: ["pending", null] });
    expect(tracker.meanwhile).toBe("Blueprint is rebuilding your work area in 3D from your video.");
  });

  it("says what comes next only from a real state", () => {
    expect(trackerOf(inputs({ reconstructionState: "ready" })).meanwhile).toContain("Next, Blueprint invites robot teams");
    expect(trackerOf(inputs({ reconstructionState: "failed" })).meanwhile).toBeNull();
    expect(trackerOf(inputs({ request: { request: {}, pilot_recommendation: { id: "r1" } } })).meanwhile)
      .toBe("Blueprint has recommended one team for your job. You can review and book it on this page.");
    expect(trackerOf(inputs({ walkthroughReceived: null })).steps[0].state).toBe("pending");
  });
});

describe("your next three things", () => {
  it("asks for the most useful missing facts first", () => {
    const value = inputs({ brief: { requestId: "job-1", summary: "x", confirmedAtIso: null } as never, itemPhotosMissing: true });
    expect(nextThingsOf(value, jobFactsOf(value)).map((entry) => [entry.id, entry.target])).toEqual([
      ["confirm_brief", "brief"], ["measure_distance", "measurements"], ["times_per_day", "operations"]]);
  });

  it("moves on as answers arrive, and skips pick-and-place readings for a job they do not fit", () => {
    const answered = inputs({ readings: { pick_to_place_distance: reading(90, "cm", 0.9), object_mass: reading(4, "kg", 4) },
      operations: { timesPerDay: 50, daysPerWeek: 5, peopleNearby: "shared", updatedAtIso: NOW }, itemPhotosMissing: true });
    expect(nextThingsOf(answered, jobFactsOf(answered)).map((entry) => entry.id)).toEqual(["floor_space", "success_target", "item_photos"]);
    const unsupported = inputs({ request: { request: {}, site_task_scope: { supported: false, reason: "deformable" } } });
    expect(nextThingsOf(unsupported, jobFactsOf(unsupported)).map((entry) => entry.id)).toEqual(["times_per_day", "people_nearby", "success_target"]);
  });
});

describe("getting the site ready", () => {
  const item = (value: Inputs, id: string) => checklistOf(value, jobFactsOf(value), computeRobotFitJob(value)).find((entry) => entry.id === id)!;

  it("reads the floor space and the open height from the site's measurements", () => {
    expect(item(inputs({ readings: { pick_front_clearance: reading(120, "cm", 1.2) } }), "floor_space")).toMatchObject({ state: "ready",
      detail: "There is 120 cm of open floor in front of the starting surface (you measured this), room for a robot's stand or base." });
    expect(item(inputs({ readings: { pick_front_clearance: reading(80, "cm", 0.8) } }), "floor_space").detail).toContain("tight for a robot's stand or base");
    const low = item(inputs({ readings: { pick_front_clearance: reading(120, "cm", 1.2), pick_overhead_clearance: reading(30, "cm", 0.3) } }), "floor_space");
    expect(low).toMatchObject({ state: "check", detail: expect.stringContaining("30 cm of open height (you measured this), tight for an arm") });
    expect(item(inputs(), "floor_space")).toMatchObject({ state: "unknown" });
  });

  it("matches where the robot stands, and the network, to the forms that fit", () => {
    const near = inputs({ readings: { pick_to_place_distance: reading(90, "cm", 0.9) } });
    expect(item(near, "standing_spot").detail).toBe("For a robot on a fixed stand: a level spot where the stand can be bolted down "
      + "or weighted. For a robot that moves: a place to park and charge, and a clear, level path between the spots.");
    expect(item(near, "power_network").detail).toContain("Wi-Fi along the route for a robot that drives between spots");
    const far = inputs({ readings: { pick_to_place_distance: reading(300, "cm", 3) } });
    expect(item(far, "standing_spot").detail).toBe("For a robot that moves: a place to park and charge, and a clear, level path between the spots.");
  });

  it("plans the safe zone from people nearby, wherever that answer came from", () => {
    expect(item(inputs({ operations: { timesPerDay: null, daysPerWeek: null, peopleNearby: "isolated", updatedAtIso: NOW } }), "safe_zone"))
      .toMatchObject({ state: "ready", detail: "The area is clear of people while it runs (you told us), so the robot can work in an area kept clear of people." });
    expect(item(inputs({ request: { request: {}, ...SCREENED, ...VIDEO(null, "working_in_the_space") } }), "safe_zone"))
      .toMatchObject({ state: "check", detail: expect.stringContaining("People work in the same space (seen in your video).") });
    expect(item(inputs(), "safe_zone").state).toBe("unknown");
  });

  it("repeats the site's own screening answers for how objects arrive", () => {
    const value = inputs({ request: { request: {}, ...SCREENED, siteTaskGates: { sceneStability: "minor_drift", taskShape: "single",
      objectVariety: "under_10" } } });
    expect(item(value, "object_arrival")).toMatchObject({ state: "check", detail: "Work area: small things move, but the layout holds. "
      + "The job: one job, done the same way each time. Different items: fewer than ten (you told us)." });
  });
});

describe("what decides success here", () => {
  it("picks at most three, in priority order, each saying what tests it", () => {
    const value = inputs({
      request: { request: {}, ...SCREENED, ...VIDEO(60, "passing_nearby"), siteTaskGates: { objectVariety: "many_but_listable", sceneStability: "reconfigured" } },
      brief: { requestId: "job-1", summary: "Move shrink-wrapped cases, clear jams", confirmedAtIso: NOW,
        successCriteria: { successDefinition: null, successRate: 99.5, cycleTimeSeconds: 45, unknown: false } } as never,
    });
    const factors = successFactorsOf(value, jobFactsOf(value));
    expect(factors.map((entry) => [entry.id, entry.where])).toEqual([["speed", "simulation"], ["variety", "simulation"], ["placement", "simulation"]]);
    expect(factors[0].test).toBe("The evaluation measures cycle time against your target.");
  });

  it("leaves to the pilot what the simulation cannot show", () => {
    const value = inputs({ brief: { requestId: "job-1", summary: "Pick glass jars and set aside damaged ones", confirmedAtIso: NOW } as never });
    const factors = successFactorsOf(value, jobFactsOf(value));
    expect(factors.map((entry) => [entry.id, entry.where, entry.detail])).toEqual([
      ["surfaces", "pilot", "Your job mentions \"glass\"."], ["exceptions", "pilot", "Your job mentions \"damaged\"."]]);
  });
});

describe("safety in plain English", () => {
  it("names the standards that apply to the forms in play, and what Blueprint does not certify", () => {
    const near = inputs({ readings: { pick_to_place_distance: reading(90, "cm", 0.9) },
      operations: { timesPerDay: null, daysPerWeek: null, peopleNearby: "shared", updatedAtIso: NOW } });
    const lines = safetyOf(jobFactsOf(near), computeRobotFitJob(near));
    expect(lines[0]).toBe("Before a robot works at your site, the robot team does a risk assessment of the job with you. It follows the "
      + "robot-safety standards: ISO 10218, adopted in the US as ANSI/A3 R15.06, and ANSI/A3 R15.08 for robots that drive between spots.");
    expect(lines[1]).toContain("Safety standards for walking robots are still being written");
    expect(lines).toContain("People work in the same space (you told us), so this decides how the robot works alongside them.");
    expect(lines.at(-1)).toContain("It does not certify that any robot is safe");
  });
});

describe("robots already do jobs like this", () => {
  it("matches the curated, sourced environments precisely, or not at all", () => {
    const packing = examplesOf(inputs({ brief: { requestId: "job-1", summary: "Pack finished parts into cartons" } as never }));
    expect(packing.map((entry) => entry.id)).toEqual(["line-side-packing"]);
    expect(packing[0].sources[0].href).toMatch(/^https:\/\//);
    expect(examplesOf(inputs())).toEqual([]);
    expect(examplesOf(inputs({ brief: { requestId: "job-1", summary: "Sort parcels onto outbound chutes" } as never })).map((entry) => entry.id))
      .toEqual(["parcel-sorting"]);
  });
});

describe("the people-nearby answer, wherever it comes from", () => {
  it("prefers the site's answer, then earlier answers, then what its video shows", () => {
    const people = (value: Inputs) => jobFactsOf(value).people;
    expect(people(inputs({ request: { request: { siteTaskSpec: { humanProximity: "nearby" } }, ...SCREENED, ...VIDEO(null, "working_in_the_space") },
      operations: { timesPerDay: null, daysPerWeek: null, peopleNearby: "isolated", updatedAtIso: NOW } }))).toMatchObject({ value: "isolated", source: "site_stated" });
    expect(people(inputs({ request: { request: { siteTaskSpec: { humanProximity: "nearby" } }, ...SCREENED, ...VIDEO(null, "working_in_the_space") } })))
      .toMatchObject({ value: "nearby", source: "site_stated" });
    expect(people(inputs({ request: { request: {}, ...SCREENED, ...VIDEO(null, "working_in_the_space") } }))).toMatchObject({ value: "shared", source: "video_observed" });
    expect(people(inputs({ request: { request: {}, ...SCREENED, ...VIDEO(null, "performing_the_task") } }))).toBeNull();
  });

  it("lets the site answer it on its page instead of leaving it to staff", () => {
    const site = projectSiteRobotFit(computeRobotFitJob(inputs()))!;
    expect(site.unknowns).toContain("Whether people work near the job. You can answer it under How the job runs today on this page.");
  });
});

describe("the owner's read", () => {
  beforeEach(() => {
    sharedFakeFirestoreState.docs.clear();
    walkthrough.received = true;
    sharedFakeFirestoreState.docs.set("inboundRequests/job-1", { requestId: "job-1", request: {}, ...SCREENED, ...VIDEO(84) });
    sharedFakeFirestoreState.docs.set("siteTaskBriefs/job-1", { requestId: "job-1", summary: "Pack finished parts into cartons", confirmedAtIso: NOW });
    sharedFakeFirestoreState.docs.set("siteTaskOperations/job-1", { requestId: "job-1", timesPerDay: 120, daysPerWeek: 5, peopleNearby: "shared", updatedAtIso: NOW });
    sharedFakeFirestoreState.docs.set("siteTaskMeasurements/job-1", { requestId: "job-1", family: "rigid_pick_place", articulation: null,
      referencePaper: null, measuredBy: null, note: null, revision: 1, updatedAtIso: NOW,
      readings: { pick_to_place_distance: reading(90, "cm", 0.9) } });
  });

  it("gives the tracker, next things and what the job takes, and the report only while shared", async () => {
    const unshared = await getSiteReadiness("job-1");
    expect(unshared).toMatchObject({ ok: true, summary: "Pack finished parts into cartons", report: null,
      operations: { timesPerDay: 120, peopleNearby: "shared" }, workload: { hoursPerWeek: 14 } });
    sharedFakeFirestoreState.docs.set("siteRobotFit/job-1", { sharing: { shared: true, changedAtIso: NOW, changedBy: "admin" } });
    const shared = await getSiteReadiness("job-1");
    expect(shared?.report?.robotFit.forms).toHaveLength(6);
    expect(shared?.report?.examples.map((entry) => entry.id)).toEqual(["line-side-packing"]);
    expect(JSON.stringify(shared)).not.toMatch(/\bmatch|price|\$/i);
    sharedFakeFirestoreState.docs.set("inboundRequests/job-1", { requestId: "job-1", request: {}, ...SCREENED, capture_rights: { consent_revoked: true } });
    expect((await getSiteReadiness("job-1"))?.report).toBeNull();
  });

  it("returns nothing for a job that does not exist", async () => {
    expect(await getSiteReadiness("missing")).toBeNull();
  });

  it("builds no report for a job that is not rated", () => {
    expect(report(inputs({ request: { request: {} } }))).toBeNull();
  });
});
