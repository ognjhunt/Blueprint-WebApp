// @vitest-environment node
/**
 * "Find a deployment company for this job": the owner link's one explicit
 * choice. It records the request once, turns the job card on through the same
 * grant "Manage opportunity sharing" records, and rings Blueprint once. It
 * contacts no outside company. OFFLINE: the real route against the fake
 * Firestore; the outbox and Slack are fakes.
 */
import { createServer, type Server } from "node:http";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

vi.mock("../utils/websitePreparationStatus", () => ({ loadCurrentWebsitePreparationStatus: vi.fn(async () => null),
  loadCurrentTaskTargetChoiceQuestion: vi.fn(async () => null) }));
vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore,
    storageAdmin: { bucket: () => ({ file: (name: string) => ({
      getMetadata: async () => { throw Object.assign(new Error(`missing ${name}`), { code: 404 }); },
      exists: async () => [false], download: async () => [Buffer.alloc(0)],
      save: () => { throw new Error("Unexpected storage mutation"); },
      delete: () => { throw new Error("Unexpected storage mutation"); } }) }) } };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
const enqueueOutbox = vi.hoisted(() => vi.fn(async () => ({ enqueued: true })));
vi.mock("../utils/captureOutbox", async importOriginal => ({
  ...await importOriginal<typeof import("../utils/captureOutbox")>(), enqueueOutbox,
  deliverOutbox: vi.fn(async () => ({ examined: 0, sent: 0, failed: 0, exhausted: 0 })) }));
const sendSlackMessage = vi.hoisted(() => vi.fn(async () => ({ sent: true })));
vi.mock("../utils/slack", async importOriginal => ({ ...await importOriginal<typeof import("../utils/slack")>(), sendSlackMessage }));
vi.mock("../utils/email", () => ({ sendEmail: vi.fn(async () => { throw new Error("No email is sent from tests"); }) }));

// Sharing follows the job's outlook (review, 2026-11-11): these tests are about recording a request on a job that
// has its answer, so the outlook is the paper check unless a test sets another phase.
const outlookPhase = vi.hoisted(() => ({ value: "no_test" as string, real: false }));
vi.mock("../utils/jobOutlook", async importOriginal => {
  const original = await importOriginal<typeof import("../utils/jobOutlook")>();
  return { ...original, loadJobOutlookDecision: vi.fn(async (requestId: string) => outlookPhase.real ? original.loadJobOutlookDecision(requestId)
    : { outlook: { phase: outlookPhase.value, reason: null, sentence: null }, certain: true }) };
});
const briefRouter = (await import("../routes/site-task-brief")).default;
const { createCaptureUploadToken } = await import("../utils/captureUploadToken");
const { listingConsentVersion } = await import("../utils/taskListingDetails");
const { JOB_CARD_ANSWER_STATEMENT_VERSION } = await import("../../client/src/lib/jobCardAnswerConsent");
const { FIND_COMPANY_CONSENT } = await import("../../client/src/components/site/SiteAnswer");

let server: Server;
let baseUrl: string;
const owner = () => createCaptureUploadToken({ requestId: "req-1", captureId: "walkthrough-req-1", sceneId: "site-req-1" });
const film = () => createCaptureUploadToken({ requestId: "req-1", captureId: "walkthrough-req-1", sceneId: "site-req-1", scope: "film" });
const row = (key: string) => sharedFakeFirestoreState.docs.get(key) as Record<string, any>;

/** The page always sends the version of the sentence it showed. */
const SHOWN = () => ({ statementVersion: JOB_CARD_ANSWER_STATEMENT_VERSION });

async function ask(token = owner(), csrf = true, body: unknown = SHOWN()) {
  const response = await fetch(`${baseUrl}/api/site-task-brief/${token}/introduction-request`, {
    method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json",
      ...(csrf ? { cookie: "csrf_token=introduction-test", "x-csrf-token": "introduction-test" } : {}) } });
  return { status: response.status, body: await response.json() };
}

