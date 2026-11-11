// @vitest-environment node
/**
 * The site's answer: every catalog robot checked against the job by its
 * published figures, each check from the best source for its own quantity
 * (the scene measured from the video decides reach, never payload), cited
 * evidence of use on this kind of job, and one pick by a fixed rule.
 *
 * Evidence rows here are fixtures, except in the block that names the shipped file.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return {
    default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore,
    storageAdmin: null,
  };
});

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { composeSiteAnswer, loadSiteAnswer } = await import("../utils/siteAnswer");
const { robotSpecCatalog } = await import("../utils/robotSpecCatalog");
const { evidenceLookup, parseDeploymentEvidence } = await import("../utils/deploymentEvidence");
const { sharedFakeFirestoreState } = await import("./helpers/fake-firestore");
const { SITE_ANSWER_NOTE, isSiteAnswer } = await import("../../client/src/lib/siteAnswer");
type Inputs = Parameters<typeof composeSiteAnswer>[0];

const NOW = "2026-11-11T12:00:00.000Z";

function evidenceRow(overrides: Record<string, unknown>) {
  return { id: "row", manufacturer: "Universal Robots", applies_to: ["universal_robots_ur10e"], names: "model", family: null,
    customer: "A named plant", job_family: "pick_place",
    level: "production", summary: "A named plant uses it to move cartons.", quote: "The UR10e moves cartons at our plant every shift.",
    source_url: "https://example.com/case", source_title: "Case study", publisher: "Example", published_on: "2025-03-01",
    ...overrides };
}
const lookupOf = (rows: Array<Record<string, unknown>>) => {
  const parsed = parseDeploymentEvidence({ schema_version: "deployment_evidence.v2", retrieved_on: "2026-11-11", rows });
  expect(parsed.rejected).toEqual([]);
  return evidenceLookup(parsed.rows);
};
const FIXTURE_EVIDENCE = lookupOf([
  evidenceRow({ id: "ur10e-prod" }),
  evidenceRow({ id: "crx-pilot", manufacturer: "FANUC", applies_to: ["fanuc_crx_10ia"], level: "pilot",
    quote: "The integrator piloted the CRX-10iA moving cartons for a named customer." }),
]);

function estimates(overrides: Record<string, unknown> = {}) {
  return { object: "carton", object_largest_side_m: 0.4, object_mass_kg_low: 3, object_mass_kg_high: 4, object_surface: "matte",
    pick_to_place_m: 1.0, pick_height_m: null, place_height_m: null, front_clearance_m: 1.5, other_items_likely: [],
    cycle_seconds: null, basis: "A person moves cartons from a conveyor to a shelf.", ...overrides };
}

function reading(value: number, unit: string, si: number) {
  return { value, unit, si, basis: "tape", recordedAtIso: NOW, recordedByScope: "owner", recordedByName: null };
}
function measurements(readings: Record<string, ReturnType<typeof reading>>) {
  return { requestId: "job-1", family: "rigid_pick_place", articulation: null, referencePaper: null, readings, measuredBy: null,
    note: null, revision: 1, updatedAtIso: NOW } as unknown as NonNullable<Inputs["measurements"]>;
}

function inputs(overrides: { request?: Record<string, any>; brief?: Record<string, any> | null; measurements?: Inputs["measurements"];
  videoReceived?: boolean; robotFit?: Inputs["robotFit"]; estimates?: Record<string, unknown> | null } = {}): Inputs {
  const est = overrides.estimates === undefined ? estimates() : overrides.estimates;
  return {
    request: { requestId: "job-1", request: {}, capture_coverage: { covers_scene: true },
      ...(est ? { walkthrough_job_estimates: { capture_id: "walkthrough-job-1", job_estimates: est } } : {}),
      ...overrides.request },
    brief: (overrides.brief === undefined
      ? { requestId: "job-1", summary: "Move cartons from the conveyor to the shelf", confirmedAtIso: null }
      : overrides.brief) as Inputs["brief"],
    measurements: overrides.measurements ?? null,
    videoReceived: overrides.videoReceived ?? true,
    robotFit: overrides.robotFit ?? null,
    evidenceFor: FIXTURE_EVIDENCE,
  };
}

const compose = (overrides: Parameters<typeof inputs>[0] = {}) => composeSiteAnswer(inputs(overrides))!;
const verdictOf = (answer: ReturnType<typeof compose>, name: string) =>
  [answer.pick, answer.runnerUp].find((robot) => robot?.name === name)?.verdict
  ?? (answer.alsoFit.some((robot) => robot.name === name) ? "fits_listed" : undefined)
  ?? (answer.ruledOut.some((robot) => robot.name === name) ? "ruled_out" : undefined);

describe("composeSiteAnswer", () => {
  it("answers with a pick and a runner-up from a different maker", () => {
    const answer = compose({ request: { capture_task_statement_draft: { state: "drafted" } } });
    expect(isSiteAnswer(answer)).toBe(true);
    expect(answer.state).toBe("ready");
    expect(answer.headline).toBe("Most likely to fit: Universal Robots UR10e.");
    expect(answer.pick).toMatchObject({ modelId: "universal_robots_ur10e", verdict: "fits_on_paper", sceneChecked: false,
      formLabel: "One arm on a fixed stand" });
    expect(answer.pick!.evidence[0]).toMatchObject({ level: "production", scope: "model" });
    expect(answer.pick!.specs.map((spec) => spec.label)).toEqual(["Reach", "Rated payload"]);
    expect(answer.runnerUp).toMatchObject({ manufacturer: "FANUC", name: "CRX-10iA" });
    expect(answer.alsoFit.length).toBeLessThanOrEqual(6);
    expect(answer.job).toEqual({ sentence: "Move cartons from the conveyor to the shelf", drafted: true, family: "pick_place",
      familyLabel: "pick and place" });
    expect(answer.facts).toContainEqual({ label: "How far the object moves", display: "about 1 m", basis: "video_estimate" });
    expect(answer.nextStep).toEqual({ kind: "introduction",
      text: "Share this job with deployment companies Blueprint has approved, and one of them can pilot it at your site." });
    expect(answer.note).toBe(SITE_ANSWER_NOTE);
    expect(answer.checked).toEqual({ models: 22, makers: 13, specsRetrievedOn: "2026-11-02" });
    expect(answer.reason).toBeNull();
    // Each check names the site's number with its basis and the robot's figure.
    const reach = answer.pick!.checks.find((check) => check.key === "reach")!;
    expect(reach).toMatchObject({ outcome: "pass", estimated: true, basis: "video_estimate" });
    expect(reach.text).toBe("Reach: your two spots are about 1 m apart (estimated from your video), so an arm standing between them needs about 64–93 cm. This arm reaches 1.3 m.");
    expect(answer.pick!.checks.find((check) => check.key === "payload")!.basis).toBe("video_estimate");
    expect(answer.pick!.checks.find((check) => check.key === "payload")!.text)
      .toBe("Payload: your object weighs about 3–4 kg (estimated from your video), plus about 0.9 kg for a standard gripper, so it must carry about 3–4.9 kg. This arm is rated for 12.5 kg.");
    for (const sentence of [answer.headline, ...answer.unknowns, ...answer.confidence.reasons, ...answer.ruledOut.map((row) => row.reason)]) {
      expect(sentence).not.toMatch(/safe to|guarantee|tested at your site|will work|certif|episode|candidate|screening|embodiment/i);
    }
  });

  it("rules a model out on payload from a stated weight, and from a video estimate, saying which", () => {
    const stated = compose({ brief: { requestId: "job-1", summary: "Move cartons to the shelf", operatorTaskDetails: { item_weight: "8 kg" } } });
    expect(stated.ruledOut).toContainEqual({ name: "UR5e", manufacturer: "Universal Robots", estimated: false,
      reason: "Payload: your object weighs 8 kg (you told us), plus about 0.9 kg for a standard gripper, so it must carry about 8–8.9 kg. This arm is rated for 5 kg." });
    const estimated = compose({ estimates: estimates({ object_mass_kg_low: 8, object_mass_kg_high: 9 }) });
    expect(estimated.ruledOut.find((row) => row.name === "UR5e")).toMatchObject({ estimated: true,
      reason: expect.stringContaining("about 8–9 kg (estimated from your video)") });
  });

  it("checks a one-figure video length across a band, so a limit inside it stays unknown", () => {
    const fromVideo = compose({ estimates: estimates({ pick_to_place_m: 2.0 }) });
    const ur10e = [fromVideo.pick, fromVideo.runnerUp].find((robot) => robot?.modelId === "universal_robots_ur10e");
    expect(verdictOf(fromVideo, "UR10e")).not.toBe("ruled_out");
    const measured = compose({ measurements: measurements({ pick_to_place_distance: reading(2, "m", 2) }) });
    expect(fromVideo.facts.find((fact) => fact.label === "How far the object moves")?.display).toBe("about 2 m");
    // Measured 2 m: 1 m + gripper + margin = 1.26 m, within 1.3 m. Estimated 2 m: 1.01–1.59 m straddles it.
    const rateUr10e = (answer: ReturnType<typeof compose>) => {
      const all = [answer.pick, answer.runnerUp].filter(Boolean);
      return all.find((robot) => robot!.modelId === "universal_robots_ur10e") ?? ur10e;
    };
    // 1.26 m of 1.3 m leaves 3%: a tight fit, so roomier arms rank ahead of it. Checked alone, it passes and says so.
    const alone = composeSiteAnswer({ ...inputs({ measurements: measurements({ pick_to_place_distance: reading(2, "m", 2) }) }),
      catalog: { ...robotSpecCatalog(), models: robotSpecCatalog().models.filter((model) => model.model_id === "universal_robots_ur10e") } })!;
    expect(alone.pick!.checks.find((check) => check.key === "reach")).toMatchObject({ outcome: "pass",
      text: "Reach: your two spots are 2 m apart (you measured this), so an arm standing between them needs about 1.26 m. This arm reaches 1.3 m. This is a tight fit." });
    expect(rateUr10e(measured)?.checks.find((check) => check.key === "reach")?.outcome ?? "pass").toBe("pass");
    expect(rateUr10e(fromVideo)?.checks.find((check) => check.key === "reach")?.outcome ?? "unknown").toBe("unknown");
    expect(measured.pick!.verdict).toBe("fits_on_paper");
  });

  it("never shows a need that reads against its own check: within the limit on a pass, beyond it on a fail", () => {
    const only = (id: string) => ({ ...robotSpecCatalog(), models: robotSpecCatalog().models.filter((model) => model.model_id === id) });
    const toNumber = (value: string, unit: string) => Number(value) / (unit === "cm" ? 100 : 1);
    /** The displayed need's two ends and the displayed limit, in one unit. */
    const shown = (sentence: string, need: RegExp, limit: RegExp) => {
      const range = sentence.match(need)![1].split("–").map((part) => part.trim().split(" "));
      const lastUnit = range[range.length - 1][1];
      const ends = range.map(([value, unit]) => toNumber(value, unit ?? lastUnit));
      const [, value, unit] = sentence.match(limit)!;
      return { lo: ends[0], hi: ends[ends.length - 1], limit: toNumber(value, unit) };
    };
    const outcomeOf = (answer: ReturnType<typeof compose>, key: string) => {
      const check = answer.pick?.checks.find((entry) => entry.key === key);
      if (check) return { outcome: check.outcome, text: check.text };
      const ruled = answer.ruledOut[0];
      return ruled ? { outcome: "fail", text: ruled.reason } : null;
    };
    let seen = { pass: 0, fail: 0 };
    // Reach near the GoFa 12's 1.38 m (a figure a tenth-of-a-metre display rounds across): the spots
    // measured to the centimetre either side of the limit.
    for (let cm = 210; cm <= 240; cm += 1) {
      const answer = composeSiteAnswer({ ...inputs({ measurements: measurements({ pick_to_place_distance: reading(cm / 100, "m", cm / 100) }) }),
        catalog: only("abb_gofa_crb15000_12_127") })!;
      const reach = outcomeOf(answer, "reach");
      if (!reach || !reach.text.includes("needs about") || reach.outcome === "unknown") continue;
      const { lo, hi, limit } = shown(reach.text, /needs (?:about )?(.+?)\. This arm/, /reaches ([\d.]+) (cm|m)\./);
      if (reach.outcome === "pass") expect(hi, reach.text).toBeLessThanOrEqual(limit);
      else expect(lo, reach.text).toBeGreaterThanOrEqual(limit);
      seen = { ...seen, [reach.outcome]: seen[reach.outcome as "pass" | "fail"] + 1 };
    }
    // Payload near its 12 kg: the object's weight in 50 g steps either side of it.
    for (let grams = 10_000; grams <= 12_500; grams += 50) {
      const answer = composeSiteAnswer({ ...inputs({ estimates: estimates({ object_mass_kg_low: grams / 1000, object_mass_kg_high: grams / 1000 }) }),
        catalog: only("abb_gofa_crb15000_12_127") })!;
      const payload = outcomeOf(answer, "payload");
      if (!payload || payload.outcome === "unknown" || !payload.text.startsWith("Payload")) continue;
      const { lo, hi, limit } = shown(payload.text, /must carry (?:about )?(.+?)\. This arm/, /rated for ([\d.]+) (kg)\./);
      if (payload.outcome === "pass") expect(hi, payload.text).toBeLessThanOrEqual(limit);
      else expect(lo, payload.text).toBeGreaterThanOrEqual(limit);
      seen = { ...seen, [payload.outcome]: seen[payload.outcome as "pass" | "fail"] + 1 };
    }
    expect(seen.pass).toBeGreaterThan(10);
    expect(seen.fail).toBeGreaterThan(10);
  });

  it("rules out arms that stay in one place when the spots are too far apart, and says the job needs a robot that moves", () => {
    const answer = compose({ measurements: measurements({ pick_to_place_distance: reading(3, "m", 3) }),
      brief: { requestId: "job-1", summary: "Carry parts across the cell", operatorTaskDetails: { item_weight: "1 kg" } } });
    expect(answer.state).toBe("ready");
    expect(answer.formNote).toBe("Your two spots are 3 m apart (you measured this), so the job needs a robot that moves between them, such as an arm on a wheeled base.");
    expect(answer.ruledOut.length + answer.ruledOutMore).toBe(20);
    expect(answer.ruledOut[0].reason).toContain("more than the 2.4 m an arm that stays in one place can serve");
    expect(answer.ruledOut[0].estimated).toBe(false);
    expect(answer.pick!.formLabel).toBe("Arm on a wheeled base");
    expect(answer.runnerUp!.formLabel).toBe("Walking humanoid");
    expect(answer.headline).toBe("No robot clearly fits yet. The closest is Hello Robot Stretch 3.");
  });

  it("never lets the simulation's scope reasons decide whether robots are checked against the job", () => {
    // The stored task screen describes what the simulation can score. Whatever it says, a carried object is checked.
    const noObject = { estimates: estimates({ object: null, pick_to_place_m: null }) };
    for (const reason of ["deformable", "liquid", "assembly", "closing", "push", "articulated", "container", "mobile", "other",
      "multi_step", "unclear"]) {
      const answer = compose({ ...noObject, request: { site_task_scope: { supported: false, kind: null, reason } } });
      expect(answer.state, reason).toBe("ready");
      expect(answer.reason).toBeNull();
    }
    expect(compose({ ...noObject, request: { site_task_scope: { supported: true, kind: "articulated_open_close", reason: null } } }).state)
      .toBe("ready");
  });

  it("still picks a robot for a carton job whose stored scope says it goes into a container", () => {
    const answer = compose({ request: { site_task_scope: { supported: false, kind: null, reason: "container" } },
      brief: { requestId: "job-1", summary: "Put each carton into the tote" } });
    expect(answer.state).toBe("ready");
    expect(answer.headline).toMatch(/^Most likely to fit: /);
  });

  it("says a job of several steps is checked one carry at a time, from the job's own sentence", () => {
    const steps = compose({ brief: { requestId: "job-1", summary: "Pick up the box from the conveyor, then put it on the shelf, then scan the label" } });
    expect(steps.state).toBe("ready");
    expect(steps.unknowns).toContain("Your job has more than one step; this checks one carry.");
    expect(compose().unknowns).not.toContain("Your job has more than one step; this checks one carry.");
    // The simulation's stored reason alone adds nothing.
    expect(compose({ request: { site_task_scope: { supported: false, kind: null, reason: "multi_step" } } }).unknowns)
      .not.toContain("Your job has more than one step; this checks one carry.");
  });

  it("says how the pick would be controlled", () => {
    // The sentence about how arms of this kind are deployed had no source and is gone.
    expect(compose().approach).toEqual({ kind: "programmed",
      text: "A programmed application: the installer teaches the robot this motion once." });
    expect(compose({ estimates: estimates({ other_items_likely: ["plastic totes"] }) }).approach).toEqual({ kind: "camera_guided",
      text: "The objects vary, so the robot needs camera-guided picking. Ask the deployment company how it handles each item." });
    const none = compose({ brief: { requestId: "job-1", summary: "Move engine blocks", operatorTaskDetails: { item_weight: "500 kg" } } });
    expect(none.pick).toBeNull();
    expect(none.approach).toBeNull();
    const moving = compose({ measurements: measurements({ pick_to_place_distance: reading(3, "m", 3) }),
      brief: { requestId: "job-1", summary: "Carry parts across the cell", operatorTaskDetails: { item_weight: "1 kg" } } });
    expect(moving.approach).toEqual({ kind: "programmed", text: "A programmed application: the installer teaches the robot this motion once." });
    expect(compose({ estimates: null, request: { capture_coverage: null }, brief: { requestId: "job-1", summary: "Your site task" } }).approach).toBeNull();
  });

  it("cannot assess a finished reading that gives no distance, weight or size", () => {
    const answer = compose({ brief: { requestId: "job-1", summary: "Your site task" },
      estimates: estimates({ object: null, object_largest_side_m: null, object_mass_kg_low: null, object_mass_kg_high: null,
        pick_to_place_m: null }) });
    expect(answer).toMatchObject({ state: "cannot_assess", reason: "The video did not show the job clearly enough for us to size it." });
  });

  it("is reading while the video is being read and the site gave no number", () => {
    const answer = compose({ estimates: null, request: { capture_coverage: null }, brief: { requestId: "job-1", summary: "Your site task" } });
    expect(answer).toMatchObject({ state: "reading", headline: "We are reading your video. Your answer will appear here.", pick: null });
    expect(answer.job.sentence).toBeNull();
  });

  it("gives no answer before a video or any number", () => {
    expect(composeSiteAnswer(inputs({ estimates: null, videoReceived: false, request: { capture_coverage: null } }))).toBeNull();
    expect(composeSiteAnswer(inputs({ request: { request: { consent_attestation: { revoked_at_iso: NOW } } } }))).toBeNull();
  });

  it("ranks a comfortable fit before a tight one, then by evidence, and a model-named source before a family-named one", () => {
    const base = inputs();
    const pilotOnSmall = composeSiteAnswer({ ...base, evidenceFor: lookupOf([
      evidenceRow({ id: "small", manufacturer: "ABB", applies_to: ["abb_gofa_crb15000_5_95"], level: "pilot" }),
    ]) })!;
    // The GoFa 5 kg has 2% payload headroom over 4 kg plus the gripper: a tight fit. Its pilot no longer
    // puts it ahead of arms with ample margin and no evidence at all.
    expect(pilotOnSmall.pick!.modelId).not.toBe("abb_gofa_crb15000_5_95");
    expect(pilotOnSmall.pick!.evidence).toEqual([]);
    expect(pilotOnSmall.runnerUp!.modelId).not.toBe("abb_gofa_crb15000_5_95");
    // When nothing fits comfortably, the tight fit is the pick, and its tight check says so.
    const onlyTight = composeSiteAnswer({ ...base, catalog: { ...robotSpecCatalog(),
      models: robotSpecCatalog().models.filter((model) => model.model_id === "abb_gofa_crb15000_5_95") } })!;
    const payload = onlyTight.pick!.checks.find((check) => check.key === "payload")!;
    expect(payload).toMatchObject({ outcome: "pass" });
    expect(payload.text.endsWith("This arm is rated for 5 kg. This is a tight fit.")).toBe(true);
    expect(onlyTight.pick!.checks.find((check) => check.key === "reach")!.text).not.toMatch(/tight fit/);
    // A comfortable pick says nothing of the kind.
    expect(compose().pick!.checks.some((check) => check.text.includes("tight fit"))).toBe(false);
    const scope = composeSiteAnswer({ ...base, evidenceFor: lookupOf([
      evidenceRow({ id: "family", manufacturer: "Yaskawa", applies_to: ["yaskawa_gp12", "yaskawa_gp20"], names: "family", family: "Motoman GP" }),
      evidenceRow({ id: "named", manufacturer: "FANUC", applies_to: ["fanuc_crx_10ia_l"] }),
    ]) })!;
    expect(scope.pick!.modelId).toBe("fanuc_crx_10ia_l");
    expect(scope.pick!.evidence[0]).toMatchObject({ scope: "model", family: null });
    expect(scope.runnerUp!.manufacturer).toBe("Yaskawa");
    expect(scope.runnerUp!.evidence[0]).toMatchObject({ scope: "family", family: "Motoman GP" });
    // A family-named source is said as such in the reasons, never as the model's own record.
    const familyPick = composeSiteAnswer({ ...base, catalog: { ...robotSpecCatalog(),
      models: robotSpecCatalog().models.filter((model) => model.model_id === "yaskawa_gp20") },
    evidenceFor: lookupOf([evidenceRow({ id: "family", manufacturer: "Yaskawa", applies_to: ["yaskawa_gp20"], names: "family", family: "Motoman GP" })]) })!;
    expect(familyPick.confidence.reasons).toContain("We found documented production use of robots in the Motoman GP family for pick and place.");
    const none = composeSiteAnswer({ ...base, evidenceFor: lookupOf([]) })!;
    // No evidence at all: the most headroom (capped), then the smaller payload.
    expect(none.pick!.verdict).toBe("fits_on_paper");
  });

  it("says how sure, in words", () => {
    const good = compose({ estimates: null, measurements: measurements({ pick_to_place_distance: reading(1, "m", 1) }),
      brief: { requestId: "job-1", summary: "Move cartons to the shelf", operatorTaskDetails: { item_weight: "4 kg" } } });
    expect(good.confidence.level).toBe("good");
    expect(good.confidence.reasons).toContain("We found documented production use of this robot for pick and place.");
    const fair = compose();
    expect(fair.confidence.level).toBe("fair");
    expect(fair.confidence.reasons).toContain("The weight and distances are estimated from your video.");
    expect(fair.confidence.raiseIt).toEqual(["Tell us the object's weight.", "Tell us how far apart the two spots are.",
      "A measured scene of your work area.", "A pilot at your site."]);
    const low = composeSiteAnswer({ ...inputs(), evidenceFor: lookupOf([]) })!;
    expect(low.confidence.level).toBe("low");
    expect(low.confidence.reasons).toContain("We found no documented use of this robot on this kind of job.");
  });

  it("lists what the video could not tell", () => {
    const answer = compose({ estimates: estimates({ object_surface: "shiny", other_items_likely: ["plastic totes", "bags"],
      object_mass_kg_low: null, object_mass_kg_high: null }) });
    expect(answer.unknowns).toEqual([
      "Whether there is floor space for the robot between the two spots.",
      "Which gripper or tool the object needs: it looks shiny in your video, which affects that choice.",
      "How many different objects the job handles: your video suggests it may also handle plastic totes, bags.",
      "Safety around people, which the company that deploys the robot assesses at your site.",
      "How heavy the object is.",
    ]);
    const clear = compose({ request: { siteTaskGates: { humanProximity: "isolated" } } });
    expect(clear.unknowns.some((line) => line.startsWith("Safety around people"))).toBe(false);
  });

  it("copies the introduction request time", () => {
    expect(compose().introductionRequestedAtIso).toBeNull();
    expect(compose({ request: { introduction_request: { requested_at_iso: NOW, requested_by: "signed_owner_link" } } })
      .introductionRequestedAtIso).toBe(NOW);
  });

  it("says whether the job card is on, as stored, and never assumes it", () => {
    expect(compose().jobCardListed).toBe(false);
    expect(compose({ request: { public_task_listing: { enabled: false } } }).jobCardListed).toBe(false);
    expect(compose({ request: { public_task_listing: { enabled: "yes" } } }).jobCardListed).toBe(false);
    expect(compose({ request: { public_task_listing: { enabled: true } } }).jobCardListed).toBe(true);
  });

  it("checks a stated cycle time against the robot's published top speed", () => {
    const answer = compose({ brief: { requestId: "job-1", summary: "Move cartons to the shelf",
      successCriteria: { successDefinition: null, successRate: null, cycleTimeSeconds: 60, unknown: false } } });
    const cycle = answer.pick!.checks.find((check) => check.key === "cycle_time")!;
    expect(cycle.outcome).toBe("pass");
    expect(cycle.text).toContain("you want one cycle in 60 s (you told us)");
    expect(answer.facts).toContainEqual({ label: "Your target cycle time", display: "60 s", basis: "site_stated" });
    expect(compose().pick!.checks.some((check) => check.key === "cycle_time")).toBe(false);
  });

  it("gives the same digest for the same inputs, and a new one when they change", () => {
    expect(compose().basisDigest).toBe(compose().basisDigest);
    expect(compose().basisDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(compose({ estimates: estimates({ pick_to_place_m: 1.1 }) }).basisDigest).not.toBe(compose().basisDigest);
  });

  it("never throws on junk or missing inputs", () => {
    const junk: unknown[] = [null, undefined, {}, { request: "x" }, { request: [], brief: 4 },
      { request: { walkthrough_job_estimates: "junk", site_task_scope: 3, site_video_evidence: [] }, brief: { summary: 7 },
        measurements: { readings: "x" }, videoReceived: true, robotFit: { models: "x" } },
      { request: { walkthrough_job_estimates: { job_estimates: { pick_to_place_m: -1, object_mass_kg_low: "a", other_items_likely: [3, null] } },
        introduction_request: 5 }, brief: { summary: "Move cartons", successCriteria: { cycleTimeSeconds: Number.NaN } },
        measurements: { family: "rigid_pick_place", readings: { pick_to_place_distance: { si: Number.NaN } } }, videoReceived: true,
        robotFit: { models: [null, { name: 3 }] } },
    ];
    for (const value of junk) {
      expect(() => composeSiteAnswer(value as Inputs)).not.toThrow();
    }
  });
});

