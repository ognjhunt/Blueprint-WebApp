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

const { composeSiteAnswer, loadSiteAnswer, UNKNOWN_JOB_KIND } = await import("../utils/siteAnswer");
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
    // The reading gives no kind of job, so none is stated; the evidence is still pick and place, which is what was checked.
    expect(answer.job).toEqual({ sentence: "Move cartons from the conveyor to the shelf", drafted: true, family: null, familyLabel: null });
    expect(answer.facts).toContainEqual({ label: "How far the object moves", display: "about 1 m", basis: "video_estimate" });
    expect(answer.nextStep).toEqual({ kind: "introduction",
      text: "Share this job with deployment companies Blueprint has approved, and one of them can pilot it at your site." });
    expect(answer.note).toBe(SITE_ANSWER_NOTE);
    expect(answer.checked).toEqual({ models: 33, makers: 21, specsRetrievedOn: "2026-11-02" });
    expect(answer.reason).toBeNull();
    // Each check names the site's number with its basis and the robot's figure.
    const reach = answer.pick!.checks.find((check) => check.key === "reach")!;
    expect(reach).toMatchObject({ outcome: "pass", estimated: true, basis: "video_estimate" });
    expect(reach.text).toBe("Reach: your two spots are about 1 m apart (estimated from your video), so an arm standing between them needs about 64–93 cm. This arm reaches 1.3 m.");
    expect(answer.pick!.checks.find((check) => check.key === "payload")!.basis).toBe("video_estimate");
    expect(answer.pick!.checks.find((check) => check.key === "payload")!.text)
      .toBe("Payload: your object weighs about 3–4 kg (estimated from your video), plus about 0.9 kg for a standard gripper, so it must carry about 3–4.9 kg. This arm is rated for 12.5 kg.");
    // The short figures the page shows are the sentence's own.
    expect(reach).toMatchObject({ need: "about 64–93 cm", has: "1.3 m" });
    expect(answer.pick!.checks.find((check) => check.key === "payload")).toMatchObject({ need: "about 3–4.9 kg", has: "12.5 kg" });
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

  it("keeps the figures of an unknown check and says why it is unknown, so it never reads as a pass or a fail", () => {
    const only = (id: string) => ({ ...robotSpecCatalog(), models: robotSpecCatalog().models.filter((model) => model.model_id === id) });
    const checkFor = (overrides: Parameters<typeof inputs>[0], id: string, key: string) =>
      composeSiteAnswer({ ...inputs(overrides), catalog: only(id) })!.pick!.checks.find((check) => check.key === key)!;
    // A video estimate of 29.1–30 kg plus the gripper against the UR30's 30 kg.
    const payload = checkFor({ estimates: estimates({ object_mass_kg_low: 29.1, object_mass_kg_high: 30 }) }, "universal_robots_ur30", "payload");
    expect(payload).toMatchObject({ outcome: "unknown", text: "Payload: your object weighs about 29–30 kg (estimated from your video), plus about 0.9 kg for a standard gripper, so it must carry about 29.1–30.9 kg. This arm is rated for 30 kg. The estimate from your video, with the gripper's weight, spans this robot's rating, so we can't say yet." });
    // A wide estimate is not close at all: its figures are shown, with why it is unknown.
    const reach = checkFor({ estimates: estimates({ pick_to_place_m: 2.0 }) }, "universal_robots_ur10e", "reach");
    expect(reach).toMatchObject({ outcome: "unknown", text: "Reach: your two spots are about 2 m apart (estimated from your video), so an arm standing between them needs about 1.01–1.59 m. This arm reaches 1.3 m. The estimate from your video spans this robot's limit, so we can't say yet." });
    // A single weight the site gave can straddle too, through the gripper's weight; it is never called an estimate.
    const stated = checkFor({ brief: { requestId: "job-1", summary: "Move cartons", operatorTaskDetails: { item_weight: "29.5 kg" } } },
      "universal_robots_ur30", "payload");
    expect(stated.outcome).toBe("unknown");
    expect(stated.text).toMatch(/With the gripper's weight added, this is at this robot's rating, so we can't say yet\.$/);
    expect(stated.text).not.toMatch(/estimate from your video/);
  });

  it("names a robot family in the source's own words, adding \"family\" only when they do not already say it", () => {
    const one = (family: string) => composeSiteAnswer({ ...inputs(), catalog: { ...robotSpecCatalog(),
      models: robotSpecCatalog().models.filter((model) => model.model_id === "fanuc_crx_10ia") },
    evidenceFor: lookupOf([evidenceRow({ id: "f", manufacturer: "FANUC", applies_to: ["fanuc_crx_10ia"], names: "family", family })]) })!
      .confidence.reasons;
    expect(one("CRX series")).toContain("We found documented production use of robots in the CRX series for pick and place.");
    expect(one("CRX")).toContain("We found documented production use of robots in the CRX family for pick and place.");
  });

  it("rules out arms that stay in one place when the spots are too far apart, and says the job needs a robot that moves", () => {
    const answer = compose({ measurements: measurements({ pick_to_place_distance: reading(3, "m", 3) }),
      brief: { requestId: "job-1", summary: "Carry parts across the cell", operatorTaskDetails: { item_weight: "1 kg" } } });
    expect(answer.state).toBe("ready");
    expect(answer.formNote).toBe("Your two spots are 3 m apart (you measured this), so the job needs a robot that moves between them, such as an arm on a wheeled base.");
    // Every arm that stays in one place (22 in the catalog).
    expect(answer.ruledOut.length + answer.ruledOutMore).toBe(22);
    expect(answer.ruledOut[0].reason).toContain("more than the 2.4 m an arm that stays in one place can serve");
    expect(answer.ruledOut[0].estimated).toBe(false);
    expect(answer.pick!.formLabel).toBe("Arm on a base that moves");
    // The job gives no heights, so a robot that moves is not settled on how high and low its hand goes.
    expect(answer.runnerUp!.formLabel).toBe("Arm on a base that moves");
    expect(answer.pick!.checks.find((check) => check.key === "reach")).toMatchObject({ measure: "height", outcome: "unknown" });
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
    // The site's own numbers, and the reader saw a carry.
    const sited = { estimates: estimates({ job_kind: "pick_and_place" }), measurements: measurements({ pick_to_place_distance: reading(1, "m", 1) }),
      brief: { requestId: "job-1", summary: "Move cartons to the shelf", operatorTaskDetails: { item_weight: "4 kg" } } };
    const good = compose(sited);
    expect(good.confidence.level).toBe("good");
    expect(good.unknowns).not.toContain(UNKNOWN_JOB_KIND);
    // The same numbers with no kind of job from the reader: only a carry was checked, so never "good".
    const unknownKind = compose({ ...sited, estimates: estimates() });
    expect(unknownKind.unknowns[0]).toBe(UNKNOWN_JOB_KIND);
    expect(unknownKind.confidence.level).not.toBe("good");
    expect(compose({ ...sited, estimates: null }).confidence.level).not.toBe("good");
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
      // The reading gave no kind of job, so this comes first.
      "We could not tell from your video what is done to the object; this checks only whether a robot can pick it up and put it down.",
      "Whether there is floor space for the robot between the two spots.",
      "Which gripper or tool the object needs: it looks shiny in your video, which affects that choice.",
      "How many different objects the job handles: your video suggests it may also handle plastic totes, bags.",
      "Safety around people, which the company that deploys the robot assesses at your site.",
      "How heavy the object is.",
    ]);
    const clear = compose({ request: { siteTaskGates: { humanProximity: "isolated" } } });
    expect(clear.unknowns.some((line) => line.startsWith("Safety around people"))).toBe(false);
  });

  it("says the video does not show the whole work area only when the stored coverage review says so, never in its words", () => {
    const short = compose({ request: { capture_coverage: { covers_scene: false, missing_coverage: ["The far side of the dining table"] } } });
    expect(short.unknowns).toContain("Your video does not show the whole work area.");
    expect(short.unknowns.join(" ")).not.toContain("far side");
    // After the scope line that leads, before the other unknowns.
    expect(short.unknowns.indexOf("Your video does not show the whole work area.")).toBe(short.unknowns[0] === UNKNOWN_JOB_KIND ? 1 : 0);
    expect(compose().unknowns).not.toContain("Your video does not show the whole work area.");
    expect(compose({ request: { capture_coverage: { covers_scene: true } } }).unknowns).not.toContain("Your video does not show the whole work area.");
    // A stored review with no yes or no says nothing; a missing review says nothing.
    const absent = composeSiteAnswer({ ...inputs(), request: { requestId: "job-1", request: {},
      walkthrough_job_estimates: { capture_id: "walkthrough-job-1", job_estimates: estimates() } } })!;
    expect(absent.unknowns).not.toContain("Your video does not show the whole work area.");
    expect(compose({ request: { capture_coverage: { views: [] } } }).unknowns).not.toContain("Your video does not show the whole work area.");
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

const OTHER_KIND = "From your video, the job looks like more than picking an object up and putting it down, which we can't check robots against yet. If that is not right, edit the job description to say what the robot should do, and we will read the video again.";
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
    expect(checkOf(answer, "reach")).toEqual({ key: "reach", measure: "distance", outcome: "pass", estimated: false, basis: "scene_measured",
      text: "Reach: checked in the scene rebuilt from your video: this robot reaches both spots with a clear arm path. It reaches 1.3 m.",
      // The scene decides reach by where the arm stands: no figure for the job's side, the robot's own reach for its side.
      need: null, has: "1.3 m" });
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

  // A reach the scene measured as a pass has no headroom figure; it counts as a comfortable margin, as it did before the
  // height check existed (bdd5bdc66), so it is not ranked below an arm that is only comfortable on paper.
  it("ranks a fixed arm whose reach passed in the scene as it did before, against an arm comfortable on paper", () => {
    const sheet = (value: number, unit = "m") => ({ value, unit, source_url: "https://example.com/sheet.pdf", quote: `Figure ${value} ${unit}`, conversion: null });
    const roomy = { model_id: "roomy_paper_arm", recipe_id: null, manufacturer: "Maker Roomy", name: "ROOMY", body_type: "fixed_arm", mounting: [],
      figures: { max_reach_m: sheet(3), rated_payload_kg: sheet(50, "kg"), max_hand_height_m: null, min_hand_height_m: null },
      unknown_figures: {} } as unknown as ReturnType<typeof robotSpecCatalog>["models"][number];
    const ur10e = robotSpecCatalog().models.find((model) => model.model_id === "universal_robots_ur10e")!;
    const answer = composeSiteAnswer({ ...inputs({ estimates: estimates({ pick_to_place_m: 2.0 }), robotFit: scene({ ...UR10E, verdict: "fits_spec" }) }),
      catalog: { ...robotSpecCatalog(), models: [roomy, ur10e] } })!;
    expect(answer.pick!.modelId).toBe("universal_robots_ur10e");
    expect(answer.runnerUp!.modelId).toBe("roomy_paper_arm");
    expect(answer.pick!.checks.find((check) => check.key === "reach")).toMatchObject({ basis: "scene_measured", outcome: "pass" });
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

describe("a robot that moves is checked on how high and how low its hand goes", () => {
  const sheet = (value: number, unit = "m") => ({ value, unit, source_url: "https://example.com/sheet.pdf", quote: `Figure ${value} ${unit}`, conversion: null });
  /** A catalog robot with only the figures given; the rest unknown. */
  const robot = (id: string, body: string, figures: { top?: number; bottom?: number; payload?: number; reach?: number }) => ({
    model_id: id, recipe_id: null, manufacturer: `Maker ${id.replace(/_/g, " ")}`, name: id.replace(/_/g, " ").toUpperCase(), body_type: body, mounting: [],
    figures: { max_reach_m: figures.reach === undefined ? null : sheet(figures.reach), rated_payload_kg: sheet(figures.payload ?? 5, "kg"),
      max_hand_height_m: figures.top === undefined ? null : sheet(figures.top), min_hand_height_m: figures.bottom === undefined ? null : sheet(figures.bottom) },
    unknown_figures: {},
  }) as unknown as ReturnType<typeof robotSpecCatalog>["models"][number];
  const withModels = (...models: Array<ReturnType<typeof robot>>) => ({ ...robotSpecCatalog(), models });
  /** The site measured both heights (exact ends) and a 3 m span; the object weighs 2 kg. */
  const measuredJob = (pickM: number | null, placeM: number | null, spanM = 3) => inputs({
    measurements: measurements({ pick_to_place_distance: reading(spanM, "m", spanM),
      ...(pickM === null ? {} : { pick_surface_height: reading(pickM, "m", pickM) }),
      ...(placeM === null ? {} : { place_surface_height: reading(placeM, "m", placeM) }) }),
    brief: { requestId: "job-1", summary: "Carry parts across the cell", operatorTaskDetails: { item_weight: "2 kg" } } });
  const heightOf = (job: Inputs, model: ReturnType<typeof robot>) => {
    const answer = composeSiteAnswer({ ...job, catalog: withModels(model) })!;
    const robots = [answer.pick, answer.runnerUp].filter((entry) => entry !== null);
    return robots.length ? robots[0]!.checks.find((check) => check.key === "reach")!
      : { outcome: "fail", text: answer.ruledOut[0].reason, measure: "height" };
  };

  it("passes when both heights are inside the published range, and says so with both sides' figures", () => {
    const check = heightOf(measuredJob(0.8, 1.2), robot("rover", "wheeled_humanoid", { top: 2.2, bottom: 0 }));
    expect(check).toMatchObject({ outcome: "pass", measure: "height", basis: "site_measured", estimated: false, has: "0–2.2 m" });
    expect(check.text).toMatch(/^Height: it is picked up at .+ and put down at .+, so the hand must work at about 80 cm–1\.2 m above the floor\. The maker lists its working height as 0 to 2\.2 m\.$/);
  });

  it("fails a height wholly above the highest or wholly below the lowest, naming the spot", () => {
    const high = heightOf(measuredJob(0.8, 2.0), robot("tall", "mobile_manipulator", { top: 1.8, bottom: 0.3 }));
    expect(high.outcome).toBe("fail");
    expect(high.text).toContain("The spot where it is put down is about 2 m. That is above the highest working height the maker lists.");
    const low = heightOf(measuredJob(0.1, 1.0), robot("short", "humanoid", { top: 1.8, bottom: 0.3 }));
    expect(low.outcome).toBe("fail");
    expect(low.text).toContain("The spot where it is picked up is about 10 cm. That is below the lowest working height the maker lists.");
  });

  it("gives each unknown case its own sentence", () => {
    const both = robot("both", "wheeled_humanoid", { top: 1.9, bottom: 0 });
    // A video estimate of one figure is checked across a band; one that spans the limit is unknown.
    const spans = composeSiteAnswer({ ...inputs({ estimates: estimates({ pick_to_place_m: 3, pick_height_m: 1.7, place_height_m: 0.8 }) }),
      catalog: withModels(both) })!.pick!.checks.find((check) => check.key === "reach")!;
    expect(spans).toMatchObject({ outcome: "unknown", measure: "height", estimated: true, basis: "video_estimate" });
    expect(spans.text).toMatch(/The height estimated from your video spans this robot's limit, so we can't say yet\.$/);
    expect(heightOf(measuredJob(null, null), both).text)
      .toBe("Height: we don't know yet how high your two spots are. The maker lists its working height as 0 to 1.9 m.");
    expect(heightOf(measuredJob(null, 1.0), both).text).toMatch(/^Height: we don't know yet how high the spot where it is picked up is\./);
    expect(heightOf(measuredJob(1.0, null), both).text).toMatch(/^Height: we don't know yet how high the spot where it is put down is\./);
    const topOnly = heightOf(measuredJob(0.8, 1.2), robot("top_only", "mobile_manipulator", { top: 1.8 }));
    expect(topOnly).toMatchObject({ outcome: "unknown", has: "up to 1.8 m" });
    expect(topOnly.text).toMatch(/The maker lists its working height only as up to 1\.8 m\. It lists how high this robot works but not how low, so we can't say yet\.$/);
    const bottomOnly = heightOf(measuredJob(0.8, 1.2), robot("bottom_only", "mobile_manipulator", { bottom: 0 }));
    expect(bottomOnly).toMatchObject({ outcome: "unknown", has: "starting at 0" });
    expect(bottomOnly.text).toMatch(/The maker lists its working height only as starting at 0\. It lists how low this robot works but not how high, so we can't say yet\.$/);
    // A one-end robot whose known end already rules a spot out fails on it.
    expect(heightOf(measuredJob(0.8, 2.0), robot("top_only", "mobile_manipulator", { top: 1.8 })).outcome).toBe("fail");
    expect(heightOf(measuredJob(0.8, 1.2), robot("neither", "humanoid", { reach: 0.9 }))).toMatchObject({ outcome: "unknown", has: null,
      text: "Height: this robot moves between the spots, so what limits it is how high and how low its hand goes, and the maker lists no working height." });
  });

  it("keeps the distance check, and its measure, for an arm that stays in one place", () => {
    const answer = compose();
    expect(answer.pick!.checks.find((check) => check.key === "reach")).toMatchObject({ measure: "distance", outcome: "pass" });
  });

  it("adds no gripper weight for a robot that lifts with its own hand", () => {
    const answer = composeSiteAnswer({ ...measuredJob(0.8, 1.2), catalog: withModels(robot("rover", "wheeled_humanoid", { top: 2.2, bottom: 0, payload: 3 })) })!;
    const payload = answer.pick!.checks.find((check) => check.key === "payload")!;
    expect(payload.text).toBe("Payload: your object weighs 2 kg (you told us), so it must carry about 2 kg. This robot is rated for 3 kg.");
    expect(payload.outcome).toBe("pass");
  });

  it("still names a fixed arm when the spots are within its reach, and a settled moving robot ahead of an unsettled one when they are not", () => {
    const ur10e = robotSpecCatalog().models.find((model) => model.model_id === "universal_robots_ur10e")!;
    const settled = robot("settled_rover", "wheeled_humanoid", { top: 2.2, bottom: 0, payload: 5 });
    const unsettled = robot("unsettled_base", "mobile_manipulator", { reach: 1.0, payload: 5 });
    const near = composeSiteAnswer({ ...measuredJob(0.8, 1.0, 1.0), catalog: withModels(settled, unsettled, ur10e) })!;
    expect(near.pick!.modelId).toBe("universal_robots_ur10e");
    expect(near.formNote).toBeNull();
    const far = composeSiteAnswer({ ...measuredJob(0.8, 1.0, 3.0), catalog: withModels(unsettled, settled, ur10e) })!;
    expect(far.pick!.modelId).toBe("settled_rover");
    expect(far.pick!.verdict).toBe("fits_on_paper");
    expect(far.runnerUp!.modelId).toBe("unsettled_base");
    expect(far.runnerUp!.verdict).toBe("possible");
    expect(far.ruledOut.map((row) => row.name)).toEqual(["UR10e"]);
  });

  // An unknown margin is not a comfortable margin (review, 2026-11-11): a moving robot's height check has no headroom
  // figure, so it never counts as comfortable, and on a carry a fixed arm can serve the fixed arm comes first.
  it("names a fixed arm that passes, tight or comfortable, ahead of any moving robot on a short carry", () => {
    const arm = (id: string, payload: number) => robot(id, "fixed_arm", { reach: 1.3, payload });
    const settled = robot("settled_rover", "wheeled_humanoid", { top: 2.2, bottom: 0, payload: 30 });
    const job = measuredJob(0.8, 1.0, 0.5);
    // How much the arm must carry: the object and a standard gripper.
    const probe = composeSiteAnswer({ ...job, catalog: withModels(arm("probe_arm", 100)) })!;
    const need = Math.max(...(probe.pick!.checks.find((check) => check.key === "payload")!.need!.match(/[\d.]+/g) ?? []).map(Number));
    const tight = arm("tight_arm", Math.round(need * 1.03 * 100) / 100);
    const tightAnswer = composeSiteAnswer({ ...job, catalog: withModels(settled, tight) })!;
    expect(tightAnswer.pick!.modelId).toBe("tight_arm");
    expect(tightAnswer.pick!.checks.find((check) => check.key === "payload")!.text).toMatch(/This is a tight fit\.$/);
    expect(tightAnswer.runnerUp!.modelId).toBe("settled_rover");
    const roomy = composeSiteAnswer({ ...job, catalog: withModels(settled, arm("roomy_arm", 30)) })!;
    expect(roomy.pick!.modelId).toBe("roomy_arm");
  });

  it("keeps a moving robot that passes ahead of one with unknown heights when the spots are beyond a fixed arm", () => {
    const settled = robot("settled_rover", "wheeled_humanoid", { top: 2.2, bottom: 0, payload: 30 });
    const unknownHeights = robot("unknown_heights", "humanoid", { reach: 0.9, payload: 30 });
    const answer = composeSiteAnswer({ ...measuredJob(0.8, 1.0, 3.0), catalog: withModels(unknownHeights, settled) })!;
    expect(answer.pick!.modelId).toBe("settled_rover");
    expect(answer.runnerUp!.modelId).toBe("unknown_heights");
  });

  it("labels a wheeled humanoid as one and links its listed working heights", () => {
    const answer = composeSiteAnswer({ ...measuredJob(0.8, 1.2), catalog: withModels(robot("rover", "wheeled_humanoid", { top: 2.2, bottom: 0 })) })!;
    expect(answer.pick!.formLabel).toBe("Wheeled humanoid");
    expect(answer.pick!.specs).toContainEqual({ label: "Working height", display: "0–2.2 m", sourceUrl: "https://example.com/sheet.pdf" });
  });
});

describe("sureness and a video that misses part of the work area", () => {
  // The site's own numbers, a carry the reader saw, and production evidence: the top level when coverage allows.
  const sited = (coverage: Record<string, unknown> | undefined) => {
    const built = inputs({ estimates: estimates({ job_kind: "pick_and_place" }), measurements: measurements({ pick_to_place_distance: reading(1, "m", 1) }),
      brief: { requestId: "job-1", summary: "Move cartons to the shelf", operatorTaskDetails: { item_weight: "4 kg" } } });
    const { capture_coverage: _ignored, ...request } = built.request!;
    return composeSiteAnswer({ ...built, request: coverage === undefined ? request : { ...request, capture_coverage: coverage } })!;
  };

  it("is never the top level when the stored review says the video does not show the whole work area, and says why", () => {
    const short = sited({ covers_scene: false });
    expect(short.confidence.level).toBe("fair");
    expect(short.confidence.reasons).toContain("Your video does not show the whole work area.");
    expect(short.unknowns).toContain("Your video does not show the whole work area.");
  });

  it("changes nothing when coverage is true or absent", () => {
    for (const coverage of [{ covers_scene: true }, undefined]) {
      const answer = sited(coverage);
      expect(answer.confidence.level).toBe("good");
      expect(answer.confidence.reasons).not.toContain("Your video does not show the whole work area.");
    }
  });
});

describe("the reader decides the kind of job; no word list does", () => {
  const typed = (summary: string, extra: Parameters<typeof inputs>[0] = {}) => compose({ brief: { requestId: "job-1", summary, confirmedAtIso: null }, ...extra });
  const ALSO = (word: string) => `Your job also involves ${word}; this checks only the picking up and putting down.`;
  const alsoLines = (answer: ReturnType<typeof compose>) => answer.unknowns.filter((line) => line.startsWith("Your job also involves"));
  const SENTENCES = ["Load parts into the CNC machine", "Move water bottles from the conveyor to the shelf",
    "Pick bolts and place them on the tray", "Paint cans go from the shelf to the cart.", "Sewing kits go into cartons.",
    "Press parts go to the rack.", "Open-top bins go from the line to the dock.", "Welding rods are moved to the station.",
    "Folding chairs are stacked against the wall.", "Take screws from the bin and drop them in the tray",
    "Fold the towels", "Screw the cap onto the bottle"];

  it("assesses every typed sentence on its numbers when the reader gives no kind, and adds nothing from the words", () => {
    for (const sentence of SENTENCES) {
      const answer = typed(sentence);
      expect(answer.state, sentence).toBe("ready");
      expect(alsoLines(answer), sentence).toEqual([]);
      // With no kind from the reader, no kind of job is stated, whatever the sentence names.
      expect(answer.job, sentence).toMatchObject({ family: null, familyLabel: null });
    }
  });

  it("cannot assess a job the reader says is another kind, whatever the sentence says", () => {
    for (const sentence of [...SENTENCES, "Your site task"]) {
      expect(typed(sentence, { estimates: estimates({ job_kind: "other" }) }), sentence).toMatchObject({ state: "cannot_assess",
        headline: "We can't check robots against this job yet.", reason: OTHER_KIND, pick: null, runnerUp: null, approach: null,
        nextStep: { kind: "none" } });
    }
    // The simulation's own reason sentences never reach the answer.
    expect(typed("Fold the towels", { estimates: estimates({ job_kind: "other" }) }).reason).not.toMatch(/evaluation preparation|simulation|hold your job/i);
    // The reason names what the reader saw, and the one thing the site can do when it disagrees.
    expect(typed("Move cartons to the shelf.", { estimates: estimates({ job_kind: "other", other_actions: ["folding", "wrapping"] }) }).reason)
      .toBe("From your video, the job looks like more than picking an object up and putting it down (folding and wrapping), which we can't check robots against yet. If that is not right, edit the job description to say what the robot should do, and we will read the video again.");
  });

  it("says first that only a carry was checked when the reader gives no kind, and nothing of the kind when it does", () => {
    const fold = typed("Fold the towels.");
    expect(fold.state).toBe("ready");
    expect(fold.unknowns[0]).toBe(UNKNOWN_JOB_KIND);
    expect(fold.note).toBe("This checks whether a robot can pick your object up and put it down, against published robot specifications and a cited track record. It is not a test of a robot at your site and does not certify performance or safety.");
    for (const kind of ["pick_and_place", "palletizing", "machine_tending"]) {
      expect(typed("Move cartons", { estimates: estimates({ job_kind: kind }) }).unknowns, kind).not.toContain(UNKNOWN_JOB_KIND);
    }
  });

  it("says what else the job involves only from the reader's closed list", () => {
    const folding = typed("Move towels to the shelf", { estimates: estimates({ job_kind: "pick_and_place", other_actions: ["folding"] }) });
    expect(folding.state).toBe("ready");
    expect(alsoLines(folding)).toEqual([ALSO("folding")]);
    const mixed = typed("Move towels to the shelf", { estimates: estimates({ job_kind: "pick_and_place",
      other_actions: ["nothing", "picking up", "packaging", "string", "inserting", "filling", "folding"] }) });
    expect(alsoLines(mixed)).toEqual([ALSO("folding")]);
    expect(alsoLines(typed("Move towels", { estimates: estimates({ other_actions: ["opening", "pressing"] }) })))
      .toEqual([ALSO("opening and pressing")]);
  });

  it("states the kind of job only when the reader judged it a carrying kind, and checks pick-and-place evidence otherwise", () => {
    const unjudged = typed("Move pressure washers to the shelf.");
    expect(unjudged.job).toMatchObject({ family: null, familyLabel: null });
    // The evidence is the pick-and-place record, and the reason says so of the evidence, not of the job.
    expect(unjudged.confidence.reasons).toContain("We found documented production use of this robot for pick and place.");
    expect(typed("Fold the towels", { estimates: estimates({ job_kind: "other" }) }).job).toMatchObject({ family: null, familyLabel: null });
    expect(typed("Move pressure washers to the shelf.", { estimates: estimates({ job_kind: "machine_tending" }) }).job)
      .toMatchObject({ family: "machine_tending", familyLabel: "machine tending" });
    expect(typed("Move water bottles from the pallet to the shelf").job.family).toBeNull();
    expect(typed("Move boxes", { estimates: estimates({ job_kind: "palletizing" }) }).job).toMatchObject({ family: "palletizing", familyLabel: "palletizing" });
    expect(typed("Move boxes", { estimates: estimates({ job_kind: "pick_and_place" }) }).job).toMatchObject({ family: "pick_place", familyLabel: "pick and place" });
  });

  it("reads a stored reading without the new fields on its numbers, and junk fields as none", () => {
    expect(estimates()).not.toHaveProperty("job_kind");
    expect(compose({ brief: { requestId: "job-1", summary: "Your site task" } }).state).toBe("ready");
    expect(compose({ brief: null, estimates: estimates({ basis: "A person folds towels." }) }).state).toBe("ready");
    expect(compose({ brief: { requestId: "job-1", summary: "Your site task" }, estimates: estimates({ object_largest_side_m: null,
      object_mass_kg_low: null, object_mass_kg_high: null, pick_to_place_m: null }) }))
      .toMatchObject({ state: "cannot_assess", reason: "The video did not show the job clearly enough for us to size it." });
    const junk = typed("Move boxes", { estimates: estimates({ job_kind: "dancing", other_actions: "folding" }) });
    expect(junk.state).toBe("ready");
    expect(alsoLines(junk)).toEqual([]);
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
  // A second stream for the inputs added later (spot heights, coverage), so the first stream's jobs stay the same.
  const added = mulberry32(20261112);
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
      ...(random() < 0.8 ? { job_kind: pick(["pick_and_place", "palletizing", "machine_tending", "other", null, "junk_kind"]),
        other_actions: random() < 0.4 ? [pick(["peeling", "stacking", "screwing_on", "<i>x</i>", "opening"])] : [] } : {}),
    }), 0.9);
    const readings: Record<string, ReturnType<typeof reading>> = {};
    if (random() < 0.3) { const metres = between(0.1, 4); readings.pick_to_place_distance = reading(metres, "m", metres); }
    if (added() < 0.25) { const metres = Number((added() * 2.5).toFixed(3)); readings.pick_surface_height = reading(metres, "m", metres); }
    if (added() < 0.25) { const metres = Number((added() * 2.5).toFixed(3)); readings.place_surface_height = reading(metres, "m", metres); }
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

  it("never refuses a job because of its sentence when the reader gives no kind", () => {
    const WORDS = ["fold", "screws", "paint", "press", "open", "move", "the", "towels", "cans", "into", "Weld", "bins", "go", "are",
      "folded", "cutting", "boards", "pour", "water", "on", "shelf", "and", "drop", "them", "sew", "kits"];
    for (let index = 0; index < 500; index++) {
      const sentence = Array.from({ length: 2 + Math.floor(random() * 8) }, () => pick(WORDS)).join(" ");
      const answer = compose({ brief: { requestId: "job-1", summary: sentence, confirmedAtIso: null } });
      expect(answer.state, sentence).toBe("ready");
      expect(answer.unknowns.some((line) => line.startsWith("Your job also involves")), sentence).toBe(false);
    }
  });

  it("holds over a few thousand random jobs", () => {
    const counts = { answers: 0, ready: 0, cannot: 0, passShown: 0, failShown: 0, good: 0, scene: 0, figures: 0,
      heightPass: 0, heightFail: 0, heightUnknown: 0, notCovered: 0 };
    // The same job checked against the robots that move only, so their height checks reach the pick and the runner-up.
    const moving = { ...catalog, models: catalog.models.filter((model) => model.body_type !== "fixed_arm") };
    for (let index = 0; index < 3000; index++) {
      const job = generated();
      // The same job when the stored review says the video misses part of the work area: never the top level, and it says why.
      if (index % 3 === 0 && job.request) {
        const short = composeSiteAnswer({ ...job, request: { ...job.request, capture_coverage: { covers_scene: false } } });
        if (short?.pick) {
          counts.notCovered++;
          expect(short.confidence.level, `case ${index}`).not.toBe("good");
          expect(short.confidence.reasons, `case ${index}`).toContain("Your video does not show the whole work area.");
        }
      }
      const movers = composeSiteAnswer({ ...job, catalog: moving });
      for (const robot of [movers?.pick, movers?.runnerUp]) {
        const check = robot?.checks.find((entry) => entry.key === "reach");
        if (!robot || !check || check.basis === "scene_measured") continue;
        expect(check.measure, check.text).toBe("height");
        expect(check.text, check.text).toMatch(/^Height: /);
        expect(check.outcome, check.text).not.toBe("fail");
        if (check.outcome === "pass") {
          counts.heightPass++;
          // Only both published ends and both heights settle it.
          const model = moving.models.find((entry) => entry.model_id === robot.modelId)!;
          expect(Boolean(model.figures.max_hand_height_m && model.figures.min_hand_height_m), check.text).toBe(true);
          expect(movers!.facts.map((fact) => fact.label), check.text).toEqual(expect.arrayContaining(["Height where it is picked up", "Height where it is put down"]));
        } else {
          counts.heightUnknown++;
          expect(check.text, check.text).toMatch(/(so we can't say yet|lists no working height|we don't know yet how high .+)\./);
        }
        for (const value of [check.need, check.has]) {
          if (value === null || value === undefined) continue;
          for (const part of value.replace(/^about /, "").split("–").map((entry) => entry.trim())) expect(check.text, value).toContain(part);
        }
      }
      for (const row of movers?.ruledOut ?? []) {
        if (!row.reason.startsWith("Height: ")) continue;
        counts.heightFail++;
        expect(row.reason).toMatch(/That is (above the highest|below the lowest) working height the maker lists\./);
      }
      const answer = composeSiteAnswer(job);
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
          // A reach check says what it measured: heights for a robot that moves, the distance for an arm that stays put.
          if (check.key === "reach") {
            const model = catalog.models.find((entry) => entry.model_id === robot.modelId)!;
            if (check.basis !== "scene_measured") expect(check.measure, check.text).toBe(model.body_type === "fixed_arm" ? "distance" : "height");
            if (check.measure === "height") expect(check.text, label).toMatch(/^Height: /);
          }
          if (figures && check.outcome === "pass") { expect(figures.hi, check.text).toBeLessThanOrEqual(figures.limit); counts.passShown++; }
          if (check.outcome !== "unknown") expect(check.basis, check.text).not.toBeNull();
          // An unknown with figures says why it is unknown, so it never reads as a pass or a fail.
          if (figures && check.outcome === "unknown") expect(check.text, check.text).toMatch(/so we can't say yet\.( This is a tight fit\.)?$/);
          // The short figures are the sentence's own words: each one the page shows appears in the sentence as it stands.
          for (const value of [check.need, check.has]) {
            if (value === null || value === undefined) continue;
            const said = value.replace(/^about /, "").split("–").map((part) => part.trim());
            for (const part of said) expect(check.text, `${label}: ${value}`).toContain(part);
            counts.figures++;
          }
          // A check decided in the scene has no figure for the job's side; one made from a distance or weight has both.
          if (check.basis === "scene_measured") expect(check.need, check.text).toBeNull();
          if (figures) { expect(check.need, check.text).toBeTruthy(); expect(check.has, check.text).toBeTruthy(); }
        }
      }
      // A ruled-out robot's reason is a failed check's sentence, and a fail never shows a need below the limit.
      for (const row of answer.ruledOut) {
        expect(row.reason, label).toMatch(/^(Reach|Height|Payload|Cycle time): /);
        if (row.reason.startsWith("Height: ")) expect(row.reason, label).toMatch(/That is (above the highest|below the lowest) working height the maker lists\./);
        expect(row.reason, label).not.toMatch(NOT_A_FAIL);
        const figures = shown(row.reason);
        if (figures) { expect(figures.lo, row.reason).toBeGreaterThanOrEqual(figures.limit); counts.failShown++; }
      }
      // "Good" never rests on an estimate or an unknown.
      if (answer.confidence.level === "good") {
        counts.good++;
        expect(answer.pick!.checks.every((check) => check.outcome === "pass" && !check.estimated), label).toBe(true);
        expect(answer.unknowns, label).not.toContain(UNKNOWN_JOB_KIND);
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
      job_kind: "palletizing", basis: "A person stacks cartons from the conveyor onto a pallet." }),
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