beforeEach(async () => {
  vi.clearAllMocks();
  outlookPhase.value = "no_test";
  outlookPhase.real = false;
  vi.stubEnv("SLACK_INBOUND_WEBHOOK_URL", "https://hooks.slack.invalid/test");
  sharedFakeFirestoreState.docs.clear();
  const app = express();
  app.use(express.json());
  app.use("/api/site-task-brief", briefRouter);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { requestId: "req-1", contact: { email: "owner@example.com" },
    request: { buyerType: "site_operator", capture_mode: "self_capture", siteTaskGates: {}, consent_attestation: {
      granted: true, statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-10-26T11:00:00.000Z" } } });
  sharedFakeFirestoreState.docs.set("siteTaskBriefs/req-1", { requestId: "req-1", summary: "Move cartons from the conveyor to the pallet",
    proposed: [], confirmedAtIso: null });
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
});

describe("POST /:token/introduction-request", () => {
  it.each(["reading", "building", "testing", "ended_by_site"])("refuses with a typed code while the job is %s, recording and listing nothing", async phase => {
    outlookPhase.value = phase;
    const before = structuredClone(row("inboundRequests/req-1"));
    const response = await ask();
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ code: "introduction_waits_for_answer", phase });
    expect(row("inboundRequests/req-1")).toEqual(before);
    expect(sendSlackMessage).not.toHaveBeenCalled();
  });
  it("refuses with the typed code, never a server error, when a closure record does not read", async () => {
    // The real loader: a malformed closure is unknown, so the job is still being worked on.
    outlookPhase.real = true;
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { ...row("inboundRequests/req-1"),
      website_run_closures: { "walkthrough-req-1": { schema_version: "website_run_closure.v1", broken: true } } });
    const before = structuredClone(row("inboundRequests/req-1"));
    const response = await ask();
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ code: "introduction_waits_for_answer" });
    expect(row("inboundRequests/req-1")).toEqual(before);
    expect(sendSlackMessage).not.toHaveBeenCalled();
  });
  it.each(["result", "no_test", "cannot_match"])("accepts a request once the job is %s", async phase => {
    outlookPhase.value = phase;
    expect((await ask()).status).toBe(200);
  });
  it("is the owner's alone", async () => {
    expect((await ask(film())).status).toBe(403);
    expect((await ask("not-a-token")).status).toBe(404);
    expect(row("inboundRequests/req-1").introduction_request).toBeUndefined();
    expect(sendSlackMessage).not.toHaveBeenCalled();
  });

  it("refuses a request without the CSRF token, and any body field but the statement version", async () => {
    expect((await ask(owner(), false)).status).toBe(403);
    expect((await ask(owner(), true, { company: "Acme" })).status).toBe(400);
    expect(row("inboundRequests/req-1").introduction_request).toBeUndefined();
  });

  it("refuses once recording consent is withdrawn", async () => {
    row("inboundRequests/req-1").consent_revoked = true;
    expect((await ask()).status).toBe(409);
    expect(row("inboundRequests/req-1").introduction_request).toBeUndefined();
  });

  it("records once, turns the card on under its consent version, and rings once", async () => {
    const first = await ask();
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ ok: true, requestedAtIso: expect.any(String), listed: true,
      sharing: { state: "visible", sharedAtIso: first.body.requestedAtIso, leavesOut: { firstLook: false, trialResult: false } } });
    const stored = row("inboundRequests/req-1");
    // The choice is recorded with the exact sentence shown under the button, and its version.
    expect(stored.introduction_request).toEqual({ requested_at_iso: first.body.requestedAtIso, requested_by: "signed_owner_link",
      statement_version: JOB_CARD_ANSWER_STATEMENT_VERSION, statement_text: FIND_COMPANY_CONSENT });
    expect(JOB_CARD_ANSWER_STATEMENT_VERSION).toBe("public-task-card-with-answer-v3");
    expect(FIND_COMPANY_CONSENT).toBe("Shares a summary of your job and your answer, including later test results, without saying who you are, "
      + "with companies we've approved. Your video, address and contacts stay private.");
    // The same grant "Manage opportunity sharing" records, with the anonymised card text, under the statement
    // that also names the answer: the older box's version does not cover it.
    expect(stored.public_task_listing).toMatchObject({ enabled: true, consentVersion: JOB_CARD_ANSWER_STATEMENT_VERSION,
      approvedBy: "signed_owner_link", details: { title: "Carton palletizing opportunity", opportunity: "open" } });
    expect(JSON.stringify(stored.public_task_listing)).not.toMatch(/conveyor/);
    expect(sendSlackMessage).toHaveBeenCalledTimes(1);
    const bell = (sendSlackMessage.mock.calls[0] as unknown as [string])[0];
    expect(bell).toContain("`req-1`");
    expect(bell).not.toMatch(/owner@example\.com|conveyor/);
    // The site hears its card went live, once, through the outbox.
    expect(enqueueOutbox.mock.calls.filter(call => (call as unknown as [{ kind: string }])[0].kind === "listing_live")).toHaveLength(1);

    const second = await ask();
    expect(second.body).toEqual({ ok: true, requestedAtIso: first.body.requestedAtIso, listed: true,
      sharing: { state: "visible", sharedAtIso: first.body.requestedAtIso, leavesOut: { firstLook: false, trialResult: false } } });
    expect(sendSlackMessage).toHaveBeenCalledTimes(1);
    expect(row("inboundRequests/req-1").public_task_listing.approvedAtIso).toBe(stored.public_task_listing.approvedAtIso);
  });

  it("moves a card already on under the older box to the statement the site just agreed to, and changes nothing else", async () => {
    const { loadJobCardAnswer } = await import("../utils/jobCardAnswer");
    // A video reading, so the job has an answer to carry.
    row("inboundRequests/req-1").capture_coverage = { covers_scene: true };
    row("inboundRequests/req-1").walkthrough_job_estimates = { capture_id: "walkthrough-req-1", job_estimates: { object: "carton",
      object_largest_side_m: 0.4, object_mass_kg_low: 3, object_mass_kg_high: 4, object_surface: "matte", pick_to_place_m: 1,
      pick_height_m: null, place_height_m: null, front_clearance_m: 1.5, other_items_likely: [], cycle_seconds: null,
      basis: "A person moves cartons from a conveyor to a pallet." } };
    const listing = { enabled: true, details: { title: "The owner's own reviewed card" }, consentVersion: listingConsentVersion,
      approvedAtIso: "2026-11-01T00:00:00.000Z", wentLiveIso: "2026-11-01T00:00:00.000Z", briefRevision: "rev-1",
      thumbnailDigest: "thumb-1", reviewRequired: false, approvedBy: "signed_owner_link" };
    row("inboundRequests/req-1").public_task_listing = structuredClone(listing);
    // Under the older box alone the card carries no answer.
    expect(await loadJobCardAnswer("req-1", row("inboundRequests/req-1"))).toBeNull();

    expect((await ask()).body).toMatchObject({ ok: true, listed: true });
    const after = row("inboundRequests/req-1");
    // Only the consent changes: the owner's reviewed card, and its published date, are byte for byte as they were.
    expect(after.public_task_listing.consentVersion).toBe(JOB_CARD_ANSWER_STATEMENT_VERSION);
    const { consentVersion: _c, ...rest } = after.public_task_listing;
    const { consentVersion: _c0, ...before } = listing;
    expect(JSON.stringify(rest)).toBe(JSON.stringify(before));
    expect(after.public_task_listing.approvedAtIso).toBe("2026-11-01T00:00:00.000Z");
    expect(after.introduction_request.statement_version).toBe(JOB_CARD_ANSWER_STATEMENT_VERSION);
    // The card is not going live: no team alert intent, no team email, no go-live notice.
    expect(after).not.toHaveProperty("newJobAlertFanout");
    const kinds = enqueueOutbox.mock.calls.map(call => (call as unknown as [{ kind: string }])[0].kind);
    expect(kinds).not.toContain("robot_team_new_task");
    expect(kinds).not.toContain("listing_live");
    // The card now carries the answer.
    const carried = await loadJobCardAnswer("req-1", after);
    expect(carried?.headline).toMatch(/^Most likely to fit: /);

    // A second press changes nothing.
    const snapshot = JSON.stringify(row("inboundRequests/req-1"));
    expect((await ask()).body).toMatchObject({ ok: true, listed: true });
    expect(JSON.stringify(row("inboundRequests/req-1"))).toBe(snapshot);
    expect(sendSlackMessage).toHaveBeenCalledTimes(1);

    // The site later re-saves its card under the older box: the answer comes off the card again.
    const { applyOwnerTaskListing } = await import("../routes/task-listings");
    const { anonymizedOpportunityDraft } = await import("../../client/src/types/taskBrowse");
    await applyOwnerTaskListing("req-1", { enabled: true, consent: true, details: anonymizedOpportunityDraft("Move cartons to the pallet") });
    expect(row("inboundRequests/req-1").public_task_listing.consentVersion).toBe(listingConsentVersion);
    expect(await loadJobCardAnswer("req-1", row("inboundRequests/req-1"))).toBeNull();
  });

  it("leaves a card that is already on under the statement as it is", async () => {
    const listing = { enabled: true, details: { title: "The owner's own reviewed card" }, consentVersion: JOB_CARD_ANSWER_STATEMENT_VERSION,
      approvedAtIso: "2026-11-01T00:00:00.000Z" };
    row("inboundRequests/req-1").public_task_listing = structuredClone(listing);
    expect((await ask()).body).toMatchObject({ ok: true, listed: true });
    expect(row("inboundRequests/req-1").public_task_listing).toEqual(listing);
  });

  // Rewritten in round 5: a press under the sentence shown now is a new choice under it. An older request keeps the
  // time of its first choice, and records the sentence now agreed to and when (so a card can carry later test results).
  it.each([
    ["recorded without a statement", {}],
    ["recorded under v2", { statement_version: "public-task-card-with-answer-v2",
      statement_text: "Shares a summary of your job and this answer, without saying who you are, with companies we've approved. Your video, address and contacts stay private." }],
  ])("records the v3 sentence on a new press of an older request (%s), keeping the first choice's time", async (_name, older) => {
    row("inboundRequests/req-1").introduction_request = { requested_at_iso: "2026-11-10T00:00:00.000Z", requested_by: "signed_owner_link", ...older };
    row("inboundRequests/req-1").public_task_listing = { enabled: true, consentVersion: "public-task-card-with-answer-v2", details: { title: "Kept" } };
    expect((await ask()).body).toMatchObject({ ok: true, requestedAtIso: "2026-11-10T00:00:00.000Z" });
    expect(row("inboundRequests/req-1").introduction_request).toMatchObject({ requested_at_iso: "2026-11-10T00:00:00.000Z",
      requested_by: "signed_owner_link", statement_version: JOB_CARD_ANSWER_STATEMENT_VERSION, statement_text: FIND_COMPANY_CONSENT,
      statement_recorded_at_iso: expect.any(String) });
    expect(row("inboundRequests/req-1").public_task_listing).toMatchObject({ consentVersion: JOB_CARD_ANSWER_STATEMENT_VERSION, details: { title: "Kept" } });
  });

  it("records the statement the page showed, and refuses a request that names none, recording and listing nothing", async () => {
    // Without the version there is no record of what the site agreed to.
    const unnamed = await ask(owner(), true, {});
    expect(unnamed).toEqual({ status: 400, body: { code: "introduction_request_invalid",
      error: "Press the button on your job page to ask for this." } });
    expect(row("inboundRequests/req-1").introduction_request).toBeUndefined();
    expect(row("inboundRequests/req-1").public_task_listing).toBeUndefined();
    expect(sendSlackMessage).not.toHaveBeenCalled();
    expect((await ask(owner(), true, { statementVersion: "" })).status).toBe(400);
    const current = await ask(owner(), true, { statementVersion: JOB_CARD_ANSWER_STATEMENT_VERSION });
    expect(current).toMatchObject({ status: 200, body: { ok: true, listed: true } });
    expect(row("inboundRequests/req-1").introduction_request).toMatchObject({ statement_version: JOB_CARD_ANSWER_STATEMENT_VERSION,
      statement_text: FIND_COMPANY_CONSENT });
  });

  it("refuses a page that showed another statement, recording and listing nothing, and asks it to reload", async () => {
    // v1 is still a valid record of a choice already made, but a page showing it now is out of date.
    for (const version of ["public-task-card-with-answer-v0", "public-task-card-with-answer-v1", "public-task-card-with-answer-v2"]) {
      expect(await ask(owner(), true, { statementVersion: version }), version).toMatchObject({ status: 409 });
    }
    const stale = await ask(owner(), true, { statementVersion: "public-task-card-with-answer-v0" });
    expect(stale).toEqual({ status: 409, body: { code: "introduction_request_statement_changed",
      error: "The wording on this page has changed. Reload the page to read it, then press the button again." } });
    expect(row("inboundRequests/req-1").introduction_request).toBeUndefined();
    expect(row("inboundRequests/req-1").public_task_listing).toBeUndefined();
    expect(sendSlackMessage).not.toHaveBeenCalled();
    expect(enqueueOutbox).not.toHaveBeenCalled();
    // Any other field is still refused.
    expect((await ask(owner(), true, { statementVersion: JOB_CARD_ANSWER_STATEMENT_VERSION, company: "Acme" })).status).toBe(400);
  });

  it("still records the request when the card cannot be turned on", async () => {
    row("inboundRequests/req-1").request.buyerType = "robot_team";
    const response = await ask();
    expect(response.body).toEqual({ ok: true, requestedAtIso: expect.any(String), listed: false,
      sharing: { state: "not_shared", sharedAtIso: null } });
    expect(row("inboundRequests/req-1").introduction_request.requested_at_iso).toBe(response.body.requestedAtIso);
    expect(row("inboundRequests/req-1").public_task_listing).toBeUndefined();
    expect(sendSlackMessage).toHaveBeenCalledTimes(1);
  });

  it("lists the card in the job library without alerting any deployment company, and tells Blueprint so", async () => {
    const { buildUpdatePreferences } = await import("../utils/updatePreferences");
    const { accessRecordId } = await import("../utils/robotTeamEarlyAccess");
    // An approved team that has opted in to new-job alerts, which "Manage opportunity sharing" would email.
    sharedFakeFirestoreState.docs.set(`robotTeamAccess/${accessRecordId("team@example.com")}`, { name: "Ada", email: "team@example.com",
      status: "approved", decidedAtIso: "2026-11-01T00:00:00.000Z", decidedBy: "fixture-ops", appliedAtIso: "2026-11-01T00:00:00.000Z",
      newJobAlertsOptIn: true, updatedAtIso: "2026-11-01T00:00:00.000Z", updatePreferences: buildUpdatePreferences({ newsletter: false,
        newJobAlerts: true, interests: {}, declaredCategories: {}, requirements: {} }, "settings") });
    expect((await ask()).body).toMatchObject({ ok: true, listed: true });
    const stored = row("inboundRequests/req-1");
    expect(stored.public_task_listing).toMatchObject({ enabled: true, wentLiveIso: expect.any(String) });
    expect(stored).not.toHaveProperty("newJobAlertFanout");
    const outbox = [...sharedFakeFirestoreState.docs].filter(([key]) => key.startsWith("captureOutbox/"));
    expect(outbox.filter(([, entry]) => (entry as { kind?: string }).kind === "robot_team_new_task")).toEqual([]);
    expect(enqueueOutbox.mock.calls.map(call => (call as unknown as [{ kind: string }])[0].kind)).not.toContain("robot_team_new_task");
    // Blueprint's owner is rung once, told that no company was emailed and that alerting them is theirs to decide.
    expect(sendSlackMessage).toHaveBeenCalledTimes(1);
    expect((sendSlackMessage.mock.calls[0] as unknown as [string])[0])
      .toContain("No deployment company has been emailed; whether to alert them is your decision.");
  });

  // The frame of 2026-11-12: every approach to an outside company needs the owner's go-ahead, so the ordinary listing
  // grant ("Manage opportunity sharing") no longer records a team alert intent either (it used to).
  it("the ordinary listing grant records no team alert intent when the card goes live", async () => {
    const { applyOwnerTaskListing } = await import("../routes/task-listings");
    const { anonymizedOpportunityDraft } = await import("../../client/src/types/taskBrowse");
    const { wentLive } = await applyOwnerTaskListing("req-1", { enabled: true, consent: true,
      details: anonymizedOpportunityDraft("Move cartons from the conveyor to the pallet") });
    expect(wentLive).toEqual(expect.any(String));
    expect(row("inboundRequests/req-1")).not.toHaveProperty("newJobAlertFanout");
    expect(enqueueOutbox.mock.calls.map(call => (call as unknown as [{ kind: string }])[0].kind)).not.toContain("robot_team_new_task");
  });
});