const OTHER_KIND = "This check covers jobs where a robot picks one solid object up and puts it down. Your job looks like another kind, which we can't check robots against yet.";
type SceneRow = NonNullable<NonNullable<Inputs["robotFit"]>["models"]>[number];
const scene = (...rows: Array<Partial<SceneRow> & { name: string; manufacturer: string }>) =>
  ({ models: rows.map((row) => ({ verdict: "fits", openChecks: [], ...row })) as SceneRow[] });
const only = (...ids: string[]) => ({ ...robotSpecCatalog(), models: robotSpecCatalog().models.filter((model) => ids.includes(model.model_id)) });
const robotsOf = (answer: ReturnType<typeof compose>) => [answer.pick, answer.runnerUp].filter((robot) => robot !== null);
const checkOf = (answer: ReturnType<typeof compose>, key: string) => robotsOf(answer)[0]?.checks.find((check) => check.key === key);

describe("each check takes its outcome from the best source for its own quantity", () => {
  const UR10E = { name: "UR10e", manufacturer: "Universal Robots" };

  it("rules out a robot the scene says fits when its payload fails, with the payload sentence, and never picks it", () => {
    const heavy = estimates({ object_mass_kg_low: 20, object_mass_kg_high: 25 });
    const answer = compose({ estimates: heavy, robotFit: scene({ ...UR10E, verdict: "fits" }) });
    const ruled = answer.ruledOut.find((row) => row.name === "UR10e")!;
    expect(ruled).toBeTruthy();
    expect(ruled.reason).toMatch(/^Payload: your object weighs about 20–25 kg \(estimated from your video\)/);
    expect(ruled.reason).toContain("This arm is rated for 12.5 kg.");
    expect(robotsOf(answer).map((robot) => robot.name)).not.toContain("UR10e");
    // Alone in the catalog it is still ruled out: there is no pick at all.
    const alone = composeSiteAnswer({ ...inputs({ estimates: heavy, robotFit: scene({ ...UR10E, verdict: "fits" }) }), catalog: only("universal_robots_ur10e") })!;
    expect(alone.pick).toBeNull();
    expect(alone.ruledOut[0].reason).toBe(ruled.reason);
  });

  it("takes reach from a scene 'fits' as a pass checked in the scene, and the verdict 'fits' only when every check passes", () => {
    const answer = composeSiteAnswer({ ...inputs({ robotFit: scene({ ...UR10E, verdict: "fits" }) }), catalog: only("universal_robots_ur10e") })!;
    expect(answer.pick).toMatchObject({ name: "UR10e", verdict: "fits", sceneChecked: true });
    expect(checkOf(answer, "reach")).toEqual({ key: "reach", outcome: "pass", estimated: false, basis: "scene_measured",
      text: "Reach: checked in the scene rebuilt from your video: this robot reaches both spots with a clear arm path. It reaches 1.3 m." });
    // The payload is still this check's own, on the video's weight.
    expect(checkOf(answer, "payload")).toMatchObject({ outcome: "pass", basis: "video_estimate", estimated: true });
    expect(answer.confidence.reasons).toContain("Its reach was checked in the scene rebuilt from your video.");
    // An unsettled payload keeps a scene 'fits' at "may fit".
    const unweighed = composeSiteAnswer({ ...inputs({ estimates: estimates({ object_mass_kg_low: null, object_mass_kg_high: null }),
      robotFit: scene({ ...UR10E, verdict: "fits" }) }), catalog: only("universal_robots_ur10e") })!;
    expect(unweighed.pick).toMatchObject({ verdict: "possible", sceneChecked: true });
  });

  it("takes reach from a scene 'fits_spec' as a pass sized in the scene, and the verdict 'fits on paper'", () => {
    const answer = composeSiteAnswer({ ...inputs({ estimates: estimates({ pick_to_place_m: 2.0 }), robotFit: scene({ ...UR10E, verdict: "fits_spec" }) }),
      catalog: only("universal_robots_ur10e") })!;
    expect(answer.pick).toMatchObject({ verdict: "fits_on_paper", sceneChecked: true });
    expect(checkOf(answer, "reach")).toMatchObject({ outcome: "pass", basis: "scene_measured", estimated: false,
      text: "Reach: sized in the scene rebuilt from your video: both spots are within this robot's published reach. Its arm path was not checked. It reaches 1.3 m." });
  });

  it("takes reach from a scene 'doesnt_fit' as a fail only when the payload passes", () => {
    const answer = composeSiteAnswer({ ...inputs({ robotFit: scene({ ...UR10E, verdict: "doesnt_fit", openChecks: ["reach"] }) }),
      catalog: only("universal_robots_ur10e") })!;
    expect(answer.pick).toBeNull();
    expect(answer.ruledOut).toEqual([{ name: "UR10e", manufacturer: "Universal Robots", estimated: false,
      reason: "Reach: ruled out in the scene rebuilt from your video: this robot could not reach both spots from a clear place to stand. It reaches 1.3 m." }]);
    // With a failing payload the scene says nothing about reach: the payload is the reason.
    const heavy = composeSiteAnswer({ ...inputs({ estimates: estimates({ object_mass_kg_low: 20, object_mass_kg_high: 25 }),
      robotFit: scene({ ...UR10E, verdict: "doesnt_fit", openChecks: ["payload"] }) }), catalog: only("universal_robots_ur10e") })!;
    expect(heavy.ruledOut[0].reason).toMatch(/^Payload: /);
    // A scene that failed only on its own guess of the weight leaves reach to the video's numbers.
    const weightOnly = composeSiteAnswer({ ...inputs({ robotFit: scene({ ...UR10E, verdict: "doesnt_fit", openChecks: ["payload"] }) }),
      catalog: only("universal_robots_ur10e") })!;
    expect(weightOnly.pick).toMatchObject({ verdict: "fits_on_paper", sceneChecked: false });
    expect(checkOf(weightOnly, "reach")).toMatchObject({ outcome: "pass", basis: "video_estimate" });
  });

  it("takes reach from a scene 'unknown' only when reach is among its open checks", () => {
    const open = composeSiteAnswer({ ...inputs({ robotFit: scene({ ...UR10E, verdict: "unknown", openChecks: ["reach"] }) }),
      catalog: only("universal_robots_ur10e") })!;
    expect(open.pick).toMatchObject({ verdict: "possible", sceneChecked: false });
    expect(checkOf(open, "reach")).toMatchObject({ outcome: "unknown", basis: "scene_measured",
      text: "Reach: the scene rebuilt from your video could not settle whether this robot reaches both spots. It reaches 1.3 m." });
    const other = composeSiteAnswer({ ...inputs({ robotFit: scene({ ...UR10E, verdict: "unknown", openChecks: ["access"] }) }),
      catalog: only("universal_robots_ur10e") })!;
    expect(other.pick).toMatchObject({ verdict: "fits_on_paper", sceneChecked: false });
    expect(checkOf(other, "reach")).toMatchObject({ outcome: "pass", basis: "video_estimate" });
  });

  it("keeps the site's measured distance over the scene", () => {
    // Measured 3 m apart: no arm that stays in one place serves it, whatever the scene's row says.
    const far = composeSiteAnswer({ ...inputs({ measurements: measurements({ pick_to_place_distance: reading(3, "m", 3) }),
      robotFit: scene({ ...UR10E, verdict: "fits" }) }), catalog: only("universal_robots_ur10e") })!;
    expect(far.pick).toBeNull();
    expect(far.ruledOut[0].reason).toContain("3 m apart (you measured this)");
    // Measured 1 m apart: the arm reaches on its published figure, though the scene's row says it does not fit.
    const near = composeSiteAnswer({ ...inputs({ measurements: measurements({ pick_to_place_distance: reading(1, "m", 1) }),
      robotFit: scene({ ...UR10E, verdict: "doesnt_fit", openChecks: ["reach"] }) }), catalog: only("universal_robots_ur10e") })!;
    expect(near.pick).toMatchObject({ verdict: "fits_on_paper", sceneChecked: false });
    expect(checkOf(near, "reach")).toMatchObject({ outcome: "pass", basis: "site_measured", estimated: false });
  });

  it("matches the scene's row by maker and name, ignoring case and punctuation", () => {
    const answer = composeSiteAnswer({ ...inputs({ robotFit: scene({ name: "ur10e", manufacturer: "universal-robots", verdict: "fits" }) }),
      catalog: only("universal_robots_ur10e") })!;
    expect(answer.pick).toMatchObject({ verdict: "fits", sceneChecked: true });
  });

  it("does not say the job needs a robot that moves when the scene shows an arm in one place reaches both spots", () => {
    const farGuess = estimates({ pick_to_place_m: 4 });
    expect(composeSiteAnswer({ ...inputs({ estimates: farGuess }), catalog: only("universal_robots_ur10e", "hello_robot_stretch_3") })!.formNote)
      .toMatch(/needs a robot that moves between them/);
    const seen = composeSiteAnswer({ ...inputs({ estimates: farGuess, robotFit: scene({ ...UR10E, verdict: "fits" }) }),
      catalog: only("universal_robots_ur10e", "hello_robot_stretch_3") })!;
    expect(seen.formNote).toBeNull();
    expect(seen.pick).toMatchObject({ name: "UR10e", verdict: "fits" });
  });
});

