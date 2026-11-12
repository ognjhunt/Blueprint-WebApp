// @vitest-environment node
/**
 * Blueprint's first look on a shared job, as approved deployment companies open it (2026-11-12: sharing is the
 * service). It goes with every job listed under `job-shared-2026-11-12`; a card under an older statement is not listed
 * at all; never for a viewer the library refuses, and never with the site's identity or words.
 * OFFLINE: the real library routes and composer against the fake Firestore.
 */
import { createServer, type Server } from "node:http";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";
import { anonymizedOpportunityDraft } from "../../client/src/types/taskBrowse";
import { passedPrivacyScreen, sharedJobListing, sharedRecordingGrant } from "./helpers/sharedJob";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore, authAdmin: null, storageAdmin: null };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
const seams = vi.hoisted(() => ({
  allowed: true,
  answerFails: false,
  managed: vi.fn(async (): Promise<{ managedEvidence: unknown[] }> => ({ managedEvidence: [] })),
}));
vi.mock("../utils/robotTeamLibraryAccess", () => ({ libraryAccessForRequest: vi.fn(async () => ({
  gated: true, status: seams.allowed ? "approved" : "none", signedIn: seams.allowed, emailVerified: seams.allowed,
  allowed: seams.allowed, staff: false })) }));
vi.mock("../utils/siteAnswer", async importOriginal => {
  const actual = await importOriginal<typeof import("../utils/siteAnswer")>();
  return { ...actual, loadSiteAnswer: vi.fn(async (...args: Parameters<typeof actual.loadSiteAnswer>) => {
    if (seams.answerFails) throw new Error("composer exploded");
    return actual.loadSiteAnswer(...args);
  }) };
});
vi.mock("../utils/siteManagedEvidence", () => ({ readSiteManagedEvidence: seams.managed }));

const router = (await import("../routes/site-worlds")).default;

let server: Server;
let baseUrl: string;
const ID = "req-card";
const PRIVATE = ["owner@example.com", "Dana Whitfield", "12 Elm Street", "Acme Supply Co", "gs://", "walkthrough.mp4",
  "https://storage.example.com", "+1 555", "conveyor by the loading dock", "Acme invoices", "A person in a red jacket"];

function job(extra: Record<string, unknown> = {}) {
  return {
    requestId: ID,
    contact: { email: "owner@example.com", firstName: "Dana", lastName: "Whitfield", phone: "+1 555 0100" },
    contactEmail: "owner@example.com", contactFirstName: "Dana Whitfield",
    request: { buyerType: "site_operator", siteName: "Acme Supply Co", siteLocation: "12 Elm Street, Springfield", capture_mode: "self_capture",
      consent_attestation: sharedRecordingGrant() },
    capture_privacy_screen: passedPrivacyScreen(ID),
    site_address: "12 Elm Street, Springfield",
    walkthrough_video_uri: "gs://bucket/walkthrough.mp4", video_url: "https://storage.example.com/walkthrough.mp4",
    capture_coverage: { covers_scene: true },
    walkthrough_job_estimates: { capture_id: `walkthrough-${ID}`, job_estimates: {
      object: "carton", object_largest_side_m: 0.4, object_mass_kg_low: 8, object_mass_kg_high: 11, object_surface: "matte",
      job_kind: "palletizing",
      pick_to_place_m: 1.6, pick_height_m: null, place_height_m: null, front_clearance_m: 1.5,
      other_items_likely: ["Acme invoices"], cycle_seconds: null,
      basis: "A person in a red jacket stacks cartons from the conveyor by the loading dock at 12 Elm Street." } },
    public_task_listing: sharedJobListing("Stack cartons onto the pallet"),
    ...extra,
  };
}
const put = (record: Record<string, unknown>) => sharedFakeFirestoreState.docs.set(`inboundRequests/${ID}`, record);
async function get(path: string) {
  const response = await fetch(`${baseUrl}/api/site-worlds${path}`);
  return { status: response.status, body: await response.json() as Record<string, any> };
}

