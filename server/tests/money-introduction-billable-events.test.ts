// @vitest-environment node
/**
 * Money (owner, 2026-11-12): each introduction is recorded as a billable event, exactly once, only after the site's own
 * press, and the site is never the party to it or charged. OFFLINE: the real site route ("Introduce us"), the real
 * company routes (the answer, the job page, the library) and the real automatic send, against the fake Firestore; no
 * email is delivered.
 *
 * What this pins:
 * - one press records one event for that job and company: `{ kind, requestId, companyId, atIso, priceUsd: null,
 *   status: "recorded_no_price" }`, naming the company and nothing of the site;
 * - a second press, two presses at once, and a retry after a failed attempt still leave one event, never rewritten;
 * - nothing records an event without the press: a company's answer, the automatic send, either side reading its page,
 *   a press from the filming link, under an old statement, or for a company that did not answer Interested;
 * - an event on record is never rewritten, even void and even without its introduction record;
 * - the press writes only the job, its introduction, the event and the two emails: no payment record of any kind, and
 *   neither side's API payload carries a price, a fee or the billable event;
 * - only the site's route reaches the event (source check).
 */
import { sharedCompanyClip } from "./helpers/sharedJob";
import express from "express";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { currentTermsAcceptance, passedPrivacyScreen, sharedJobListing, sharedRecordingGrant } from "./helpers/sharedJob";
// The fixture's site holds a name of its own and a person's, so its page shows the sentence of 2026-11-12, true for it
// (`introductionStatementVersionFor`); a job from the start form shows the current one.
import { INTRODUCTION_REQUEST_STATEMENT_2026_11_12_VERSION as INTRODUCTION_REQUEST_STATEMENT_VERSION } from "../../client/src/lib/siteIntroductions";
import { COMPANY_RESPONSE_STATEMENT_VERSION } from "../../client/src/lib/companyResponses";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore, authAdmin: null, storageAdmin: null };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/field-encryption", async importOriginal => {
  const actual = await importOriginal<typeof import("../utils/field-encryption")>();
  return { ...actual, decryptFieldValue: vi.fn(async (value: unknown) => typeof value === "string" || value == null
    ? String(value ?? "").replace(/^encrypted:/, "") : actual.decryptFieldValue(value as never)) };
});
const seams = vi.hoisted(() => ({ tokens: new Map<string, { uid: string; email: string }>() }));
vi.mock("../utils/robotTeamLibraryAccess", async () => {
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  const { accessRecordId } = await import("../utils/robotTeamEarlyAccess");
  const viewerFor = async (req: express.Request) => {
    const account = seams.tokens.get(String(req.headers.authorization ?? "").replace(/^Bearer /, ""));
    if (!account) return { access: { status: "none", signedIn: false, emailVerified: false, allowed: false, staff: false }, viewer: null };
    const companyId = accessRecordId(account.email);
    const record = (await sharedFakeFirestore.collection("robotTeamAccess").doc(companyId).get()).data();
    const { companyMaySeeJobs } = await import("../utils/companyTerms");
    return { access: { status: record?.status ?? "none", signedIn: true, emailVerified: true,
      allowed: companyMaySeeJobs(record), staff: false }, viewer: { uid: account.uid, email: account.email, companyId, staff: false } };
  };
  return { companyViewerForRequest: viewerFor, libraryAccessForRequest: async (req: express.Request) => (await viewerFor(req)).access };
});
vi.mock("../middleware/verifyFirebaseToken", () => ({ default: (req: express.Request, res: express.Response, next: () => void) => {
  const account = seams.tokens.get(String(req.headers.authorization ?? "").replace(/^Bearer /, ""));
  res.locals.firebaseUser = account ? { uid: account.uid, email: account.email, email_verified: true } : undefined;
  next();
} }));
vi.mock("../utils/email", () => ({ sendEmail: vi.fn(async () => { throw new Error("No email is sent from this test"); }) }));
vi.mock("../utils/siteWalkthrough", async importOriginal => ({ ...await importOriginal<typeof import("../utils/siteWalkthrough")>(),
  savedWalkthrough: vi.fn(async () => ({ upload: { captureReceived: true, uploadState: "processing_ready" }, received: true,
    uploadState: "processing_ready" })) }));

