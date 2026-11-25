// @vitest-environment node
/**
 * `POST /api/job-facts/:token` (PACKAGE_E E1): the site's tap answers. The real route against the
 * fake Firestore. Every refusal writes nothing.
 */
import { createServer, type Server } from "node:http";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const router = (await import("../routes/job-facts")).default;
const { createCaptureUploadToken } = await import("../utils/captureUploadToken");
const { createRequestReviewToken } = await import("../utils/request-review-auth");
const { readJobFacts, parseJobFactTap } = await import("../utils/jobFacts");

let server: Server;
let baseUrl: string;
const owner = (requestId = "req-1") => createCaptureUploadToken({ requestId, captureId: `walkthrough-${requestId}`, sceneId: `site-${requestId}` });
const film = () => createCaptureUploadToken({ requestId: "req-1", captureId: "walkthrough-req-1", sceneId: "site-req-1", scope: "film" });
const job = () => sharedFakeFirestoreState.docs.get("inboundRequests/req-1") as Record<string, any>;

async function tap(body: unknown, token = owner(), csrf = true) {
  const response = await fetch(`${baseUrl}/api/job-facts/${token}`, { method: "POST", body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...(csrf ? { cookie: "csrf_token=jf", "x-csrf-token": "jf" } : {}) } });
  return { status: response.status, body: await response.json() };
}

beforeEach(async () => {
  sharedFakeFirestoreState.docs.clear();
  sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { requestId: "req-1", request: { buyerType: "site_operator" },
    site: { name: "Keep Me Site" } });
  const app = express();
  app.use(express.json());
  app.use("/api/job-facts", router);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
afterEach(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });

describe("POST /api/job-facts/:token", () => {
  it("saves one tap with updatedAtIso, and another tap changes it, leaving the job's other fields alone", async () => {
    const first = await tap({ key: "weight", code: "5_15kg" });
    expect(first.status).toBe(200);
    expect(first.body.jobFacts).toMatchObject({ weight: "5_15kg" });
    expect(Date.parse(job().job_facts.updatedAtIso)).not.toBeNaN();
    await tap({ key: "timing", code: "asap" });
    const changed = await tap({ key: "weight", code: "unsure" });
    expect(changed.body.jobFacts).toMatchObject({ weight: "unsure", timing: "asap" });
    expect(Object.keys(job().job_facts).sort()).toEqual(["timing", "updatedAtIso", "weight"]);
    expect(job().site).toEqual({ name: "Keep Me Site" });
    expect(readJobFacts(job())).toMatchObject({ weight: "unsure", timing: "asap" });
  });

  it("saves an exact measurement for a job-type question through the same owner route", async () => {
    expect((await tap({ key: "peakPerMinute", code: "26.5" })).status).toBe(200);
    expect((await tap({ key: "machineAccess", code: "automatic" })).status).toBe(200);
    expect((await tap({ key: "itemsPerCase", code: "3.5" })).status).toBe(400);
    expect((await tap({ key: "peakPerMinute", code: "26.5" }, film())).status).toBe(403);
    expect(readJobFacts(job())).toMatchObject({ peakPerMinute: "26.5", machineAccess: "automatic" });
  });

  it.each([
    ["an array", [{ key: "weight", code: "5_15kg" }], "job_facts_body_not_object"],
    ["an extra field", { key: "weight", code: "5_15kg", note: "it is heavy" }, "job_facts_unexpected_field"],
    ["free text as the answer", { key: "weight", code: "about 12 kilos" }, "job_facts_unknown_answer"],
    ["a typed number", { key: "weight", code: 12 }, "job_facts_unknown_answer"],
    ["another question's code", { key: "size", code: "5_15kg" }, "job_facts_unknown_answer"],
    ["an unknown question", { key: "colour", code: "unsure" }, "job_facts_unknown_question"],
    ["updatedAtIso as a question", { key: "updatedAtIso", code: "2026-01-01" }, "job_facts_unknown_question"],
    ["no answer", { key: "weight" }, "job_facts_unknown_answer"],
    ["a prototype key", { key: "__proto__", code: "unsure" }, "job_facts_unknown_question"],
  ])("refuses %s and writes nothing", async (_name, body, code) => {
    const result = await tap(body);
    expect(result.status).toBe(400);
    expect(result.body.code).toBe(code);
    expect(job().job_facts).toBeUndefined();
  });

  it("refuses a bare JSON string (the body parser refuses it before the route) and writes nothing", async () => {
    const response = await fetch(`${baseUrl}/api/job-facts/${owner()}`, { method: "POST", body: JSON.stringify("weight=5_15kg"),
      headers: { "content-type": "application/json", cookie: "csrf_token=jf", "x-csrf-token": "jf" } });
    expect(response.status).toBe(400);
    expect(job().job_facts).toBeUndefined();
  });

  it("refuses a colleague's film link, another kind of signed link, a tampered link and a missing CSRF token", async () => {
    expect((await tap({ key: "weight", code: "unsure" }, film())).status).toBe(403);
    expect((await tap({ key: "weight", code: "unsure" }, createRequestReviewToken("req-1"))).status).toBe(403);
    const [payload, signature] = owner().split(".");
    const forged = Buffer.from(Buffer.from(payload, "base64url").toString().replace("req-1", "req-2")).toString("base64url");
    expect((await tap({ key: "weight", code: "unsure" }, `${forged}.${signature}`)).status).toBe(403);
    expect((await tap({ key: "weight", code: "unsure" }, owner(), false)).status).toBe(403);
    expect(job().job_facts).toBeUndefined();
  });

  it("refuses after a withdrawal and writes nothing", async () => {
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { ...job(),
      request: { buyerType: "site_operator", consent_attestation: { withdrawn_at_iso: "2026-11-12T09:00:00.000Z" } } });
    const result = await tap({ key: "weight", code: "under_5kg" });
    expect(result.status).toBe(409);
    expect(job().job_facts).toBeUndefined();
  });

  it("refuses a job that does not exist", async () => {
    expect((await tap({ key: "weight", code: "under_5kg" }, owner("req-missing"))).status).toBe(404);
    expect(sharedFakeFirestoreState.docs.has("inboundRequests/req-missing")).toBe(false);
  });
});