beforeEach(async () => {
  seams.allowed = true; seams.answerFails = false;
  seams.managed.mockReset(); seams.managed.mockImplementation(async () => ({ managedEvidence: [] }));
  sharedFakeFirestoreState.docs.clear();
  sharedFakeFirestoreState.docs.set(`siteTaskBriefs/${ID}`, { requestId: ID,
    summary: "Dana at Acme Supply Co stacks cartons from the conveyor by the loading dock onto the pallet", confirmedAtIso: null });
  const app = express();
  app.use("/api/site-worlds", router);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
afterEach(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
});

describe("GET /api/site-worlds/tasks/:taskId", () => {
  it("carries the answer when the site asked under the statement that names it, and nothing private", async () => {
    put(job());
    const { status, body } = await get(`/tasks/${ID}`);
    expect(status).toBe(200);
    const summary = body.item.answerSummary;
    expect(summary).toBeTruthy();
    expect(Object.keys(summary).sort()).toEqual(["confidence", "facts", "familyLabel", "headline", "note", "pick", "runnerUp",
      "sceneNote", "simulation", "test", "unknowns"]);
    // No scene says otherwise here: no scene note.
    expect(summary.sceneNote).toBeNull();
    // No simulation has run: the card's headline is the paper check's, as on the site's screen.
    expect(summary.test).toBeNull();
    expect(summary.headline).toMatch(/^Most likely to fit: /);
    expect(summary.familyLabel).toBe("palletizing");
    expect(summary.pick).toMatchObject({ manufacturer: expect.any(String), name: expect.any(String), verdictLabel: expect.any(String) });
    expect(Object.keys(summary.pick).sort()).toEqual(["checks", "evidence", "manufacturer", "name", "specs", "verdictLabel"]);
    // Each check's outcome and its figures, numbers with units only, never the site's sentence.
    expect(summary.pick.checks.map((check: Record<string, unknown>) => Object.keys(check).sort()))
      .toEqual(summary.pick.checks.map(() => ["has", "key", "need", "outcome", "tight"]));
    expect(summary.pick.checks.find((check: { key: string }) => check.key === "payload")).toMatchObject({ outcome: "pass",
      need: expect.stringMatching(/kg$/), has: expect.stringMatching(/kg$/) });
    for (const spec of summary.pick.specs) expect(spec.sourceUrl).toMatch(/^https:\/\//);
    for (const row of summary.pick.evidence) expect(row.sourceUrl).toMatch(/^https:\/\//);
    expect(summary.facts.length).toBeGreaterThan(0);
    for (const fact of summary.facts) expect(fact.display).toMatch(/\d/);
    expect(summary.unknowns).toContain("How many different objects the job handles.");
    expect(summary.note).toContain("not a test of a robot at the site");
    expect(body.item.answerHeadline).toBe(summary.headline);
    // The card's own fields are the anonymised draft, as before.
    expect(body.item.title).toBe("Carton palletizing opportunity");
    const text = JSON.stringify(body);
    for (const word of PRIVATE) expect(text).not.toContain(word);
    expect(text).not.toMatch(/\byour\b/i);
    // No simulation has run: no line.
    expect(summary.simulation).toBeNull();
  });

  it("tells a company what was checked: the standing note always, and that only a carry was checked when the reader gave no kind", async () => {
    const record = job();
    delete (record.walkthrough_job_estimates.job_estimates as Record<string, unknown>).job_kind;
    put(record);
    const { body } = await get(`/tasks/${ID}`);
    const summary = body.item.answerSummary;
    expect(summary.note).toBe("This checks whether a robot can pick the object up and put it down, against published robot specifications and a cited track record. It is not a test of a robot at the site and does not certify performance or safety.");
    expect(summary.unknowns[0]).toBe("We could not tell from the site's video what is done to the object; this checks only whether a robot can pick it up and put it down.");
    expect(JSON.stringify(summary)).not.toMatch(/\byour\b/i);
    // Nobody judged the kind of job, so the card states none.
    expect(summary.familyLabel).toBeNull();
    // The reader says another kind: the card says it can't be checked, and states no kind of job either.
    const other = job();
    (other.walkthrough_job_estimates.job_estimates as Record<string, unknown>).job_kind = "other";
    put(other);
    const refused = (await get(`/tasks/${ID}`)).body.item.answerSummary;
    expect(refused).toMatchObject({ headline: "We can't check robots against this job yet.", familyLabel: null, pick: null });
    // With the reader's kind of job, the card says nothing of the kind.
    put(job());
    const judged = (await get(`/tasks/${ID}`)).body.item.answerSummary;
    expect(judged.unknowns.some((line: string) => line.startsWith("We could not tell"))).toBe(false);
    expect(judged.familyLabel).toBe("palletizing");
  });

  it("says the site's video does not show the whole work area about the site, never in the review's own words", async () => {
    put(job({ capture_coverage: { covers_scene: false, missing_coverage: ["The far side of the loading dock"] } }));
    const summary = (await get(`/tasks/${ID}`)).body.item.answerSummary;
    expect(summary.unknowns).toContain("The site's video does not show the whole work area.");
    expect(JSON.stringify(summary)).not.toMatch(/\byour\b|far side/i);
  });

  it("adds one plain simulation line when the site's evaluation has one", async () => {
    put(job());
    seams.managed.mockImplementation(async () => ({ managedEvidence: [{ current: true, state: "completed", outcome: "held_scene_check" }] }));
    const { body } = await get(`/tasks/${ID}`);
    expect(body.item.answerSummary.simulation).toBe("The simulated scene failed the check we run before testing robots, so no robot was tested in it.");
  });

  it("carries the simulation test's result as its headline, the same one the site sees, in numbers and closed-map names", async () => {
    put(job());
    const progress = (counts: number[]) => ({ graded: 10, meanScore: 0, stages: ["approached", "contact", "moved", "lifted", "translated",
      "placed", "released_and_settled"].map((stage, index) => ({ stage, episodes: counts[index] })), closestApproachM: { median: 0.2, min: 0.05 } });
    const row = (candidateId: string, counts: number[], succeeded = 0) => ({ candidateId, name: `stored ${candidateId}`, state: "completed", planned: 10, scored: 10,
      succeeded, failed: 10 - succeeded, void: 0, blockers: [], progress: progress(counts) });
    seams.managed.mockImplementation(async () => ({ managedEvidence: [{ current: true, state: "completed", outcome: "estimate",
      screening: { candidates: [row("pi05_droid", [9, 6, 5, 4, 2, 0, 0]), row("groot_n17_droid", [0, 0, 0, 0, 0, 0, 0])] } }] }));
    const none = (await get(`/tasks/${ID}`)).body.item;
    expect(none.answerSummary.headline).toBe("No robot finished the job in our trial.");
    expect(none.answerHeadline).toBe(none.answerSummary.headline);
    expect(none.answerSummary.test).toMatchObject({ kind: "none_finished", wording: null,
      options: [{ label: "Franka arm + π0.5", maker: "Physical Intelligence", succeeded: 0, scored: 10, furthestText: "lifted and carried the object" },
        { label: "Franka arm + GR00T N1.7", maker: "NVIDIA", succeeded: 0, scored: 10 }] });
    expect(none.answerSummary.simulation).toBeNull();
    // A winner by the probability rule: the card says it as the site's screen does.
    seams.managed.mockImplementation(async () => ({ managedEvidence: [{ current: true, state: "completed", outcome: "estimate",
      screening: { candidates: [row("pi05_droid", [10, 10, 10, 10, 10, 10, 10], 10), row("groot_n17_droid", [0, 0, 0, 0, 0, 0, 0])] } }] }));
    const won = (await get(`/tasks/${ID}`)).body.item.answerSummary;
    expect(won.headline).toBe("Did best in our early trial: Franka arm + π0.5, doing the job in 10 of 10 tries.");
    expect(won.test).toMatchObject({ kind: "winner", wording: "did_best" });
    expect(JSON.stringify(won)).not.toMatch(/stored |\byour\b/i);
  });

  // Sharing is the service (2026-11-12): a shared job carries the early trial's result with the first look, before and
  // after it arrives.
  it("carries the paper check before a trial result and the trial result once it arrives", async () => {
    put(job());
    const before = (await get(`/tasks/${ID}`)).body.item.answerSummary;
    expect(before.headline).toMatch(/^Most likely to fit: |^No robot clearly fits\.|^None of the /);
    expect(before.test).toBeNull();
    seams.managed.mockImplementation(async () => ({ managedEvidence: [{ current: true, state: "completed", outcome: "estimate",
      screening: { candidates: [{ candidateId: "pi05_droid", name: "stored", state: "completed", planned: 10, scored: 10, succeeded: 10, failed: 0,
        void: 0, blockers: [] }, { candidateId: "groot_n17_droid", name: "stored", state: "completed", planned: 10, scored: 10, succeeded: 0,
        failed: 10, void: 0, blockers: [] }] } }] }));
    const after = (await get(`/tasks/${ID}`)).body.item;
    expect(after.answerSummary.headline).toBe("Did best in our early trial: Franka arm + π0.5, doing the job in 10 of 10 tries.");
    expect(after.answerSummary.test).toMatchObject({ kind: "winner" });
    expect(after.answerHeadline).toBe(after.answerSummary.headline);
  });

  it("keeps the answer when the simulation line cannot be read", async () => {
    put(job());
    seams.managed.mockImplementation(async () => { throw new Error("index missing"); });
    const { body } = await get(`/tasks/${ID}`);
    expect(body.item.answerSummary.headline).toMatch(/^Most likely to fit: /);
    expect(body.item.answerSummary.simulation).toBeNull();
  });

  it.each(["public-task-card-v1", "public-task-card-with-answer-v3"])("does not list a card under the older version %s at all", async version => {
    put(job({ public_task_listing: { ...job().public_task_listing, consentVersion: version } }));
    const { status, body } = await get(`/tasks/${ID}`);
    expect(status).toBe(404);
    expect(JSON.stringify(body)).not.toMatch(/Most likely|Carton/);
    expect((await get("/tasks")).body.items).toEqual([]);
  });

  it("refuses a viewer the library refuses, and a card that is not listed", async () => {
    put(job());
    seams.allowed = false;
    expect((await get(`/tasks/${ID}`)).status).toBe(404);
    seams.allowed = true;
    put(job({ public_task_listing: { ...job().public_task_listing, enabled: false } }));
    const hidden = await get(`/tasks/${ID}`);
    expect(hidden.status).toBe(404);
    expect(JSON.stringify(hidden.body)).not.toMatch(/Most likely/);
    put(job({ consent_revoked: true }));
    expect((await get(`/tasks/${ID}`)).status).toBe(404);
  });

  it("returns the card without the answer when composing fails", async () => {
    put(job());
    seams.answerFails = true;
    const { status, body } = await get(`/tasks/${ID}`);
    expect(status).toBe(200);
    expect(body.item.title).toBe("Carton palletizing opportunity");
    expect(body.item.answerSummary).toBeUndefined();
  });
});

describe("GET /api/site-worlds/tasks", () => {
  it("shows the headline alone on a shared card, and does not list a card under an older version", async () => {
    const { loadSiteAnswer } = await import("../utils/siteAnswer");
    vi.mocked(loadSiteAnswer).mockClear();
    put(job());
    sharedFakeFirestoreState.docs.set("inboundRequests/req-plain", { ...job(), requestId: "req-plain",
      public_task_listing: { ...job().public_task_listing, consentVersion: "public-task-card-v1" } });
    const { body } = await get("/tasks");
    const shared = body.items.find((item: { id: string }) => item.id === ID);
    const plain = body.items.find((item: { id: string }) => item.id === "req-plain");
    expect(shared.answerHeadline).toMatch(/^Most likely to fit: /);
    expect(shared.answerSummary).toBeUndefined();
    expect(plain).toBeUndefined();
    // The line's headline is the card's own, so the test is read for the consenting card only.
    expect(seams.managed).toHaveBeenCalledTimes(1);
    // The answer is composed for the consenting card only.
    expect(vi.mocked(loadSiteAnswer).mock.calls.map(call => call[0])).toEqual([ID]);
  });
});
