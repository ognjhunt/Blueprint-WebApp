// @vitest-environment node
/**
 * The site readiness report: an expert's first read of a site's job, built
 * from its video. The site sends its video and nothing else (founder
 * direction, 2026-10-20).
 *
 * What this pins:
 * - the video reader's estimates fill what nobody measured, always labelled
 *   "estimated from your video", and anything the site measured or told us
 *   still comes first;
 * - nothing asks the site anything: its only steps are its video, its brief
 *   and booking, and every checklist item is ready or one to confirm with the
 *   robot team, never a check no process runs;
 * - the tracker reports recorded states only, calls a recommendation bookable
 *   exactly as the booking route does, and says when a job is out of scope;
 * - the simulation is credited only with what the evaluation contract tests;
 * - exceptions are read from real exceptions, not lookalike phrases;
 * - examples are deployments on the public record, by environment, with no
 *   robot company named;
 * - the report reaches the site only while shared and while consent stands.
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
// Qualified evidence is a long receipt chain with its own tests; here only its answer matters.
vi.mock("../utils/pilotRecommendationEvidence", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/pilotRecommendationEvidence")>()),
  isQualifiedRecommendationEvidence: (evidence: { qualified?: boolean } | null | undefined) => evidence?.qualified === true,
}));

const readiness = await import("../utils/siteReadiness");
const fit = await import("../utils/siteRobotFit");
const { buildReadinessReport, checklistOf, examplesOf, getSiteReadiness, safetyOf, successFactorsOf, trackerOf } = readiness;
const { computeRobotFitJob, jobFactsOf, projectSiteRobotFit, videoEvidence } = fit;
type Inputs = Parameters<typeof trackerOf>[0];

const NOW = "2026-10-20T12:00:00.000Z";
const SCREENED = { site_task_scope: { supported: true, kind: "rigid_pick_and_place", reason: null } };

type Estimates = Partial<{ object: string; object_largest_side_m: number; object_mass_kg_low: number; object_mass_kg_high: number;
  object_surface: string; pick_to_place_m: number; pick_height_m: number; place_height_m: number; front_clearance_m: number;
  other_items_likely: string[]; cycle_seconds: number }>;

/**
 * The site's video as Blueprint holds it: the walkthrough's estimates from its
 * coverage review, and an intake link's reading for a timed cycle and people.
 */
function walkthroughReading(options: { cycle?: number | null; people?: string | null; estimates?: Estimates | null;
  linkEstimates?: Estimates | null; footage?: string } = {}) {
  const link = options.cycle != null || options.people != null || options.linkEstimates != null || options.footage != null;
  return {
    ...(options.estimates ? { walkthrough_job_estimates: { capture_id: "walkthrough-job-1", job_estimates: options.estimates,
      reviewed_at_iso: NOW } } : {}),
    ...(link ? { site_video_evidence: { status: options.footage === "unusable" ? "unreadable" : "analysed",
      footage_status: options.footage ?? "usable", measured_cycle_seconds: options.cycle ?? null,
      people_relationship_to_work: options.people ?? null, job_estimates: options.linkEstimates ?? null } } : {}),
  };
}

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
    walkthroughReceived: true,
    reconstructionState: null,
    sceneViewable: false,
    shared: false,
    ...rest,
  };
}

const withVideo = (options: Parameters<typeof walkthroughReading>[0], request: Record<string, unknown> = {}) =>
  inputs({ request: { requestId: "job-1", request: {}, ...SCREENED, ...walkthroughReading(options), ...request } });

