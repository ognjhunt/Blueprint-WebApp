// @vitest-environment node
/**
 * Pilot offers (owner, 2026-11-28), OFFLINE: the real company routes (the offer, the job page, Confirm, the answer), the
 * real site routes (the status read, "Request this pilot", Accept) and the outbox's dispatch check, against the fake
 * Firestore; no email is delivered.
 *
 * What this pins:
 * - only an approved deployment company under the current Terms saves an offer, a malformed offer is refused by name,
 *   and a paused offer is never shown to a site;
 * - a site sees an offer that fits on paper with the company's name, website and terms, an opaque `offerRef` and nothing
 *   else of the company (no id, no contact details);
 * - the site's press works from the owner link only, is refused on a withdrawn job, records the introduction sentence's
 *   version, and a second press changes nothing;
 * - the company's Confirm is an Apply recorded under the response line, then the introduction, made once with one
 *   billable event; a refused introduction leaves an ordinary application the site can accept;
 * - the company's email carries no figure and the one-use job link, and its dispatch check cancels it once the request is
 *   gone or the job is not listed;
 * - the pilot sheet appears only once the introduction is made, with the site's own words and the terms as of the request.
 */
import express from "express";
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestore, sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { currentTermsAcceptance, passedPrivacyScreen, sharedCompanyClip, sharedJobListing, sharedRecordingGrant } from "./helpers/sharedJob";
import { INTRODUCTION_REQUEST_STATEMENT_2026_11_12_VERSION, INTRODUCTION_REQUEST_STATEMENT_VERSION } from "../../client/src/lib/siteIntroductions";
import { COMPANY_RESPONSE_STATEMENT_VERSION } from "../../client/src/lib/companyResponses";
import { PILOT_OFFER_STATEMENT_VERSION } from "../../client/src/lib/pilotOffers";

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
const { payloadPriceFindings, priceFindings } = await import("../../scripts/qa/price-statements");
const { pilotRequestEmailIsCurrent, pilotRequestEmailKey } = await import("../utils/pilotOffers");
const { companyStateOf } = await import("../utils/companyJobPage");

const ID = "req-pilot";
const CAPTURE = `walkthrough-${ID}`;
const sha = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
const SITE = { email: "owner@site-pilot.example", address: "77 QUOKKA Lane, Austin" };
const V6 = { ...sharedRecordingGrant(), statement_version: "2026-11-23.v6" };

function company(tag: string, extra: Record<string, unknown> = {}) {
  return { partnerRole: "deployment", termsAcceptance: currentTermsAcceptance(), termsAcceptedByUid: `uid-contact@${tag.toLowerCase()}.example`,
    name: `Person ${tag}`, email: `contact@${tag.toLowerCase()}.example`, company: `${tag} Robotics`, website: `https://${tag.toLowerCase()}.example`,
    status: "approved", newJobAlertsOptIn: false, appliedAtIso: "2026-11-01T00:00:00.000Z", updatedAtIso: "2026-11-01T00:00:00.000Z",
    decidedAtIso: "2026-11-02T00:00:00.000Z", decidedBy: "ops", decisionNote: null, ...extra };
}
const NORTH = company("North");
const SOUTH = company("South");
const PENDING = company("Pending", { status: "applied" });
const NO_TERMS = company("Oldterms", { termsAcceptance: null, termsAcceptedByUid: null });

const OFFER = {
  published: true, kinds: ["palletizing", "pick_and_place"],
  limits: { maxKg: 25, maxSide: null, minHours: null, states: ["TX"] },
  terms: { weeks: 6, sitePays: { kind: "once", low: 5000, high: 8000 }, siteProvides: ["floor_space", "power"],
    earliestStart: "within_month", afterPilot: "per_task" },
  statementVersion: PILOT_OFFER_STATEMENT_VERSION,
};