const { default: briefRouter } = await import("../routes/site-task-brief");
const { default: worldsRouter } = await import("../routes/site-worlds");
const { createCaptureUploadToken } = await import("../utils/captureUploadToken");
const { sendJobToApprovedCompanies } = await import("../utils/jobAutoSend");
const { decryptFieldValue } = await import("../utils/field-encryption");
const { payloadPriceFindings } = await import("../../scripts/qa/price-statements");

const ID = "req-money";
const CAPTURE = `walkthrough-${ID}`;
const sha = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
const SITE = { name: "ZEBRAPLANT Foods", address: "77 QUOKKA Lane, Springfield", email: "owner@site-plant.example",
  first: "Wilhelmina", last: "Zebraplant" };
const SITE_PLANTED = [SITE.name, "ZEBRAPLANT", "QUOKKA", SITE.email, "site-plant", SITE.first];

function company(tag: string, extra: Record<string, unknown> = {}) {
  return { partnerRole: "deployment", termsAcceptance: currentTermsAcceptance(), termsAcceptedByUid: `uid-contact@${tag.toLowerCase()}.example`,
    name: `Person ${tag}`, email: `contact@${tag.toLowerCase()}.example`, company: `${tag} Robotics`, website: `https://${tag.toLowerCase()}.example`,
    robot: "arm", workWanted: "pick", region: null, status: "approved", newJobAlertsOptIn: true, appliedAtIso: "2026-11-01T00:00:00.000Z",
    updatedAtIso: "2026-11-01T00:00:00.000Z", decidedAtIso: "2026-11-02T00:00:00.000Z", decidedBy: "ops", decisionNote: null, ...extra };
}
const NORTH = company("North");
const SOUTH = company("South");
const PENDING = company("Pending", { status: "applied" });

const EVENTS = "billableEvents/";
const events = () => [...state.docs.entries()].filter(([key]) => key.startsWith(EVENTS))
  .map(([key, value]) => ({ id: key.slice(EVENTS.length), ...(value as Record<string, unknown>) }));
const introductions = () => [...state.docs.keys()].filter(key => key.startsWith(`inboundRequests/${ID}/introductions/`));
const outboxRows = () => [...state.docs.entries()].filter(([key]) => key.startsWith("captureOutbox/")).map(([, value]) => value as Record<string, any>);
const eventId = (record: { email: string }) => `introduction-${ID}-${sha(record.email)}`;

let server: Server;
let base = "";

function signIn(record: { email: string }) {
  const token = `token-${record.email}`;
  seams.tokens.set(token, { uid: `uid-${record.email}`, email: record.email });
  return { Authorization: `Bearer ${token}` };
}
async function answer(record: { email: string }, value = "interested") {
  const response = await fetch(`${base}/api/site-worlds/tasks/${ID}/interest`, { method: "POST",
    body: JSON.stringify({ state: value, inputs: "We do this every day.", statementVersion: COMPANY_RESPONSE_STATEMENT_VERSION }),
    headers: { ...signIn(record), "content-type": "application/json", cookie: "csrf_token=m-test", "x-csrf-token": "m-test" } });
  return { status: response.status, body: await response.json() as Record<string, any> };
}
async function companyRead(record: { email: string }, url: string) {
  const response = await fetch(`${base}${url}`, { headers: signIn(record) });
  const raw = await response.text();
  return { status: response.status, raw, body: JSON.parse(raw) as unknown };
}
const token = (scope: "owner" | "film" = "owner") => createCaptureUploadToken({ requestId: ID, captureId: CAPTURE, sceneId: `site-${ID}`, scope });
async function siteStatus() {
  const response = await fetch(`${base}/api/site-task-brief/${token()}/status`);
  const raw = await response.text();
  expect(response.status, raw).toBe(200);
  return { raw, body: JSON.parse(raw) as unknown };
}
/** The site's one press for one company ("Introduce us"), as its job page sends it. */
async function press(alias: string, options: { scope?: "owner" | "film"; statementVersion?: string } = {}) {
  const response = await fetch(`${base}/api/site-task-brief/${token(options.scope)}/introductions`, { method: "POST",
    body: JSON.stringify({ alias, statementVersion: options.statementVersion ?? INTRODUCTION_REQUEST_STATEMENT_VERSION }),
    headers: { "content-type": "application/json", cookie: "csrf_token=site-test", "x-csrf-token": "site-test" } });
  return { status: response.status, body: await response.json() as Record<string, any> };
}

