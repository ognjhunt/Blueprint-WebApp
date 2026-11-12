// @vitest-environment node
/**
 * Outcome questions after an introduction (PACKAGE_E E8): when they are owed, that each is queued
 * once, what the two emails say (and do not say), the signed links, and the confirm route. The real
 * outbox enqueue against the fake Firestore; listing (`teamJobAccess`) is stubbed per job, withdrawal
 * is the real rule.
 */
import { createServer, type Server } from "node:http";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, sharedFakeFirestoreState: state, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  // The fake has no collection-group read; this one lists every `.../introductions/{id}` in key order.
  const collectionGroup = (name: string) => {
    const query = (limitCount: number, after: string | null): any => ({
      limit: (count: number) => query(count, after),
      startAfter: (snapshot: { ref: { path: string } }) => query(limitCount, snapshot.ref.path),
      get: async () => {
        const keys = [...state.docs.keys()].filter(key => {
          const parts = key.split("/");
          return parts.length % 2 === 0 && parts[parts.length - 2] === name;
        }).sort().filter(key => after === null || key > after).slice(0, limitCount);
        const docs = keys.map(key => ({ id: key.split("/").pop(), ref: { path: key },
          data: () => JSON.parse(JSON.stringify(state.docs.get(key))) }));
        return { docs, empty: docs.length === 0, size: docs.length };
      },
    });
    return query(Number.MAX_SAFE_INTEGER, null);
  };
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: { ...sharedFakeFirestore, collectionGroup } };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/email", () => ({ sendEmail: vi.fn(async () => { throw new Error("No email is sent from tests"); }) }));
vi.mock("../utils/teamJobAccess", () => {
  const teamJobAccess = (record: Record<string, unknown> | null) => ({ listed: Boolean(record) && record!.testListed !== false });
  return { teamJobAccess,
    loadCompanyJobAccess: async (_requestId: string, record: Record<string, unknown> | null) => ({ record, access: teamJobAccess(record) }) };
});

const { sweepOutcomeQuestions, latestOutcome, recordOutcomeAnswer, buildOutcomeQuestionEmail, introductionPath } = await import("../utils/jobOutcomes");
const { dueOutcomeQuestionDay, outcomeQuestionIsCurrent, outcomeQuestionKey, parseOutcomeQuestionKey } = await import("../utils/jobOutcomeGate");
const { createJobOutcomeToken, verifyJobOutcomeToken } = await import("../utils/jobOutcomeToken");
const { createCaptureUploadToken } = await import("../utils/captureUploadToken");
const { createRequestReviewToken, createSiteClaimToken } = await import("../utils/request-review-auth");
const outcomesRouter = (await import("../routes/job-outcomes")).default;

const DAY = 24 * 60 * 60 * 1000;
const START = Date.parse("2026-08-01T12:00:00.000Z");
const at = (days: number, extraMs = 0) => new Date(START + days * DAY + extraMs);

/** Distinctive strings in every field of both sides: only the names may reach the other side. */
const PLANT = {
  siteName: "Acme Plant Siteside", siteEmail: "site-secret-mail@siteside.example", sitePhone: "+1-555-0100-SITEPHONE",
  company: "Robo Company Ltd", contactName: "Casey Contactperson", companyEmail: "company-secret@robo.example",
  website: "https://robo-secret-website.example",
  address: "42 Secret Street Siteplace", submitter: "Sam Submitterson", jobSentence: "Move the SECRETBOX totes",
};

function seedJob(requestId = "req-1", extra: Record<string, unknown> = {}) {
  sharedFakeFirestoreState.docs.set(`inboundRequests/${requestId}`, { requestId, request: { buyerType: "site_operator" },
    contact: { email: PLANT.siteEmail, name: PLANT.submitter, phone: PLANT.sitePhone }, site: { name: PLANT.siteName, address: PLANT.address },
    site_task_brief: { summary: PLANT.jobSentence }, ...extra });
}
function seedIntro(requestId = "req-1", companyId = "co-1", extra: Record<string, unknown> = {}) {
  sharedFakeFirestoreState.docs.set(`inboundRequests/${requestId}/introductions/${companyId}`, { schemaVersion: 1, alias: "Company A",
    requestedAtIso: new Date(START).toISOString(), by: "site",
    siteShared: { name: PLANT.siteName, email: PLANT.siteEmail, phone: PLANT.sitePhone },
    companyShared: { company: PLANT.company, contactName: PLANT.contactName, email: PLANT.companyEmail, website: PLANT.website },
    outcomes: [], ...extra });
}
const outbox = () => [...sharedFakeFirestoreState.docs.entries()].filter(([key]) => key.startsWith("captureOutbox/"))
  .map(([key, row]) => ({ id: key.slice("captureOutbox/".length), ...(row as Record<string, any>) }));