let server: Server;
let base = "";
function signIn(record: { email: string }) {
  const token = `token-${record.email}`;
  seams.tokens.set(token, { uid: `uid-${record.email}`, email: record.email });
  return { Authorization: `Bearer ${token}` };
}
const CSRF = { "content-type": "application/json", cookie: "csrf_token=p-test", "x-csrf-token": "p-test" };
async function call(method: string, url: string, body?: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(`${base}${url}`, { method, headers: { ...CSRF, ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const raw = await response.text();
  return { status: response.status, raw, body: JSON.parse(raw) as Record<string, any> };
}
const putOffer = (record: { email: string }, offer: unknown = OFFER) => call("PUT", "/api/site-worlds/pilot-offer", offer, signIn(record));
const token = (scope: "owner" | "film" = "owner") => createCaptureUploadToken({ requestId: ID, captureId: CAPTURE, sceneId: `site-${ID}`, scope });
async function siteStatus() {
  const result = await call("GET", `/api/site-task-brief/${token()}/status`);
  expect(result.status, result.raw).toBe(200);
  return result;
}
const sitePilot = async () => (await siteStatus()).body.companyStatus?.pilotOffers as { offers: Array<Record<string, any>>; introductionStatementVersion: string } | undefined;
async function requestPilot(offerRef: string, options: { scope?: "owner" | "film"; statementVersion?: string } = {}) {
  return call("POST", `/api/site-task-brief/${token(options.scope)}/pilot-requests`, { offerRef,
    statementVersion: options.statementVersion ?? INTRODUCTION_REQUEST_STATEMENT_VERSION });
}
const confirm = (record: { email: string }) => call("POST", `/api/site-worlds/jobs/${ID}/pilot-request`,
  { decision: "confirm", statementVersion: COMPANY_RESPONSE_STATEMENT_VERSION }, signIn(record));
const companyPage = async (record: { email: string }) => (await call("GET", `/api/site-worlds/jobs/${ID}`, undefined, signIn(record))).body.item;
const docsUnder = (prefix: string) => [...state.docs.entries()].filter(([key]) => key.startsWith(prefix))
  .map(([key, value]) => ({ key, ...(value as Record<string, any>) }));
const jobDoc = () => state.docs.get(`inboundRequests/${ID}`) as Record<string, any>;
/** The company's introduction email is sent: the introduction is made (`jobIntroductionGate.ts`). */
function markIntroductionSent(record: { email: string }) {
  const key = `captureOutbox/${ID}:introduction_made_company:${sha(record.email)}`;
  state.docs.set(key, { ...(state.docs.get(key) as Record<string, unknown>), status: "sent", sentAtIso: "2026-11-28T12:00:00.000Z" });
}

beforeEach(async () => {
  state.docs.clear();
  seams.tokens.clear();
  vi.stubEnv("FIELD_ENCRYPTION_MASTER_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("FIELD_ENCRYPTION_KMS_KEY_NAME", "");
  state.docs.set(`captureUploadSessions/${CAPTURE}`, { company_clip: sharedCompanyClip(CAPTURE) });
  state.docs.set(`siteTaskBriefs/${ID}`, { requestId: ID, summary: "Stack cartons onto the pallet", confirmedAtIso: null,
    successCriteria: { successDefinition: "Every carton is on the pallet, square." } });
  // A job from the start form: no name of its own and no person's, so the current introduction sentence is true for it.
  state.docs.set(`inboundRequests/${ID}`, {
    requestId: ID,
    contact: { email: `encrypted:${SITE.email}` },
    request: { buyerType: "site_operator", capture_mode: "self_capture", siteLocation: `encrypted:${SITE.address}`,
      siteLocationMetadata: { country: "encrypted:US", state: "encrypted:Texas", city: "encrypted:Austin" }, consent_attestation: V6 },
    public_task_listing: sharedJobListing("Stack cartons onto the pallet"),
    capture_privacy_screen: passedPrivacyScreen(ID),
    job_facts: { weight: "5_15kg", hours: "two_shifts", updatedAtIso: "2026-11-28T00:00:00.000Z" },
  });
  for (const record of [NORTH, SOUTH, PENDING, NO_TERMS]) state.docs.set(`robotTeamAccess/${sha(record.email)}`, record);
  const app = express();
  app.use(express.json());
  app.use("/api/site-task-brief", briefRouter);
  app.use("/api/site-worlds", worldsRouter);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
});

describe("a company's pilot offer", () => {
  it("is saved and read back by an approved deployment company under the current Terms", async () => {
    const saved = await putOffer(NORTH);
    expect(saved.status, saved.raw).toBe(200);
    const stored = state.docs.get(`pilotOffers/${sha(NORTH.email)}`) as Record<string, any>;
    expect(stored).toMatchObject({ schemaVersion: 1, companyId: sha(NORTH.email), published: true, kinds: OFFER.kinds,
      statementVersion: PILOT_OFFER_STATEMENT_VERSION, acceptedByUid: `uid-${NORTH.email}` });
    // The name, website and contact details are read from the company's record when shown, never copied.
    for (const field of ["company", "website", "email", "name"]) expect(stored).not.toHaveProperty(field);
    expect(JSON.stringify(stored)).not.toMatch(/North Robotics|https:\/\/north\.example/);
    const read = await call("GET", "/api/site-worlds/pilot-offer", undefined, signIn(NORTH));
    expect(read.body.offer).toMatchObject({ published: true, terms: OFFER.terms, limits: OFFER.limits });
    expect(read.body.statement.version).toBe(PILOT_OFFER_STATEMENT_VERSION);
  });

  it("refuses a malformed offer by name, and any company not approved or without the current Terms", async () => {
    expect((await putOffer(NORTH, { ...OFFER, kinds: [] })).body.error).toBe("Choose at least one kind of job you take.");
    expect((await putOffer(NORTH, { ...OFFER, terms: { ...OFFER.terms, weeks: 40 } })).status).toBe(400);
    expect((await putOffer(NORTH, { ...OFFER, statementVersion: "pilot-offer-old" })).status).toBe(400);
    expect((await putOffer(NORTH, { ...OFFER, contactEmail: "x@y.example" })).status).toBe(400);
    expect((await putOffer(NORTH, { ...OFFER, terms: { ...OFFER.terms, sitePays: { kind: "once", low: 9000, high: 100 } } })).status).toBe(400);
    expect((await putOffer(PENDING)).status).toBe(403);
    const terms = await putOffer(NO_TERMS);
    expect(terms.status).toBe(403);
    expect(terms.body.code).toBe("terms_acceptance_required");
    expect(docsUnder("pilotOffers/")).toEqual([]);
  });
});

describe("the offers a site sees", () => {
  it("shows an offer that fits with the company's name, website and terms, an opaque reference and nothing else", async () => {
    await putOffer(NORTH);
    const pilot = await sitePilot();
    expect(pilot?.offers).toHaveLength(1);
    const [offer] = pilot!.offers;
    expect(offer.offerRef).toMatch(/^p-[a-f0-9]{32}$/);
    expect(offer.company).toEqual({ name: "North Robotics", website: "https://north.example" });
    expect(offer.offer.terms).toEqual(OFFER.terms);
    expect(offer.unknown).toEqual([]);
    expect(pilot!.introductionStatementVersion).toBe(INTRODUCTION_REQUEST_STATEMENT_VERSION);
    const raw = JSON.stringify(pilot);
    for (const hidden of [sha(NORTH.email), NORTH.email, NORTH.name, "north.example/"]) expect(raw).not.toContain(hidden);
    expect(Object.keys(offer).sort()).toEqual(["company", "offer", "offerRef", "unknown"]);
  });

  it("never shows a paused offer, one that does not fit, or one of a company that lost its approval or its Terms", async () => {
    await putOffer(NORTH, { ...OFFER, published: false });
    await putOffer(SOUTH, { ...OFFER, limits: { ...OFFER.limits, states: ["CA"] } });
    expect((await sitePilot())?.offers).toEqual([]);
    await putOffer(NORTH);
    state.docs.set(`robotTeamAccess/${sha(NORTH.email)}`, { ...NORTH, termsAcceptance: null });
    expect((await sitePilot())?.offers).toEqual([]);
  });

  it("is not in the status at all while the job is not listed", async () => {
    await putOffer(NORTH);
    state.docs.set(`inboundRequests/${ID}`, { ...jobDoc(), operator_listing_hold: { held: true, atIso: "2026-11-28T00:00:00.000Z", by: "ops" } });
    expect((await siteStatus()).body.companyStatus ?? {}).not.toHaveProperty("pilotOffers");
  });

  it("reads the job's US state only under the statement that shares it", async () => {
    expect(await companyStateOf(jobDoc())).toBe("TX");
    expect(await companyStateOf({ ...jobDoc(), request: { ...jobDoc().request, consent_attestation: sharedRecordingGrant() } })).toBeNull();
    expect(await companyStateOf({ ...jobDoc(), request: { ...jobDoc().request, siteLocationMetadata: { country: "encrypted:CA",
      state: "encrypted:Texas" } } })).toBeNull();
  });
});

describe("the site's request", () => {
  it("works from the owner link only, records the sentence's version, queues one email, and a second press changes nothing", async () => {
    await putOffer(NORTH);
    const [offer] = (await sitePilot())!.offers;
    expect((await requestPilot(offer.offerRef, { scope: "film" })).status).toBe(403);
    expect(docsUnder(`inboundRequests/${ID}/pilotRequests/`)).toEqual([]);
    const first = await requestPilot(offer.offerRef);
    expect(first.status, first.raw).toBe(200);
    const [stored] = docsUnder(`inboundRequests/${ID}/pilotRequests/`);
    expect(stored).toMatchObject({ key: `inboundRequests/${ID}/pilotRequests/${sha(NORTH.email)}`, state: "requested",
      introductionStatementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION, offerSnapshot: { terms: OFFER.terms } });
    const second = await requestPilot(offer.offerRef);
    expect(second.body.requestedAtIso).toBe(first.body.requestedAtIso);
    expect(docsUnder("captureOutbox/").filter(row => row.kind === "pilot_requested_company")).toHaveLength(1);
    expect((await sitePilot())!.offers[0].request).toMatchObject({ state: "requested", requestedAtIso: first.body.requestedAtIso });
  });

  it("refuses a sentence that is not this job's, an unknown offer, and a withdrawn job", async () => {
    await putOffer(NORTH);
    const [offer] = (await sitePilot())!.offers;
    const stale = await requestPilot(offer.offerRef, { statementVersion: INTRODUCTION_REQUEST_STATEMENT_2026_11_12_VERSION });
    expect(stale.body).toMatchObject({ reason: "statement_not_current", statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION });
    expect((await requestPilot(`p-${"0".repeat(32)}`)).body.reason).toBe("offer_unavailable");
    state.docs.set(`inboundRequests/${ID}`, { ...jobDoc(), request: { ...jobDoc().request,
      consent_attestation: { ...V6, withdrawn_at_iso: "2026-11-28T01:00:00.000Z" } } });
    const withdrawn = await requestPilot(offer.offerRef);
    expect(withdrawn.status).toBe(409);
    expect(docsUnder(`inboundRequests/${ID}/pilotRequests/`)).toEqual([]);
    expect(docsUnder("captureOutbox/")).toEqual([]);
  });

  it("emails the company the one-use job link and no figure; the dispatch check cancels it once the request is gone or the job is not listed", async () => {
    await putOffer(NORTH);
    await requestPilot((await sitePilot())!.offers[0].offerRef);
    const [row] = docsUnder("captureOutbox/").filter(entry => entry.kind === "pilot_requested_company");
    expect(row).toMatchObject({ to: NORTH.email, subject: "A site asked for your pilot", status: "pending",
      idempotencyKey: pilotRequestEmailKey(ID, sha(NORTH.email)) });
    expect(row.body).toContain(`/jobs/${ID}?link=`);
    expect(priceFindings(`${row.subject}\n${row.body}`)).toEqual([]);
    expect(row.body).not.toMatch(/5,000|8,000|\d+ weeks|Austin|Texas|owner@/);
    const current = () => sharedFakeFirestore.runTransaction(tx => pilotRequestEmailIsCurrent(row as never, tx as never));
    expect(await current()).toBe(true);
    const job = jobDoc();
    state.docs.set(`inboundRequests/${ID}`, { ...job, operator_listing_hold: { held: true, atIso: "2026-11-28T00:00:00.000Z", by: "ops" } });
    expect(await current()).toBe(false);
    state.docs.set(`inboundRequests/${ID}`, job);
    state.docs.delete(`inboundRequests/${ID}/pilotRequests/${sha(NORTH.email)}`);
    expect(await current()).toBe(false);
  });
});

describe("the company's Confirm", () => {
  it("records an Apply under the response line, then makes the introduction once, with one billable event", async () => {
    await putOffer(NORTH);
    await requestPilot((await sitePilot())!.offers[0].offerRef);
    const page = await companyPage(NORTH);
    expect(page.pilotRequest).toMatchObject({ state: "requested", terms: OFFER.terms });
    expect(JSON.stringify(page.pilotRequest)).not.toMatch(/Austin|QUOKKA|owner@/);
    const result = await confirm(NORTH);
    expect(result.body, result.raw).toMatchObject({ ok: true, introduced: true });
    expect(state.docs.get(`inboundRequests/${ID}/robotTeamInterest/${sha(NORTH.email)}`)).toMatchObject({ state: "interested",
      recordedBy: "company", statementVersion: COMPANY_RESPONSE_STATEMENT_VERSION,
      details: { startWindow: "within_month", chargeModel: "per_task" } });
    expect(docsUnder(`inboundRequests/${ID}/introductions/`)).toHaveLength(1);
    expect(docsUnder("billableEvents/")).toHaveLength(1);
    expect(docsUnder(`inboundRequests/${ID}/introductions/`)[0]).toMatchObject({ statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION, by: "site" });
    // A second press: nothing new.
    expect((await confirm(NORTH)).body).toMatchObject({ ok: true });
    expect(docsUnder("billableEvents/")).toHaveLength(1);
    expect(docsUnder(`inboundRequests/${ID}/pilotRequests/`)[0]).toMatchObject({ state: "confirmed" });
  });

  it("is refused when the site did not ask: the company applies through the form instead", async () => {
    await putOffer(NORTH);
    const result = await confirm(NORTH);
    expect(result.status).toBe(409);
    expect(docsUnder(`inboundRequests/${ID}/robotTeamInterest/`)).toEqual([]);
    expect(docsUnder("billableEvents/")).toEqual([]);
  });

  it("leaves an ordinary application the site can accept when the introduction is refused", async () => {
    await putOffer(NORTH);
    await requestPilot((await sitePilot())!.offers[0].offerRef);
    // The site's details changed after its press: the sentence it agreed to is no longer the one true for the job.
    const key = `inboundRequests/${ID}/pilotRequests/${sha(NORTH.email)}`;
    state.docs.set(key, { ...(state.docs.get(key) as Record<string, unknown>), introductionStatementVersion: INTRODUCTION_REQUEST_STATEMENT_2026_11_12_VERSION });
    const result = await confirm(NORTH);
    expect(result.body).toMatchObject({ ok: true, introduced: false, refusal: "statement_not_current" });
    expect(state.docs.get(key)).toMatchObject({ state: "refused", refusal: "statement_not_current" });
    expect(docsUnder("billableEvents/")).toEqual([]);
    expect(state.docs.get(`inboundRequests/${ID}/robotTeamInterest/${sha(NORTH.email)}`)).toMatchObject({ state: "interested" });
    const status = (await siteStatus()).body;
    const entry = status.companyStatus.companies.entries.find((row: Record<string, unknown>) => row.kind === "answered");
    expect(entry).toMatchObject({ state: "interested", canIntroduce: true, applicant: { name: "North Robotics" } });
    expect(status.companyStatus.pilotOffers.offers[0].request.state).toBe("refused");
    expect((await companyPage(NORTH)).pilotRequest).toMatchObject({ state: "refused", refusal: "statement_not_current" });
  });

  it("reads Need more details and Not a fit, given through the ordinary form, as the request's question and decline", async () => {
    await putOffer(NORTH);
    await requestPilot((await sitePilot())!.offers[0].offerRef);
    const answer = (state: string, inputs: string) => call("POST", `/api/site-worlds/tasks/${ID}/interest`,
      { state, inputs, statementVersion: COMPANY_RESPONSE_STATEMENT_VERSION }, signIn(NORTH));
    expect((await answer("needs_something", "Which pallet size?")).status).toBe(200);
    expect((await sitePilot())!.offers[0].request.state).toBe("question");
    expect((await answer("declined", "")).status).toBe(200);
    expect((await sitePilot())!.offers[0].request.state).toBe("declined");
    expect((await companyPage(NORTH)).pilotRequest.state).toBe("declined");
  });
});

describe("the pilot sheet", () => {
  it("appears on both pages only once the introduction is made, with the site's own words and the terms as of the request", async () => {
    await putOffer(NORTH);
    await requestPilot((await sitePilot())!.offers[0].offerRef);
    // The company changes its offer after the site asked: the sheet keeps the terms the site asked for.
    await putOffer(NORTH, { ...OFFER, terms: { ...OFFER.terms, weeks: 12 } });
    await confirm(NORTH);
    expect((await sitePilot())!.offers[0].request).not.toHaveProperty("sheet");
    expect(await companyPage(NORTH)).not.toHaveProperty("pilotSheet");
    markIntroductionSent(NORTH);
    const sheet = (await sitePilot())!.offers[0].request.sheet;
    expect(sheet).toMatchObject({ sentence: "Stack cartons onto the pallet", done: "Every carton is on the pallet, square.",
      terms: { ...OFFER.terms, weeks: 6 } });
    const companySheet = (await companyPage(NORTH)).pilotSheet;
    expect(companySheet).toMatchObject({ terms: { weeks: 6 } });
  });

  it("adds no price-shaped key or billable word to either side's payload", async () => {
    await putOffer(NORTH);
    await requestPilot((await sitePilot())!.offers[0].offerRef);
    await confirm(NORTH);
    markIntroductionSent(NORTH);
    // The one key allowed is the application's own `details.chargeModel`, which an Apply has carried since 2026-11-23 (the
    // Confirm's Apply fills it from the offer's "after a pilot"); every key the pilot offer adds passes the guard.
    const APPLICATIONS_OWN_KEY = /\.entries\[\d+\]\.details\.chargeModel$|\.myAnswer\.details\.chargeModel$/;
    for (const [label, payload] of [["site", (await siteStatus()).body], ["company", await companyPage(NORTH)]] as const) {
      expect(payloadPriceFindings(payload).filter(finding => !APPLICATIONS_OWN_KEY.test(finding)), label).toEqual([]);
      expect(JSON.stringify(payload), label).not.toMatch(/billable|recorded_no_price/i);
    }
  });
});