beforeEach(async () => {
  state.docs.clear();
  seams.tokens.clear();
  vi.stubEnv("FIELD_ENCRYPTION_MASTER_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("FIELD_ENCRYPTION_KMS_KEY_NAME", "");
  state.docs.set(`captureUploadSessions/walkthrough-${ID}`, { company_clip: sharedCompanyClip(`walkthrough-${ID}`) });
  state.docs.set(`siteTaskBriefs/${ID}`, { requestId: ID, summary: "Stack cartons onto the pallet", confirmedAtIso: null });
  state.docs.set(`inboundRequests/${ID}`, {
    requestId: ID,
    contact: { email: `encrypted:${SITE.email}`, firstName: `encrypted:${SITE.first}`, lastName: `encrypted:${SITE.last}`,
      company: `encrypted:${SITE.name}` },
    request: { buyerType: "site_operator", capture_mode: "self_capture", siteName: `encrypted:${SITE.name}`,
      siteLocation: `encrypted:${SITE.address}`, consent_attestation: sharedRecordingGrant() },
    public_task_listing: sharedJobListing("Stack cartons onto the pallet"),
    capture_privacy_screen: passedPrivacyScreen(ID),
  });
  for (const record of [NORTH, SOUTH, PENDING]) state.docs.set(`robotTeamAccess/${sha(record.email)}`, record);
  const app = express();
  app.use(express.json());
  app.use("/api/site-task-brief", briefRouter);
  app.use("/api/site-worlds", worldsRouter);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  // North answers Interested (alias A), South "would need something" (alias B).
  expect((await answer(NORTH)).status).toBe(200);
  expect((await answer(SOUTH, "needs_something")).status).toBe(200);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
});

describe("each introduction is one billable event, recorded only after the site's press", () => {
  it("records nothing before the press: answers, the automatic send, and both sides reading their pages", async () => {
    await sendJobToApprovedCompanies(ID);
    await siteStatus();
    for (const record of [NORTH, SOUTH]) {
      expect((await companyRead(record, `/api/site-worlds/jobs/${ID}`)).status).toBe(200);
      expect((await companyRead(record, "/api/site-worlds/tasks")).status).toBe(200);
    }
    expect(events()).toEqual([]);
    expect(introductions()).toEqual([]);
  });

  it("records one event for the company the site pressed for, with no price and nothing of the site", async () => {
    const result = await press("Company A");
    expect(result, JSON.stringify(result.body)).toMatchObject({ status: 200, body: { ok: true } });
    const recorded = events();
    expect(recorded).toEqual([{ id: eventId(NORTH), kind: "introduction", requestId: ID, companyId: sha(NORTH.email),
      atIso: result.body.introducedAtIso, priceUsd: null, status: "recorded_no_price" }]);
    // The party is an approved deployment company; no site, no amount, no payment state.
    expect(state.docs.get(`robotTeamAccess/${recorded[0].companyId}`)).toMatchObject({ partnerRole: "deployment", status: "approved" });
    const raw = JSON.stringify(recorded).toLowerCase();
    for (const planted of SITE_PLANTED) expect(raw).not.toContain(planted.toLowerCase());
  });

  // Owner decision 2026-11-19 ("One cap at $40"): the job's spending cap governs what Blueprint spends building the
  // packet, never the introduction. A job past its cap, its scene ended at the cap, still records the same one event.
  it("records the same one event for a job that reached its spending cap", async () => {
    const job = state.docs.get(`inboundRequests/${ID}`) as Record<string, any>;
    job.website_preparation_reservations = { spent: { admission: { maximum_cost_usd: 40, request_count: 1,
      provider: "world_labs_atlas" }, settlement: { actual_cost_usd: 40, status: "settled" } } };
    state.docs.set("taskEvaluationSceneIntakes/scene-capped", { website_request_id: ID, state: "blocked", receipt: {},
      request: { execution: { max_total_spend_usd: 20 } }, pipeline_status: { status: "blocked", phase: "preparation",
        blockers: ["scene_intake_spend_cap_exhausted"], attempts: [],
        outcome: { kind: "spending_cap_reached", terminal: true, reason_code: "spend_cap_reached" } } });
    const result = await press("Company A");
    expect(result, JSON.stringify(result.body)).toMatchObject({ status: 200, body: { ok: true } });
    expect(events()).toEqual([{ id: eventId(NORTH), kind: "introduction", requestId: ID, companyId: sha(NORTH.email),
      atIso: result.body.introducedAtIso, priceUsd: null, status: "recorded_no_price" }]);
  });

  it("records one event for a double press, and never rewrites it", async () => {
    const first = await press("A");
    expect(first.status).toBe(200);
    const before = events();
    const again = await press("A");
    expect(again).toMatchObject({ status: 409, body: { reason: "already_introduced" } });
    expect(events()).toEqual(before);
    expect(outboxRows().filter(row => row.kind === "introduction_made_company")).toHaveLength(1);
  });

  it("records one event for two presses at once", async () => {
    const both = await Promise.all([press("A"), press("A")]);
    expect(both.map(result => result.status).sort()).toEqual([200, 409]);
    expect(events()).toHaveLength(1);
    expect(introductions()).toHaveLength(1);
    expect(outboxRows().filter(row => row.kind === "introduction_made_company")).toHaveLength(1);
  });

  it("records nothing for a failed attempt and one event for its retry", async () => {
    // The site's details cannot be read for the company's email: the whole transaction fails, nothing is written.
    vi.mocked(decryptFieldValue).mockRejectedValueOnce(new Error("kms unavailable"));
    const failed = await press("A");
    expect(failed.status).not.toBe(200);
    expect(events()).toEqual([]);
    expect(introductions()).toEqual([]);
    expect((await press("A")).status).toBe(200);
    expect((await press("A")).status).toBe(409);
    expect(events()).toHaveLength(1);
  });

  it("records nothing for a press it refuses", async () => {
    expect((await press("A", { scope: "film" })).status).toBe(403);
    expect((await press("A", { statementVersion: "introduction-request-2026-01-01" })).status).toBe(409);
    expect(await press("B")).toMatchObject({ status: 409, body: { reason: "not_interested" } });
    expect((await press("Z")).status).toBe(409);
    expect((await answer(PENDING)).status).not.toBe(200);
    expect(events()).toEqual([]);
    expect(introductions()).toEqual([]);
  });

  it("keeps a cancelled introduction's event void and records nothing when the site presses again", async () => {
    expect((await press("A")).status).toBe(200);
    // As the dispatch check cancels it (G3): the record marked, the event void, both kept.
    const key = `${EVENTS}${eventId(NORTH)}`;
    state.docs.set(key, { ...(state.docs.get(key) as object), status: "void", voidedAtIso: "2026-11-19T10:00:00.000Z",
      voidReason: "company_not_approved" });
    const intro = `inboundRequests/${ID}/introductions/${sha(NORTH.email)}`;
    state.docs.set(intro, { ...(state.docs.get(intro) as object), cancelledAtIso: "2026-11-19T10:00:00.000Z" });
    const before = events();
    expect(await press("A")).toMatchObject({ status: 409, body: { reason: "already_introduced" } });
    expect(events()).toEqual(before);
    expect(before[0]).toMatchObject({ status: "void" });
  });

  it("lets the site press again after Blueprint's own email failed: a new event for the new attempt, the void one kept", async () => {
    expect((await press("A")).status).toBe(200);
    const companyId = sha(NORTH.email);
    // As the outbox ends it when the company's email definitely failed (`companyIntroductionEmailEnd`).
    const key = `${EVENTS}${eventId(NORTH)}`;
    state.docs.set(key, { ...(state.docs.get(key) as object), status: "void", voidedAtIso: "2026-11-19T10:00:00.000Z",
      voidReason: "company_email_failed" });
    const intro = `inboundRequests/${ID}/introductions/${companyId}`;
    state.docs.set(intro, { ...(state.docs.get(intro) as object), cancelledAtIso: "2026-11-19T10:00:00.000Z",
      cancelReason: "company_email_failed", siteShared: null, companyShared: null });
    const voided = events();
    const again = await press("A");
    expect(again, JSON.stringify(again.body)).toMatchObject({ status: 200, body: { ok: true } });
    expect(events()).toEqual([...voided, { id: `${eventId(NORTH)}-a1`, kind: "introduction", requestId: ID, companyId,
      atIso: again.body.introducedAtIso, priceUsd: null, status: "recorded_no_price", attempt: 1 }]);
    expect(state.docs.get(intro)).toMatchObject({ attempt: 1, requestedAtIso: again.body.introducedAtIso });
    expect(state.docs.get(intro)).not.toHaveProperty("cancelledAtIso");
    // The new attempt's emails have their own keys, so the spent ones never block it.
    for (const kind of ["introduction_made_company", "introduction_made_site"])
      expect(state.docs.has(`captureOutbox/${ID}:${kind}:${companyId}:a1`), kind).toBe(true);
    expect(await press("A")).toMatchObject({ status: 409, body: { reason: "already_introduced" } });
    expect(events()).toHaveLength(2);
  });

  it("records when the introduction was made once the company's email is sent, and never on a void event", async () => {
    expect((await press("A")).status).toBe(200);
    const { companyIntroductionEmailEnd } = await import("../utils/jobIntroductionGate");
    const { dbAdmin } = await import("../../client/src/lib/firebaseAdmin");
    const entry = { kind: "introduction_made_company", requestId: ID, idempotencyKey: `${ID}:introduction_made_company:${sha(NORTH.email)}` };
    expect(events()[0]).not.toHaveProperty("madeAtIso");
    await dbAdmin!.runTransaction(async tx => { (await companyIntroductionEmailEnd(entry, tx))!.sent(tx); });
    const made = events()[0];
    expect(made).toMatchObject({ status: "recorded_no_price", madeAtIso: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) });
    // Written once: a second end does not move it.
    await dbAdmin!.runTransaction(async tx => { (await companyIntroductionEmailEnd(entry, tx))!.sent(tx); });
    expect(events()[0]).toEqual(made);
    const key = `${EVENTS}${eventId(NORTH)}`;
    const { id: _id, madeAtIso: _madeAtIso, ...stored } = made;
    state.docs.set(key, { ...stored, status: "void" });
    await dbAdmin!.runTransaction(async tx => { (await companyIntroductionEmailEnd(entry, tx))!.sent(tx); });
    expect(events()[0]).not.toHaveProperty("madeAtIso");
  });

  it("never rewrites an event on record, even when its introduction record is gone", async () => {
    const onRecord = { kind: "introduction", requestId: ID, companyId: sha(NORTH.email), atIso: "2026-11-13T09:00:00.000Z",
      priceUsd: null, status: "void", voidedAtIso: "2026-11-13T09:05:00.000Z", voidReason: "company_email_failed" };
    state.docs.set(`${EVENTS}${eventId(NORTH)}`, onRecord);
    expect(await press("A")).toMatchObject({ status: 409, body: { reason: "already_introduced" } });
    expect(events()).toEqual([{ id: eventId(NORTH), ...onRecord }]);
    expect(introductions()).toEqual([]);
    expect(outboxRows().filter(row => String(row.kind).startsWith("introduction_made"))).toEqual([]);
  });
});

