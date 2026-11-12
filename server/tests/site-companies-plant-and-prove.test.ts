// @vitest-environment node
/**
 * The site's side of sharing (PACKAGE_E E4, E6; 2026-11-12), plant and prove. OFFLINE: the real owner status read and
 * the real introductions route against the fake Firestore; `requestIntroduction` is replaced only where a refusal is
 * forced; email delivery is not reached (the builders and the dispatch check are called directly).
 *
 * What this pins:
 * - before an introduction, nothing the site receives (its status payload, its emails) carries any company's name,
 *   contact name, email, website or words: distinctive strings are planted in every field;
 * - after an introduction, the site receives exactly that company's name and contact details, and still nothing of
 *   the other company;
 * - a job under an older statement shows no company section at all, whatever company records it has;
 * - the introductions route says each refusal in one plain sentence, and answers only the owner's link;
 * - each site email is checked again at dispatch: never after a withdrawal, never while the job is not visible.
 */
import express from "express";
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";

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
const { buildTaskLifecycleNotification, buildIntroductionMadeSiteNotification, LISTING_LIVE_SENTENCES, HOW_TO_WITHDRAW } =
  await import("../utils/taskLifecycleNotifications");
const { taskLifecycleNotificationIsCurrent } = await import("../utils/taskLifecycleNotificationAuthority");
const { requestIntroduction } = await import("../utils/jobIntroductions");
const { COMPANY_RESPONSE_STATEMENT_VERSION } = await import("../../client/src/lib/companyResponses");

