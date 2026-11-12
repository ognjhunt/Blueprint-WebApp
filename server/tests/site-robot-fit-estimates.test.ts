// @vitest-environment node
/**
 * The first look's read of a site's job from its video (`siteRobotFit.ts`).
 * The site sends its video and nothing else (founder direction, 2026-10-20).
 *
 * What this pins: the video reader's estimates fill what nobody measured,
 * always labelled "estimated from your video", and anything the site measured
 * or told us still comes first. (The readiness report built on this read, and
 * its printable brief, were removed on 2026-11-12.)
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

const { computeRobotFitJob, jobFactsOf, videoEvidence } = await import("../utils/siteRobotFit");
type Inputs = import("../utils/siteRobotFit").RobotFitInputs;

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
    expect(job.forms).toHaveLength(6);
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
    expect(estimates).toEqual({ largestSideM: null, massKg: { low: 2, high: 6 }, surface: null, jobKind: null, otherActions: [],
      pickToPlaceM: null, pickHeightM: null,
      placeHeightM: null, frontClearanceM: null, otherItemsLikely: ["trays", "lids", "bags", "boxes", "bins"], cycleSeconds: null });
    // The names reach the site's report, so only plain nouns survive.
    expect(videoEvidence(withVideo({ estimates: { other_items_likely: ["https://example.test/sku", "robot spare parts", "C-12 cartons",
      "Smaller cartons"] } }))?.estimates?.otherItemsLikely).toEqual(["c-12 cartons", "smaller cartons"]);
    expect(videoEvidence(withVideo({ estimates: { front_clearance_m: 0 } }))?.estimates?.frontClearanceM).toBe(0);
    // What is done to the object: a known kind only, and plain -ing words only, since they reach a sentence on the page.
    expect(videoEvidence(withVideo({ estimates: { job_kind: "machine_tending", other_actions: ["Folding", "<b>x</b>", "screw_ing",
      "wiping", "folding"] } }))?.estimates).toMatchObject({ jobKind: "machine_tending", otherActions: ["folding", "wiping"] });
    expect(videoEvidence(withVideo({ estimates: { job_kind: "juggling" } }))?.estimates?.jobKind).toBeNull();
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

describe("the people-nearby answer, wherever it comes from", () => {
  it("prefers what the site told us, then what its video shows", () => {
    const people = (value: Inputs) => jobFactsOf(value).people;
    expect(people(withVideo({ people: "working_in_the_space" }, { request: { siteTaskSpec: { humanProximity: "nearby" } } })))
      .toMatchObject({ value: "nearby", source: "site_stated" });
    expect(people(withVideo({ people: "working_in_the_space" }))).toMatchObject({ value: "shared", source: "video_observed" });
    expect(people(withVideo({ people: "performing_the_task" }))).toBeNull();
  });
});
