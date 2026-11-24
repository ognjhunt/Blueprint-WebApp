// @vitest-environment node
/**
 * The site's side of sharing (PACKAGE_E E4, E6; 2026-11-12), plant and prove. OFFLINE: the real owner status read and
 * the real introductions route against the fake Firestore; `requestIntroduction` is replaced only where a refusal is
 * forced; email delivery is not reached (the builders and the dispatch check are called directly).
 *
 * What this pins:
 * - before an introduction, nothing the site receives (its status payload, its emails) carries any company's name,
 *   contact name, email, website, phone or note: distinctive strings are planted in every field, and in the company's
 *   own words, which reach the site's page only with all of them taken out (2026-11-20) and never its emails;
 * - after an introduction, the site receives exactly that company's name and contact details, and still nothing of
 *   the other company;
 * - a job under an older statement shows no company section at all, whatever company records it has;
 * - the introductions route says each refusal in one plain sentence, and answers only the owner's link;
 * - each site email is checked again at dispatch: never after a withdrawal, never while the job is not visible.
 */
import { sharedCompanyClip } from "./helpers/sharedJob";
import { currentTermsAcceptance } from "./helpers/sharedJob";
import express from "express";
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { modelPassFindsNothing } from "./helpers/freeTextScreening";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore, authAdmin: null, storageAdmin: null };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/field-encryption", async importOriginal => ({ ...await importOriginal<typeof import("../utils/field-encryption")>(),
  decryptFieldValue: vi.fn(async (value: string) => String(value).replace(/^encrypted:/, "")) }));
vi.mock("../utils/email", () => ({ sendEmail: vi.fn(async () => ({ sent: true, provider: "resend", messageId: "accepted" })) }));
vi.mock("../utils/siteWalkthrough", async importOriginal => ({ ...await importOriginal<typeof import("../utils/siteWalkthrough")>(),
  savedWalkthrough: vi.fn(async () => ({ upload: { captureReceived: true, uploadState: "processing_ready" }, received: true, uploadState: "processing_ready" })) }));
const introductions = vi.hoisted(() => ({ forced: null as null | { ok: false; reason: string } | { ok: true; introducedAtIso: string } }));
vi.mock("../utils/jobIntroductions", async importOriginal => {
  const actual = await importOriginal<typeof import("../utils/jobIntroductions")>();
  return { ...actual, requestIntroduction: vi.fn(async (...args: Parameters<typeof actual.requestIntroduction>) =>
    introductions.forced ?? actual.requestIntroduction(...args)) };
});

const { default: briefRouter } = await import("../routes/site-task-brief");
const { createCaptureUploadToken } = await import("../utils/captureUploadToken");
const { buildJobSharedListing } = await import("../utils/jobSharedListing");
const { buildTaskLifecycleNotification, buildIntroductionMadeSiteNotification, SHARING_AND_HOW_TO_STOP } =
  await import("../utils/taskLifecycleNotifications");
const { taskLifecycleNotificationIsCurrent } = await import("../utils/taskLifecycleNotificationAuthority");
const { requestIntroduction } = await import("../utils/jobIntroductions");
const { COMPANY_RESPONSE_STATEMENT_VERSION, COMPANY_RESPONSE_STATEMENT_2026_11_12_VERSION } = await import("../../client/src/lib/companyResponses");

const ID = "req-site-plant";
const AT = "2026-11-12T10:00:00.000Z";
const sha = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
function company(tag: string) {
  return { partnerRole: "deployment", status: "approved", termsAcceptance: currentTermsAcceptance(), termsAcceptedByUid: `uid-${tag}`, name: `Person ${tag}plant`, company: `${tag}PLANT Robotics`,
    email: `contact-${tag.toLowerCase()}@${tag.toLowerCase()}-plant.example`, website: `https://www.${tag.toLowerCase()}-plant.example/about`,
    robot: `ROBOT-${tag}-PLANT`, region: `REGION-${tag}-PLANT`, decisionNote: `NOTE-${tag}-PLANT`,
    appliedAtIso: "2026-11-01T00:00:00.000Z", updatedAtIso: "2026-11-01T00:00:00.000Z", decidedAtIso: "2026-11-02T00:00:00.000Z" };
}
const NORTH = company("NORTHX");
const SOUTH = company("SOUTHX");
/** The companies' words, each naming the company, its person, its email, its website and a phone number. */
const WORDS = {
  north: "NORTHXPLANT Robotics palletizes cartons like these every day. Ask Person NORTHXplant at contact-northx@northx-plant.example.",
  south: "SOUTHXPLANT Robotics would need a second gripper for the far end; see https://www.southx-plant.example/about or call +1 415 555 0199.",
};
const planted = (record: typeof NORTH) => [record.company, record.email, record.website, record.name, record.robot, record.region,
  record.decisionNote, sha(record.email)];