const intro = (requestId = "req-1", companyId = "co-1") =>
  sharedFakeFirestoreState.docs.get(`inboundRequests/${requestId}/introductions/${companyId}`) as Record<string, any>;

beforeEach(() => {
  sharedFakeFirestoreState.docs.clear();
  vi.stubEnv("APP_URL", "https://app.example");
  vi.stubEnv("VITE_PUBLIC_APP_URL", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("when a question is owed", () => {
  const base = { requestedAtIso: new Date(START).toISOString(), outcomes: [] };
  it("is owed at 14, 45 and 90 days, the latest that has passed", () => {
    expect(dueOutcomeQuestionDay(base, at(13).getTime())).toBeNull();
    expect(dueOutcomeQuestionDay(base, at(14).getTime() - 1)).toBeNull();
    expect(dueOutcomeQuestionDay(base, at(14).getTime())).toBe(14);
    expect(dueOutcomeQuestionDay(base, at(15).getTime())).toBe(14);
    expect(dueOutcomeQuestionDay(base, at(44).getTime())).toBe(14);
    expect(dueOutcomeQuestionDay(base, at(45).getTime())).toBe(45);
    expect(dueOutcomeQuestionDay(base, at(90).getTime())).toBe(90);
    expect(dueOutcomeQuestionDay(base, at(400).getTime())).toBe(90);
  });
  it("is never owed after a final answer from either side, or without a start time", () => {
    for (const state of ["installed", "not_going_ahead"]) for (const by of ["site", "company"])
      expect(dueOutcomeQuestionDay({ ...base, outcomes: [{ by, state, atIso: at(20).toISOString() }] }, at(45).getTime())).toBeNull();
    expect(dueOutcomeQuestionDay({ ...base, outcomes: [{ by: "site", state: "quote_given", atIso: at(20).toISOString() }] }, at(45).getTime())).toBe(45);
    expect(dueOutcomeQuestionDay({ outcomes: [] }, at(45).getTime())).toBeNull();
    expect(dueOutcomeQuestionDay({ requestedAtIso: "not a date" }, at(45).getTime())).toBeNull();
  });
});

describe("sweepOutcomeQuestions", () => {
  it("sends nothing at day 13, one email per side at day 14, nothing new at 15, then once at 45 and once at 90", async () => {
    seedJob(); seedIntro();
    expect(await sweepOutcomeQuestions({ now: at(13) })).toEqual({ examined: 1, queued: 0 });
    expect(outbox()).toHaveLength(0);
    expect((await sweepOutcomeQuestions({ now: at(14) })).queued).toBe(2);
    expect(outbox().map(row => row.id).sort()).toEqual([
      "job-outcome-question:req-1:co-1:company:d14", "job-outcome-question:req-1:co-1:site:d14"]);
    expect((await sweepOutcomeQuestions({ now: at(15) })).queued).toBe(0);
    expect((await sweepOutcomeQuestions({ now: at(45) })).queued).toBe(2);
    expect((await sweepOutcomeQuestions({ now: at(90) })).queued).toBe(2);
    expect((await sweepOutcomeQuestions({ now: at(120) })).queued).toBe(0);
    expect(outbox()).toHaveLength(6);
    expect(new Set(outbox().map(row => row.kind))).toEqual(new Set(["job_outcome_question"]));
  });

  it("is idempotent: the same sweep twice queues once", async () => {
    seedJob(); seedIntro();
    await sweepOutcomeQuestions({ now: at(14) });
    const first = JSON.stringify(outbox());
    expect((await sweepOutcomeQuestions({ now: at(14) })).queued).toBe(0);
    expect(JSON.stringify(outbox())).toBe(first);
  });

  it("sends nothing after either side gave a final answer", async () => {
    seedJob(); seedIntro("req-1", "co-1", { outcomes: [{ by: "company", state: "installed", atIso: at(20).toISOString() }] });
    seedJob("req-2"); seedIntro("req-2", "co-1", { outcomes: [{ by: "site", state: "not_going_ahead", atIso: at(20).toISOString() }] });
    expect((await sweepOutcomeQuestions({ now: at(45) })).queued).toBe(0);
  });

  it("sends nothing after a withdrawal, or while the job is not visible", async () => {
    seedJob("req-1", { request: { buyerType: "site_operator", consent_attestation: { withdrawn_at_iso: at(5).toISOString() } } }); seedIntro("req-1");
    seedJob("req-2", { testListed: false }); seedIntro("req-2");
    expect((await sweepOutcomeQuestions({ now: at(14) })).queued).toBe(0);
    expect(outbox()).toHaveLength(0);
  });

  it("asks only a side it has an address for, about a counterpart it has a name for", async () => {
    seedJob(); seedIntro("req-1", "co-1", { companyShared: { contactName: PLANT.contactName, email: PLANT.companyEmail } });
    await sweepOutcomeQuestions({ now: at(14) });
    // No company name: the site is not asked "How did it go with ?"; the company is still asked about the site.
    expect(outbox().map(row => row.id)).toEqual(["job-outcome-question:req-1:co-1:company:d14"]);
  });

  it("ignores documents that are not introductions on a job", async () => {
    sharedFakeFirestoreState.docs.set("robotTeams/t1/introductions/x", { requestedAtIso: new Date(START).toISOString() });
    expect((await sweepOutcomeQuestions({ now: at(14) })).queued).toBe(0);
    expect(introductionPath("inboundRequests/r/introductions/c")).toEqual({ requestId: "r", companyId: "c" });
    expect(introductionPath("robotTeams/t1/introductions/x")).toBeNull();
  });
});

describe("the two emails", () => {
  it("say one sentence, name only the other side, and carry five links; nothing else of either side appears", async () => {
    seedJob(); seedIntro();
    await sweepOutcomeQuestions({ now: at(14) });
    const site = outbox().find(row => row.id.endsWith(":site:d14"))!;
    const company = outbox().find(row => row.id.endsWith(":company:d14"))!;
    expect(site.to).toBe(PLANT.siteEmail);
    expect(company.to).toBe(PLANT.companyEmail);
    expect(site.subject).toBe(`How did it go with ${PLANT.company}?`);
    expect(company.subject).toBe(`How did it go with ${PLANT.siteName}?`);
    const lines = (body: string) => body.split("\n");
    expect(lines(site.body)[0]).toBe(`One click tells us where things stand with ${PLANT.company}.`);
    expect(lines(company.body)[0]).toBe(`One click tells us where things stand with ${PLANT.siteName}.`);
    for (const row of [site, company]) {
      const body = lines(row.body);
      expect(body[1]).toBe("");
      expect(body.slice(2).map(line => line.split(": ")[0])).toEqual(["Still talking", "Quote given", "Going ahead", "Installed", "Not going ahead"]);
      for (const line of body.slice(2)) expect(line).toMatch(/^[A-Za-z ]+: https:\/\/app\.example\/api\/job-outcomes\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    }
    const forbiddenInSite = [PLANT.contactName, PLANT.companyEmail, PLANT.website, PLANT.siteEmail, PLANT.sitePhone, PLANT.address,
      PLANT.submitter, PLANT.jobSentence, PLANT.siteName, "co-1", "Company A"];
    const forbiddenInCompany = [PLANT.siteEmail, PLANT.sitePhone, PLANT.address, PLANT.submitter, PLANT.jobSentence, PLANT.contactName,
      PLANT.companyEmail, PLANT.website, PLANT.company, "co-1", "Company A"];
    for (const value of forbiddenInSite) expect(`${site.subject}\n${site.body}`).not.toContain(value);
    for (const value of forbiddenInCompany) expect(`${company.subject}\n${company.body}`).not.toContain(value);
    // The links themselves carry no name or address: only ids, a side and an answer.
    for (const row of [site, company]) for (const line of lines(row.body).slice(2)) {
      const token = line.split("/api/job-outcomes/")[1];
      const decoded = Buffer.from(token.split(".")[0], "base64url").toString();
      for (const value of Object.values(PLANT)) expect(decoded).not.toContain(value);
    }
  });
});

describe("signed links", () => {
  const params = { requestId: "req-1", companyId: "co-1", by: "site" as const, state: "quote_given" as const };
  it("verify for their own purpose, and expire after 30 days", () => {
    const token = createJobOutcomeToken({ ...params, nowMs: START });
    expect(verifyJobOutcomeToken(token, START + 29 * DAY)).toMatchObject({ kind: "job_outcome", r: "req-1", c: "co-1", by: "site", state: "quote_given" });
    expect(verifyJobOutcomeToken(token, START + 30 * DAY)).toBeNull();
  });
  it("refuse a tampered payload or signature", () => {
    const token = createJobOutcomeToken(params);
    const [payload, signature] = token.split(".");
    const swapped = Buffer.from(Buffer.from(payload, "base64url").toString().replace('"site"', '"company"')).toString("base64url");
    expect(verifyJobOutcomeToken(`${swapped}.${signature}`)).toBeNull();
    const state = Buffer.from(Buffer.from(payload, "base64url").toString().replace("quote_given", "installed")).toString("base64url");
    expect(verifyJobOutcomeToken(`${state}.${signature}`)).toBeNull();
    expect(verifyJobOutcomeToken(`${payload}.${signature.slice(0, -2)}AA`)).toBeNull();
    expect(verifyJobOutcomeToken(`${payload}.`)).toBeNull();
    expect(verifyJobOutcomeToken("")).toBeNull();
  });
  it("refuse a link signed with the same secret for another purpose", () => {
    for (const other of [createCaptureUploadToken({ requestId: "req-1", captureId: "walkthrough-req-1", sceneId: "site-req-1" }),
      createRequestReviewToken("req-1"), createSiteClaimToken("req-1")]) expect(verifyJobOutcomeToken(other)).toBeNull();
  });
});

describe("recording an answer", () => {
  it("appends { by, state, atIso }; a later answer from the same side appends; the latest per side is current", async () => {
    seedJob(); seedIntro();
    const token = (by: "site" | "company", state: any) => createJobOutcomeToken({ requestId: "req-1", companyId: "co-1", by, state });
    expect(await recordOutcomeAnswer(token("site", "still_talking"), at(14))).toEqual({ ok: true, state: "still_talking", recorded: true });
    expect(await recordOutcomeAnswer(token("company", "quote_given"), at(15))).toMatchObject({ recorded: true });
    // A second click on the same link soon after is one answer.
    expect(await recordOutcomeAnswer(token("site", "still_talking"), new Date(at(14).getTime() + 60_000))).toMatchObject({ recorded: false });
    expect(await recordOutcomeAnswer(token("site", "still_talking"), at(45))).toMatchObject({ recorded: true });
    expect(await recordOutcomeAnswer(token("site", "going_ahead"), at(46))).toMatchObject({ recorded: true });
    expect(intro().outcomes).toEqual([
      { by: "site", state: "still_talking", atIso: at(14).toISOString() },
      { by: "company", state: "quote_given", atIso: at(15).toISOString() },
      { by: "site", state: "still_talking", atIso: at(45).toISOString() },
      { by: "site", state: "going_ahead", atIso: at(46).toISOString() }]);
    expect(latestOutcome(intro())).toEqual({
      site: { by: "site", state: "going_ahead", atIso: at(46).toISOString() },
      company: { by: "company", state: "quote_given", atIso: at(15).toISOString() },
      latest: { by: "site", state: "going_ahead", atIso: at(46).toISOString() } });
    expect(latestOutcome(null)).toEqual({ site: null, company: null, latest: null });
  });

  it("refuses after a withdrawal, for a missing introduction, and for a bad link", async () => {
    seedJob("req-1", { request: { buyerType: "site_operator", consent_attestation: { withdrawn_at_iso: at(5).toISOString() } } }); seedIntro();
    expect(await recordOutcomeAnswer(createJobOutcomeToken({ requestId: "req-1", companyId: "co-1", by: "site", state: "installed" })))
      .toEqual({ ok: false, reason: "closed" });
    expect(await recordOutcomeAnswer(createJobOutcomeToken({ requestId: "req-1", companyId: "co-9", by: "site", state: "installed" })))
      .toEqual({ ok: false, reason: "not_found" });
    expect(await recordOutcomeAnswer("nope.nope")).toEqual({ ok: false, reason: "invalid_link" });
    expect(intro().outcomes).toEqual([]);
  });
});

describe("the outbox's check before it sends", () => {
  it("passes other kinds, and an outcome question only while it is still owed", async () => {
    expect(await outcomeQuestionIsCurrent({ kind: "job_sent", requestId: "req-1" })).toBe(true);
    seedJob(); seedIntro();
    const key = outcomeQuestionKey("req-1", "co-1", "site", 14);
    expect(parseOutcomeQuestionKey("req-1", key)).toEqual({ companyId: "co-1", side: "site", day: 14 });
    const entry = { kind: "job_outcome_question", requestId: "req-1", idempotencyKey: key };
    expect(await outcomeQuestionIsCurrent(entry)).toBe(true);
    expect(await outcomeQuestionIsCurrent({ ...entry, idempotencyKey: "job-outcome-question:req-2:co-1:site:d14" })).toBe(false);
    seedIntro("req-1", "co-1", { outcomes: [{ by: "company", state: "not_going_ahead", atIso: at(16).toISOString() }] });
    expect(await outcomeQuestionIsCurrent(entry)).toBe(false);
    seedIntro();
    seedJob("req-1", { testListed: false });
    expect(await outcomeQuestionIsCurrent(entry)).toBe(false);
    seedJob("req-1", { request: { buyerType: "site_operator", consent_attestation: { withdrawn_at_iso: at(5).toISOString() } } });
    expect(await outcomeQuestionIsCurrent(entry)).toBe(false);
  });
});

describe("GET and POST /api/job-outcomes/:token", () => {
  let server: Server;
  let baseUrl: string;
  beforeEach(async () => {
    const app = express();
    app.use(express.urlencoded({ extended: false }));
    app.use("/api/job-outcomes", outcomesRouter);
    server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  });
  afterEach(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });

  it("a GET shows a confirm page and records nothing; the POST records and redirects to the thank-you page", async () => {
    seedJob(); seedIntro();
    const token = createJobOutcomeToken({ requestId: "req-1", companyId: "co-1", by: "company", state: "going_ahead" });
    const get = await fetch(`${baseUrl}/api/job-outcomes/${token}`);
    expect(get.status).toBe(200);
    const html = await get.text();
    expect(html).toContain("Going ahead");
    expect(html).toContain(`<form method="post" action="/api/job-outcomes/${token}">`);
    for (const value of Object.values(PLANT)) expect(html).not.toContain(value);
    expect(intro().outcomes).toEqual([]);
    await fetch(`${baseUrl}/api/job-outcomes/${token}`, { method: "HEAD" });
    expect(intro().outcomes).toEqual([]);

    const post = await fetch(`${baseUrl}/api/job-outcomes/${token}`, { method: "POST", redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded" }, body: "" });
    expect(post.status).toBe(303);
    expect(post.headers.get("location")).toBe("/job-outcome/thanks?answer=going_ahead");
    expect(intro().outcomes).toMatchObject([{ by: "company", state: "going_ahead" }]);
  });

  it("refuses a tampered, expired or other-purpose link on both methods and records nothing", async () => {
    seedJob(); seedIntro();
    const good = createJobOutcomeToken({ requestId: "req-1", companyId: "co-1", by: "site", state: "installed" });
    const expired = createJobOutcomeToken({ requestId: "req-1", companyId: "co-1", by: "site", state: "installed", nowMs: Date.now() - 31 * DAY });
    const [payload, signature] = good.split(".");
    const tampered = `${Buffer.from(Buffer.from(payload, "base64url").toString().replace("co-1", "co-2")).toString("base64url")}.${signature}`;
    const other = createCaptureUploadToken({ requestId: "req-1", captureId: "walkthrough-req-1", sceneId: "site-req-1" });
    for (const token of [expired, tampered, other, "<script>alert(1)</script>"]) {
      const get = await fetch(`${baseUrl}/api/job-outcomes/${encodeURIComponent(token)}`);
      expect(get.status).toBe(404);
      expect(await get.text()).not.toContain("<script>alert");
      const post = await fetch(`${baseUrl}/api/job-outcomes/${encodeURIComponent(token)}`, { method: "POST", redirect: "manual" });
      expect(post.status).toBe(404);
    }
    expect(intro().outcomes).toEqual([]);
  });

  it("builds the same email text the sweep queues", () => {
    const email = buildOutcomeQuestionEmail({ requestId: "r", companyId: "c", side: "site", otherSideName: "Robo" });
    expect(email.subject).toBe("How did it go with Robo?");
    expect(email.body.split("\n")).toHaveLength(7);
  });
});