describe("the action decides the kind of job", () => {
  const typed = (summary: string, extra: Parameters<typeof inputs>[0] = {}) => compose({ brief: { requestId: "job-1", summary, confirmedAtIso: null }, ...extra });
  const ALSO = (word: string) => `Your job also involves ${word}; this checks only the picking up and putting down.`;
  /** The reader's words and fields alone: no sentence from the site. */
  const read = (fields: Record<string, unknown>) => compose({ brief: { requestId: "job-1", summary: "Your site task" }, estimates: estimates(fields) });

  it("assesses machine tending, carrying and pick-and-place sentences", () => {
    const cnc = typed("Load parts into the CNC machine");
    expect(cnc).toMatchObject({ state: "ready", job: { family: "machine_tending", familyLabel: "machine tending" } });
    expect(typed("Move water bottles from the conveyor to the shelf").state).toBe("ready");
    expect(typed("Pick bolts and place them on the tray").state).toBe("ready");
    for (const answer of [cnc, typed("Pick bolts and place them on the tray")]) {
      expect(answer.unknowns.some((line) => line.startsWith("Your job also involves"))).toBe(false);
    }
    // The same jobs in the reader's own words, with no sentence from the site.
    expect(read({ object: "water bottle", basis: "A person moves each water bottle from a conveyor to a shelf." }).state).toBe("ready");
    expect(read({ object: "bolt", basis: "A worker picks bolts from a bin and places them on a tray." }).state).toBe("ready");
    expect(read({ object: "part", basis: "An operator loads parts into the CNC machine." }))
      .toMatchObject({ state: "ready", job: { family: "machine_tending" } });
  });

  it("cannot assess a job that does something else to the object, whatever numbers the reading gave", () => {
    for (const sentence of ["Fold the towels", "Screw the cap onto the bottle"]) {
      expect(typed(sentence), sentence).toMatchObject({ state: "cannot_assess", headline: "We can't check robots against this job yet.",
        reason: OTHER_KIND, pick: null, runnerUp: null, approach: null, nextStep: { kind: "none" } });
    }
    expect(read({ object: "towel", basis: "A person folds the towels on a table." })).toMatchObject({ state: "cannot_assess", reason: OTHER_KIND });
    expect(read({ object: "cap", basis: "A worker screws the caps onto bottles." })).toMatchObject({ state: "cannot_assess", reason: OTHER_KIND });
    // Where grammar does not make the word a verb ("folds towels": a verb, or a noun before a noun), the rule
    // says nothing and the numbers decide; the reader's own kind of job is the better judge.
    expect(read({ object: "towel", basis: "A person folds towels on a table." }).state).toBe("ready");
    expect(read({ object: "towel", basis: "A person folds towels on a table.", job_kind: "other" }).state).toBe("cannot_assess");
    // A linked video's summary counts as the reader's words too.
    expect(compose({ brief: null, estimates: estimates({ basis: "A person stands at a table." }),
      request: { site_video_evidence: { summary: "Staff fold the laundry at a counter." } } })).toMatchObject({ state: "cannot_assess", reason: OTHER_KIND });
    // The simulation's own reason sentences never reach the answer.
    expect(typed("Fold the towels").reason).not.toMatch(/evaluation preparation|simulation|hold your job/i);
  });

  it("assesses a job that carries the object and does something else too, and says what else", () => {
    const answer = typed("Open the box and place the bottles on the shelf");
    expect(answer.state).toBe("ready");
    expect(answer.unknowns).toContain(ALSO("opening"));
    const both = typed("Fold each towel and stack it on the shelf");
    expect(both.state).toBe("ready");
    expect(both.unknowns).toContain(ALSO("folding"));
    expect(read({ object: "towel", basis: "A person folds the towels and stacks them on a shelf." }).unknowns).toContain(ALSO("folding"));
  });

  it("does not count a verb used as a noun or a describing word", () => {
    const press = typed("Load parts into the press");
    expect(press).toMatchObject({ state: "ready", job: { family: "machine_tending" } });
    expect(press.unknowns.some((line) => /pressing/.test(line))).toBe(false);
    expect(typed("Move a pack of bottles to the shelf").unknowns.some((line) => line.startsWith("Your job also involves"))).toBe(false);
    expect(typed("Put the boxes close to the door").unknowns.some((line) => /closing/.test(line))).toBe(false);
    expect(typed("Place bottles into open crates").unknowns.some((line) => /opening/.test(line))).toBe(false);
    // A noun alone never decides: the object's name says nothing about what is done to it.
    expect(typed("The press").state).toBe("ready");
  });

  it("counts a word as a verb only where grammar makes it one, and never lets an object's name decide", () => {
    const noAlso = (answer: ReturnType<typeof compose>) => answer.unknowns.filter((line) => line.startsWith("Your job also involves"));
    for (const sentence of ["Take screws from the bin and drop them in the tray", "Sort screws by size into the trays",
      "Stock spray bottles on the shelf", "Paint cans are moved from the pallet to the shelf", "Tend the hydraulic press",
      "Move boxes to open crates", "Place parts close to the door"]) {
      const answer = typed(sentence);
      expect(answer.state, sentence).toBe("ready");
      expect(noAlso(answer), sentence).toEqual([]);
    }
    for (const [sentence, word] of [["We need help with loading boxes after opening them", "opening"],
      ["Pick up the cap and screw it on", "screwing"], ["Towels are folded and stacked on the cart", "folding"]]) {
      const answer = typed(sentence);
      expect(answer.state, sentence).toBe("ready");
      expect(noAlso(answer), sentence).toEqual([ALSO(word)]);
    }
    for (const sentence of ["Fold towels", "Fold the towels", "Wipe down each table", "Screw the cap onto the bottle"]) {
      expect(typed(sentence), sentence).toMatchObject({ state: "cannot_assess", reason: OTHER_KIND, pick: null });
    }
  });

  it("takes the reader's kind of job when the site has typed no sentence", () => {
    expect(read({ job_kind: "other" })).toMatchObject({ state: "cannot_assess", reason: OTHER_KIND, pick: null });
    // A sentence drafted from the video is the reader's, not the site's: the reader's kind still decides.
    expect(compose({ brief: { requestId: "job-1", summary: "Move the towels", confirmedAtIso: null },
      request: { capture_task_statement_draft: { state: "drafted" } }, estimates: estimates({ job_kind: "other" }) }))
      .toMatchObject({ state: "cannot_assess", reason: OTHER_KIND });
    const pallet = read({ job_kind: "palletizing", basis: "A person moves boxes." });
    expect(pallet).toMatchObject({ state: "ready", job: { family: "palletizing", familyLabel: "palletizing" } });
    expect(read({ job_kind: "machine_tending" }).job.family).toBe("machine_tending");
    expect(read({ job_kind: "pick_and_place", basis: "A person folds towels." }).state).toBe("ready");
    // The reader's other actions add to what the job also involves; a carrying word is not one.
    const extra = read({ job_kind: "pick_and_place", other_actions: ["peeling", "stacking", "<b>x</b>"] });
    expect(extra.unknowns).toContain(ALSO("peeling"));
    expect(extra.unknowns.filter((line) => line.startsWith("Your job also involves"))).toHaveLength(1);
  });

  it("puts a sentence the site typed or confirmed before the reader", () => {
    expect(typed("Move cartons to the shelf", { estimates: estimates({ job_kind: "other" }) }).state).toBe("ready");
    expect(typed("Fold the towels", { estimates: estimates({ job_kind: "pick_and_place" }) }))
      .toMatchObject({ state: "cannot_assess", reason: OTHER_KIND });
    // The site's sentence gives the job family; the reader's kind gives it only when it decided.
    expect(typed("Move cartons to the shelf", { estimates: estimates({ job_kind: "palletizing" }) }).job.family).toBe("pick_place");
  });

  it("reads a stored reading without the new fields as before: the verb rule, then the numbers rule", () => {
    const legacy = estimates();
    expect(legacy).not.toHaveProperty("job_kind");
    expect(read({}).state).toBe("ready");
    // No verb in the reading's words: an object and a distance is a pick and a place.
    expect(read({ basis: "Sized against a doorway and the conveyor." }).state).toBe("ready");
    // No number at all: the video could not size the job.
    expect(read({ basis: "Sized against a doorway.", object_largest_side_m: null, object_mass_kg_low: null, object_mass_kg_high: null,
      pick_to_place_m: null })).toMatchObject({ state: "cannot_assess", reason: "The video did not show the job clearly enough for us to size it." });
    // A junk kind reads as none.
    expect(read({ job_kind: "dancing" }).state).toBe("ready");
  });
});