describe("parseJobFactTap and readJobFacts", () => {
  it("accept only the closed lists", () => {
    expect(parseJobFactTap({ key: "hours", code: "around_the_clock" })).toEqual({ ok: true, tap: { key: "hours", code: "around_the_clock" } });
    expect(parseJobFactTap(null)).toEqual({ ok: false, reason: "body_not_object" });
    expect(readJobFacts({ job_facts: { weight: "5_15kg", size: "<b>", extra: "x", updatedAtIso: "2026-11-12T00:00:00.000Z" } }))
      .toEqual({ weight: "5_15kg", updatedAtIso: "2026-11-12T00:00:00.000Z" });
    expect(readJobFacts({})).toBeNull();
  });

  // Stress test, 2026-11-24: a weight typed in pounds is stored as typed, never as a converted 19.958.
  it("takes the heaviest load in pounds as typed, and nothing else with a unit", () => {
    expect(parseJobFactTap({ key: "maxLoadedWeightKg", code: "44lb" })).toEqual({ ok: true, tap: { key: "maxLoadedWeightKg", code: "44lb" } });
    expect(parseJobFactTap({ key: "maxLoadedWeightKg", code: "44 lb" })).toEqual({ ok: false, reason: "unknown_answer" });
    expect(parseJobFactTap({ key: "peakPerMinute", code: "12lb" })).toEqual({ ok: false, reason: "unknown_answer" });
    expect(readJobFacts({ job_facts: { maxLoadedWeightKg: "44lb", updatedAtIso: "2026-11-24T00:00:00.000Z" } }))
      .toEqual({ maxLoadedWeightKg: "44lb", updatedAtIso: "2026-11-24T00:00:00.000Z" });
  });
});