const NORTH_PLANTED = [...planted(NORTH), WORDS.north, "NORTHX"];
const SOUTH_PLANTED = [...planted(SOUTH), WORDS.south, "SOUTHX"];
const expectNone = (label: string, text: string, strings: string[]) => {
  for (const value of strings) expect(text.toLowerCase(), `${label} contains ${value}`).not.toContain(value.toLowerCase());
};

function sharedJob(extra: Record<string, unknown> = {}) {
  return {
    requestId: ID,
    contact: { email: "encrypted:owner@site.example", firstName: "encrypted:Sam" },
    request: { buyerType: "site_operator", capture_mode: "self_capture", siteName: "encrypted:SITE-NAME-PLANT",
      consent_attestation: { granted: true, statement_version: "2026-11-12.v4", recorded_at_iso: AT } },
    public_task_listing: buildJobSharedListing({ taskStatement: "Stack cartons onto the pallet", atIso: AT }),
    capture_privacy_screen: { proceeded: true, eligibility: "eligible" },
    capture_coverage: { covers_scene: true },
    company_aliases: { [sha(NORTH.email)]: "A", [sha(SOUTH.email)]: "B" },
    walkthrough_job_estimates: { capture_id: `walkthrough-${ID}`, job_estimates: {
      object: "carton", object_largest_side_m: 0.4, object_mass_kg_low: 8, object_mass_kg_high: 11, object_surface: "matte",
      pick_to_place_m: 1.6, pick_height_m: null, place_height_m: null, front_clearance_m: 1.5,
      other_items_likely: [], cycle_seconds: null, basis: "A person stacks cartons onto a pallet." } },
    ...extra,
  };
}
/** An answer under the 2026-11-12 line, which keeps the company's alias; pass the current line to show its name. */
function answer(record: typeof NORTH, words: string, state = "interested", line = COMPANY_RESPONSE_STATEMENT_2026_11_12_VERSION) {
  return { state, inputs: words, email: record.email, company: record.company, submittedBy: record.email,
    recordedBy: "company", statementVersion: line, updatedAtIso: "2026-11-12T11:00:00.000Z" };
}
function seed(job = sharedJob()) {
  state.docs.set(`inboundRequests/${ID}`, job);
  state.docs.set(`captureUploadSessions/walkthrough-${ID}`, { company_clip: sharedCompanyClip(`walkthrough-${ID}`) });
  state.docs.set(`siteTaskBriefs/${ID}`, { requestId: ID, summary: "Stack cartons onto the pallet", confirmedAtIso: null });
  for (const record of [NORTH, SOUTH]) state.docs.set(`robotTeamAccess/${sha(record.email)}`, record);
  state.docs.set(`inboundRequests/${ID}/robotTeamInterest/${sha(NORTH.email)}`, answer(NORTH, WORDS.north));
  state.docs.set(`inboundRequests/${ID}/robotTeamInterest/${sha(SOUTH.email)}`, answer(SOUTH, WORDS.south, "needs_something"));
  state.docs.set(`inboundRequests/${ID}/companySends/send-1`, { companyId: sha(NORTH.email), sentAtIso: AT, sentBy: "system" });
  state.docs.set(`inboundRequests/${ID}/companySends/send-2`, { companyId: sha(SOUTH.email), sentAtIso: AT, sentBy: "system" });
}

let server: Server;
let base = "";
const token = (scope: "owner" | "film" = "owner") => createCaptureUploadToken({ requestId: ID, captureId: `walkthrough-${ID}`, sceneId: `site-${ID}`, scope });
async function siteStatus() {
  const response = await fetch(`${base}/api/site-task-brief/${token()}/status`);
  const raw = await response.text();
  expect(response.status, raw).toBe(200);
  return { raw, body: JSON.parse(raw) as Record<string, any> };
}
async function introduce(alias: string, scope: "owner" | "film" = "owner",
  statementVersion: string | null = "introduction-request-2026-11-12") {
  const response = await fetch(`${base}/api/site-task-brief/${token(scope)}/introductions`, { method: "POST",
    body: JSON.stringify({ alias, ...(statementVersion === null ? {} : { statementVersion }) }),
    headers: { "content-type": "application/json", cookie: "csrf_token=site-test", "x-csrf-token": "site-test" } });
  return { status: response.status, body: await response.json() as Record<string, any> };
}