describe("estimates from the video", () => {
  const ESTIMATES: Estimates = { object: "sealed carton", object_largest_side_m: 0.45, object_mass_kg_low: 3, object_mass_kg_high: 5,
    pick_to_place_m: 0.9, pick_height_m: 0.8, place_height_m: 0.15, front_clearance_m: 1.3 };

  it("fills what nobody measured with the video's estimates, and says so every time", () => {
    const value = withVideo({ estimates: ESTIMATES });
    const facts = jobFactsOf(value);
    expect(facts.distance).toMatchObject({ display: "about 90 cm", source: "video_estimate" });
    expect(facts.mass).toMatchObject({ display: "about 3–5 kg", source: "video_estimate", min: 3, max: 5 });
    expect(facts.size).toMatchObject({ display: "about 45 cm", source: "video_estimate" });
    const job = computeRobotFitJob(value);
    expect(job.needs).toEqual(expect.arrayContaining([
      "It can work from one place: the object moves about 90 cm (estimated from your video).",
      "It has to lift about 3–5 kg (estimated from your video).",
      "It has to reach down near the floor: the object is put down at about 15 cm (estimated from your video).",
    ]));
    expect(job.unknowns.map((entry) => entry.key)).toEqual(["people_nearby"]);
    expect(projectSiteRobotFit(job)?.forms).toHaveLength(6);
  });

  it("keeps anything the site measured or told us ahead of an estimate", () => {
    const value = inputs({ request: { requestId: "job-1", request: { siteTaskSpec: { payloadWeight: "two_to_ten" } }, ...SCREENED,
      ...walkthroughReading({ estimates: ESTIMATES }) }, readings: { pick_to_place_distance: reading(120, "cm", 1.2) } });
    const facts = jobFactsOf(value);
    expect(facts.distance).toMatchObject({ display: "120 cm", source: "site_measured" });
    expect(facts.mass).toMatchObject({ display: "2–10 kg", source: "site_stated" });
    expect(facts.size).toMatchObject({ source: "video_estimate" });
  });

  it("reads each estimate from the walkthrough first, then the intake link, and nothing from unusable footage", () => {
    const link = { cycle: 50, linkEstimates: { pick_to_place_m: 2, object_largest_side_m: 0.5 } };
    const both = videoEvidence(withVideo({ estimates: { pick_to_place_m: 0.9 }, ...link }));
    expect(both).toMatchObject({ measuredCycleSeconds: 50, estimates: { pickToPlaceM: 0.9, largestSideM: 0.5 } });
    expect(videoEvidence(withVideo({ ...link, footage: "unusable" }))).toBeNull();
    expect(videoEvidence(withVideo({ estimates: { pick_to_place_m: 0.9 }, ...link, footage: "unusable" }))).toMatchObject({
      measuredCycleSeconds: null, people: null, estimates: { pickToPlaceM: 0.9, largestSideM: null } });
  });

  it("reads a stored estimate only inside the reader's own bounds", () => {
    const estimates = videoEvidence(withVideo({ estimates: { object_largest_side_m: 9, object_mass_kg_low: 6, object_mass_kg_high: 2,
      pick_to_place_m: 0, front_clearance_m: -1, cycle_seconds: Number.NaN, object_surface: "glittery",
      other_items_likely: ["  trays ", "", 4 as never, "Lids", "bags", "boxes", "bins", "extra"] } }))?.estimates;
    expect(estimates).toEqual({ largestSideM: null, massKg: { low: 2, high: 6 }, surface: null, pickToPlaceM: null, pickHeightM: null,
      placeHeightM: null, frontClearanceM: null, otherItemsLikely: ["trays", "lids", "bags", "boxes", "bins"], cycleSeconds: null });
    // The names reach the site's report, so only plain nouns survive.
    expect(videoEvidence(withVideo({ estimates: { other_items_likely: ["https://example.test/sku", "robot spare parts", "C-12 cartons",
      "Smaller cartons"] } }))?.estimates?.otherItemsLikely).toEqual(["c-12 cartons", "smaller cartons"]);
    expect(videoEvidence(withVideo({ estimates: { front_clearance_m: 0 } }))?.estimates?.frontClearanceM).toBe(0);
    expect(videoEvidence(withVideo({ estimates: { object_mass_kg_high: 0.4 } }))?.estimates?.massKg).toEqual({ low: 0.4, high: 0.4 });
  });

  it("says floor level for a height of zero", () => {
    expect(computeRobotFitJob(withVideo({ estimates: { pick_to_place_m: 0.9, place_height_m: 0 } })).needs)
      .toContain("It has to reach down near the floor: the object is put down at floor level (estimated from your video).");
  });

  it("never lets an estimated distance alone rule a robot form out", () => {
    const job = computeRobotFitJob(withVideo({ estimates: { pick_to_place_m: 3 } }));
    expect(job.forms.filter((rating) => rating.verdict === "not_a_fit")).toEqual([]);
    expect(job.forms.find((rating) => rating.id === "fixed_base_arm")).toMatchObject({ verdict: "possible", checks: [{ outcome: "caution",
      text: "It stays in one place, and the object moves about 3 m (estimated from your video), likely too far to reach both spots." }] });
    const measuredFar = computeRobotFitJob(inputs({ readings: { pick_to_place_distance: reading(300, "cm", 3) } }));
    expect(measuredFar.forms.find((rating) => rating.id === "fixed_base_arm")?.verdict).toBe("not_a_fit");
  });

  it("writes a light object's weight in grams", () => {
    expect(jobFactsOf(withVideo({ estimates: { object_mass_kg_low: 0.25, object_mass_kg_high: 0.4 } })).mass?.display).toBe("about 250–400 g");
    expect(jobFactsOf(withVideo({ estimates: { object_mass_kg_low: 2, object_mass_kg_high: 2 } })).mass?.display).toBe("about 2 kg");
  });
});