const ID = "req-site-plant";
const AT = "2026-11-12T10:00:00.000Z";
const sha = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
function company(tag: string) {
  return { partnerRole: "deployment", status: "approved", name: `Person ${tag}plant`, company: `${tag}PLANT Robotics`,
    email: `contact-${tag.toLowerCase()}@${tag.toLowerCase()}-plant.example`, website: `https://www.${tag.toLowerCase()}-plant.example/about`,
    robot: `ROBOT-${tag}-PLANT`, region: `REGION-${tag}-PLANT`, decisionNote: `NOTE-${tag}-PLANT`,
    appliedAtIso: "2026-11-01T00:00:00.000Z", updatedAtIso: "2026-11-01T00:00:00.000Z", decidedAtIso: "2026-11-02T00:00:00.000Z" };
}
const NORTH = company("NORTHX");
const SOUTH = company("SOUTHX");
const WORDS = { north: "NORTHX-WORDS: we would need a second gripper", south: "SOUTHX-WORDS: our arm palletizes this today" };
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
function answer(record: typeof NORTH, words: string, state = "interested") {
  return { state, inputs: { words }, words, email: record.email, company: record.company, submittedBy: record.email,
    recordedBy: "company", statementVersion: COMPANY_RESPONSE_STATEMENT_VERSION, updatedAtIso: "2026-11-12T11:00:00.000Z" };
}
function seed(job = sharedJob()) {
  state.docs.set(`inboundRequests/${ID}`, job);
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
async function introduce(alias: string, scope: "owner" | "film" = "owner") {
  const response = await fetch(`${base}/api/site-task-brief/${token(scope)}/introductions`, { method: "POST", body: JSON.stringify({ alias }),
    headers: { "content-type": "application/json", cookie: "csrf_token=site-test", "x-csrf-token": "site-test" } });
  return { status: response.status, body: await response.json() as Record<string, any> };
}

beforeEach(async () => {
  state.docs.clear();
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

describe("the site's status payload, before and after an introduction", () => {
  it("carries aliases, dates and fixed labels only before an introduction", async () => {
    const { raw, body } = await siteStatus();
    expect(body.answer.sharing).toEqual({ state: "visible", sharedAtIso: AT });
    expect(body.answer.companies.sent).toEqual({ count: 2, firstAtIso: AT });
    expect(body.answer.companies.entries.map((entry: Record<string, unknown>) => [entry.alias, entry.state]))
      .toEqual(expect.arrayContaining([["Company A", "interested"], ["Company B", "needs_something"]]));
    expectNone("status before the introduction", raw, [...NORTH_PLANTED, ...SOUTH_PLANTED]);
  });

  it("after the site asked, carries exactly the introduced company's name and contact details, and nothing of the other", async () => {
    state.docs.set(`inboundRequests/${ID}/introductions/${sha(NORTH.email)}`, { schemaVersion: 1, alias: "A", requestedAtIso: "2026-11-12T12:00:00.000Z",
      by: "site", siteShared: { name: "SITE-NAME-PLANT", email: "owner@site.example" },
      companyShared: { company: NORTH.company, contactName: NORTH.name, email: NORTH.email, website: NORTH.website }, outcomes: [] });
    const { raw, body } = await siteStatus();
    const north = body.answer.companies.entries.find((entry: Record<string, unknown>) => entry.alias === "Company A");
    expect(north.company).toEqual({ name: NORTH.company, contactName: NORTH.name, email: NORTH.email, website: NORTH.website });
    expect(north.introducedAtIso).toBe("2026-11-12T12:00:00.000Z");
    expect(body.answer.companies.introductions).toEqual({ used: 1, max: 3 });
    // The company's words, its robot, region and the operator's note never reach the site, even after.
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
    ["not_listed", "Your job is not in front of deployment companies right now, so we cannot make an introduction."],
    ["not_interested", "This company has not answered Interested, so we cannot introduce you."],
    ["consent_missing", "This company needs to answer again before we can introduce you."],
    ["limit_reached", "You have used your three introductions."],
    ["already_introduced", "You have already been introduced to this company. Their details are on this page and in your email."],
    ["company_not_approved", "This company can no longer be introduced."],
  ])("says the refusal %s in one plain sentence", async (reason, sentence) => {
    introductions.forced = { ok: false, reason };
    expect(await introduce("Company A")).toEqual({ status: 409, body: { ok: false, code: "introduction_refused", reason, error: sentence } });
  });

  it("passes the bare alias letter, and returns when the introduction was made", async () => {
    introductions.forced = { ok: true, introducedAtIso: "2026-11-12T12:00:00.000Z" };
    expect(await introduce("Company A")).toEqual({ status: 200, body: { ok: true, introducedAtIso: "2026-11-12T12:00:00.000Z" } });
    expect(vi.mocked(requestIntroduction)).toHaveBeenLastCalledWith({ requestId: ID, alias: "A", actor: "site" });
  });
});

describe("the emails to the site", () => {
  const url = "https://tryblueprint.io/capture-upload/owner-token";
  const build = (milestone: "listing_live" | "job_sent" | "company_answered", extra: Record<string, unknown> = {}) =>
    buildTaskLifecycleNotification({ requestId: ID, to: "owner@site.example", captureUrl: url, milestone, ...extra });

  it("say only fixed sentences before an introduction: no company's name, contact or words, and no summary", () => {
    const live = build("listing_live", { eventId: "summary-1" });
    expect(live.subject).toBe("Your job is with deployment companies");
    expect(live.body).toBe(`${LISTING_LIVE_SENTENCES}\n\n${HOW_TO_WITHDRAW}\n\nOpen your job:\n${url}`);
    expect(LISTING_LIVE_SENTENCES).toBe("Deployment companies we approve can now see your job. We don't share your name, address or contact "
      + "details with a deployment company unless you ask for an introduction to it. Your job page shows any answer.");
    const sent = build("job_sent", { eventId: "companies", companyCount: 4 });
    expect(sent.idempotencyKey).toBe(`${ID}:job_sent:companies`);
    expect(sent.body).toBe(`Your job is with 4 deployment companies. Your job page shows any answer.\n\nOpen your job:\n${url}`);
    expect(build("job_sent", { eventId: "companies", companyCount: 1 }).body).toMatch(/^Your job is with 1 deployment company\./);
    const answered = build("company_answered", { eventId: "A-interested", companyAnswerState: "interested" });
    expect(answered.body).toBe(`A deployment company answered about your job: Interested. Your job page has the details.\n\nOpen your job:\n${url}`);
    const needs = build("company_answered", { eventId: "B-needs_something", companyAnswerState: "needs_something" });
    expect(needs.body).toBe("A deployment company answered about your job: Would need something. Your job page has the details. "
      + `A few quick answers on your job page may be all they need.\n\nOpen your job:\n${url}`);
    for (const row of [live, sent, answered, needs]) {
      expectNone(row.kind, JSON.stringify(row), [...NORTH_PLANTED, ...SOUTH_PLANTED]);
      expect(`${row.subject} ${row.body}`).not.toMatch(/summary/i);
    }
  });

  it("after an introduction, say exactly the introduced company's details and reply to it", () => {
    const row = buildIntroductionMadeSiteNotification({ requestId: ID, to: "owner@site.example", companyId: sha(NORTH.email), captureUrl: url,
      company: { name: NORTH.company, contactName: NORTH.name, email: NORTH.email, website: NORTH.website } });
    expect(row).toMatchObject({ idempotencyKey: `${ID}:introduction_made_site:${sha(NORTH.email)}`, kind: "introduction_made_site",
      to: "owner@site.example", subject: `Meet ${NORTH.company}`, replyTo: NORTH.email });
    expect(row.body).toBe([`${NORTH.company} answered Interested about your job, and you asked us to introduce you.`, "",
      `Contact: ${NORTH.name}`, `Email: ${NORTH.email}`, `Website: ${NORTH.website}`, "",
      "We've given them your details. Reply to them directly.", "", `Open your job:\n${url}`].join("\n"));
    expectNone("introduction email", JSON.stringify(row), [WORDS.north, NORTH.robot, NORTH.region, NORTH.decisionNote, ...SOUTH_PLANTED]);
  });

  it("are checked again at dispatch: never after a withdrawal, never while the job is not visible", async () => {
    const companyId = sha(NORTH.email);
    const entry = (kind: string, idempotencyKey?: string) => ({ requestId: ID, kind: kind as never, ...(idempotencyKey ? { idempotencyKey } : {}) });
    expect(await taskLifecycleNotificationIsCurrent(entry("listing_live"))).toBe(true);
    // "Meet {company}" needs the introduction on record.
    expect(await taskLifecycleNotificationIsCurrent(entry("introduction_made_site", `${ID}:introduction_made_site:${companyId}`))).toBe(false);
    state.docs.set(`inboundRequests/${ID}/introductions/${companyId}`, { schemaVersion: 1, alias: "A" });
    expect(await taskLifecycleNotificationIsCurrent(entry("introduction_made_site", `${ID}:introduction_made_site:${companyId}`))).toBe(true);
    expect(await taskLifecycleNotificationIsCurrent(entry("introduction_made_site"))).toBe(false);
    for (const [label, patch] of [
      ["withdrawn", { consent_revoked: true }],
      ["held by Blueprint", { operator_listing_hold: { held: true, atIso: AT, by: "admin-1" } }],
      ["under a rights hold", { evaluation_readiness: { rights_review_status: "blocked" } }],
    ] as const) {
      state.docs.set(`inboundRequests/${ID}`, sharedJob(patch));
      for (const kind of ["listing_live", "job_sent", "company_answered", "introduction_made_site"]) {
        const key = kind === "introduction_made_site" ? `${ID}:introduction_made_site:${companyId}` : kind === "job_sent" ? `${ID}:job_sent:companies` : undefined;
        expect(await taskLifecycleNotificationIsCurrent(entry(kind, key)), `${kind} when ${label}`).toBe(false);
      }
    }
  });
});
