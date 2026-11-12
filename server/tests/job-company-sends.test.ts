// @vitest-environment node
/**
 * Sends and responses (package C1): the operator records that it sent a site's job to an approved deployment company
 * and what each company answered; the site sees, on its job page and in two emails, only an alias, dates, one of three
 * fixed labels and Blueprint's own sentence. OFFLINE: the real admin routes, the real company response route, the real
 * owner status read and the real outbox against the fake Firestore; email delivery, Slack and sign-in are fakes.
 *
 * What this pins:
 * - nothing the site receives (its status payload, either email) carries a company's name, email, website, the id
 *   derived from its email or its own words: distinctive strings are planted in every company field;
 * - a send is refused for a job that is not shared and visible, and for a company that is not an approved
 *   deployment company;
 * - the operator hold closes the library card and the response route and flips the site's sentence;
 * - a voided send is not shown and its email is not sent; a withdrawn job shows nothing and sends nothing.
 */
import express from "express";
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestore, sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { anonymizedOpportunityDraft } from "../../client/src/types/taskBrowse";
import { JOB_CARD_ANSWER_STATEMENT, JOB_CARD_ANSWER_STATEMENT_VERSION } from "../../client/src/lib/jobCardAnswerConsent";

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

const ID = "req-c1";
let server: Server;
let base = "";

/* ----------------------------------------------------------------- planted company records */

