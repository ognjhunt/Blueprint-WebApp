// @vitest-environment node
/**
 * Sends and responses (package C1): a site's job is sent to every approved deployment company automatically and each
 * company answers on the job's page (staff no longer record a send or an answer by hand, 2026-11-22); the site sees, on its job page and in two emails, only an alias, dates, one of three
 * fixed labels and Blueprint's own sentence. OFFLINE: the real admin routes, the real company response route, the real
 * owner status read and the real outbox against the fake Firestore; email delivery, Slack and sign-in are fakes.
 *
 * What this pins:
 * - nothing the site receives (its status payload, either email) carries a company's name, email, website, the id
 *   derived from its email or its own words: distinctive strings are planted in every company field;
 * - the operator hold closes the library card and the response route and flips the site's sentence;
 * - a voided send recorded before is not shown; a withdrawn job shows nothing and sends nothing.
 */
import { sharedCompanyClip } from "./helpers/sharedJob";
import express from "express";
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestore, sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { anonymizedOpportunityDraft } from "../../client/src/types/taskBrowse";
import { currentTermsAcceptance, sharedJobFields } from "./helpers/sharedJob";
import { COMPANY_RESPONSE_STATEMENT_VERSION } from "../../client/src/lib/companyResponses";
import { INTRODUCTION_REQUEST_STATEMENT_VERSION } from "../../client/src/lib/siteIntroductions";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore, authAdmin: null, storageAdmin: null };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/field-encryption", async importOriginal => ({ ...await importOriginal<typeof import("../utils/field-encryption")>(),
  decryptFieldValue: vi.fn(async (value: string) => String(value).replace(/^encrypted:/, "")) }));
vi.mock("../utils/access-control", () => ({
  hasAnyRole: async (res: express.Response) => res.locals.firebaseUser?.admin === true,
}));
const seams = vi.hoisted(() => ({
  company: { uid: "company-user", email: "", email_verified: true } as Record<string, unknown>,
  sendEmail: vi.fn(async (_message: Record<string, unknown>) => ({ sent: true, provider: "resend", messageId: "accepted" })),
  slack: vi.fn(async (_text: string) => ({ sent: true })),
}));
vi.mock("../middleware/verifyFirebaseToken", () => ({ default: (_req: unknown, res: { locals: Record<string, unknown> }, next: () => void) => {
  res.locals.firebaseUser = seams.company; next();
} }));
vi.mock("../utils/email", () => ({ sendEmail: seams.sendEmail }));
// The video is saved (the storage read is out of scope here); the job page's status follows it.
vi.mock("../utils/siteWalkthrough", async importOriginal => ({ ...await importOriginal<typeof import("../utils/siteWalkthrough")>(),
  savedWalkthrough: vi.fn(async () => ({ upload: { captureReceived: true, uploadState: "processing_ready" }, received: true, uploadState: "processing_ready" })) }));
vi.mock("../utils/slack", async importOriginal => ({ ...await importOriginal<typeof import("../utils/slack")>(), sendSlackMessage: seams.slack }));

const { default: adminRouter } = await import("../routes/admin-job-console");
const { default: worldsRouter } = await import("../routes/site-worlds");
const { default: briefRouter } = await import("../routes/site-task-brief");
const { createCaptureUploadToken } = await import("../utils/captureUploadToken");
const { deliverOutbox } = await import("../utils/captureOutbox");
const { projectTaskBrowseCard } = await import("../utils/taskBrowse");
const { projectSiteCompanyActivity, setJobCompaniesPageSizeForTests } = await import("../utils/jobCompanies");
const { sendJobToApprovedCompanies } = await import("../utils/jobAutoSend");
/** The job goes to every approved deployment company that accepted the Terms (here North and South), once. */
const sendToCompanies = () => sendJobToApprovedCompanies(ID);

const ID = "req-c1";
let server: Server;
let base = "";

/* ----------------------------------------------------------------- planted company records */