/**
 * The company's answer at the commit point (2026-11-24, a $0 stress test: a company that answered Not a fit after the
 * site pressed Accept, before its email went, was still introduced and billed). The dispatch check of both emails
 * (`introductionMayProceed`) reads the company's answer as it stands; the site's own press reads it too.
 */
describe("the company's answer when its introduction email would go", () => {
  const companyKey = (record: { email: string }, attempt = 0) =>
    `${ID}:introduction_made_company:${sha(record.email)}${attempt ? `:a${attempt}` : ""}`;
  const siteKey = (record: { email: string }, attempt = 0) =>
    `${ID}:introduction_made_site:${sha(record.email)}${attempt ? `:a${attempt}` : ""}`;
  /** One dispatch check of an introduction email, as the outbox runs it: reads, then the cancellation in the same transaction. */
  async function dispatchCheck(kind: "introduction_made_company" | "introduction_made_site", idempotencyKey: string) {
    const { introductionEmailCheck } = await import("../utils/jobIntroductionGate");
    const { dbAdmin } = await import("../../client/src/lib/firebaseAdmin");
    return dbAdmin!.runTransaction(async tx => {
      const check = await introductionEmailCheck({ kind, requestId: ID, idempotencyKey }, tx);
      check.cancel?.(tx);
      return check.current;
    });
  }
  const introRecord = () => state.docs.get(`inboundRequests/${ID}/introductions/${sha(NORTH.email)}`) as Record<string, unknown>;

  for (const changed of ["declined", "needs_something"] as const) {
    it(`cancels and voids when the company answers ${changed} after the press and before its email went`, async () => {
      expect((await press("A")).status).toBe(200);
      expect((await answer(NORTH, changed)).status).toBe(200);
      expect(await dispatchCheck("introduction_made_company", companyKey(NORTH))).toBe(false);
      expect(events()).toEqual([expect.objectContaining({ id: eventId(NORTH), status: "void", voidReason: "company_answer_changed" })]);
      expect(introRecord()).toMatchObject({ cancelReason: "company_answer_changed", siteShared: null, companyShared: null });
      // The company's own row is not current, so the outbox stops it; the site's is cancelled and cleared with it.
      expect(state.docs.get(`captureOutbox/${siteKey(NORTH)}`)).toMatchObject({ status: "cancelled", subject: "", body: "" });
      // The site's page says it could not go ahead, and offers nothing until the company applies again.
      const entries = ((await siteStatus()).body as { companyStatus: { companies: { entries: Array<Record<string, unknown>> } } })
        .companyStatus.companies.entries;
      expect(entries.find(row => row.alias === "Company A")).toMatchObject({ introductionCancelled: true, canIntroduce: false });
    });
  }

  it("decides the site's held email the same way when the company's row has not gone", async () => {
    expect((await press("A")).status).toBe(200);
    expect((await answer(NORTH, "declined")).status).toBe(200);
    expect(await dispatchCheck("introduction_made_site", siteKey(NORTH))).toBe(false);
    expect(events()).toEqual([expect.objectContaining({ status: "void", voidReason: "company_answer_changed" })]);
  });

  it("goes ahead when the answer changed between the two that allow one, Apply and Tested it: can do", async () => {
    expect((await press("A")).status).toBe(200);
    const answerKey = `inboundRequests/${ID}/robotTeamInterest/${sha(NORTH.email)}`;
    state.docs.set(answerKey, { ...(state.docs.get(answerKey) as object), state: "tested_can_do" });
    expect(await dispatchCheck("introduction_made_company", companyKey(NORTH))).toBe(true);
    expect(events()).toEqual([expect.objectContaining({ status: "recorded_no_price" })]);
    expect(introRecord()).not.toHaveProperty("cancelledAtIso");
  });

  it("refuses a press from a page loaded before the company changed to Not a fit, and records nothing", async () => {
    expect((await answer(NORTH, "declined")).status).toBe(200);
    expect(await press("A")).toMatchObject({ status: 409, body: { reason: "not_interested" } });
    expect(events()).toEqual([]);
    expect(introductions()).toEqual([]);
  });

  it("lets the site accept again once the company applies again: a new attempt and event, the void one kept", async () => {
    expect((await press("A")).status).toBe(200);
    expect((await answer(NORTH, "declined")).status).toBe(200);
    expect(await dispatchCheck("introduction_made_company", companyKey(NORTH))).toBe(false);
    // Still Not a fit: nothing to accept.
    expect(await press("A")).toMatchObject({ status: 409, body: { reason: "not_interested" } });
    expect((await answer(NORTH)).status).toBe(200);
    const again = await press("A");
    expect(again, JSON.stringify(again.body)).toMatchObject({ status: 200, body: { ok: true } });
    expect(events()).toEqual([expect.objectContaining({ id: eventId(NORTH), status: "void", voidReason: "company_answer_changed" }),
      expect.objectContaining({ id: `${eventId(NORTH)}-a1`, status: "recorded_no_price", attempt: 1 })]);
    expect(await dispatchCheck("introduction_made_company", companyKey(NORTH, 1))).toBe(true);
  });
});