const sha = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
/** Every field a company record has, each a string that must never reach the site. */
function companyRecord(tag: string, extra: Record<string, unknown> = {}) {
  return {
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
const WORDS = { north: "NORTHX-WORDS: we would need a second gripper", south: "SOUTHX-WORDS: our UR20 palletizes this today" };
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
    request: { buyerType: "site_operator", capture_mode: "self_capture" },
    capture_coverage: { covers_scene: true },
    walkthrough_job_estimates: { capture_id: `walkthrough-${ID}`, job_estimates: {
      object: "carton", object_largest_side_m: 0.4, object_mass_kg_low: 8, object_mass_kg_high: 11, object_surface: "matte",
      pick_to_place_m: 1.6, pick_height_m: null, place_height_m: null, front_clearance_m: 1.5,
      other_items_likely: [], cycle_seconds: null, basis: "A person stacks cartons onto a pallet." } },
    public_task_listing: { enabled: true, consentVersion: JOB_CARD_ANSWER_STATEMENT_VERSION, approvedAtIso: "2026-11-11T10:00:00.000Z",
      approvedBy: "signed_owner_link", details: anonymizedOpportunityDraft("Stack cartons onto the pallet") },
    introduction_request: { requested_at_iso: "2026-11-11T10:00:00.000Z", requested_by: "signed_owner_link",
      statement_version: JOB_CARD_ANSWER_STATEMENT_VERSION, statement_text: JOB_CARD_ANSWER_STATEMENT },
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
  const response = await fetch(`${base}/api/site-worlds/tasks/${ID}/interest`, { method: "POST", body: JSON.stringify(body),
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
const sent = () => seams.sendEmail.mock.calls.map(([message]) => message as { subject: string; text?: string; body?: string; to: string });
/** Every byte of every email the site was sent, and every row queued for it. */
const siteEmailText = () => JSON.stringify([sent(), outbox()]);
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
    expect((await adminPost("/sends", { companyId: sha(NORTH.email) }, { Authorization: "Bearer user", "content-type": "application/json" })).status).toBe(403);
    expect(outbox()).toHaveLength(0);
  });

  it("says the sharing state, lists approved deployment companies only, and gives the job's library address", async () => {
    const read = await panel();
    expect(read.sharing).toMatchObject({ state: "shared_visible", words: "Shared and visible to approved companies." });
    expect(read.companies.map((row: { id: string }) => row.id).sort()).toEqual([sha(NORTH.email), sha(SOUTH.email)].sort());
    expect(read.libraryUrl).toMatch(new RegExp(`/contact/robot-team#job-${ID}$`));
    expect(read).toMatchObject({ hold: null, consentRevoked: false, sends: [], responses: [] });
  });

  it("refuses a send for a job that is not shared, not visible or withdrawn, and for a company that is not an approved deployment company", async () => {
    for (const record of [TECH, PENDING]) {
      expect(await adminPost("/sends", { companyId: sha(record.email) })).toMatchObject({ status: 409, body: { code: "company_not_approved" } });
    }
    expect(await adminPost("/sends", { companyId: "f".repeat(64) })).toMatchObject({ status: 409, body: { code: "company_not_approved" } });
    patchJob({ public_task_listing: { ...jobDoc().public_task_listing, enabled: false } });
    expect(await adminPost("/sends", { companyId: sha(NORTH.email) })).toMatchObject({ status: 409, body: { code: "not_visible" } });
    patchJob({ public_task_listing: job().public_task_listing, evaluation_readiness: { rights_review_status: "needs_review" } });
    expect(await adminPost("/sends", { companyId: sha(NORTH.email) })).toMatchObject({ status: 409, body: { code: "not_visible" } });
    patchJob({ evaluation_readiness: {}, workspace_task: { paused: true } });
    expect(await adminPost("/sends", { companyId: sha(NORTH.email) })).toMatchObject({ status: 409, body: { code: "not_visible" } });
    patchJob({ workspace_task: {}, consent_revoked: true });
    expect(await adminPost("/sends", { companyId: sha(NORTH.email) })).toMatchObject({ status: 409, body: { code: "consent_withdrawn" } });
    expect([...state.docs.keys()].filter(key => key.includes("/companySends/"))).toHaveLength(0);
    expect(outbox()).toHaveLength(0);
    expect(jobDoc().company_aliases).toBeUndefined();
  });

  it("records a send with who and when, voids without deleting, and records an emailed answer only for a company with a standing send", async () => {
    const recorded = await adminPost("/sends", { companyId: sha(NORTH.email) });
    expect(recorded).toMatchObject({ status: 200, body: { send: { alias: "A" } } });
    const sendKey = `inboundRequests/${ID}/companySends/${recorded.body.send.sendId}`;
    expect(state.docs.get(sendKey)).toMatchObject({ schemaVersion: 1, companyId: sha(NORTH.email), sentBy: "admin-1", sentByEmail: "ops@tryblueprint.io" });
    expect(await adminPost(`/sends/${recorded.body.send.sendId}/void`, {})).toMatchObject({ status: 200 });
    expect(state.docs.get(sendKey)).toMatchObject({ voidedBy: "ops@tryblueprint.io", voidedAtIso: expect.any(String) });
    expect(await adminPost("/sends/nope/void", {})).toMatchObject({ status: 404 });
    // North's only send is voided, and South was never sent the job: neither answer can be recorded.
    expect(await adminPost("/responses", { companyId: sha(NORTH.email), state: "interested", inputs: WORDS.north }))
      .toMatchObject({ status: 409, body: { code: "not_sent" } });
    expect(await adminPost("/responses", { companyId: sha(SOUTH.email), state: "interested", inputs: WORDS.south }))
      .toMatchObject({ status: 409, body: { code: "not_sent" } });
    // A note for the site is no longer a field at all.
    expect(await adminPost("/responses", { companyId: sha(NORTH.email), state: "interested", inputs: WORDS.north,
      noteForSite: "They can visit in two weeks." })).toMatchObject({ status: 400 });
    expect([...state.docs.keys()].filter(key => key.includes("/robotTeamInterest/"))).toEqual([]);
    expect(outbox().filter(row => row.kind === "company_answered")).toEqual([]);
    // A fresh send makes North's answer recordable.
    await adminPost("/sends", { companyId: sha(NORTH.email) });
    expect(await adminPost("/responses", { companyId: sha(NORTH.email), state: "interested", inputs: WORDS.north }))
      .toMatchObject({ status: 200, body: { response: { alias: "A" } } });
    const read = await panel();
    expect(read.sends[0]).toEqual(expect.objectContaining({ company: NORTH.company, alias: "A", sentBy: "ops@tryblueprint.io", voidedAtIso: expect.any(String) }));
    expect(state.docs.get(`inboundRequests/${ID}/robotTeamInterest/${sha(NORTH.email)}`)).toMatchObject({ recordedBy: "operator",
      recordedByUid: "admin-1", recordedByEmail: "ops@tryblueprint.io" });
    expect(state.docs.get(`inboundRequests/${ID}/robotTeamInterest/${sha(NORTH.email)}`)).not.toHaveProperty("noteForSite");
  });
});