const sha = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
/** Every field a company record has, each a string that must never reach the site. */
function companyRecord(tag: string, extra: Record<string, unknown> = {}) {
  return {
    // Approved companies here have accepted the current Terms (planner, 18:50Z).
    termsAcceptance: currentTermsAcceptance(), termsAcceptedByUid: `uid-${tag}`,
    partnerRole: "deployment", supportedSystems: `SYSTEMS-${tag}-PLANT`, name: `Person ${tag}plant`,
    email: `contact-${tag.toLowerCase()}@${tag.toLowerCase()}-plant.example`, company: `${tag}PLANT Robotics`,
    website: `https://www.${tag.toLowerCase()}-plant.example/about`, robot: `ROBOT-${tag}-PLANT`, workWanted: `WORK-${tag}-PLANT`,
    region: `REGION-${tag}-PLANT`, status: "approved", appliedAtIso: "2026-11-01T00:00:00.000Z",
    updatedAtIso: "2026-11-01T00:00:00.000Z", decidedAtIso: "2026-11-02T00:00:00.000Z", decidedBy: "ops", decisionNote: `NOTE-${tag}-PLANT`,
    ...extra,
  };
}
const NORTH = companyRecord("NORTHX");
const SOUTH = companyRecord("SOUTHX");
const TECH = companyRecord("TECHX", { partnerRole: "technology" });
const PENDING = companyRecord("PENDX", { status: "applied" });
/** The companies' words, each naming the company and its contact details: the site reads them only with those taken out. */
const WORDS = { north: "NORTHXPLANT Robotics would need a second gripper; ask Person NORTHXplant.",
  south: "SOUTHXPLANT Robotics: our UR20 palletizes this today. Write to contact-southx@southx-plant.example or www.southx-plant.example/about." };
/** The words as the site reads them (2026-11-20). */
const SOUTH_REASON = "The company: our UR20 palletizes this today. Write to [removed] or [removed].";
const NORTH_REASON = "The company would need a second gripper; ask the company.";
const PLANTED = [
  ...[NORTH, SOUTH].flatMap(record => [record.company, record.email, record.website, record.name, record.robot, record.workWanted,
    record.supportedSystems, record.region, record.decisionNote, sha(record.email),
    record.website.replace(/^https:\/\/www\./, "").replace(/\/.*$/, "")]),
  WORDS.north, WORDS.south, "NORTHX", "SOUTHX",
];

function job(extra: Record<string, unknown> = {}) {
  return {
    requestId: ID,
    contact: { email: "encrypted:owner@site.example" },
    ...sharedJobFields(ID, { capture_mode: "self_capture" }),
    capture_coverage: { covers_scene: true },
    walkthrough_job_estimates: { capture_id: `walkthrough-${ID}`, job_estimates: {
      object: "carton", object_largest_side_m: 0.4, object_mass_kg_low: 8, object_mass_kg_high: 11, object_surface: "matte",
      pick_to_place_m: 1.6, pick_height_m: null, place_height_m: null, front_clearance_m: 1.5,
      other_items_likely: [], cycle_seconds: null, basis: "A person stacks cartons onto a pallet." } },
    ...extra,
  };
}
const jobDoc = () => state.docs.get(`inboundRequests/${ID}`) as Record<string, any>;
const patchJob = (patch: Record<string, unknown>) => state.docs.set(`inboundRequests/${ID}`, { ...jobDoc(), ...patch });

/* ----------------------------------------------------------------- calls */