beforeEach(async () => {
  // The model pass over free text finds nothing more than the deterministic pass (a company's words still reach the site).
  modelPassFindsNothing();
  state.docs.clear();
  (await import("../utils/jobAutoSend")).resetAnyCompanyMaySeeJobsCache();
  introductions.forced = null;
  seed();
  const app = express();
  app.use(express.json());
  app.use("/api/site-task-brief", briefRouter);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
afterEach(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
});

describe("the site is told its job is posted only when a company may see it (L1-N1)", () => {
  it("says no company can see it while no approved company has accepted the current Terms signed in", async () => {
    for (const record of [NORTH, SOUTH]) state.docs.set(`robotTeamAccess/${sha(record.email)}`, { ...record, termsAcceptedByUid: null });
    expect((await siteStatus()).body.answer.sharing).toEqual({ state: "visible", sharedAtIso: AT, noCompanyCanSee: true });
  });
});

describe("the site's status payload, before and after an introduction", () => {
  it("carries aliases, dates and fixed labels only before an introduction", async () => {
    const { raw, body } = await siteStatus();
    expect(body.answer.sharing).toEqual({ state: "visible", sharedAtIso: AT });
    expect(body.answer.companies.sent).toEqual({ count: 2, firstAtIso: AT });
    expect(body.answer.companies.entries.map((entry: Record<string, unknown>) => [entry.alias, entry.state]))
      .toEqual(expect.arrayContaining([["Company A", "interested"], ["Company B", "needs_something"]]));
    expectNone("status before the introduction", raw, [...NORTH_PLANTED, ...SOUTH_PLANTED]);
    // Why each answered as it did: the words, with every name, email, website and phone number taken out.
    const reasons = Object.fromEntries(body.answer.companies.entries.map((entry: Record<string, unknown>) => [entry.alias, entry.reason]));
    expect(reasons).toEqual({
      "Company A": "The company palletizes cartons like these every day. Ask the company at [removed].",
      "Company B": "The company would need a second gripper for the far end; see [removed] or call [removed].",
    });
  });

  // Owner, 2026-11-23: a company applies under a line that says the site sees its name and website with its answer.
  it("under the current line, carries the applicant's name and website, and still never its contact details", async () => {
    state.docs.set(`inboundRequests/${ID}/robotTeamInterest/${sha(NORTH.email)}`,
      answer(NORTH, WORDS.north, "interested", COMPANY_RESPONSE_STATEMENT_VERSION));
    const { raw, body } = await siteStatus();
    const north = body.answer.companies.entries.find((entry: Record<string, unknown>) => entry.alias === "Company A");
    expect(north.applicant).toEqual({ name: NORTH.company, website: NORTH.website });
    expect(north.company).toBeUndefined();
    // The email, the person, the robot, the region, the operator's note and the words as written never reach the site.
    expectNone("status with an applicant", raw, [NORTH.email, NORTH.name, NORTH.robot, NORTH.region, NORTH.decisionNote,
      sha(NORTH.email), WORDS.north, ...SOUTH_PLANTED]);
    // The answer under the 2026-11-12 line keeps its alias.
    expect(body.answer.companies.entries.find((entry: Record<string, unknown>) => entry.alias === "Company B").applicant).toBeUndefined();
  });

  it("shows no words given under the older line, or with no line", async () => {
    state.docs.set(`inboundRequests/${ID}/robotTeamInterest/${sha(NORTH.email)}`, { ...answer(NORTH, WORDS.north), statementVersion: "company-response-2026-11-01" });
    const { statementVersion: _dropped, ...noLine } = answer(SOUTH, WORDS.south, "needs_something");
    state.docs.set(`inboundRequests/${ID}/robotTeamInterest/${sha(SOUTH.email)}`, noLine);
    const { raw, body } = await siteStatus();
    expect(body.answer.companies.entries.filter((entry: Record<string, unknown>) => entry.kind === "answered")
      .map((entry: Record<string, unknown>) => entry.reason)).toEqual([undefined, undefined]);
    expect(raw).not.toContain("palletizes");
    expect(raw).not.toContain("second gripper");
  });

  it("after the site asked, carries exactly the introduced company's name and contact details, and nothing of the other", async () => {
    state.docs.set(`inboundRequests/${ID}/introductions/${sha(NORTH.email)}`, { schemaVersion: 1, alias: "A", requestedAtIso: "2026-11-12T12:00:00.000Z",
      by: "site", siteShared: { name: "SITE-NAME-PLANT", email: "owner@site.example" },
      companyShared: { company: NORTH.company, contactName: NORTH.name, email: NORTH.email, website: NORTH.website }, outcomes: [] });
    // Asked, but the company's email has not been sent in any state short of sent: not introduced, no details (H2).
    const companyRowKey = `captureOutbox/${ID}:introduction_made_company:${sha(NORTH.email)}`;
    for (const status of [null, "pending", "claimed", "dispatching", "unknown", "failed"]) {
      if (status === null) state.docs.delete(companyRowKey);
      else state.docs.set(companyRowKey, { kind: "introduction_made_company", requestId: ID, status, sentAtIso: null });
      const before = await siteStatus();
      const asked = before.body.answer.companies.entries.find((entry: Record<string, unknown>) => entry.alias === "Company A");
      expect(asked, `company row ${status}`).toMatchObject({ introductionPending: true });
      expect(asked).not.toHaveProperty("company");
      expect(asked).not.toHaveProperty("introducedAtIso");
      expectNone(`status with the company's email ${status}`, before.raw, [NORTH.company, NORTH.email, NORTH.name, NORTH.website]);
    }
    state.docs.set(companyRowKey, { kind: "introduction_made_company", requestId: ID, status: "sent", sentAtIso: "2026-11-12T12:01:00.000Z" });
    const { raw, body } = await siteStatus();
    const north = body.answer.companies.entries.find((entry: Record<string, unknown>) => entry.alias === "Company A");
    expect(north.company).toEqual({ name: NORTH.company, contactName: NORTH.name, email: NORTH.email, website: NORTH.website });
    expect(north.introducedAtIso).toBe("2026-11-12T12:01:00.000Z");
    expect(north).not.toHaveProperty("introductionPending");
    expect(body.answer.companies.introductions).toEqual({ used: 1 });
    // The company's words as written, its robot, region and the operator's note never reach the site, even after.
    expectNone("status after the introduction", raw, [WORDS.north, NORTH.robot, NORTH.region, NORTH.decisionNote, ...SOUTH_PLANTED]);
  });

  it.each(["2026-09-18.v1", "2026-11-02.v2", "2026-11-11.v3"])("shows no company section for a job under the older statement %s", async version => {
    const job = sharedJob();
    state.docs.set(`inboundRequests/${ID}`, { ...job, public_task_listing: { enabled: true, consentVersion: "public-task-card-with-answer-v3",
      approvedAtIso: AT, details: job.public_task_listing.details },
      request: { ...job.request, consent_attestation: { granted: true, statement_version: version, recorded_at_iso: AT } } });
    const { raw, body } = await siteStatus();
    expect(body.answer.sharing).toEqual({ state: "not_shared", sharedAtIso: null, olderStatement: true });
    expect(body.answer.companies).toBeUndefined();
    expectNone("older job's status", raw, [...NORTH_PLANTED, ...SOUTH_PLANTED, "Company A", "Company B"]);
  });
});

describe("the introductions route", () => {
  it("answers only the owner's link, and only a company alias", async () => {
    expect((await introduce("A", "film")).status).toBe(403);
    expect((await introduce("NORTHX PLANT")).status).toBe(400);
  });

  it.each([
    ["not_listed", "Your job is not in front of deployment companies right now, so you cannot accept a company."],
    ["not_interested", "This company has not applied, or has changed its answer since, so you cannot accept it now."],
    ["consent_missing", "This company needs to apply again before you can accept it."],
    ["already_introduced", "You have already accepted this company."],
    ["company_not_approved", "This company can no longer be accepted."],
  ])("says the refusal %s in one plain sentence", async (reason, sentence) => {
    introductions.forced = { ok: false, reason };
    expect(await introduce("Company A")).toEqual({ status: 409, body: { ok: false, code: "introduction_refused", reason, error: sentence } });
  });

  // Review S8: a withdrawn job is told for good, never "right now". (A fully revoked job is refused earlier by the
  // router's own rights check; this is the moment the withdrawal is on record and the job has just left companies' view.)
  it("says a withdrawn job's refusal without 'right now'", async () => {
    state.docs.set(`inboundRequests/${ID}`, sharedJob({ capture_withdrawal: { state: "uploads_stopped_cleanup_pending" } }));
    introductions.forced = { ok: false, reason: "not_listed" };
    expect(await introduce("A")).toEqual({ status: 409, body: { ok: false, code: "introduction_refused", reason: "withdrawn",
      error: "You withdrew this job, so you cannot accept a company." } });
  });

  // The sentence beside the button is a recorded statement (planner, 18:25Z): no version, or another, records nothing.
  it.each([[null], ["introduction-request-2026-11-01"], [""]])("refuses statement version %s and writes nothing", async version => {
    vi.mocked(requestIntroduction).mockClear();
    const before = JSON.stringify([...state.docs.entries()]);
    expect(await introduce("A", "owner", version)).toEqual({ status: 409, body: { ok: false, code: "introduction_statement_changed",
      error: "The wording on this page has changed. Reload the page, read it, then press Accept again." } });
    expect(vi.mocked(requestIntroduction)).not.toHaveBeenCalled();
    expect(JSON.stringify([...state.docs.entries()])).toBe(before);
  });

  it("says a refusal for a wording the company side no longer accepts as 'reload the page'", async () => {
    introductions.forced = { ok: false, reason: "statement_not_current" };
    expect(await introduce("A")).toEqual({ status: 409, body: { ok: false, code: "introduction_statement_changed",
      error: "The wording on this page has changed. Reload the page, read it, then press Accept again." } });
  });

  // End to end with the real `requestIntroduction` (review M2): the site's email says the company's own stored answer.
  it("queues the site's email with the company's real answer, and records the statement version", async () => {
    introductions.forced = null;
    // The introduction's personal fields are encrypted at rest (company side, C1): a fixture key.
    vi.stubEnv("FIELD_ENCRYPTION_KMS_KEY_NAME", ""); vi.stubEnv("FIELD_ENCRYPTION_MASTER_KEY", Buffer.alloc(32, 7).toString("base64"));
    const north = sha(NORTH.email), south = sha(SOUTH.email);
    state.docs.set(`inboundRequests/${ID}/robotTeamInterest/${north}`, answer(NORTH, WORDS.north, "tested_can_do"));
    const response = await introduce("A");
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    const intro = state.docs.get(`inboundRequests/${ID}/introductions/${north}`) as Record<string, any>;
    expect(intro.statementVersion).toBe("introduction-request-2026-11-12");
    const row = state.docs.get(`captureOutbox/${ID}:introduction_made_site:${north}`) as Record<string, any>;
    expect(row.body.split("\n")[0]).toBe(`${NORTH.company} answered "Tested it: can do" about your job, and you accepted them.`);
    expect(JSON.stringify(row)).not.toContain(WORDS.north);
    expect(state.docs.has(`inboundRequests/${ID}/introductions/${south}`)).toBe(false);
    vi.unstubAllEnvs();
  });

  it("passes the bare alias letter, and returns when the introduction was made", async () => {
    introductions.forced = { ok: true, introducedAtIso: "2026-11-12T12:00:00.000Z" };
    expect(await introduce("Company A")).toEqual({ status: 200, body: { ok: true, introducedAtIso: "2026-11-12T12:00:00.000Z" } });
    expect(vi.mocked(requestIntroduction)).toHaveBeenLastCalledWith({ requestId: ID, alias: "A", actor: "site",
      statementVersion: "introduction-request-2026-11-12" });
  });
});

describe("the emails to the site", () => {
  const url = "https://tryblueprint.io/capture-upload/owner-token";
  const build = (milestone: "task_received" | "company_answered", extra: Record<string, unknown> = {}) =>
    buildTaskLifecycleNotification({ requestId: ID, to: "owner@site.example", captureUrl: url, milestone, ...extra });

  it("say only fixed sentences before an introduction: no company's name, contact or words, and no summary", () => {
    // The job link email says where the job goes and how to stop; "Your job is posted" is no longer sent (ledger AL38).
    const sent = build("task_received");
    expect(sent.idempotencyKey).toBe(`${ID}:task_received`);
    expect(sent.body).toBe("Your job link is ready.\n\nA video is required to post your job. Use the link to send one or check your upload. "
      + `This link opens your job without a password, so please don't forward it.\n\n${SHARING_AND_HOW_TO_STOP}\n\nOpen your job:\n${url}`);
    // The withdrawal promise is whole: how to stop, that the job leaves every company's view, and the deletion ask.
    expect(SHARING_AND_HOW_TO_STOP).toContain("It then leaves every company's view at once, and each company it was sent to is asked to delete any copy it saved.");
    // The next step is named only when the job page offers it (e-028, e-029); fixed labels are quoted.
    const answered = build("company_answered", { eventId: "A-interested", companyAnswerState: "interested", introductionOffered: true });
    expect(answered.body).toBe(`A deployment company applied to your job. To meet them, press Accept on your job page.\n\nOpen your job:\n${url}`);
    const canDo = build("company_answered", { eventId: "A-tested_can_do", companyAnswerState: "tested_can_do", introductionOffered: true });
    expect(canDo.body).toBe(`A deployment company answered "Tested it: can do" about your job. To meet them, press Accept on your job page.\n\nOpen your job:\n${url}`);
    // Already introduced (or an answer under the older line): no button to press, so none is named.
    const introduced = build("company_answered", { eventId: "A-interested", companyAnswerState: "interested", introductionOffered: false });
    expect(introduced.body).toBe(`A deployment company applied to your job. Your job page has the details.\n\nOpen your job:\n${url}`);
    // An answer no introduction follows is never told how to meet the company, whatever the caller says.
    const declined = build("company_answered", { eventId: "A-declined", companyAnswerState: "declined", introductionOffered: true });
    expect(declined.body).toBe(`A deployment company answered "Not a fit" about your job. Your job page has the details.\n\nOpen your job:\n${url}`);
    const needs = build("company_answered", { eventId: "B-needs_something", companyAnswerState: "needs_something", questionOnPage: true });
    expect(needs.body).toBe(`A deployment company needs more details about your job. Read their question and answer it on your job page.\n\nOpen your job:\n${url}`);
    // Recorded by Blueprint from the company's email: no question box on the page, so none is promised.
    const recorded = build("company_answered", { eventId: "B-needs_something", companyAnswerState: "needs_something", questionOnPage: false });
    expect(recorded.body).toBe(`A deployment company needs more details about your job. Your job page has the details.\n\nOpen your job:\n${url}`);
    for (const row of [sent, answered, canDo, introduced, declined, needs, recorded]) {
      expectNone(row.kind, JSON.stringify(row), [...NORTH_PLANTED, ...SOUTH_PLANTED]);
      expect(`${row.subject} ${row.body}`).not.toMatch(/summary/i);
    }
  });

  it("after an introduction, say exactly the introduced company's details and reply to it", () => {
    const row = buildIntroductionMadeSiteNotification({ requestId: ID, to: "owner@site.example", companyId: sha(NORTH.email), captureUrl: url,
      company: { name: NORTH.company, contactName: NORTH.name, email: NORTH.email, website: NORTH.website }, answerLabel: "Applied" });
    expect(row).toMatchObject({ idempotencyKey: `${ID}:introduction_made_site:${sha(NORTH.email)}`, kind: "introduction_made_site",
      to: "owner@site.example", subject: `Meet ${NORTH.company}`, replyTo: NORTH.email });
    // A reply reaches Blueprint (dispatch sends Reply-To hello@), so it says where to write instead (decision 9).
    expect(row.body).toBe([`${NORTH.company} applied to your job, and you accepted them.`, "",
      `Contact: ${NORTH.name}`, `Email: ${NORTH.email}`, `Website: ${NORTH.website}`, "",
      "We've given them your details. Write to them at the email above.", "", `Open your job:\n${url}`].join("\n"));
    expectNone("introduction email", JSON.stringify(row), [WORDS.north, NORTH.robot, NORTH.region, NORTH.decisionNote, ...SOUTH_PLANTED]);
  });

  // Review M2: worded from the company's stored answer, never "Applied" for another answer; with none, no answer claimed.
  it("says the company's own answer in the introduction email", async () => {
    const { introductionMadeSiteEmail } = await import("../utils/introductionSiteEmail");
    const company = { name: NORTH.company, contactName: NORTH.name, email: NORTH.email, website: null };
    expect(introductionMadeSiteEmail({ jobUrl: url, company, answerLabel: "Tested it: can do" }).body.split("\n")[0])
      .toBe(`${NORTH.company} answered "Tested it: can do" about your job, and you accepted them.`);
    expect(introductionMadeSiteEmail({ jobUrl: url, company, answerLabel: "Applied" }).body.split("\n")[0])
      .toBe(`${NORTH.company} applied to your job, and you accepted them.`);
    const none = introductionMadeSiteEmail({ jobUrl: url, company });
    expect(none.body.split("\n")[0]).toBe(`You accepted ${NORTH.company}.`);
    expect(none.body).not.toMatch(/answered/);
  });

  it("are checked again at dispatch: never after a withdrawal, never while the job is not visible; Meet waits for the company's email", async () => {
    const companyId = sha(NORTH.email);
    const entry = (kind: string, idempotencyKey?: string) => ({ requestId: ID, kind: kind as never, ...(idempotencyKey ? { idempotencyKey } : {}) });
    expect(await taskLifecycleNotificationIsCurrent(entry("job_sent"))).toBe(true);
    // "Meet {company}" (planner, 20:35Z, H2 and H4): one commit point. It may go only once the company's introduction
    // email is definitely sent; from then on it goes whatever has changed since. Weakening this gate fails here.
    const site = () => taskLifecycleNotificationIsCurrent(entry("introduction_made_site", `${ID}:introduction_made_site:${companyId}`));
    const companyRow = (status: string | null) => status === null
      ? state.docs.delete(`captureOutbox/${ID}:introduction_made_company:${companyId}`)
      : state.docs.set(`captureOutbox/${ID}:introduction_made_company:${companyId}`, { kind: "introduction_made_company", requestId: ID, status });
    expect(await site()).toBe(false);
    state.docs.set(`inboundRequests/${ID}/introductions/${companyId}`, { schemaVersion: 1, alias: "A" });
    // On record, but the company's email has not gone (none, waiting, being handed over, uncertain, cancelled, failed).
    for (const status of [null, "pending", "claimed", "held", "dispatching", "unknown", "review_required", "cancelled", "failed"]) {
      companyRow(status);
      expect(await site(), `company row ${status}`).toBe(false);
    }
    companyRow("sent");
    expect(await site()).toBe(true);
    expect(await taskLifecycleNotificationIsCurrent(entry("introduction_made_site"))).toBe(false);
    expect(await taskLifecycleNotificationIsCurrent(entry("introduction_made_site", `${ID}:introduction_made_site:${"f".repeat(64)}`))).toBe(false);
    // Once the company's email is sent, a suspension, a technology partner, a stale acceptance or the site closing its job
    // does not stop the site being told who holds its details.
    for (const record of [{ ...NORTH, status: "declined" }, { ...NORTH, partnerRole: "technology" }, { ...NORTH, termsAcceptance: null }]) {
      state.docs.set(`robotTeamAccess/${companyId}`, record);
      expect(await site()).toBe(true);
    }
    state.docs.set(`robotTeamAccess/${companyId}`, NORTH);
    state.docs.set(`inboundRequests/${ID}`, sharedJob({ website_run_closures: { [`walkthrough-${ID}`]: { closed_at_iso: AT } } }));
    expect(await site()).toBe(true);
    expect(await taskLifecycleNotificationIsCurrent(entry("job_sent"))).toBe(false);
    // Before the company's email is sent, the one predicate decides: the same stops cancel it.
    companyRow("pending");
    expect(await site()).toBe(false);
    state.docs.set(`inboundRequests/${ID}`, sharedJob());
    for (const [label, patch] of [
      ["withdrawn", { consent_revoked: true }],
      ["held by Blueprint", { operator_listing_hold: { held: true, atIso: AT, by: "admin-1" } }],
      ["under a rights hold", { evaluation_readiness: { rights_review_status: "blocked" } }],
    ] as const) {
      state.docs.set(`inboundRequests/${ID}`, sharedJob(patch));
      for (const kind of ["job_sent", "company_answered"]) {
        const key = kind === "job_sent" ? `${ID}:job_sent:companies` : undefined;
        expect(await taskLifecycleNotificationIsCurrent(entry(kind, key)), `${kind} when ${label}`).toBe(false);
      }
      // "Meet {company}": stopped while the company's email has not gone; sent once it has.
      companyRow("pending");
      expect(await site(), `introduction_made_site when ${label}, company's email not sent`).toBe(false);
      companyRow("sent");
      expect(await site(), `introduction_made_site when ${label}, company's email sent`).toBe(true);
    }
  });
});