/** A small seeded generator, so every run checks the same few thousand inputs. */
function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

describe("every sentence has a precondition in the data (generated inputs)", () => {
  const random = mulberry32(20261111);
  const pick = <T,>(values: readonly T[]): T => values[Math.floor(random() * values.length)];
  const maybe = <T,>(value: () => T, chance = 0.5): T | null => (random() < chance ? value() : null);
  const between = (lo: number, hi: number) => Number((lo + random() * (hi - lo)).toFixed(3));
  const catalog = robotSpecCatalog();
  const SENTENCES = ["Move cartons from the conveyor to the shelf", "Load parts into the CNC machine", "Fold the towels",
    "Open the box and place the bottles on the shelf", "Stack boxes onto the pallet", "Screw the cap onto the bottle",
    "Pick up the box from the conveyor, then put it on the shelf, then scan the label", "Your site task", "Load parts into the press", ""];
  const BASES = ["A person moves cartons from a conveyor to a shelf.", "A person folds towels.", "Sized against a doorway.", null,
    "An operator loads parts into the machine and closes the door."];
  const evidence = [FIXTURE_EVIDENCE, undefined] as const;

  function generated(): Inputs {
    const mass = maybe(() => [between(0.05, 40), between(0.05, 40)].sort((a, b) => a - b), 0.8);
    const est = maybe(() => ({
      object: maybe(() => pick(["carton", "bolt", "towel", "water bottle"]), 0.8),
      object_largest_side_m: maybe(() => between(0.01, 1.5)),
      object_mass_kg_low: mass?.[0] ?? null, object_mass_kg_high: maybe(() => mass?.[1] ?? null, 0.8),
      object_surface: pick(["matte", "shiny", "transparent", "mixed", null]),
      pick_to_place_m: maybe(() => between(0.05, 5), 0.8), pick_height_m: maybe(() => between(0, 2)), place_height_m: maybe(() => between(0, 2)),
      front_clearance_m: maybe(() => between(0, 3)), other_items_likely: random() < 0.3 ? ["plastic totes"] : [],
      cycle_seconds: null, basis: pick(BASES),
      ...(random() < 0.6 ? { job_kind: pick(["pick_and_place", "palletizing", "machine_tending", "other", null, "junk_kind"]),
        other_actions: random() < 0.4 ? [pick(["peeling", "stacking", "screwing_on", "<i>x</i>", "opening"])] : [] } : {}),
    }), 0.9);
    const readings: Record<string, ReturnType<typeof reading>> = {};
    if (random() < 0.3) { const metres = between(0.1, 4); readings.pick_to_place_distance = reading(metres, "m", metres); }
    const summary = pick(SENTENCES);
    const rows = catalog.models.filter(() => random() < 0.3).map((model) => ({ name: model.name, manufacturer: model.manufacturer,
      verdict: pick(["fits", "fits_spec", "doesnt_fit", "unknown"] as const),
      openChecks: random() < 0.5 ? [] : [pick(["reach", "payload", "stance", "access", "cycle_time"])] }));
    const built = inputs({
      estimates: est,
      measurements: Object.keys(readings).length ? measurements(readings) : null,
      brief: summary ? { requestId: "job-1", summary, confirmedAtIso: random() < 0.3 ? NOW : null,
        operatorTaskDetails: random() < 0.3 ? { item_weight: `${between(0.5, 60)} kg` } : {},
        successCriteria: random() < 0.3 ? { successDefinition: null, successRate: null, cycleTimeSeconds: between(2, 120), unknown: false } : undefined }
        : null,
      request: random() < 0.4 ? { capture_task_statement_draft: { state: "drafted" } } : {},
      robotFit: rows.length ? { models: rows } : null,
    });
    const lookup = pick(evidence);
    return lookup ? { ...built, evidenceFor: lookup } : (({ evidenceFor: _ignored, ...rest }) => rest)(built);
  }

  /** The displayed need's two ends and the displayed limit of a check sentence, in one unit, when it has both. */
  function shown(sentence: string) {
    const toUnit = (value: string, unit: string) => Number(value) / (unit === "cm" ? 100 : 1);
    const range = (text: string) => {
      const parts = text.split("–").map((part) => part.trim().split(" "));
      const lastUnit = parts[parts.length - 1][1];
      const ends = parts.map(([value, unit]) => toUnit(value, unit ?? lastUnit));
      return { lo: ends[0], hi: ends[ends.length - 1] };
    };
    const reach = sentence.match(/needs (?:about )?(.+?)\. This arm reaches ([\d.]+) (cm|m)\./);
    if (reach) return { ...range(reach[1]), limit: toUnit(reach[2], reach[3]) };
    const payload = sentence.match(/must carry (?:about )?(.+?)\. This (?:arm|robot) is rated for ([\d.]+) kg\./);
    if (payload) return { ...range(payload[1]), limit: Number(payload[2]) };
    const cycle = sentence.match(/one cycle in ([\d.]+) s .*takes between about ([\d.]+) s and ([\d.]+) s/);
    if (cycle) return { lo: Number(cycle[2]), hi: Number(cycle[3]), limit: Number(cycle[1]) };
    return null;
  }
  const MODEL_IDS = catalog.models.map((model) => model.model_id);
  /** Sentences that describe a check that was not failed: never a reason a robot is ruled out. */
  const NOT_A_FAIL = /we don't know yet|publishes no|could not settle|could not size|is not checked against|was not checked|is not published/;

  it("never reads an object's name as another action after a carrying verb", () => {
    const CARRY = ["Move", "Take", "Pick", "Load", "Stack", "Sort", "Carry", "Drop", "Bring", "Place", "Transfer", "Unload"];
    const LOOK_ALIKES = ["screws", "paints", "sprays", "presses", "mixes", "ties", "cuts", "pulls"];
    const TAILS = ["", " to the shelf", " into the tray", " from the bin onto the cart", " off the conveyor"];
    for (let index = 0; index < 500; index++) {
      const sentence = `${pick(CARRY)} ${pick(LOOK_ALIKES)}${pick(TAILS)}`;
      const answer = compose({ brief: { requestId: "job-1", summary: sentence, confirmedAtIso: null } });
      expect(answer.state, sentence).not.toBe("cannot_assess");
      expect(answer.unknowns.some((line) => line.startsWith("Your job also involves")), sentence).toBe(false);
    }
  });

  it("holds over a few thousand random jobs", () => {
    const counts = { answers: 0, ready: 0, cannot: 0, passShown: 0, failShown: 0, good: 0, scene: 0 };
    for (let index = 0; index < 3000; index++) {
      const answer = composeSiteAnswer(generated());
      if (!answer) continue;
      counts.answers++;
      const label = `case ${index}: ${answer.headline}`;
      const robots = [answer.pick, answer.runnerUp].filter((robot) => robot !== null);
      // The pick and the runner-up never have a failed check; their verdict says what their checks say.
      for (const robot of robots) {
        expect(robot.checks.some((check) => check.outcome === "fail"), label).toBe(false);
        const allPass = robot.checks.every((check) => check.outcome === "pass");
        expect(robot.verdict === "fits" || robot.verdict === "fits_on_paper", label).toBe(allPass);
        // Checked in the scene only when the scene decided the reach check.
        expect(robot.sceneChecked, label).toBe(robot.checks.some((check) => check.key === "reach" && check.basis === "scene_measured"
          && check.outcome !== "unknown"));
        if (robot.sceneChecked) counts.scene++;
        for (const check of robot.checks) {
          const figures = shown(check.text);
          if (figures && check.outcome === "pass") { expect(figures.hi, check.text).toBeLessThanOrEqual(figures.limit); counts.passShown++; }
          if (check.outcome !== "unknown") expect(check.basis, check.text).not.toBeNull();
        }
      }
      // A ruled-out robot's reason is a failed check's sentence, and a fail never shows a need below the limit.
      for (const row of answer.ruledOut) {
        expect(row.reason, label).toMatch(/^(Reach|Payload|Cycle time): /);
        expect(row.reason, label).not.toMatch(NOT_A_FAIL);
        const figures = shown(row.reason);
        if (figures) { expect(figures.lo, row.reason).toBeGreaterThanOrEqual(figures.limit); counts.failShown++; }
      }
      // "Good" never rests on an estimate or an unknown.
      if (answer.confidence.level === "good") {
        counts.good++;
        expect(answer.pick!.checks.every((check) => check.outcome === "pass" && !check.estimated), label).toBe(true);
      }
      if (answer.state === "cannot_assess") {
        counts.cannot++;
        expect(answer.pick, label).toBeNull();
        expect(answer.runnerUp, label).toBeNull();
        expect(answer.nextStep.kind, label).toBe("none");
      }
      if (answer.state === "ready") counts.ready++;
      // No sentence carries a raw model id, a code or markup.
      const sentences = [answer.headline, answer.reason, answer.formNote, answer.approach?.text, answer.nextStep.text, ...answer.unknowns,
        ...answer.confidence.reasons, ...answer.confidence.raiseIt, ...answer.ruledOut.map((row) => row.reason),
        ...robots.flatMap((robot) => robot.checks.map((check) => check.text))].filter((entry): entry is string => Boolean(entry));
      for (const sentence of sentences) {
        expect(sentence, label).not.toMatch(/\b[a-z0-9]+_[a-z0-9_]+\b/i);
        expect(sentence, label).not.toMatch(/<[^>]*>/);
        for (const id of MODEL_IDS) expect(sentence.includes(id), `${label}: ${sentence}`).toBe(false);
      }
    }
    // The generator reaches every branch the assertions are about.
    expect(counts.answers).toBeGreaterThan(2500);
    for (const [key, value] of Object.entries(counts)) expect(value, key).toBeGreaterThan(10);
  }, 120_000);
});