const admin = { Authorization: "Bearer admin", "content-type": "application/json" };
const adminPost = async (path: string, body: unknown, headers: Record<string, string> = admin) => {
  const response = await fetch(`${base}/api/admin/jobs/${ID}/companies${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() as Record<string, any> };
};
const panel = async () => (await fetch(`${base}/api/admin/jobs/${ID}/companies`, { headers: admin })).json() as Promise<Record<string, any>>;
async function companyAnswers(record: typeof NORTH, body: Record<string, unknown>) {
  seams.company = { uid: `uid-${record.email}`, email: record.email, email_verified: true };
  const response = await fetch(`${base}/api/site-worlds/tasks/${ID}/interest`, { method: "POST",
    body: JSON.stringify({ statementVersion: COMPANY_RESPONSE_STATEMENT_VERSION, ...body }),
    headers: { "content-type": "application/json", cookie: "csrf_token=c1-test", "x-csrf-token": "c1-test" } });
  return { status: response.status, body: await response.json() as Record<string, any> };
}
/** The owner's status read, exactly as the site's job page receives it. */
async function siteStatus(): Promise<{ raw: string; body: Record<string, any> }> {
  const token = createCaptureUploadToken({ requestId: ID, captureId: `walkthrough-${ID}`, sceneId: `site-${ID}`, scope: "owner" });
  const response = await fetch(`${base}/api/site-task-brief/${token}/status`);
  const raw = await response.text();
  expect(response.status).toBe(200);
  return { raw, body: JSON.parse(raw) };
}
const outbox = () => [...state.docs.entries()].filter(([key]) => key.startsWith("captureOutbox/"))
  .map(([key, value]) => ({ key, ...(value as { kind: string; status: string; subject: string; body: string }) }));
/** Emails to the site only: the automatic send also emails each company that asked for job emails. */
const sent = () => seams.sendEmail.mock.calls.map(([message]) => message as { subject: string; text?: string; body?: string; to: string })
  .filter(message => message.to.includes("owner@site.example"));
/** Every byte of every email the site was sent, and every row queued for it. */
const siteEmailText = () => JSON.stringify([sent(), outbox().filter(row => !row.key.startsWith("captureOutbox/robot_team_new_task:"))]);
const expectNoCompanyIn = (label: string, text: string) => {
  for (const planted of PLANTED) expect(text.toLowerCase(), `${label} contains ${planted}`).not.toContain(planted.toLowerCase());
};

beforeEach(async () => {
  state.docs.clear();
  seams.sendEmail.mockClear();
  seams.slack.mockClear();
  vi.stubEnv("SLACK_INBOUND_WEBHOOK_URL", "https://hooks.slack.invalid/test");
  state.docs.set(`siteTaskBriefs/${ID}`, { requestId: ID, summary: "Stack cartons onto the pallet", confirmedAtIso: null });
  state.docs.set(`inboundRequests/${ID}`, job());
  state.docs.set(`captureUploadSessions/walkthrough-${ID}`, { company_clip: sharedCompanyClip(`walkthrough-${ID}`) });
  for (const record of [NORTH, SOUTH, TECH, PENDING]) state.docs.set(`robotTeamAccess/${sha(record.email)}`, record);
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/admin/")) res.locals.firebaseUser = req.headers.authorization === "Bearer admin"
      ? { uid: "admin-1", email: "ops@tryblueprint.io", admin: true } : { uid: "someone" };
    next();
  });
  app.use("/api/admin/jobs", adminRouter);
  app.use("/api/site-worlds", worldsRouter);
  app.use("/api/site-task-brief", briefRouter);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
afterEach(async () => {
  setJobCompaniesPageSizeForTests(200);
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
});

/* ----------------------------------------------------------------- tests */

describe("the operator's Deployment companies panel", () => {
  it("is for admins only", async () => {
    expect((await fetch(`${base}/api/admin/jobs/${ID}/companies`, { headers: { Authorization: "Bearer user" } })).status).toBe(403);
    expect((await adminPost("/hold", { held: true, reason: "x" }, { Authorization: "Bearer user", "content-type": "application/json" })).status).toBe(403);
    expect(outbox()).toHaveLength(0);
  });

  it("has no route to record a send, void one or record an emailed answer (2026-11-22)", async () => {
    const post = async (path: string, body: unknown) => (await fetch(`${base}/api/admin/jobs/${ID}/companies${path}`,
      { method: "POST", headers: admin, body: JSON.stringify(body) })).status;
    expect(await post("/sends", { companyId: sha(NORTH.email) })).toBe(404);
    expect(await post("/sends/send-1/void", {})).toBe(404);
    expect(await post("/responses", { companyId: sha(NORTH.email), state: "interested", inputs: WORDS.north })).toBe(404);
    expect(companyRows()).toEqual([]);
    expect(outbox()).toHaveLength(0);
  });

  it("says the sharing state, lists approved deployment companies only, and gives the job's library address", async () => {
    const read = await panel();
    expect(read.sharing).toMatchObject({ state: "shared_visible", words: "Shared and visible to approved companies." });
    expect(read.companies.map((row: { id: string }) => row.id).sort()).toEqual([sha(NORTH.email), sha(SOUTH.email)].sort());
    expect(read.libraryUrl).toMatch(new RegExp(`/jobs/${ID}$`));
    expect(read).toMatchObject({ hold: null, consentRevoked: false, sends: [], responses: [] });
  });
});

describe("what the site receives", () => {
  it("tells the site each send and answer by alias, date, label and the company's cleared words only: no company field reaches its page, and no company words its emails", async () => {
    // The job goes to North and South automatically; South, then North, answer on the job's page.
    expect(await sendToCompanies()).toMatchObject({ sent: true, count: 2 });
    expect((await companyAnswers(SOUTH, { state: "needs_something", inputs: WORDS.south })).status).toBe(200);
    expect((await companyAnswers(NORTH, { state: "interested", inputs: WORDS.north })).status).toBe(200);
    await deliverOutbox();

    // The aliases, assigned once, in order of first answer.
    expect(jobDoc().company_aliases).toEqual({ [sha(SOUTH.email)]: "A", [sha(NORTH.email)]: "B" });

    // The site's job page: exactly these fields.
    const { raw, body } = await siteStatus();
    const entries = body.answer.companies.entries as Array<Record<string, unknown>>;
    expect(body.answer.companies.interested).toBe(true);
    expect(Object.keys(body.answer.companies).sort()).toEqual(["entries", "firstAnswerAtIso", "interested", "introductions", "sent"]);
    expect(body.answer.companies.sent).toMatchObject({ count: 2 });
    expect(body.answer.companies.introductions).toEqual({ used: 0 });
    expect(entries.map(entry => Object.keys(entry).sort())).toEqual([
      ["alias", "atIso", "canIntroduce", "kind", "question", "reason", "state"], ["alias", "atIso", "canIntroduce", "kind", "reason", "state"]]);
    // Why: the company's own words, with its name, email and website taken out (2026-11-20).
    expect(entries.map(entry => entry.reason)).toEqual([SOUTH_REASON, NORTH_REASON]);
    // Interested can be introduced; Need more details is not (E6).
    expect(entries.map(entry => entry.canIntroduce)).toEqual([false, true]);
    expect(entries.map(({ kind, alias, state: answer }) => ({ kind, alias, answer }))).toEqual([
      { kind: "answered", alias: "Company A", answer: "needs_something" },
      { kind: "answered", alias: "Company B", answer: "interested" },
    ]);
    expectNoCompanyIn("the site's status payload", raw);

    // The emails: one per company and answer, each by the fixed words. The send itself emails the site nothing: its job
    // link email already said where the job goes (ledger AL38).
    const subjects = sent().map(message => message.subject);
    expect(subjects.sort()).toEqual(["A deployment company answered", "A deployment company answered"]);
    const rows = outbox().filter(row => row.kind === "job_sent" || row.kind === "company_answered");
    expect(entries[0].question).toMatchObject({ id: expect.stringMatching(/^[a-f0-9]{64}$/), text: SOUTH_REASON });
    const questionEvent = "company_answered:A-needs_something";
    expect(rows.map(row => row.key).sort()).toEqual([`captureOutbox/${ID}:company_answered:B-interested`,
      `captureOutbox/${ID}:${questionEvent}`].sort());
    // A sent row no longer holds its body (cleared at send), so each body is read from the email that was sent.
    const { providerIdempotencyKey } = await import("../utils/captureOutboxRetry");
    expect(rows.every(row => row.body === "" && row.to === "" && typeof row.toDigest === "string")).toBe(true);
    const bodyOf = (key: string) => String((seams.sendEmail.mock.calls.map(([message]) => message)
      .find(message => message.idempotencyKey === providerIdempotencyKey(`${ID}:${key}`)) as { text: string }).text)
      .split("\n\n--\n")[0];
    // The company's own "Need more details" carries the question the site answers on its page; North's Interested
    // answer is one the site can ask to be introduced after, so the email says how.
    expect(bodyOf(questionEvent)).toMatch(/^A deployment company needs more details about your job\. Read their question and answer it on your job page\.\n\nOpen your job:\nhttps:\/\/\S+$/);
    expect(bodyOf("company_answered:B-interested")).toMatch(/^A deployment company answered "Interested" about your job\. To meet them, press Introduce us on your job page\.\n\nOpen your job:\n/);
    expect(rows.every(row => row.status === "sent")).toBe(true);
    expectNoCompanyIn("the site's emails", siteEmailText());

    // The same answer again sends nothing new; a changed answer is its own email; going back to an earlier state is
    // shown on the page but not emailed again (one email per company per state).
    expect((await companyAnswers(SOUTH, { state: "needs_something", inputs: WORDS.south })).status).toBe(200);
    expect((await companyAnswers(SOUTH, { state: "declined", inputs: WORDS.south })).status).toBe(200);
    await deliverOutbox();
    expect(outbox().filter(row => row.kind === "company_answered").map(row => row.key)).toContain(`captureOutbox/${ID}:company_answered:A-declined`);
    expect(sent().filter(message => message.subject === "A deployment company answered")).toHaveLength(3);
    expect((await companyAnswers(SOUTH, { state: "needs_something", inputs: `${WORDS.south} again` })).status).toBe(200);
    await deliverOutbox();
    expect(sent().filter(message => message.subject === "A deployment company answered")).toHaveLength(3);
    expect((await siteStatus()).body.answer.companies.entries).toContainEqual(expect.objectContaining({ alias: "Company A", state: "needs_something" }));
    expectNoCompanyIn("the site's emails", siteEmailText());
    expectNoCompanyIn("the site's status payload", (await siteStatus()).raw);

    // The operator, and only the operator, sees the names and the words.
    const read = await panel();
    expect(read.responses.map((row: { company: string; inputs: string; recordedBy: string }) => [row.company, row.inputs, row.recordedBy]).sort())
      .toEqual([[NORTH.company, WORDS.north, "company"], [SOUTH.company, `${WORDS.south} again`, "company"]].sort());
  });

  // "Introduce us" beside Interested, the company's consent being the current Terms it accepted.
  it("introduces the site to a company that answered Interested", async () => {
    // The introduction record is sealed at rest (`introductionShared.ts`).
    vi.stubEnv("FIELD_ENCRYPTION_MASTER_KEY", Buffer.alloc(32, 7).toString("base64"));
    expect(await sendToCompanies()).toMatchObject({ sent: true });
    expect((await companyAnswers(NORTH, { state: "interested", inputs: WORDS.north })).status).toBe(200);
    const before = (await siteStatus()).body.answer.companies.entries.find((entry: Record<string, unknown>) => entry.kind === "answered");
    expect(before).toMatchObject({ alias: "Company A", state: "interested", canIntroduce: true, reason: NORTH_REASON });
    const token = createCaptureUploadToken({ requestId: ID, captureId: `walkthrough-${ID}`, sceneId: `site-${ID}`, scope: "owner" });
    const response = await fetch(`${base}/api/site-task-brief/${token}/introductions`, { method: "POST",
      body: JSON.stringify({ alias: "A", statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION }),
      headers: { "content-type": "application/json", cookie: "csrf_token=c1-test", "x-csrf-token": "c1-test" } });
    expect(response.status, await response.clone().text()).toBe(200);
    const after = (await siteStatus()).body.answer.companies.entries.find((entry: Record<string, unknown>) => entry.kind === "answered");
    expect(after).toMatchObject({ alias: "Company A", canIntroduce: false, introducedAtIso: expect.any(String) });
    expect(state.docs.get(`inboundRequests/${ID}/introductions/${sha(NORTH.email)}`)).toMatchObject({ alias: "A", by: "site" });
  });

  it("shows no words staff recorded before the form said the site reads them, and still offers the introduction", async () => {
    expect(await sendToCompanies()).toMatchObject({ sent: true });
    patchJob({ company_aliases: { [sha(NORTH.email)]: "A" } });
    state.docs.set(`inboundRequests/${ID}/robotTeamInterest/${sha(NORTH.email)}`, { state: "interested", inputs: WORDS.north,
      email: NORTH.email, company: NORTH.company, recordedBy: "operator", recordedByUid: "ops", recordedByEmail: "ops@example.com",
      updatedAtIso: "2026-11-13T00:00:00.000Z" });
    const { raw, body } = await siteStatus();
    const entry = body.answer.companies.entries.find((row: Record<string, unknown>) => row.kind === "answered");
    expect(entry).toMatchObject({ alias: "Company A", state: "interested", canIntroduce: true });
    expect(entry).not.toHaveProperty("reason");
    expect(raw).not.toContain("second gripper");
  });

  it("the projection reads no company field even when one is planted on a send or an answer", () => {
    const activity = projectSiteCompanyActivity({ aliases: { n: "A" },
      sends: [{ companyId: "n", sentAtIso: "2026-11-12T00:00:00.000Z", company: NORTH.company, email: NORTH.email, website: NORTH.website }],
      responses: [{ id: "n", data: { state: "interested", updatedAtIso: "2026-11-12T01:00:00.000Z", inputs: WORDS.north,
        company: NORTH.company, email: NORTH.email, website: NORTH.website, name: NORTH.name, recordedBy: "company",
        noteForSite: "NOTE-PLANT a note that must never show." } }] });
    expectNoCompanyIn("the projection", JSON.stringify(activity));
    expect(JSON.stringify(activity)).not.toContain("NOTE-PLANT");
    expect(activity).toEqual({ interested: true, entries: [{ kind: "sent", alias: "Company A", atIso: "2026-11-12T00:00:00.000Z" },
      { kind: "answered", alias: "Company A", atIso: "2026-11-12T01:00:00.000Z", state: "interested", canIntroduce: false }],
      sent: { count: 1, firstAtIso: "2026-11-12T00:00:00.000Z" }, introductions: { used: 0 } });
  });

  it("never shows an answer given before this change (no recordedBy), gives it no alias, and the status read writes nothing", async () => {
    // A legacy answer, as the library stored it before C1, even one that somehow carries an alias.
    state.docs.set(`inboundRequests/${ID}/robotTeamInterest/${sha(SOUTH.email)}`, { state: "interested", inputs: WORDS.south,
      email: SOUTH.email, company: SOUTH.company, submittedBy: "uid-south", updatedAtIso: "2026-11-10T00:00:00.000Z" });
    expect(projectSiteCompanyActivity({ aliases: { [sha(SOUTH.email)]: "A" }, sends: [],
      responses: [{ id: sha(SOUTH.email), data: state.docs.get(`inboundRequests/${ID}/robotTeamInterest/${sha(SOUTH.email)}`) as never }] }))
      .toMatchObject({ entries: [], interested: false });
    const before = JSON.stringify([...state.docs.entries()].filter(([key]) => !key.startsWith("captureOutbox/")));
    const { body } = await siteStatus();
    expect(body.answer.companies).toMatchObject({ entries: [], interested: false, sent: null });
    await siteStatus();
    // Nothing the status read could write changed: no alias, no record.
    expect(JSON.stringify([...state.docs.entries()].filter(([key]) => !key.startsWith("captureOutbox/")))).toBe(before);
    expect(jobDoc().company_aliases).toBeUndefined();
    expect((await panel()).responses).toEqual([expect.objectContaining({ company: SOUTH.company, recordedBy: "before_c1", alias: null })]);
  });

  it("does not show a send voided before staff stopped recording sends", async () => {
    patchJob({ company_aliases: { [sha(NORTH.email)]: "A" } });
    state.docs.set(`inboundRequests/${ID}/companySends/send-1`, { schemaVersion: 1, companyId: sha(NORTH.email),
      sentAtIso: "2026-11-12T10:00:00.000Z", sentBy: "admin-1", sentByEmail: "ops@tryblueprint.io",
      voidedAtIso: "2026-11-12T11:00:00.000Z", voidedBy: "ops@tryblueprint.io" });
    expect((await siteStatus()).body.answer.companies).toMatchObject({ entries: [], interested: false, sent: null });
  });
});

describe("Blueprint's hold", () => {
  it("closes the library card and the response route, flips the site's sentence and holds the emails, until shown again", async () => {
    await sendToCompanies();
    // Stopping needs a reason: it is the staff stop for a privacy or rights problem.
    expect(await adminPost("/hold", { held: true })).toMatchObject({ status: 400 });
    expect(await adminPost("/hold", { held: true, reason: "  " })).toMatchObject({ status: 400 });
    expect(jobDoc().operator_listing_hold).toBeUndefined();
    expect(await adminPost("/hold", { held: true, reason: "Checking the summary" })).toMatchObject({ status: 200, body: { hold: { held: true } } });
    expect(jobDoc().operator_listing_hold).toMatchObject({ held: true, by: "admin-1", byEmail: "ops@tryblueprint.io", reason: "Checking the summary" });

    // The card a company sees, and its response form, close.
    expect(projectTaskBrowseCard(ID, jobDoc() as never)).toBeNull();
    expect((await companyAnswers(SOUTH, { state: "interested", inputs: WORDS.south })).status).toBe(409);
    // The send queues no site email (ledger AL38), so nothing is delivered while held.
    await deliverOutbox();
    expect(sent().map(message => message.subject)).not.toContain("Your job is posted");
    expect(outbox().find(row => row.kind === "job_sent")).toBeUndefined();
    // The site's page says the existing "not visible right now" sentence (its state), and still counts the send.
    const held = (await siteStatus()).body.answer;
    expect(held.sharing.state).toBe("not_visible");
    expect(held.companies.sent).toMatchObject({ count: 2 });
    expect((await panel()).sharing).toMatchObject({ state: "shared_not_visible", reason: "blueprint_hold",
      words: "Shared, but not visible to companies right now: Blueprint stopped showing it." });

    expect(await adminPost("/hold", { held: false })).toMatchObject({ status: 200, body: { hold: { held: false } } });
    expect(jobDoc().operator_listing_hold).toMatchObject({ held: false, by: "admin-1", reason: null });
    expect(projectTaskBrowseCard(ID, jobDoc() as never)).not.toBeNull();
    expect((await siteStatus()).body.answer.sharing.state).toBe("visible");
    expect((await companyAnswers(SOUTH, { state: "interested", inputs: WORDS.south })).status).toBe(200);
  });
});

describe("a withdrawn job", () => {
  it("queues neither email and records nothing when the site withdrew before any send or answer", async () => {
    patchJob({ consent_revoked: true });
    expect(await sendToCompanies()).toEqual({ sent: false, reason: "not_listed" });
    expect((await companyAnswers(SOUTH, { state: "interested", inputs: WORDS.south })).status).toBe(409);
    await deliverOutbox();
    expect(outbox().filter(row => row.kind === "job_sent" || row.kind === "company_answered")).toEqual([]);
    expect(sent().map(message => message.subject)).not.toEqual(expect.arrayContaining(["Your job is posted"]));
    expect(sent().map(message => message.subject)).not.toContain("A deployment company answered");
    expect([...state.docs.keys()].filter(key => key.includes("/companySends/") || key.includes("/robotTeamInterest/"))).toEqual([]);
  });


  it("shows nothing, sends nothing and records nothing new", async () => {
    await sendToCompanies();
    expect((await companyAnswers(SOUTH, { state: "interested", inputs: WORDS.south })).status).toBe(200);
    patchJob({ consent_revoked: true });
    await deliverOutbox();
    expect(sent().map(message => message.subject).filter(subject => subject !== "Your job summary is shared")).toEqual([]);
    expect(outbox().filter(row => row.kind === "job_sent" || row.kind === "company_answered").every(row => row.status === "cancelled")).toBe(true);
    const { raw } = await siteStatus();
    expect(JSON.parse(raw).answer).toBeNull();
    expect(raw).not.toMatch(/Company [A-Z]|"companies"|"entries"/);
    // The loader itself shows nothing for a withdrawn job, whatever its caller does.
    const { loadSiteCompanyActivity } = await import("../utils/jobCompanies");
    expect(await loadSiteCompanyActivity(ID)).toMatchObject({ entries: [], interested: false, sent: null });
    expect((await companyAnswers(NORTH, { state: "interested", inputs: WORDS.north })).status).toBe(409);
  });
});

/** The next transaction runs its body, then fails to commit: none of its writes land, as with Firestore. */
function failNextCommit() {
  const original = sharedFakeFirestore.runTransaction.bind(sharedFakeFirestore);
  vi.spyOn(sharedFakeFirestore, "runTransaction").mockImplementationOnce((async (body: (tx: unknown) => Promise<unknown>) =>
    original(async (tx: never) => { await body(tx); throw new Error("SYNTHETIC commit failure"); })) as never);
}
const siteRows = () => outbox().filter(row => row.kind === "job_sent" || row.kind === "company_answered");
const companyRows = () => [...state.docs.keys()].filter(key => key.includes("/companySends/") || key.includes("/robotTeamInterest/"));

describe("the site's email is a durable intent of the activity", () => {
  it("is queued in the same transaction: the row exists as soon as the send or answer is recorded, before any delivery pass", async () => {
    await sendToCompanies();
    // The send itself queues no site email (ledger AL38); each answer does.
    expect(siteRows()).toEqual([]);
    await companyAnswers(NORTH, { state: "interested", inputs: WORDS.north });
    await companyAnswers(SOUTH, { state: "declined", inputs: WORDS.south });
    expect(siteRows().map(row => row.key).sort()).toEqual([`captureOutbox/${ID}:company_answered:A-interested`,
      `captureOutbox/${ID}:company_answered:B-declined`].sort());
    expectNoCompanyIn("the queued emails", siteEmailText());
  });

  it("leaves neither the activity nor its email when the transaction fails, on both paths", async () => {
    failNextCommit();
    await expect(sendToCompanies()).rejects.toThrow("SYNTHETIC commit failure");
    expect(companyRows()).toEqual([]);
    expect(outbox()).toEqual([]);
    expect(jobDoc().company_aliases).toBeUndefined();

    await sendToCompanies();
    failNextCommit();
    expect((await companyAnswers(SOUTH, { state: "interested", inputs: WORDS.south })).status).toBe(409);
    expect(companyRows().sort()).toEqual([`inboundRequests/${ID}/companySends/system-${sha(NORTH.email)}`,
      `inboundRequests/${ID}/companySends/system-${sha(SOUTH.email)}`].sort());
    expect(siteRows()).toEqual([]);
    expect(jobDoc().company_aliases).toBeUndefined();
  });

  it("queues one row for an answer given twice with the same state", async () => {
    await sendToCompanies();
    await companyAnswers(NORTH, { state: "interested", inputs: WORDS.north });
    await companyAnswers(NORTH, { state: "interested", inputs: `${WORDS.north} (resent)` });
    await companyAnswers(SOUTH, { state: "declined", inputs: WORDS.south });
    await companyAnswers(SOUTH, { state: "declined", inputs: `${WORDS.south} (again)` });
    expect(outbox().filter(row => row.kind === "company_answered").map(row => row.key).sort())
      .toEqual([`captureOutbox/${ID}:company_answered:A-interested`, `captureOutbox/${ID}:company_answered:B-declined`]);
    await deliverOutbox();
    expect(sent().filter(message => message.subject === "A deployment company answered")).toHaveLength(2);
  });

  it("an answer queued while visible is cancelled at dispatch once the job is held, and once it is withdrawn", async () => {
    await sendToCompanies();
    await companyAnswers(NORTH, { state: "interested", inputs: WORDS.north });
    await adminPost("/hold", { held: true, reason: "Checking the summary" });
    await deliverOutbox();
    expect(outbox().filter(row => row.kind === "job_sent" || row.kind === "company_answered").map(row => row.status)).toEqual(["cancelled"]);
    await adminPost("/hold", { held: false });
    await companyAnswers(SOUTH, { state: "interested", inputs: WORDS.south });
    patchJob({ consent_revoked: true });
    await deliverOutbox();
    expect(outbox().find(row => row.key === `captureOutbox/${ID}:company_answered:B-interested`)).toMatchObject({ status: "cancelled" });
    expect(sent().map(message => message.subject)).not.toContain("A deployment company answered");
  });
});

describe("every row is read, page by page", () => {
  const extra = Array.from({ length: 5 }, (_, index) => companyRecord(`EXTRA${index}X`));
  it("lists every approved company, send and answer past one page, on the panel and on the site's page", async () => {
    for (const record of extra) state.docs.set(`robotTeamAccess/${sha(record.email)}`, record);
    setJobCompaniesPageSizeForTests(2);
    const everyone = [NORTH, SOUTH, ...extra];
    expect(await sendToCompanies()).toMatchObject({ sent: true, count: everyone.length });
    for (const record of everyone) {
      expect((await companyAnswers(record, { state: "needs_something", inputs: "words" })).status).toBe(200);
    }
    const read = await panel();
    expect(read.companies).toHaveLength(everyone.length);
    expect(read.sends).toHaveLength(everyone.length);
    expect(read.responses).toHaveLength(everyone.length);
    const companies = (await siteStatus()).body.answer.companies;
    expect(companies.sent).toMatchObject({ count: everyone.length });
    expect((companies.entries as Array<{ kind: string }>).filter(entry => entry.kind === "answered")).toHaveLength(everyone.length);
  });
});