// Owner, 2026-11-25: the site answers its job brief's own questions on its page (`client/src/lib/jobBrief.ts`).
describe("a tap on a question of the job's brief", () => {
  const SENTENCE = "Move the lamp from the round bedside table to the glass shelf on the wall.";
  const ROWS = [
    { id: "lamp_size", label: "Lamp size", evidence: "video_estimate", estimate_fields: ["object_largest_side_m"] },
    { id: "how_often_moved", label: "How often it is moved", evidence: "ask_site", question: "How often is the lamp moved?",
      choices: ["Once a day", "A few times a day", "Once a week or less"] },
    { id: "hours", label: "Hours a day", evidence: "site_answer", answer_key: "hours" },
  ];
  async function withBrief() {
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { ...job(), walkthrough_job_estimates: { capture_id: "walkthrough-req-1",
      job_estimates: { job_kind: "pick_and_place", object: "bedside lamp", object_largest_side_m: 0.45 } } });
    sharedFakeFirestoreState.docs.set("siteTaskBriefs/req-1", { summary: SENTENCE });
    const { ensureJobBrief, resetJobBriefForTests, useJobBriefWriter } = await import("../utils/jobBrief");
    useJobBriefWriter(async () => ROWS);
    expect(await ensureJobBrief("req-1")).not.toBeNull();
    resetJobBriefForTests();
  }

  it("saves the index of the choice tapped, or unsure, beside the catalog answers, and a catalog tap keeps it", async () => {
    await withBrief();
    const first = await tap({ custom: "how_often_moved", code: 1 });
    expect(first.status).toBe(200);
    expect(first.body.jobFacts).toMatchObject({ custom: { how_often_moved: 1 } });
    expect((await tap({ key: "hours", code: "two_shifts" })).body.jobFacts).toMatchObject({ hours: "two_shifts", custom: { how_often_moved: 1 } });
    expect((await tap({ custom: "how_often_moved", code: "unsure" })).body.jobFacts).toMatchObject({ hours: "two_shifts",
      custom: { how_often_moved: "unsure" } });
    expect(job().job_facts).toEqual({ hours: "two_shifts", custom: { how_often_moved: "unsure" }, updatedAtIso: expect.any(String) });
    expect(job().site).toEqual({ name: "Keep Me Site" });
  });

  it("refuses a question the brief shown now does not ask, a choice it does not offer and any other shape, writing nothing", async () => {
    // No brief yet: no question of its own is asked.
    expect(await tap({ custom: "how_often_moved", code: 0 })).toMatchObject({ status: 400, body: { code: "job_facts_unknown_question" } });
    await withBrief();
    for (const [body, code] of [
      [{ custom: "how_often_moved", code: 3 }, "job_facts_unknown_answer"],
      [{ custom: "how_often_moved", code: "1" }, "job_facts_unknown_answer"],
      [{ custom: "how_often_moved", code: "A few times a day" }, "job_facts_unknown_answer"],
      [{ custom: "hours", code: 0 }, "job_facts_unknown_question"],
      [{ custom: "lamp_size", code: 0 }, "job_facts_unknown_question"],
      [{ custom: "How_Often", code: 0 }, "job_facts_unknown_question"],
      [{ custom: "how_often_moved", code: 0, key: "hours" }, "job_facts_unexpected_field"],
    ] as const) expect(await tap(body), JSON.stringify(body)).toMatchObject({ status: 400, body: { code } });
    // A changed sentence: the stored brief is no longer the one the site's page shows, so its question is not asked.
    sharedFakeFirestoreState.docs.set("siteTaskBriefs/req-1", { summary: "Move the lamp to the desk." });
    expect(await tap({ custom: "how_often_moved", code: 0 })).toMatchObject({ status: 400, body: { code: "job_facts_unknown_question" } });
    expect(job().job_facts).toBeUndefined();
  });

  it("refuses after a withdrawal and writes nothing", async () => {
    await withBrief();
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { ...job(),
      request: { buyerType: "site_operator", consent_attestation: { withdrawn_at_iso: "2026-11-25T09:00:00.000Z" } } });
    expect((await tap({ custom: "how_often_moved", code: 0 })).status).toBe(409);
    expect(job().job_facts).toBeUndefined();
  });
});