describe("what the site receives", () => {
  it("tells the site each send and answer by alias, date and label only: no company field and no company words reach its page or its emails", async () => {
    // Blueprint sends to North; South answers in the library without a send; North answers by email, recorded by Blueprint.
    const send = await adminPost("/sends", { companyId: sha(NORTH.email) });
    expect(send.status).toBe(200);
    expect((await companyAnswers(SOUTH, { state: "needs_something", inputs: WORDS.south })).status).toBe(200);
    expect(await adminPost("/responses", { companyId: sha(NORTH.email), state: "interested", inputs: WORDS.north }))
      .toMatchObject({ status: 200, body: { response: { alias: "A" } } });
    await deliverOutbox();

    // The aliases, assigned once, in order of first appearance.
    expect(jobDoc().company_aliases).toEqual({ [sha(NORTH.email)]: "A", [sha(SOUTH.email)]: "B" });

    // The site's job page: exactly these fields.
    const { raw, body } = await siteStatus();
    const entries = body.answer.companies.entries as Array<Record<string, unknown>>;
    expect(body.answer.companies.interested).toBe(true);
    expect(Object.keys(body.answer.companies).sort()).toEqual(["entries", "interested"]);
    expect(entries.map(entry => Object.keys(entry).sort())).toEqual([["alias", "atIso", "kind"],
      ["alias", "atIso", "kind", "state"], ["alias", "atIso", "kind", "state"]]);
    expect(entries.map(({ kind, alias, state: answer }) => ({ kind, alias, answer }))).toEqual([
      { kind: "sent", alias: "Company A", answer: undefined },
      { kind: "answered", alias: "Company B", answer: "needs_something" },
      { kind: "answered", alias: "Company A", answer: "interested" },
    ]);
    expectNoCompanyIn("the site's status payload", raw);

    // The emails: one per send, one per company and answer, each by the fixed words.
    const subjects = sent().map(message => message.subject).filter(subject => subject !== "Your job summary is shared");
    expect(subjects.sort()).toEqual(["A deployment company answered", "A deployment company answered", "Your job was sent to a deployment company"].sort());
    const rows = outbox().filter(row => row.kind === "job_sent" || row.kind === "company_answered");
    expect(rows.map(row => row.key).sort()).toEqual([`captureOutbox/${ID}:company_answered:A-interested`,
      `captureOutbox/${ID}:company_answered:B-needs_something`, `captureOutbox/${ID}:job_sent:send-${send.body.send.sendId}`].sort());
    const bodyOf = (key: string) => rows.find(row => row.key === `captureOutbox/${ID}:${key}`)!.body;
    expect(bodyOf(`job_sent:send-${send.body.send.sendId}`)).toMatch(/^We sent the summary of your job to a deployment company we approved\. Your video, address and contacts stay private\. Your job page shows any answer\.\n\nOpen your job:\nhttps:\/\/\S+\/capture-upload\/\S+$/);
    expect(bodyOf("company_answered:B-needs_something")).toMatch(/^A deployment company answered about your job: Would need something\. Your job page has the details\.\n\nOpen your job:\nhttps:\/\/\S+$/);
    expect(bodyOf("company_answered:A-interested")).toMatch(/^A deployment company answered about your job: Interested\. Your job page has the details\./);
    expect(rows.every(row => row.status === "sent")).toBe(true);
    expectNoCompanyIn("the site's emails", siteEmailText());

    // The same answer again sends nothing new; a changed answer is its own email; going back to an earlier state is
    // shown on the page but not emailed again (one email per company per state).
    expect((await companyAnswers(SOUTH, { state: "needs_something", inputs: WORDS.south })).status).toBe(200);
    expect((await companyAnswers(SOUTH, { state: "declined", inputs: WORDS.south })).status).toBe(200);
    await deliverOutbox();
    expect(outbox().filter(row => row.kind === "company_answered").map(row => row.key)).toContain(`captureOutbox/${ID}:company_answered:B-declined`);
    expect(sent().filter(message => message.subject === "A deployment company answered")).toHaveLength(3);
    expect((await companyAnswers(SOUTH, { state: "needs_something", inputs: `${WORDS.south} again` })).status).toBe(200);
    await deliverOutbox();
    expect(sent().filter(message => message.subject === "A deployment company answered")).toHaveLength(3);
    expect((await siteStatus()).body.answer.companies.entries).toContainEqual(expect.objectContaining({ alias: "Company B", state: "needs_something" }));
    expectNoCompanyIn("the site's emails", siteEmailText());
    expectNoCompanyIn("the site's status payload", (await siteStatus()).raw);

    // The operator, and only the operator, sees the names and the words.
    const read = await panel();
    expect(read.responses.map((row: { company: string; inputs: string; recordedBy: string }) => [row.company, row.inputs, row.recordedBy]).sort())
      .toEqual([[NORTH.company, WORDS.north, "operator"], [SOUTH.company, `${WORDS.south} again`, "company"]].sort());
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
      { kind: "answered", alias: "Company A", atIso: "2026-11-12T01:00:00.000Z", state: "interested" }] });
  });

  it("never shows an answer given before this change (no recordedBy), gives it no alias, and the status read writes nothing", async () => {
    // A legacy answer, as the library stored it before C1, even one that somehow carries an alias.
    state.docs.set(`inboundRequests/${ID}/robotTeamInterest/${sha(SOUTH.email)}`, { state: "interested", inputs: WORDS.south,
      email: SOUTH.email, company: SOUTH.company, submittedBy: "uid-south", updatedAtIso: "2026-11-10T00:00:00.000Z" });
    expect(projectSiteCompanyActivity({ aliases: { [sha(SOUTH.email)]: "A" }, sends: [],
      responses: [{ id: sha(SOUTH.email), data: state.docs.get(`inboundRequests/${ID}/robotTeamInterest/${sha(SOUTH.email)}`) as never }] }))
      .toEqual({ entries: [], interested: false });
    const before = JSON.stringify([...state.docs.entries()].filter(([key]) => !key.startsWith("captureOutbox/")));
    const { body } = await siteStatus();
    expect(body.answer.companies).toEqual({ entries: [], interested: false });
    await siteStatus();
    // Nothing the status read could write changed: no alias, no record.
    expect(JSON.stringify([...state.docs.entries()].filter(([key]) => !key.startsWith("captureOutbox/")))).toBe(before);
    expect(jobDoc().company_aliases).toBeUndefined();
    expect((await panel()).responses).toEqual([expect.objectContaining({ company: SOUTH.company, recordedBy: "before_c1", alias: null })]);
  });

  it("does not show a voided send, and does not send its email", async () => {
    const send = await adminPost("/sends", { companyId: sha(NORTH.email) });
    await adminPost(`/sends/${send.body.send.sendId}/void`, {});
    await deliverOutbox();
    expect(sent().map(message => message.subject)).not.toContain("Your job was sent to a deployment company");
    expect(outbox().find(row => row.kind === "job_sent")).toMatchObject({ status: "cancelled" });
    expect((await siteStatus()).body.answer.companies).toEqual({ entries: [], interested: false });
  });
});