describe("steps to a pilot", () => {
  const states = (value: Inputs) => Object.fromEntries(trackerOf(value).steps.map((entry) => [entry.id, entry.state]));

  it("asks the site only for its video and its brief, and reports recorded states only", () => {
    const tracker = trackerOf(inputs({ reconstructionState: "processing" }));
    expect(tracker.steps.map((entry) => [entry.id, entry.state, entry.owner])).toEqual([
      ["video", "done", "site"], ["brief", "done", "site"], ["scene", "in_progress", "blueprint"],
      ["evaluation", "pending", "blueprint"], ["recommendation", "pending", "blueprint"], ["booking", "pending", "site"]]);
    expect(tracker.meanwhile).toBe("Blueprint is rebuilding your work area in 3D from your video.");
  });

  it("calls a recommendation bookable only as the booking route does", () => {
    const request = (recommendation: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
      inputs({ request: { requestId: "job-1", request: {}, ...SCREENED, pilot_recommendation: recommendation, ...extra } });
    const bookable = request({ id: "r1", evidence: { qualified: true } });
    expect(states(bookable)).toMatchObject({ evaluation: "done", recommendation: "done", booking: "pending" });
    expect(trackerOf(bookable).meanwhile).toBe("Blueprint has recommended a pilot for your job. You can review and book it on your job page.");
    for (const held of [request({ id: "r1", evidence: { qualified: true }, reviewRequired: true }), request({ id: "r1", evidence: {} })]) {
      expect(states(held)).toMatchObject({ evaluation: "done", recommendation: "in_progress" });
      expect(trackerOf(held).meanwhile).toBe("Blueprint is reviewing its recommendation against your job brief.");
    }
    const booked = request({ id: "r1", evidence: { qualified: true }, reviewRequired: true }, { pilot_booking: { recommendationId: "r1" } });
    expect(states(booked)).toMatchObject({ recommendation: "done", booking: "done" });
    expect(trackerOf(booked).meanwhile).toBe("Your pilot is booked. You and the delivery partner agree its details directly.");
  });

  it("says so when a job is out of scope, rather than promising robot teams", () => {
    const tracker = trackerOf(inputs({ reconstructionState: "ready",
      request: { requestId: "job-1", request: {}, site_task_scope: { supported: false, reason: "deformable" } } }));
    expect(tracker.meanwhile).toBe("We have your job and are preparing an evaluation for it.");
  });

  it("says what comes next only from a real state", () => {
    // Blueprint runs the candidates itself (owner, 2026-10-26): no robot team is waited on.
    expect(trackerOf(inputs({ reconstructionState: "ready", sceneViewable: true })).meanwhile)
      .toBe("Next, Blueprint evaluates candidate robots and policies that look right for your job in a simulation of your site.");
    expect(trackerOf(inputs({ reconstructionState: "ready", sceneViewable: true })).steps.map((entry) => entry.label)).toEqual([
      "Video received", "Job brief confirmed", "Your site rebuilt in 3D", "Blueprint evaluates candidate robots and policies in simulation",
      "Blueprint recommends the approach that wins", "You book the pilot"]);
    expect(trackerOf(inputs({ reconstructionState: "failed" })).meanwhile).toBeNull();
  });

  it("calls the scene rebuilt only once it can be viewed", () => {
    const labelOnly = trackerOf(inputs({ reconstructionState: "ready", sceneViewable: false }));
    expect(states(inputs({ reconstructionState: "ready", sceneViewable: false })).scene).toBe("pending");
    expect(labelOnly.meanwhile).toBeNull();
    expect(states(inputs({ reconstructionState: "ready", sceneViewable: true })).scene).toBe("done");
  });

  it("never reads a video status it could not check as not filmed", () => {
    expect(states(inputs({ walkthroughReceived: null })).video).toBe("unknown");
    expect(states(inputs({ walkthroughReceived: false })).video).toBe("pending");
    // A scene is only built from a received video.
    expect(states(inputs({ walkthroughReceived: null, reconstructionState: "processing" })).video).toBe("done");
  });
});

describe("getting the site ready", () => {
  const checklist = (value: Inputs) => checklistOf(value, jobFactsOf(value), computeRobotFitJob(value));
  const item = (value: Inputs, id: string) => checklist(value).find((entry) => entry.id === id)!;

  it("reads the floor space from the site's measurement, else the video's estimate", () => {
    expect(item(inputs({ readings: { pick_front_clearance: reading(120, "cm", 1.2) } }), "floor_space")).toMatchObject({ state: "ready",
      detail: "There is 120 cm (you measured this) of open floor in front of the starting surface, room for a robot's stand or base." });
    // Only a reading on file makes the floor "Looks ready"; an estimate is confirmed with the deployment partner.
    expect(item(withVideo({ estimates: { front_clearance_m: 1.3 } }), "floor_space")).toMatchObject({ state: "confirm",
      detail: "There is about 1.3 m (estimated from your video) of open floor in front of the starting surface, likely room for a robot's stand or base." });
    expect(item(withVideo({ estimates: { front_clearance_m: 0.8 } }), "floor_space")).toMatchObject({ state: "confirm",
      detail: "There is about 80 cm (estimated from your video) of open floor in front of the starting surface, tight for a robot's "
        + "stand or base. Confirm the space with the deployment partner." });
    expect(item(withVideo({ estimates: { front_clearance_m: 0.4 } }), "floor_space").detail).toMatch(/^There is only about 40 cm/);
    expect(item(withVideo({ estimates: { front_clearance_m: 0 } }), "floor_space")).toMatchObject({ state: "confirm",
      detail: "There is no open floor (estimated from your video) in front of the starting surface, so a robot's stand or base needs "
        + "another spot. Confirm the space with the deployment partner." });
    const low = item(inputs({ readings: { pick_front_clearance: reading(120, "cm", 1.2), pick_overhead_clearance: reading(30, "cm", 0.3) } }), "floor_space");
    expect(low).toMatchObject({ state: "confirm", detail: expect.stringContaining("30 cm of open height (you measured this), tight for an arm") });
    expect(item(inputs(), "floor_space")).toEqual({ id: "floor_space", title: "Floor space at the station", state: "confirm",
      detail: "The deployment partner confirms the floor space its robot needs beside the work." });
  });

  it("matches where the robot stands, and the network, to the forms that fit", () => {
    const near = inputs({ readings: { pick_to_place_distance: reading(90, "cm", 0.9) } });
    expect(item(near, "standing_spot").detail).toBe("For a robot on a fixed stand: a level spot where the stand can be bolted down "
      + "or weighted. For a robot that moves: a place to park and charge, and a clear, level path between the spots.");
    expect(item(near, "power_network").detail).toContain("Wi-Fi along the route for a robot that drives between spots");
    const far = inputs({ readings: { pick_to_place_distance: reading(300, "cm", 3) } });
    expect(item(far, "standing_spot").detail).toBe("For a robot that moves: a place to park and charge, and a clear, level path between the spots.");
  });

  it("plans the safe zone from people nearby, wherever that came from", () => {
    expect(item(inputs({ request: { requestId: "job-1", request: { siteTaskSpec: { humanProximity: "isolated" } }, ...SCREENED } }), "safe_zone"))
      .toMatchObject({ state: "ready", detail: "The area is clear of people while it runs (you told us), so the robot can work in an area kept clear of people." });
    expect(item(withVideo({ people: "working_in_the_space" }), "safe_zone"))
      .toMatchObject({ state: "confirm", detail: expect.stringContaining("People work in the same space (seen in your video).") });
    expect(item(inputs(), "safe_zone")).toMatchObject({ state: "confirm",
      detail: "The deployment partner's risk assessment settles how its robot works around people." });
  });

  it("repeats the screening answers on file for how objects arrive, and leaves the item out when there are none", () => {
    const answers = (gates: Record<string, string>) => inputs({ request: { requestId: "job-1", request: {}, ...SCREENED, siteTaskGates: gates } });
    expect(item(answers({ sceneStability: "minor_drift", taskShape: "single", objectVariety: "under_10" }), "object_arrival")).toMatchObject({
      state: "confirm", detail: "Work area: small things move, but the layout holds. "
        + "The job: one job, done the same way each time. Different items: fewer than ten (you told us)." });
    expect(item(answers({ sceneStability: "stable", taskShape: "single" }), "object_arrival").state).toBe("ready");
    expect(checklist(inputs()).map((entry) => entry.id)).toEqual(["floor_space", "standing_spot", "power_network", "safe_zone"]);
  });

  it("never claims a check that no process runs", () => {
    for (const value of [inputs(), withVideo({ people: "passing_nearby", estimates: { front_clearance_m: 0.5 } })]) {
      const items = checklist(value);
      expect(items.every((entry) => entry.state === "ready" || entry.state === "confirm")).toBe(true);
      expect(JSON.stringify(items)).not.toMatch(/Blueprint checks/);
    }
  });
});

describe("what decides success here", () => {
  const target = (cycleTimeSeconds: number, summary = "Move sealed cartons from the conveyor onto a pallet", successRate: number | null = null) =>
    ({ requestId: "job-1", summary, confirmedAtIso: NOW, successCriteria: { successDefinition: null, successRate, cycleTimeSeconds, unknown: false } }) as never;

  it("picks at most three, in priority order, each saying what tests it", () => {
    const value = inputs({
      request: { requestId: "job-1", request: {}, ...SCREENED, siteTaskGates: { sceneStability: "reconfigured" },
        ...walkthroughReading({ people: "passing_nearby", estimates: { cycle_seconds: 60, other_items_likely: ["smaller cartons", "trays"] } }) },
      brief: target(45, "Move shrink-wrapped cases, clear jams", 99.5),
    });
    const factors = successFactorsOf(value, jobFactsOf(value));
    expect(factors.map((entry) => [entry.id, entry.where])).toEqual([["speed", "simulation"], ["variety", "pilot"], ["placement", "simulation"]]);
    expect(factors[0]).toMatchObject({ detail: "Your target, 45 seconds per cycle, is faster than today's 60 seconds (estimated from your video).",
      test: "The evaluation measures cycle time against your target." });
    expect(factors[1]).toMatchObject({ detail: "Probably also handled here, though not in your video: smaller cartons, trays (estimated from your video).",
      test: "The evaluation tests the object in your rebuilt scene. Other items are checked in the pilot." });
  });

  it("names a tight space in a sentence of its own, a zero clearance included", () => {
    const tight = (front_clearance_m: number) => {
      const value = withVideo({ estimates: { front_clearance_m } });
      return successFactorsOf(value, jobFactsOf(value)).find((entry) => entry.id === "tight_space")?.detail;
    };
    expect(tight(0.8)).toBe("About 80 cm (estimated from your video) of open floor in front of the starting surface.");
    expect(tight(0)).toBe("No open floor (estimated from your video) in front of the starting surface.");
    expect(tight(1.3)).toBeUndefined();
  });

  it("calls a cycle the reader timed timed, not measured", () => {
    const value = inputs({ request: { requestId: "job-1", request: {}, ...SCREENED, ...walkthroughReading({ cycle: 60 }) }, brief: target(45) });
    expect(successFactorsOf(value, jobFactsOf(value))[0].detail).toBe("Your target, 45 seconds per cycle, is faster than today's 60 seconds (timed from your video).");
  });

  it("leaves to the pilot what the simulation cannot show", () => {
    const value = inputs({ brief: { requestId: "job-1", summary: "Pick glass jars and set aside damaged ones", confirmedAtIso: NOW } as never });
    expect(successFactorsOf(value, jobFactsOf(value)).map((entry) => [entry.id, entry.title, entry.where, entry.detail])).toEqual([
      ["surfaces", "Shiny or see-through items", "pilot", "Your job mentions \"glass\"."],
      ["exceptions", "Jams and damaged items", "pilot", "Your job mentions \"damaged\"."]]);
    const seen = withVideo({ estimates: { object_surface: "transparent" } });
    expect(successFactorsOf(seen, jobFactsOf(seen))[0]).toMatchObject({ id: "surfaces", detail: "The object looks transparent in your video." });
  });

  it("reads a real exception, not a phrase that only looks like one", () => {
    const exception = (summary: string) => {
      const value = inputs({ brief: { requestId: "job-1", summary, confirmedAtIso: NOW } as never });
      return successFactorsOf(value, jobFactsOf(value)).some((entry) => entry.id === "exceptions");
    };
    for (const lookalike of ["Fill jam jars", "Broken-case picking from totes", "Fit spill-proof lids", "Zero damaged items a shift",
      "Parcels dropped off at the dock"]) expect(exception(lookalike), lookalike).toBe(false);
    for (const real of ["Clear jams on the infeed", "Set aside damaged cartons", "Pick up a dropped carton", "Wipe up spills"]) {
      expect(exception(real), real).toBe(true);
    }
  });
});

describe("safety in plain English", () => {
  it("asks the deployment partner for its risk assessment, names the standards for the forms in play, and what Blueprint does not certify", () => {
    const near = inputs({ request: { requestId: "job-1", request: { siteTaskSpec: { humanProximity: "shared" } }, ...SCREENED },
      readings: { pick_to_place_distance: reading(90, "cm", 0.9) } });
    const lines = safetyOf(jobFactsOf(near), computeRobotFitJob(near));
    expect(lines[0]).toBe("Before a robot works at your site, ask the deployment partner for its risk assessment of the job. Robot safety follows "
      + "the standards ISO 10218, adopted in the US as ANSI/A3 R15.06, and ANSI/A3 R15.08 for robots that drive between spots.");
    expect(lines[1]).toContain("Safety standards for walking robots are still being written");
    expect(lines).toContain("People work in the same space (you told us), so this decides how the robot works alongside them.");
    expect(lines.at(-1)).toContain("It does not certify that any robot is safe");
  });
});

describe("jobs like this on the public record", () => {
  const example = (summary: string) => examplesOf(inputs({ brief: { requestId: "job-1", summary } as never }));

  it("matches documented deployments precisely, by environment and source, and never names a robot company", () => {
    const parcels = example("Sort parcels onto outbound chutes");
    expect(parcels).toEqual([{ id: "parcel-sorting", name: "Parcel sorting", sources: expect.any(Array) }]);
    expect(parcels[0].sources[0].href).toMatch(/^https:\/\//);
    expect(example("Pick prescriptions for the pharmacy counter").map((entry) => entry.id)).toEqual(["pharmacy"]);
    expect(JSON.stringify([parcels, example("Pick prescriptions for the pharmacy counter")])).not.toMatch(/Galbot|Robot Era/);
  });

  it("leaves out environments with no operating site on record, and jobs it cannot place", () => {
    expect(example("Pack finished parts into cartons")).toEqual([]);
    expect(example("Pick orders from shelves into totes")).toEqual([]);
    expect(examplesOf(inputs())).toEqual([]);
  });
});

describe("the people-nearby answer, wherever it comes from", () => {
  it("prefers what the site told us, then what its video shows", () => {
    const people = (value: Inputs) => jobFactsOf(value).people;
    expect(people(withVideo({ people: "working_in_the_space" }, { request: { siteTaskSpec: { humanProximity: "nearby" } } })))
      .toMatchObject({ value: "nearby", source: "site_stated" });
    expect(people(withVideo({ people: "working_in_the_space" }))).toMatchObject({ value: "shared", source: "video_observed" });
    expect(people(withVideo({ people: "performing_the_task" }))).toBeNull();
  });

  it("never turns what is unknown into a question for the site", () => {
    const site = projectSiteRobotFit(computeRobotFitJob(inputs()))!;
    expect(site).not.toHaveProperty("unknowns");
    expect(JSON.stringify(site)).not.toMatch(/on this page|you can answer|measure it/i);
  });
});

describe("the owner's read", () => {
  beforeEach(() => {
    sharedFakeFirestoreState.docs.clear();
    walkthrough.received = true;
    sharedFakeFirestoreState.docs.set("inboundRequests/job-1", { requestId: "job-1", request: {}, ...SCREENED,
      ...walkthroughReading({ cycle: 84, estimates: { pick_to_place_m: 0.9, object_mass_kg_low: 1, object_mass_kg_high: 2 } }) });
    sharedFakeFirestoreState.docs.set("siteTaskBriefs/job-1", { requestId: "job-1", summary: "Sort parcels onto outbound chutes", confirmedAtIso: NOW });
  });

  it("gives where the job stands, and the report only while shared and while consent stands", async () => {
    const unshared = await getSiteReadiness("job-1");
    expect(Object.keys(unshared!).sort()).toEqual(["briefPath", "ok", "report", "summary", "tracker"]);
    expect(unshared).toMatchObject({ ok: true, summary: "Sort parcels onto outbound chutes", report: null, briefPath: null });
    sharedFakeFirestoreState.docs.set("siteRobotFit/job-1", { sharing: { shared: true, changedAtIso: NOW, changedBy: "admin" } });
    const shared = await getSiteReadiness("job-1");
    expect(shared?.report?.robotFit.forms).toHaveLength(6);
    expect(shared?.report?.robotFit.needs).toContain("It can work from one place: the object moves about 90 cm (estimated from your video).");
    expect(shared?.report?.examples.map((entry) => entry.id)).toEqual(["parcel-sorting"]);
    expect(JSON.stringify(shared)).not.toMatch(/\bmatch|price|\$|Galbot|Robot Era/i);
    sharedFakeFirestoreState.docs.set("inboundRequests/job-1", { requestId: "job-1", request: {}, ...SCREENED, capture_rights: { consent_revoked: true } });
    expect((await getSiteReadiness("job-1"))?.report).toBeNull();
  });

  it("returns nothing for a job that does not exist", async () => {
    expect(await getSiteReadiness("missing")).toBeNull();
  });

  it("builds no report for a job that is not rated", () => {
    expect(buildReadinessReport(inputs({ request: { request: {} } }))).toBeNull();
  });
});