// For "Changed after you accepted" (the flows work, 2026-11-24): the introduction keeps the estimate the site read.
describe("the estimate the site read when it pressed Accept", () => {
  const answerKey = `inboundRequests/${ID}/robotTeamInterest/${sha(NORTH.email)}`;
  const north = () => ((state.docs.get(answerKey) ?? {}) as Record<string, unknown>);
  const entryA = async () => ((await siteStatus()).body as { companyStatus: { companies: { entries: Array<Record<string, unknown>> } } })
    .companyStatus.companies.entries.find(row => row.alias === "Company A");

  it("is recorded on the introduction and carried on the site's entry, and stays as it was when the estimate changes", async () => {
    state.docs.set(answerKey, { ...north(), details: { chargeModel: "subscription", estimate: { lowUsd: 9000, highUsd: 12000 } } });
    expect((await press("A")).status).toBe(200);
    expect(state.docs.get(`inboundRequests/${ID}/introductions/${sha(NORTH.email)}`))
      .toMatchObject({ estimateAtAccept: { chargeModel: "subscription", estimate: { lowUsd: 9000, highUsd: 12000 } } });
    state.docs.set(answerKey, { ...north(), details: { chargeModel: "subscription", estimate: { lowUsd: 15000, highUsd: 15000 } } });
    expect(await entryA()).toMatchObject({ acceptedEstimate: { chargeModel: "subscription", estimate: { lowUsd: 9000, highUsd: 12000 } },
      details: { estimate: { lowUsd: 15000, highUsd: 15000 } } });
  });

  it("is null when the answer gave none, and not recorded for an answer under a line that shows no estimate", async () => {
    expect((await press("A")).status).toBe(200);
    expect(state.docs.get(`inboundRequests/${ID}/introductions/${sha(NORTH.email)}`)).toMatchObject({ estimateAtAccept: null });
    expect(await entryA()).toMatchObject({ acceptedEstimate: null });
    state.docs.set(answerKey, { ...north(), statementVersion: "company-response-2026-11-23" });
    expect(await entryA()).not.toHaveProperty("acceptedEstimate");
  });
});