describe("Blueprint's hold", () => {
  it("closes the library card and the response route, flips the site's sentence and holds the emails, until shown again", async () => {
    await adminPost("/sends", { companyId: sha(NORTH.email) });
    expect(await adminPost("/hold", { held: true, reason: "Checking the summary" })).toMatchObject({ status: 200, body: { hold: { held: true } } });
    expect(jobDoc().operator_listing_hold).toMatchObject({ held: true, by: "admin-1", byEmail: "ops@tryblueprint.io", reason: "Checking the summary" });

    // The card a company sees, and its response form, close.
    expect(projectTaskBrowseCard(ID, jobDoc() as never)).toBeNull();
    expect((await companyAnswers(SOUTH, { state: "interested", inputs: WORDS.south })).status).toBe(409);
    // Nothing can be sent, and the queued send email is not delivered while held.
    expect(await adminPost("/sends", { companyId: sha(SOUTH.email) })).toMatchObject({ status: 409, body: { code: "not_visible" } });
    await deliverOutbox();
    expect(sent().map(message => message.subject)).not.toContain("Your job was sent to a deployment company");
    expect(outbox().find(row => row.kind === "job_sent")).toMatchObject({ status: "cancelled" });
    // The site's page says the existing "not visible right now" sentence (its state), and still lists the send.
    const held = (await siteStatus()).body.answer;
    expect(held.sharing.state).toBe("not_visible");
    expect(held.companies.entries).toEqual([expect.objectContaining({ kind: "sent", alias: "Company A" })]);
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
    expect(await adminPost("/sends", { companyId: sha(NORTH.email) })).toMatchObject({ status: 409, body: { code: "consent_withdrawn" } });
    expect((await companyAnswers(SOUTH, { state: "interested", inputs: WORDS.south })).status).toBe(409);
    expect(await adminPost("/responses", { companyId: sha(NORTH.email), state: "interested", inputs: WORDS.north }))
      .toMatchObject({ status: 409, body: { code: "consent_withdrawn" } });
    await deliverOutbox();
    expect(outbox().filter(row => row.kind === "job_sent" || row.kind === "company_answered")).toEqual([]);
    expect(sent().map(message => message.subject)).not.toEqual(expect.arrayContaining(["Your job was sent to a deployment company"]));
    expect(sent().map(message => message.subject)).not.toContain("A deployment company answered");
    expect([...state.docs.keys()].filter(key => key.includes("/companySends/") || key.includes("/robotTeamInterest/"))).toEqual([]);
  });


  it("shows nothing, sends nothing and records nothing new", async () => {
    await adminPost("/sends", { companyId: sha(NORTH.email) });
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
    expect(await loadSiteCompanyActivity(ID)).toEqual({ entries: [], interested: false });
    expect(await adminPost("/responses", { companyId: sha(NORTH.email), state: "interested", inputs: WORDS.north }))
      .toMatchObject({ status: 409, body: { code: "consent_withdrawn" } });
    expect(await adminPost("/sends", { companyId: sha(NORTH.email) })).toMatchObject({ status: 409, body: { code: "consent_withdrawn" } });
  });
});