describe("composeSiteAnswer with the shipped evidence and catalog", () => {
  it("picks a model with documented production palletizing for 8–11 kg cartons with spots 1.6 m apart, every row quoted and linked", () => {
    const base = inputs({ estimates: estimates({ object: "carton", object_mass_kg_low: 8, object_mass_kg_high: 11, pick_to_place_m: 1.6,
      basis: "A person stacks cartons from the conveyor onto a pallet." }),
    brief: { requestId: "job-1", summary: "Stack cartons from the conveyor onto the pallet", confirmedAtIso: null } });
    const { evidenceFor: _fixture, ...shipped } = base;
    const answer = composeSiteAnswer(shipped)!;
    expect(answer.state).toBe("ready");
    expect(answer.job.family).toBe("palletizing");
    expect(answer.pick).not.toBeNull();
    expect(answer.pick!.evidence[0]).toMatchObject({ level: "production", scope: "model" });
    for (const robot of [answer.pick, answer.runnerUp]) {
      expect(robot).not.toBeNull();
      for (const row of robot!.evidence) {
        expect(row.quote.trim().length).toBeGreaterThan(0);
        expect(row.sourceUrl).toMatch(/^https:\/\//);
      }
    }
  });
});

describe("loadSiteAnswer", () => {
  it("reads the job's documents and composes the answer", async () => {
    sharedFakeFirestoreState.docs.clear();
    sharedFakeFirestoreState.docs.set("inboundRequests/job-1", inputs().request!);
    sharedFakeFirestoreState.docs.set("siteTaskBriefs/job-1", inputs().brief!);
    const answer = await loadSiteAnswer("job-1");
    expect(answer?.state).toBe("ready");
    expect(await loadSiteAnswer("missing")).toBeNull();
    const held = await loadSiteAnswer("job-1", { request: inputs().request, brief: inputs().brief, videoReceived: true, robotFit: null });
    expect(held?.basisDigest).toBe(answer?.basisDigest);
  });
});