// A review of PR #1437: the site's page shows what companies read of its words only while companies can see the job,
// so no paid pass runs over the site's words that no company reads.
describe("what companies read of the site's words, on the site's page", () => {
  afterEach(async () => (await import("../utils/freeTextScreening")).resetFreeTextScreeningForTests());

  it("makes no model pass over the site's words while no company can see the job, and shows them once one can", async () => {
    const { resetFreeTextScreeningForTests, useFreeTextRedactor } = await import("../utils/freeTextScreening");
    resetFreeTextScreeningForTests();
    let siteCalls = 0;
    useFreeTextRedactor(async ({ writer }) => { if (writer === "site") siteCalls++; return []; });
    const job = state.docs.get(`inboundRequests/${ID}`) as Record<string, unknown>;
    state.docs.set(`inboundRequests/${ID}`, { ...job, operator_listing_hold: { held: true, atIso: "2026-11-24T00:00:00.000Z", by: "ops" } });
    const held = (await siteStatus()).body as { companyStatus?: Record<string, unknown> };
    expect(held.companyStatus ?? {}).not.toHaveProperty("companiesRead");
    expect(siteCalls).toBe(0);
    state.docs.set(`inboundRequests/${ID}`, job);
    const listed = (await siteStatus()).body as { companyStatus: { companiesRead?: Record<string, unknown> } };
    expect(listed.companyStatus.companiesRead).toMatchObject({ sentence: { text: "Stack cartons onto the pallet" } });
    expect(siteCalls).toBeGreaterThan(0);
  });
});