/** The next transaction runs its body, then fails to commit: none of its writes land, as with Firestore. */
function failNextCommit() {
  const original = sharedFakeFirestore.runTransaction.bind(sharedFakeFirestore);
  vi.spyOn(sharedFakeFirestore, "runTransaction").mockImplementationOnce((async (body: (tx: unknown) => Promise<unknown>) =>
    original(async (tx: never) => { await body(tx); throw new Error("SYNTHETIC commit failure"); })) as never);
}
const companyRows = () => [...state.docs.keys()].filter(key => key.includes("/companySends/") || key.includes("/robotTeamInterest/"));

describe("the site's email is a durable intent of the activity", () => {
  it("is queued in the same transaction: the row exists as soon as the send or answer is recorded, before any delivery pass", async () => {
    const send = await adminPost("/sends", { companyId: sha(NORTH.email) });
    expect(outbox().map(row => [row.key, row.status])).toEqual([[`captureOutbox/${ID}:job_sent:send-${send.body.send.sendId}`, "pending"]]);
    await adminPost("/responses", { companyId: sha(NORTH.email), state: "interested", inputs: WORDS.north });
    await companyAnswers(SOUTH, { state: "declined", inputs: WORDS.south });
    expect(outbox().map(row => row.key).sort()).toEqual([`captureOutbox/${ID}:company_answered:A-interested`,
      `captureOutbox/${ID}:company_answered:B-declined`, `captureOutbox/${ID}:job_sent:send-${send.body.send.sendId}`].sort());
    expectNoCompanyIn("the queued emails", siteEmailText());
  });

  it("leaves neither the activity nor its email when the transaction fails, on all three paths", async () => {
    failNextCommit();
    expect((await adminPost("/sends", { companyId: sha(NORTH.email) })).status).toBe(503);
    expect(companyRows()).toEqual([]);
    expect(outbox()).toEqual([]);
    expect(jobDoc().company_aliases).toBeUndefined();

    const send = await adminPost("/sends", { companyId: sha(NORTH.email) });
    failNextCommit();
    expect((await adminPost("/responses", { companyId: sha(NORTH.email), state: "interested", inputs: WORDS.north })).status).toBe(503);
    failNextCommit();
    expect((await companyAnswers(SOUTH, { state: "interested", inputs: WORDS.south })).status).toBe(409);
    expect(companyRows()).toEqual([`inboundRequests/${ID}/companySends/${send.body.send.sendId}`]);
    expect(outbox().map(row => row.kind)).toEqual(["job_sent"]);
    expect(jobDoc().company_aliases).toEqual({ [sha(NORTH.email)]: "A" });
  });

  it("queues one row for an answer recorded twice with the same state, by either path", async () => {
    await adminPost("/sends", { companyId: sha(NORTH.email) });
    await adminPost("/responses", { companyId: sha(NORTH.email), state: "interested", inputs: WORDS.north });
    await adminPost("/responses", { companyId: sha(NORTH.email), state: "interested", inputs: `${WORDS.north} (resent)` });
    await companyAnswers(SOUTH, { state: "declined", inputs: WORDS.south });
    await companyAnswers(SOUTH, { state: "declined", inputs: `${WORDS.south} (again)` });
    expect(outbox().filter(row => row.kind === "company_answered").map(row => row.key).sort())
      .toEqual([`captureOutbox/${ID}:company_answered:A-interested`, `captureOutbox/${ID}:company_answered:B-declined`]);
    await deliverOutbox();
    expect(sent().filter(message => message.subject === "A deployment company answered")).toHaveLength(2);
  });

  it("an answer queued while visible is cancelled at dispatch once the job is held, and once it is withdrawn", async () => {
    await adminPost("/sends", { companyId: sha(NORTH.email) });
    await adminPost("/responses", { companyId: sha(NORTH.email), state: "interested", inputs: WORDS.north });
    await adminPost("/hold", { held: true });
    await deliverOutbox();
    expect(outbox().filter(row => row.kind === "job_sent" || row.kind === "company_answered").map(row => row.status)).toEqual(["cancelled", "cancelled"]);
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
    for (const record of everyone) expect((await adminPost("/sends", { companyId: sha(record.email) })).status).toBe(200);
    for (const record of everyone) {
      expect(await adminPost("/responses", { companyId: sha(record.email), state: "needs_something", inputs: "words" })).toMatchObject({ status: 200 });
    }
    const read = await panel();
    expect(read.companies).toHaveLength(everyone.length);
    expect(read.sends).toHaveLength(everyone.length);
    expect(read.responses).toHaveLength(everyone.length);
    // The last send can still be voided from the panel, and the last company still answers.
    const last = read.sends[read.sends.length - 1];
    expect((await adminPost(`/sends/${last.sendId}/void`, {})).status).toBe(200);
    const entries = (await siteStatus()).body.answer.companies.entries as Array<{ kind: string }>;
    expect(entries.filter(entry => entry.kind === "sent")).toHaveLength(everyone.length - 1);
    expect(entries.filter(entry => entry.kind === "answered")).toHaveLength(everyone.length);
  });
});
