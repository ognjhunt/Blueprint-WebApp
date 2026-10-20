// @vitest-environment node
/**
 * Robot fit: every form of robot rated against what the job needs, in the
 * site's own numbers; a site version with no team and no screening limit; and
 * a team ranking that keeps only what a team's research actually says.
 *
 * What this pins: all six declarable forms are rated (never only arms); a band
 * is judged at both ends; a typed weight is read only when it is one number and
 * unit; a quote must sit inside one field of the research; a form the rules
 * rule out caps a team's fit; a failed run never hides the last good ranking;
 * unscreened jobs are not rated; and consent withdrawal stops ranking and sharing.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

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

const fit = await import("../utils/siteRobotFit");
const { robotFitRankingTask } = await import("../agents/tasks/robot-fit-ranking");
const { RATED_FORMS } = await import("../../client/src/data/robotFit");
const { ROBOT_FORMS } = await import("../../client/src/types/robotEmbodiment");
const {
  computeRobotFitJob, getAdminRobotFit, getSiteRobotFit, parseStatedWeight, projectSiteRobotFit, rankTeamsForJob,
  rankingCandidates, setRobotFitSharing, validateRanking, RobotFitError,
} = fit;
type Inputs = Parameters<typeof computeRobotFitJob>[0];

const NOW = "2026-10-20T12:00:00.000Z";
const SCREENED = { site_task_scope: { supported: true, kind: "rigid_pick_and_place", reason: null } };

function reading(value: number, unit: string, si: number) {
  return { value, unit, si, basis: unit === "kg" || unit === "lb" ? "scale" : "tape", recordedAtIso: NOW,
    recordedByScope: "owner", recordedByName: null };
}

function measurements(readings: Record<string, ReturnType<typeof reading>>, family = "rigid_pick_place") {
  return { requestId: "job-1", family, articulation: null, referencePaper: null, readings, measuredBy: null, note: null,
    revision: 1, updatedAtIso: NOW } as unknown as NonNullable<Inputs["measurements"]>;
}

function inputs(overrides: Partial<{ request: Record<string, any>; brief: Record<string, any> | null;
  measurements: Inputs["measurements"] }> = {}): Inputs {
  return {
    request: overrides.request ?? { requestId: "job-1", request: {}, ...SCREENED },
    brief: (overrides.brief === undefined ? { requestId: "job-1", summary: "Move sealed cartons from the conveyor onto a pallet" }
      : overrides.brief) as Inputs["brief"],
    measurements: overrides.measurements ?? null,
  };
}

const rating = (job: ReturnType<typeof computeRobotFitJob>, id: string) => job.forms.find((entry) => entry.id === id)!;
const verdicts = (job: ReturnType<typeof computeRobotFitJob>) => Object.fromEntries(job.forms.map((entry) => [entry.id, entry.verdict]));

describe("every form of robot, rated against the job's needs", () => {
  it("rates all six declarable forms, never only arms", () => {
    const job = computeRobotFitJob(inputs({ measurements: measurements({ pick_to_place_distance: reading(90, "cm", 0.9) }) }));
    expect(job.forms.map((entry) => entry.id)).toEqual([...RATED_FORMS]);
    expect([...RATED_FORMS, "other"]).toEqual([...ROBOT_FORMS]);
  });

  it("lets every form fit a short, light job, and notes when moving around is more than it needs", () => {
    const job = computeRobotFitJob(inputs({
      request: { request: { siteTaskSpec: { humanProximity: "shared" } }, ...SCREENED },
      measurements: measurements({ pick_to_place_distance: reading(90, "cm", 0.9), object_mass: reading(4, "kg", 4) }),
    }));
    expect(verdicts(job)).toEqual({ fixed_base_arm: "fits", bimanual_arm: "fits", mobile_manipulator: "fits",
      wheeled_humanoid: "fits", humanoid: "fits", legged_manipulator: "fits" });
    expect(job.needs).toEqual([
      "It has to pick the object up and put it down at another spot.",
      "It can work from one place: the object moves 90 cm (you measured this).",
      "It has to lift 4 kg (you measured this).",
      "It has to work safely alongside people in the same space (you told us).",
    ]);
    expect(rating(job, "humanoid").checks).toEqual([{ requirement: "pick_to_place_span", outcome: "extra",
      text: "Walking between spots isn't needed: the object moves 90 cm (you measured this)." }]);
    expect(rating(job, "wheeled_humanoid").checks[0].text).toBe("Driving between spots isn't needed: the object moves 90 cm (you measured this).");
    expect(job.unknowns).toEqual([]);
  });

  it("rules out forms that stay in one place when the spots are far apart, and keeps every form that moves", () => {
    const job = computeRobotFitJob(inputs({ measurements: measurements({ pick_to_place_distance: reading(300, "cm", 3) }) }));
    expect(verdicts(job)).toMatchObject({ fixed_base_arm: "not_a_fit", bimanual_arm: "not_a_fit", mobile_manipulator: "fits",
      wheeled_humanoid: "fits", humanoid: "fits", legged_manipulator: "fits" });
    expect(job.needs[1]).toBe("It has to move between the spots: the object moves 300 cm (you measured this).");
  });

  it("gives two-armed forms a large or heavy object, and asks one-armed forms for a wide gripper", () => {
    const job = computeRobotFitJob(inputs({ measurements: measurements({ pick_to_place_distance: reading(80, "cm", 0.8),
      object_length: reading(70, "cm", 0.7), object_mass: reading(18, "kg", 18) }) }));
    expect(verdicts(job)).toEqual({ fixed_base_arm: "possible", bimanual_arm: "fits", mobile_manipulator: "possible",
      wheeled_humanoid: "fits", humanoid: "fits", legged_manipulator: "possible" });
    expect(job.needs).toContain("It has to handle a large or heavy object (its largest side is 70 cm (you measured this) and "
      + "it weighs 18 kg (you measured this)), which takes two arms, or one arm with a wide gripper or suction cups.");
    expect(rating(job, "bimanual_arm").checks.map((entry) => entry.text)).toContain("It has two arms to share a large or heavy object.");
  });

  it("judges a weight band at both ends and flags a heavy load for every form", () => {
    const band = (payloadWeight: string) => computeRobotFitJob(inputs({ request: { request: { siteTaskSpec: { payloadWeight } }, ...SCREENED },
      measurements: measurements({ pick_to_place_distance: reading(50, "cm", 0.5) }) }));
    const straddles = band("ten_to_twentyfive");
    expect(rating(straddles, "fixed_base_arm").checks[1]).toMatchObject({ outcome: "caution",
      text: "With one arm, it may need a wide gripper or suction cups if the object is at the heavy end." });
    expect(straddles.needs).toContain("It may have to handle a heavy object (it weighs 10–25 kg (you told us)), which can take two arms, "
      + "or one arm with a wide gripper or suction cups.");
    const heavy = band("over_25kg");
    for (const form of heavy.forms) expect(form.verdict).toBe("possible");
    expect(rating(heavy, "humanoid").checks.map((entry) => entry.text))
      .toContain("The object weighs over 25 kg (you told us), so check that this robot can lift it.");
  });

  it("uses the surface heights: a span across heights and a floor-level spot need a long reach", () => {
    const job = computeRobotFitJob(inputs({ measurements: measurements({
      pick_to_place_distance: reading(100, "cm", 1.0), pick_surface_height: reading(0, "cm", 0),
      place_surface_height: reading(100, "cm", 1.0), object_mass: reading(1, "kg", 1) }) }));
    // hypot(1.0, 1.0) = 1.41 m: past one place, inside a long reach.
    expect(rating(job, "fixed_base_arm").checks.map((entry) => entry.outcome)).toEqual(["caution", "caution"]);
    expect(rating(job, "humanoid").checks).toContainEqual({ requirement: "pick_height", outcome: "caution",
      text: "It has to reach down near the floor, to a spot at 0 cm (you measured this)." });
    expect(job.needs).toContain("It has to reach down near the floor: the object is picked up at 0 cm (you measured this).");
  });

  it("does not rate a job that is not screened as one rigid object picked up and put down", () => {
    const unscreened = computeRobotFitJob(inputs({ request: { request: {} } }));
    expect(unscreened).toMatchObject({ rated: false, forms: [], notRatedReason: expect.stringContaining("not been screened") });
    expect(projectSiteRobotFit(unscreened)).toBeNull();
    const unsupported = computeRobotFitJob(inputs({ request: { site_task_scope: { supported: false, reason: "deformable" } } }));
    expect(unsupported.notRatedReason).toContain("soft or flexible");
    const legacyArticulated = computeRobotFitJob(inputs({ request: { site_task_scope: { supported: true, kind: "articulated_open_close" } } }));
    expect(legacyArticulated.rated).toBe(false);
  });

  it("reads the instruction the Pipeline derived from the video", () => {
    const job = computeRobotFitJob(inputs({ brief: null, request: { ...SCREENED, agent_execution_offer: { team_evaluation: {
      contract: { instruction: "Pick up the blue container and place it on the shelf." } } } } }));
    expect(job).toMatchObject({ summary: null, instruction: "Pick up the blue container and place it on the shelf." });
  });
});

describe("parseStatedWeight", () => {
  it("reads one number and one unit", () => {
    expect(parseStatedWeight("5 kg")).toEqual({ kg: 5, display: "5 kg" });
    expect(parseStatedWeight("roughly 500 grams")?.kg).toBeCloseTo(0.5);
    expect(parseStatedWeight("12lbs")?.kg).toBeCloseTo(5.443, 3);
    expect(parseStatedWeight("2,5 kg")?.kg).toBe(2.5);
    expect(parseStatedWeight(".75 lb")).toMatchObject({ display: "0.75 lb" });
  });

  it("leaves lists, ranges, fractions and thousands separators unknown instead of reading the first number", () => {
    for (const text of ["Totes 3 kg, bins 18 kg", "5 kg to 10 kg", "5-10 kg", "2 1/2 lb", "1,000 lb", "heavy", undefined]) {
      expect(parseStatedWeight(text)).toBeNull();
    }
  });
});

describe("the site version", () => {
  it("shows the job's needs and each form's distinguishing reasons, with no team and no screening limit", () => {
    const job = computeRobotFitJob(inputs({ request: { request: { siteTaskSpec: { humanProximity: "nearby" } }, ...SCREENED },
      measurements: measurements({ pick_to_place_distance: reading(30, "in", 0.762) }) }));
    const site = projectSiteRobotFit(job)!;
    expect(site.forms).toHaveLength(6);
    // Passing checks repeat the needs; a fixed arm that simply reaches both spots shows no extra reason.
    expect(site.forms.find((form) => form.id === "fixed_base_arm")).toMatchObject({ verdict: "fits", reasons: [] });
    expect(site.forms.find((form) => form.id === "humanoid")?.reasons)
      .toEqual(["Walking between spots isn't needed: the object moves 30 inches (you measured this)."]);
    expect(site.unknowns).toEqual(["How heavy the object is. You can add it under Add measurements (optional) on this page."]);
    const built = JSON.stringify({ needs: site.needs, forms: site.forms, unknowns: site.unknowns });
    for (const forbidden of ["1.2", "2.4", "15 kg", "25 kg", "match", "team"]) expect(built).not.toContain(forbidden);
    expect(site.note).toContain("If Blueprint recommends a team, it will be one whose evaluation of your job passed.");
    expect(site.note).not.toContain("match");
  });

  it("never asks the site a question its page cannot answer", () => {
    const site = projectSiteRobotFit(computeRobotFitJob(inputs()))!;
    expect(site.forms).toEqual([]);
    expect(site.unknowns).toHaveLength(2);
    expect(site.unknowns.join(" ")).not.toContain("people");
  });
});

const NOTE_A = "Task: Mixed-case palletizing at distribution centers. Delivery/evidence: Named customer deployments with cobots stacking sealed cartons onto pallets.";
const NOTE_B = "Task: Strawberry harvesting in greenhouses. Geography: Salinas, CA.";

function team(id: string, name: string, notes: string | null, extra: Record<string, unknown> = {}) {
  return { id, name, status: "prospect", website: `https://${id}.example`, capability: {}, fieldProvenance: {},
    capabilityDescription: notes, createdAt: NOW, updatedAt: NOW, ...extra };
}

describe("validateRanking", () => {
  const candidates = rankingCandidates([team("b", "Berry Bots", NOTE_B, { evidenceBar: "Fruit bruising in wet weather." }),
    team("a", "Pallet Co", NOTE_A)] as never);
  const entry = (teamId: string, quote: string, extra: Record<string, unknown> = {}) => ({ teamId, fit: "strong",
    form: "fixed_base_arm", concerns: [], reasons: [{ claim: "Claim", quote }], ...extra });

  it("orders candidates by id and leaves out teams without a note", () => {
    expect(rankingCandidates([team("z", "Z", null), team("b", "B", NOTE_B), team("a", "A", NOTE_A)] as never)
      .map((candidate) => candidate.teamId)).toEqual(["a", "b"]);
  });

  it("keeps quoted reasons and drops unquoted ones, short ones, and unknown or repeated teams", () => {
    const result = validateRanking({ ranked: [
      { ...entry("a", "cobots  stacking sealed cartons onto pallets"), concerns: ["Payload is not stated."],
        reasons: [{ claim: "Palletizes cartons", quote: "cobots  stacking sealed cartons onto pallets" },
          { claim: "Invented", quote: "handles 40 kg boxes all day long" }] },
      entry("a", "Mixed-case palletizing at distribution centers"),
      entry("ghost", "Mixed-case palletizing at distribution centers"),
      entry("b", "Task: Strawberry"),
    ] }, candidates);
    expect(result.teams).toEqual([{ teamId: "a", name: "Pallet Co", status: "prospect", agreed: false, fit: "strong",
      form: "fixed_base_arm", concerns: ["Payload is not stated."],
      reasons: [{ claim: "Palletizes cartons", quote: "cobots stacking sealed cartons onto pallets" }] }]);
    expect(result).toMatchObject({ droppedReasons: 2, droppedTeams: 3 });
  });

  it("keeps a quote inside one field: it cannot be stitched across the note and what goes wrong", () => {
    const stitched = validateRanking({ ranked: [entry("b", "Salinas, CA. Fruit bruising in wet weather")] }, candidates);
    expect(stitched.teams).toEqual([]);
    const whole = validateRanking({ ranked: [entry("b", "Fruit bruising in wet weather")] }, candidates);
    expect(whole.teams).toHaveLength(1);
  });

  it("checks an elided quote part by part, in order, and across curly quotes and dashes", () => {
    const elided = validateRanking({ ranked: [entry("a", "Mixed-case palletizing at distribution … sealed cartons onto pallets")] }, candidates);
    expect(elided.teams).toHaveLength(1);
    const reversed = validateRanking({ ranked: [entry("a", "sealed cartons onto pallets … Mixed-case palletizing at distribution")] }, candidates);
    expect(reversed.teams).toEqual([]);
    const curly = rankingCandidates([team("c", "Curly", "Evidence maturity: customer’s site — named deployment")] as never);
    expect(validateRanking({ ranked: [entry("c", "“customer's site - named deployment”")] }, curly).teams).toHaveLength(1);
  });

  it("caps a team whose robot form the rules rule out for this job", () => {
    const result = validateRanking({ ranked: [entry("a", "Mixed-case palletizing at distribution centers")] }, candidates,
      new Map([["fixed_base_arm", "not_a_fit"]]));
    expect(result.teams[0]).toMatchObject({ fit: "weak", concerns: ["Its form (one arm on a fixed stand) is rated not a fit for this job."] });
  });

  it("refuses output that is not the schema", () => {
    expect(() => validateRanking({ ranked: [{ teamId: "a" }] }, candidates)).toThrow();
  });
});

describe("the ranking prompt", () => {
  it("puts the shared team corpus before the job, so it stays a cacheable prefix", () => {
    const prompt = robotFitRankingTask.build_prompt({ candidates: rankingCandidates([team("a", "Pallet Co", NOTE_A)] as never),
      job: { summary: "Move cartons", instruction: null, rated: true, notRatedReason: null, needs: [], requirements: [],
        unknowns: [], forms: [], serviceArea: null } });
    expect(prompt.indexOf("\"candidates\"")).toBeGreaterThan(-1);
    expect(prompt.indexOf("\"candidates\"")).toBeLessThan(prompt.indexOf("\"job\""));
    expect(prompt).toContain("Prefer no shape.");
  });
});

function seedJob(extra: Record<string, unknown> = {}) {
  sharedFakeFirestoreState.docs.set("inboundRequests/job-1", { requestId: "job-1",
    request: { siteTaskSpec: { humanProximity: "isolated" } }, ...SCREENED, ...extra });
  sharedFakeFirestoreState.docs.set("siteTaskBriefs/job-1", { requestId: "job-1",
    summary: "Move sealed cartons from the conveyor onto a pallet" });
  sharedFakeFirestoreState.docs.set("siteTaskMeasurements/job-1", measurements({
    pick_to_place_distance: reading(90, "cm", 0.9), object_mass: reading(6, "kg", 6) }));
  sharedFakeFirestoreState.docs.set("robotTeams/a", team("a", "Pallet Co", NOTE_A));
  sharedFakeFirestoreState.docs.set("robotTeams/b", team("b", "Berry Bots", NOTE_B));
  sharedFakeFirestoreState.docs.set("robotTeams/d", team("d", "Declined Co", NOTE_A, { status: "declined" }));
}

const ranked = { status: "completed", provider: "openai_responses", model: "test-model", output: { ranked: [
  { teamId: "a", fit: "strong", form: "fixed_base_arm", concerns: [],
    reasons: [{ claim: "Palletizes sealed cartons", quote: "stacking sealed cartons onto pallets" }] }] } };
const historyDocs = () => [...sharedFakeFirestoreState.docs.keys()].filter((key) => key.startsWith("siteRobotFit/job-1/rankings/"));

describe("ranking, staleness and sharing", () => {
  beforeEach(() => sharedFakeFirestoreState.docs.clear());

  it("sends every noted team and the job, keeps the validated ranking, the attempt and a history copy", async () => {
    seedJob();
    const run = vi.fn(async () => ranked as never);
    const { ranking, attempt } = await rankTeamsForJob("job-1", { actor: "admin-1", run, now: () => new Date(NOW) });
    const task = (run.mock.calls[0] as unknown[])[0] as { kind: string; input: { candidates: Array<{ teamId: string }>;
      job: { summary: string; forms: unknown[]; needs: string[] } } };
    expect(task.kind).toBe("robot_fit_ranking");
    expect(task.input.candidates.map((candidate) => candidate.teamId)).toEqual(["a", "b"]);
    expect(task.input.job.forms).toHaveLength(6);
    expect(ranking).toMatchObject({ rankedBy: "admin-1", candidateCount: 2, model: "test-model", teams: [{ teamId: "a" }] });
    expect(attempt).toEqual({ state: "ranked", atIso: NOW, by: "admin-1", error: null });
    expect(sharedFakeFirestoreState.docs.get("siteRobotFit/job-1")).toMatchObject({ ranking: { rankedAtIso: NOW }, lastAttempt: { state: "ranked" } });
    expect(historyDocs()).toHaveLength(1);

    expect((await getAdminRobotFit("job-1"))?.ranking?.stale).toBe(false);
    sharedFakeFirestoreState.docs.set("robotTeams/b", team("b", "Berry Bots", `${NOTE_B} Now also palletizes.`));
    expect((await getAdminRobotFit("job-1"))?.ranking?.stale).toBe(true);
  });

  it("keeps the last good ranking when a later run fails, and records why the run failed", async () => {
    seedJob();
    await rankTeamsForJob("job-1", { actor: "admin-1", run: async () => ranked as never, now: () => new Date(NOW) });
    const later = new Date(Date.parse(NOW) + 60_000);
    const failed = await rankTeamsForJob("job-1", { actor: "admin-2", now: () => later,
      run: async () => ({ status: "failed", provider: "openai_responses", model: "m", error: "provider_timeout" }) as never });
    expect(failed).toMatchObject({ ranking: null, attempt: { state: "failed", by: "admin-2", error: "provider_timeout (openai_responses)" } });
    const view = await getAdminRobotFit("job-1");
    expect(view?.ranking).toMatchObject({ rankedAtIso: NOW, teams: [{ teamId: "a" }] });
    expect(view?.lastAttempt).toMatchObject({ state: "failed", atIso: later.toISOString() });
    expect(historyDocs()).toHaveLength(2);
  });

  it("never lets a slower run that started earlier replace a newer ranking", async () => {
    seedJob();
    const later = new Date(Date.parse(NOW) + 60_000);
    await rankTeamsForJob("job-1", { actor: "newer", run: async () => ranked as never, now: () => later });
    await rankTeamsForJob("job-1", { actor: "older", run: async () => ranked as never, now: () => new Date(NOW) });
    expect(sharedFakeFirestoreState.docs.get("siteRobotFit/job-1")).toMatchObject({
      ranking: { rankedBy: "newer" }, lastAttempt: { by: "newer" } });
  });

  it("refuses after consent withdrawal and when the job says nothing yet", async () => {
    seedJob({ capture_rights: { consent_revoked: true } });
    const run = vi.fn();
    await expect(rankTeamsForJob("job-1", { actor: null, run })).rejects.toMatchObject({ code: "consent_revoked" });
    sharedFakeFirestoreState.docs.clear();
    sharedFakeFirestoreState.docs.set("inboundRequests/job-1", { requestId: "job-1", request: {} });
    sharedFakeFirestoreState.docs.set("siteTaskBriefs/job-1", { requestId: "job-1", summary: "Your site task" });
    await expect(rankTeamsForJob("job-1", { actor: null, run })).rejects.toBeInstanceOf(RobotFitError);
    expect(run).not.toHaveBeenCalled();
  });

  it("shows the site nothing until shared, and stops when consent is withdrawn", async () => {
    seedJob();
    expect(await getSiteRobotFit("job-1")).toBeNull();
    await setRobotFitSharing("job-1", true, { actor: "admin-1", now: () => new Date(NOW) });
    const site = await getSiteRobotFit("job-1");
    expect(site?.forms.find((entry) => entry.id === "bimanual_arm")?.verdict).toBe("fits");
    expect(JSON.stringify(site)).not.toContain("Pallet Co");
    sharedFakeFirestoreState.docs.set("inboundRequests/job-1", { requestId: "job-1", request: {}, ...SCREENED,
      capture_rights: { consent_revoked: true } });
    expect(await getSiteRobotFit("job-1")).toBeNull();
    await expect(setRobotFitSharing("job-1", true, { actor: null })).rejects.toMatchObject({ code: "consent_revoked" });
    await expect(setRobotFitSharing("job-1", false, { actor: null })).resolves.toMatchObject({ shared: false });
  });

  it("refuses to share a job that is not rated", async () => {
    seedJob({ site_task_scope: { supported: false, reason: "liquid" } });
    await expect(setRobotFitSharing("job-1", true, { actor: null })).rejects.toMatchObject({ code: "nothing_to_share" });
  });
});