describe("the site is never charged", () => {
  it("writes only the job, its introduction, the event and the two emails: no payment record of any kind", async () => {
    const before = new Map(state.docs);
    expect((await press("A")).status).toBe(200);
    const written = [...state.docs.entries()].filter(([key, value]) => before.get(key) !== value).map(([key]) => key);
    const collections = new Set(written.map(key => key.split("/").filter((_, index) => index % 2 === 0).join("/")));
    expect([...collections].sort()).toEqual(["billableEvents", "captureOutbox", "inboundRequests", "inboundRequests/introductions"]);
    expect(outboxRows().filter(row => String(row.kind).startsWith("introduction_made")).map(row => row.kind).sort())
      .toEqual(["introduction_made_company", "introduction_made_site"]);
  });

  it("gives neither side a price, a fee or the billable event in what it reads", async () => {
    expect((await press("A")).status).toBe(200);
    const payloads: Array<[string, unknown]> = [["the site's job page", (await siteStatus()).body]];
    for (const record of [NORTH, SOUTH]) {
      payloads.push([`${record.company}'s job page`, (await companyRead(record, `/api/site-worlds/jobs/${ID}`)).body]);
      payloads.push([`${record.company}'s library`, (await companyRead(record, "/api/site-worlds/tasks")).body]);
    }
    // The one price-shaped key allowed: whether the pilot figure the site itself typed is its offer or its target budget
    // (`taskListingDetails.ts`). It is the site's own number for its deal with a company, never a Blueprint price.
    const SITES_OWN_PILOT_FIGURE = /\.pilotPriceStatus$/;
    for (const [label, payload] of payloads) {
      expect(payloadPriceFindings(payload).filter(finding => !SITES_OWN_PILOT_FIGURE.test(finding)), label).toEqual([]);
      expect(JSON.stringify(payload), label).not.toMatch(/billable|recorded_no_price|introduction-req-money/i);
    }
  });
});

