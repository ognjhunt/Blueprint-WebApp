// @vitest-environment node
/**
 * The site's answer: every catalog robot checked against the job by its
 * published figures, the scene's verdict where the scene was measured, cited
 * evidence of use on this kind of job, and one pick by a fixed rule.
 *
 * Evidence rows here are fixtures: the shipped file is filled separately.
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
const { evidenceLookup, parseDeploymentEvidence } = await import("../utils/deploymentEvidence");
const { sharedFakeFirestoreState } = await import("./helpers/fake-firestore");
const { SITE_ANSWER_NOTE, isSiteAnswer } = await import("../../client/src/lib/siteAnswer");
type Inputs = Parameters<typeof composeSiteAnswer>[0];

const NOW = "2026-11-11T12:00:00.000Z";

function evidenceRow(overrides: Record<string, unknown>) {
  return { id: "row", manufacturer: "Universal Robots", model_ids: ["universal_robots_ur10e"], job_family: "pick_place",
    level: "production", summary: "A named plant uses it to move cartons.", quote: "The UR10e moves cartons at our plant every shift.",
    source_url: "https://example.com/case", source_title: "Case study", publisher: "Example", published_on: "2025-03-01",
    ...overrides };
}
const lookupOf = (rows: Array<Record<string, unknown>>) =>
  evidenceLookup(parseDeploymentEvidence({ schema_version: "deployment_evidence.v1", retrieved_on: "2026-11-11", rows }).rows);
const FIXTURE_EVIDENCE = lookupOf([
  evidenceRow({ id: "ur10e-prod" }),
  evidenceRow({ id: "crx-pilot", manufacturer: "FANUC", model_ids: ["fanuc_crx_10ia"], level: "pilot",
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
    expect(reach).toMatchObject({ outcome: "pass", estimated: true });
    expect(reach.text).toBe("Reach: your two spots are about 1 m apart (estimated from your video), so an arm standing between them needs about 64–93 cm. This arm reaches 1.3 m.");
    expect(answer.pick!.checks.find((check) => check.key === "payload")!.text)
      .toBe("Payload: your object weighs about 3–4 kg (estimated from your video), plus about 0.9 kg for a standard gripper. This arm is rated for 12.5 kg.");
    for (const sentence of [answer.headline, ...answer.unknowns, ...answer.confidence.reasons, ...answer.ruledOut.map((row) => row.reason)]) {
      expect(sentence).not.toMatch(/safe to|guarantee|tested at your site|will work|certif|episode|candidate|screening|embodiment/i);
    }
  });

  it("rules a model out on payload from a stated weight, and from a video estimate, saying which", () => {
    const stated = compose({ brief: { requestId: "job-1", summary: "Move cartons to the shelf", operatorTaskDetails: { item_weight: "8 kg" } } });
    expect(stated.ruledOut).toContainEqual({ name: "UR5e", manufacturer: "Universal Robots", estimated: false,
      reason: "Payload: your object weighs 8 kg (you told us), plus about 0.9 kg for a standard gripper. This arm is rated for 5 kg." });
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
    expect(rateUr10e(measured)!.checks.find((check) => check.key === "reach")!.outcome).toBe("pass");
    expect(rateUr10e(fromVideo)?.checks.find((check) => check.key === "reach")?.outcome ?? "unknown").toBe("unknown");
    expect(measured.pick!.verdict).toBe("fits_on_paper");
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

  it("cannot assess a job that is plainly not one object picked up and put down, in the fit check's own words", () => {
    const OTHER_KIND = "This check covers jobs where a robot picks one solid object up and puts it down. Your job looks like another kind, which we can't check robots against yet.";
    const noObject = { estimates: estimates({ object: null, pick_to_place_m: null }) };
    for (const reason of ["deformable", "liquid", "assembly", "closing", "push", "articulated"]) {
      const answer = compose({ ...noObject, request: { site_task_scope: { supported: false, kind: null, reason } } });
      expect(answer).toMatchObject({ state: "cannot_assess", headline: "We can't check robots against this job yet.", pick: null,
        reason: OTHER_KIND, approach: null });
    }
    const opening = compose({ ...noObject, request: { site_task_scope: { supported: true, kind: "articulated_open_close", reason: null } } });
    expect(opening.reason).toBe(OTHER_KIND);
    const screened = compose({ ...noObject, brief: { requestId: "job-1", summary: "Fold the towels" } });
    expect(screened).toMatchObject({ state: "cannot_assess", reason: OTHER_KIND });
    expect(screened.nextStep.kind).toBe("none");
    // The simulation's own reason sentences never reach the answer.
    for (const answer of [opening, screened]) expect(answer.reason).not.toMatch(/evaluation preparation|simulation|hold your job/i);
  });

  it("assesses from the reading and the site's numbers even when the task screen says the simulation cannot score it", () => {
    for (const reason of ["deformable", "container", "mobile", "other", "multi_step"]) {
      const answer = compose({ request: { site_task_scope: { supported: false, kind: null, reason } } });
      expect(answer.state).toBe("ready");
      expect(answer.reason).toBeNull();
    }
  });

  it("treats container, far-apart and multi-step jobs as a pick and a place, and says a multi-step job is checked one carry at a time", () => {
    const noObject = { estimates: estimates({ object: null }) };
    for (const reason of ["container", "mobile"]) {
      const answer = compose({ ...noObject, request: { site_task_scope: { supported: false, kind: null, reason } } });
      expect(answer.state).toBe("ready");
      expect(answer.unknowns).not.toContain("Your job has more than one step; this checks one carry.");
    }
    const stored = compose({ ...noObject, request: { site_task_scope: { supported: false, kind: null, reason: "multi_step" } } });
    expect(stored.state).toBe("ready");
    expect(stored.unknowns).toContain("Your job has more than one step; this checks one carry.");
    const withObject = compose({ request: { site_task_scope: { supported: false, kind: null, reason: "multi_step" } } });
    expect(withObject.unknowns.at(-1)).toBe("Your job has more than one step; this checks one carry.");
    const screened = compose({ ...noObject, brief: { requestId: "job-1", summary: "Pick up the box from the conveyor, then put it on the shelf, then scan the label" } });
    expect(screened.state).toBe("ready");
  });

  it("says how the pick would be controlled", () => {
    expect(compose().approach).toEqual({ kind: "programmed",
      text: "A programmed application: the installer teaches the robot this motion once. Arms of this kind are deployed this way on jobs like yours." });
    expect(compose({ estimates: estimates({ other_items_likely: ["plastic totes"] }) }).approach).toEqual({ kind: "camera_guided",
      text: "The objects vary, so the robot needs camera-guided picking. Ask the deployment company how it handles each item." });
    const none = compose({ brief: { requestId: "job-1", summary: "Move engine blocks", operatorTaskDetails: { item_weight: "500 kg" } } });
    expect(none.pick).toBeNull();
    expect(none.approach).toBeNull();
    const moving = compose({ measurements: measurements({ pick_to_place_distance: reading(3, "m", 3) }),
      brief: { requestId: "job-1", summary: "Carry parts across the cell", operatorTaskDetails: { item_weight: "1 kg" } } });
    // The deployment-practice sentence speaks only of fixed arms.
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

  it("takes the scene's verdict over the video's", () => {
    const answer = compose({ robotFit: { models: [
      { name: "UR5e", manufacturer: "Universal Robots", verdict: "fits", openChecks: [] },
      { name: "UR10e", manufacturer: "Universal Robots", verdict: "doesnt_fit", openChecks: [] },
    ] } });
    expect(answer.pick).toMatchObject({ name: "UR5e", verdict: "fits", sceneChecked: true });
    expect(answer.ruledOut).toContainEqual({ name: "UR10e", manufacturer: "Universal Robots", estimated: false,
      reason: "Ruled out in the scene measured from your video." });
    expect(answer.confidence.level).toBe("fair");
  });

  it("ranks by evidence before headroom, and a model-named source before a maker-level one", () => {
    const base = inputs();
    const pilotOnSmall = composeSiteAnswer({ ...base, evidenceFor: lookupOf([
      evidenceRow({ id: "small", manufacturer: "ABB", model_ids: ["abb_gofa_crb15000_5_95"], level: "pilot" }),
    ]) })!;
    // The GoFa 5 kg has almost no payload headroom over 4 kg plus the gripper; its pilot still puts it first.
    expect(pilotOnSmall.pick!.modelId).toBe("abb_gofa_crb15000_5_95");
    const scope = composeSiteAnswer({ ...base, evidenceFor: lookupOf([
      evidenceRow({ id: "maker", manufacturer: "Yaskawa", model_ids: [] }),
      evidenceRow({ id: "model", manufacturer: "KUKA", model_ids: ["yaskawa_gp20"] }),
      evidenceRow({ id: "named", manufacturer: "FANUC", model_ids: ["fanuc_crx_10ia_l"] }),
    ]) })!;
    expect(scope.pick!.modelId).toBe("fanuc_crx_10ia_l");
    expect(scope.pick!.evidence[0].scope).toBe("model");
    expect(scope.runnerUp!.manufacturer).toBe("Yaskawa");
    expect(scope.runnerUp!.evidence[0].scope).toBe("maker");
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