describe("only the site's own route reaches the billable event (source)", () => {
  const ROOT = path.resolve(import.meta.dirname, "../..");
  const sources = (dir: string): string[] => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? (entry.name === "tests" ? [] : sources(`${dir}/${entry.name}`))
      : /\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name) ? [`${dir}/${entry.name}`] : []);
  const files = [...sources("server"), ...sources("client/src")];
  const calling = (pattern: RegExp) => files.filter(file => pattern.test(fs.readFileSync(path.join(ROOT, file), "utf8"))).sort();

  it("calls requestIntroduction from the site's owner-link route only", () => {
    expect(calling(/\brequestIntroduction\s*\(/)).toEqual(["server/routes/site-task-brief.ts", "server/utils/jobIntroductions.ts"]);
  });

  it("creates an event only inside requestIntroduction, and changes one only to void it or to record when it was made", () => {
    expect(calling(/\bwriteIntroductionBillableEvent\s*\(/)).toEqual(["server/utils/billableEvents.ts", "server/utils/jobIntroductions.ts"]);
    // Everything that names the event store: the module itself, the dispatch checks that void an event, and the
    // admin console's reads.
    expect(calling(/BILLABLE_EVENTS_COLLECTION|billableEventRef|collection\(\s*["']billableEvents["']/)).toEqual([
      "server/utils/billableEvents.ts", "server/utils/jobIntroductionGate.ts", "server/utils/jobIntroductions.ts"]);
    const gate = fs.readFileSync(path.join(ROOT, "server/utils/jobIntroductionGate.ts"), "utf8");
    const eventWrites = [...gate.matchAll(/write\.set\(eventRef, ([^;]+);/g)].map(match => match[1]);
    expect(eventWrites.length).toBeGreaterThan(0);
    for (const write of eventWrites) expect(write).toMatch(
      /^\{ status: "void", voidedAtIso: atIso, voidReason: reason \}, \{ merge: true \}\)$|^\{ madeAtIso: new Date\(\)\.toISOString\(\) \}, \{ merge: true \}\)$/);
    expect(gate).not.toMatch(/eventRef\)?\.delete|delete\(eventRef/);
  });
});
