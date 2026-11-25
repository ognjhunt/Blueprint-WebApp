// @vitest-environment node
/**
 * The internal test company's marker and its rules (owner, 2026-11-25; `server/utils/internalTestCompany.ts`).
 *
 * - The marker `internal_test_company` is written by the signed internal route alone: a scan of the code for every way a
 *   field is written (an object key, a quoted key or update path, the field-name constant).
 * - Who it is: the marker, the configured inbox, approved, a deployment company; nothing without the setting; a marked
 *   record that does not match is neither it nor an ordinary company.
 * - The one job predicate with its flag: every real job closed to it; a test job opened only through every safety stop.
 * - The outbox's rule for a test job's row, and money: its introductions are test events, outside the owner's totals
 *   and the CSV.
 */
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ default: {}, dbAdmin: null }));

import { INTERNAL_TEST_COMPANY_FIELD, hasInternalTestCompanyMarker, internalTestCompanyEmail, internalTestCompanyId,
  internalTestRowMayBeDelivered, isInternalTestCompany, isInternalTestCompanyRow, isInternalTestPair } from "../utils/internalTestCompany";
import { companyMayActOnJob, companyMaySeeJobs, isApprovedDeploymentCompanyRecord } from "../utils/companyTerms";
import { accessRecordId } from "../utils/robotTeamEarlyAccess";
import { teamJobAccess } from "../utils/teamJobAccess";
import { jobSharingOf } from "../utils/siteAnswer";
import { BILLABLE_EVENTS_CSV_HEADER, billableEventsCsv, loadJobTotals } from "../utils/ownerTotals";
import { buildIntroductionBillableEvent, isMadeBillableEvent, isTestBillableEvent, isUnmadeBillableEvent,
  tallyStandingBillableEvents } from "../utils/billableEvents";
import { INTERNAL_TEST_RECORDING_STATEMENT_VERSION } from "../utils/internalTestJob";
import { sealWebsiteJobNoGrantEnding } from "../utils/websiteJobWindowEnding";
import { currentTermsAcceptance, passedPrivacyScreen, sharedJobListing, sharedRecordingGrant } from "./helpers/sharedJob";

const ROOT = path.resolve(__dirname, "../..");
function sources(dir: string): string[] {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "tests" || entry.name === "node_modules" ? [] : sources(relative);
    return /\.(ts|tsx|js|mjs|cjs)$/.test(entry.name) ? [relative] : [];
  });
}
const code = () => [...sources("server"), ...sources("client/src"), ...sources("scripts")]
  .map(file => ({ file, text: fs.readFileSync(path.join(ROOT, file), "utf8") }));

const INBOX = "internal-test-inbox@example.com";
const SETTING = "BLUEPRINT_INTERNAL_TEST_COMPANY_EMAIL";
const MARKER = { created_at_iso: "2026-11-25T12:00:00.000Z", created_by: "pipeline_sync_signature" };
const testCompany = (extra: Record<string, unknown> = {}) => ({ name: "Blueprint internal test company", email: INBOX,
  company: "Blueprint internal test company", website: null, partnerRole: "deployment", source: "invite", status: "approved",
  decidedAtIso: "2026-11-25T12:00:00.000Z", decidedBy: "pipeline_sync_signature", [INTERNAL_TEST_COMPANY_FIELD]: MARKER, ...extra });
const realCompany = (extra: Record<string, unknown> = {}) => ({ email: "contact@north.example.com", company: "North Robotics",
  partnerRole: "deployment", status: "approved", termsAcceptance: currentTermsAcceptance(), termsAcceptedByUid: "uid-north", ...extra });

const ID = "req-itc";
const TEST_MARKER = { label: "rigid pick", footage_id: "pexels-854533", created_by: "pipeline_sync_signature",
  created_at_iso: "2026-11-15T12:00:00.000Z" };
const INTERNAL_GRANT = { granted: true, statement_version: INTERNAL_TEST_RECORDING_STATEMENT_VERSION,
  recorded_at_iso: "2026-11-15T12:00:00.000Z", basis: "blueprint_internal_test" };
/** A real job every company would see today. */
const realJob = (extra: Record<string, unknown> = {}) => ({ requestId: ID,
  request: { buyerType: "site_operator", capture_mode: "self_capture", consent_attestation: sharedRecordingGrant() },
  public_task_listing: sharedJobListing(), capture_privacy_screen: passedPrivacyScreen(ID), ...extra });
/** An internal test job as the internal route creates it: the marker and the internal grant, no listing, no contact. */
const testJob = (extra: Record<string, unknown> = {}) => ({ requestId: ID,
  request: { buyerType: "site_operator", capture_mode: "self_capture", consent_attestation: INTERNAL_GRANT },
  internal_test: TEST_MARKER, ...extra });
const CONTEXT = { brief: { summary: "Stack cartons onto the pallet", confirmedAtIso: "2026-11-15T12:00:00.000Z" }, preparationState: null,
  companyVideoReady: true };

beforeEach(() => { vi.stubEnv(SETTING, INBOX); });
afterEach(() => { vi.unstubAllEnvs(); });

describe("the marker is written by the internal route alone", () => {
  it("has one writer in the server, the client and the scripts", () => {
    const writes = [
      /\binternal_test_company\s*:/, // an object key
      /["']internal_test_company["']\s*[:,\])]/, // a quoted key, an update path or a merge field
      /["']internal_test_company\.[A-Za-z_]+["']/, // a dotted update path into the marker
      /\[\s*INTERNAL_TEST_COMPANY_FIELD\s*\]\s*:/, // the field-name constant as a key
    ];
    const writers = code().filter(({ text }) => writes.some(pattern => pattern.test(text))).map(({ file }) => file);
    // The one writer of the access record's field, and the one module that names the same word as something else: the
    // job predicate's closed reason for a real job asked for by the test company (`closed("internal_test_company")`).
    const NAMED = ["server/utils/teamJobAccess.ts"];
    expect(writers.sort()).toEqual(["server/routes/internal-test-company.ts", ...NAMED].sort());
    for (const { file, text } of code().filter(({ file }) => NAMED.includes(file))) {
      expect(text, file).not.toMatch(/robotTeamAccess/);
      expect(text.match(/["']internal_test_company["']/g), file).toEqual(['"internal_test_company"', '"internal_test_company"']);
    }
    // The route writes it only into the test company's own record, at the configured inbox's id.
    const route = fs.readFileSync(path.join(ROOT, "server/routes/internal-test-company.ts"), "utf8");
    expect(route.match(/\binternal_test_company\s*:/g)).toHaveLength(1);
    expect(route).toMatch(/const ref = store\.collection\(ROBOT_TEAM_ACCESS_COLLECTION\)\.doc\(companyId\);/);
    expect(route).toMatch(/companyId = internalTestCompanyId\(\)!/);
  });

  it("the client names neither the marker, the setting nor the closed reason", () => {
    expect(code().filter(({ file, text }) => file.startsWith("client/")
      && /internal_test_company|BLUEPRINT_INTERNAL_TEST_COMPANY_EMAIL/.test(text)).map(({ file }) => file)).toEqual([]);
  });

  it("no address of the inbox is written in the code: it is a server setting", () => {
    const named = code().filter(({ text }) => /BLUEPRINT_INTERNAL_TEST_COMPANY_EMAIL\s*[=:]\s*["'][^"']+@/.test(text)).map(({ file }) => file);
    expect(named).toEqual([]);
    for (const file of ["render.yaml", "render.required.env.example", "render.optional.env.example"]) {
      const text = fs.readFileSync(path.join(ROOT, file), "utf8");
      expect(text, file).not.toMatch(/BLUEPRINT_INTERNAL_TEST_COMPANY_EMAIL\s*[=:]\s*\S+@/);
    }
  });
});

describe("who the internal test company is", () => {
  it("is the configured inbox's record, by the same id as every company's", () => {
    expect(internalTestCompanyEmail()).toBe(INBOX);
    expect(internalTestCompanyId()).toBe(accessRecordId(INBOX));
    vi.stubEnv(SETTING, `  ${INBOX.toUpperCase()} `);
    expect(internalTestCompanyEmail()).toBe(INBOX);
    expect(isInternalTestCompanyRow(accessRecordId(INBOX), testCompany())).toBe(true);
  });

  it("needs the marker, the inbox, the approval and a deployment company; nothing without the setting", () => {
    expect(isInternalTestCompany(testCompany())).toBe(true);
    for (const changed of [{ [INTERNAL_TEST_COMPANY_FIELD]: undefined }, { [INTERNAL_TEST_COMPANY_FIELD]: true },
      { email: "someone@example.com" }, { status: "declined" }, { status: "applied" }, { partnerRole: "technology" }, { partnerRole: null }])
      expect(isInternalTestCompany(testCompany(changed)), JSON.stringify(changed)).toBe(false);
    expect(isInternalTestCompanyRow(accessRecordId("someone@example.com"), testCompany())).toBe(false);
    for (const value of ["", "not-an-email"]) {
      vi.stubEnv(SETTING, value);
      expect(internalTestCompanyEmail()).toBeNull();
      expect(internalTestCompanyId()).toBeNull();
      expect(isInternalTestCompany(testCompany())).toBe(false);
    }
  });

  it("a record with any marker is not an ordinary company, whatever else it holds", () => {
    const ordinary = realCompany();
    expect(companyMaySeeJobs(ordinary)).toBe(true);
    expect(isApprovedDeploymentCompanyRecord(ordinary)).toBe(true);
    for (const marker of [MARKER, {}, "x", 1, true]) {
      expect(hasInternalTestCompanyMarker({ ...ordinary, [INTERNAL_TEST_COMPANY_FIELD]: marker })).toBe(true);
      expect(companyMaySeeJobs({ ...ordinary, [INTERNAL_TEST_COMPANY_FIELD]: marker } as never)).toBe(false);
      expect(isApprovedDeploymentCompanyRecord({ ...ordinary, [INTERNAL_TEST_COMPANY_FIELD]: marker } as never)).toBe(false);
    }
    for (const marker of [undefined, null, false]) expect(hasInternalTestCompanyMarker({ [INTERNAL_TEST_COMPANY_FIELD]: marker })).toBe(false);
    // The test company itself, with an accepted Terms on its record: still no real job.
    expect(companyMaySeeJobs({ ...testCompany(), termsAcceptance: currentTermsAcceptance(), termsAcceptedByUid: "uid-x" } as never)).toBe(false);
  });

  it("acts on a job only as the pair: the test company on a test job; a real company on a real job's rule", () => {
    const testId = accessRecordId(INBOX), realId = accessRecordId("contact@north.example.com");
    expect(isInternalTestPair(testId, testCompany(), testJob())).toBe(true);
    expect(isInternalTestPair(testId, testCompany(), realJob())).toBe(false);
    expect(isInternalTestPair(realId, realCompany(), testJob())).toBe(false);
    expect(companyMayActOnJob(testJob(), testId, testCompany() as never)).toBe(true);
    expect(companyMayActOnJob(realJob(), testId, testCompany() as never)).toBe(false);
    // A real company passes the company half; the job's own access (read without the flag) closes a test job to it.
    expect(companyMayActOnJob(testJob(), realId, realCompany())).toBe(true);
    expect(teamJobAccess(testJob(), CONTEXT).reason).toBe("internal_test_job");
  });
});

describe("the one job predicate, for the internal test company", () => {
  const pair = (record: Record<string, unknown>, context: Record<string, unknown> = {}) =>
    teamJobAccess(record, { ...CONTEXT, ...context, internalTestCompany: true });

  it("closes every real job to it, first, with its own reason", () => {
    expect(teamJobAccess(realJob(), CONTEXT).listed).toBe(true);
    expect(pair(realJob())).toEqual({ listed: false, evaluationAvailable: false, reason: "internal_test_company", details: null });
    for (const stop of [{ capture_withdrawal: { requestedAtIso: "2026-11-25T13:00:00.000Z" } }, { request: { buyerType: "robot_team" } }])
      expect(pair(realJob(stop)).reason).toBe("internal_test_company");
  });

  it("lists a test job for it, with the brief's sentence as its details, and for nobody else", () => {
    const access = pair(testJob());
    expect(access).toMatchObject({ listed: true });
    expect(access.details?.taskFamily).toBe(teamJobAccess(realJob(), CONTEXT).details?.taskFamily);
    // A sentence with no closed category: the neutral one, never the site's own words.
    expect(pair(testJob(), { brief: { summary: "Do the thing we do", confirmedAtIso: null } }).details?.title).not.toContain("thing");
    expect(teamJobAccess(testJob(), CONTEXT)).toEqual({ listed: false, evaluationAvailable: false, reason: "internal_test_job", details: null });
  });

  it("runs every safety stop on a test job", () => {
    const stops: Array<[Record<string, unknown>, Record<string, unknown>, string]> = [
      [{ capture_withdrawal: { requestedAtIso: "2026-11-25T13:00:00.000Z" } }, {}, "consent_withdrawn"],
      [{ request: { buyerType: "site_operator", consent_attestation: { ...INTERNAL_GRANT, revoked_at_iso: "2026-11-25T13:00:00.000Z" } } }, {}, "consent_withdrawn"],
      [{ operator_listing_hold: { held: true, atIso: "2026-11-25T13:00:00.000Z" } }, {}, "blueprint_hold"],
      [{ pipeline: { rights_review_status: "blocked" } }, {}, "rights_blocked"],
      [{ evaluation_readiness: { rights_review_status: "needs_review" } }, {}, "rights_needs_review"],
      [{ website_run_closures: { capture: { closedAtIso: "2026-11-25T13:00:00.000Z" } } }, {}, "closed_by_site"],
      [{ workspace_task: { archived: true } }, {}, "closed_by_site"],
      [{ evidence_tier: "development_only" }, {}, "development_only"],
      [{ debug: { autoCreatedByPipeline: true } }, {}, "pipeline_placeholder"],
      [{ request: { buyerType: "site_operator", consent_attestation: sharedRecordingGrant() } }, {}, "older_statement"],
      [{}, { brief: null }, "no_job_sentence"],
      [{}, { brief: { summary: "Your site task", confirmedAtIso: null } }, "no_job_sentence"],
      [{}, { companyVideoReady: false }, "video_required"],
    ];
    for (const [patch, context, reason] of stops) expect(pair(testJob(patch), context).reason, reason).toBe(reason);
    // The job ended for want of the site's step closes it; Blueprint's own work window ending does not (G-01), as for a
    // site's job.
    const ending = sealWebsiteJobNoGrantEnding({ request_id: ID, waiting_on: "site", waiting_since_epoch: 1_794_000_000,
      ended_at_epoch: 1_794_100_000, recorded_at_iso: "2026-11-25T12:00:00.000Z", notice: "none_emails_retired" });
    expect(pair(testJob({ website_job_no_grant_ending: ending })).reason).toBe("job_ended");
    expect(pair(testJob(), { preparationState: "authority_ended" }).listed).toBe(true);
  });

  it("is unchanged without the flag", () => {
    for (const record of [realJob(), testJob(), realJob({ operator_listing_hold: { held: true } })])
      expect(teamJobAccess(record, CONTEXT)).toEqual(teamJobAccess(record, { ...CONTEXT, internalTestCompany: false }));
  });

  it("the site's page of a test job says where it stands with the test company, and only with that option", () => {
    const listed = pair(testJob());
    expect(jobSharingOf(testJob(), listed, { internalTestCompany: true })).toEqual({ state: "visible", sharedAtIso: TEST_MARKER.created_at_iso });
    expect(jobSharingOf(testJob(), pair(testJob(), { companyVideoReady: false }), { internalTestCompany: true }))
      .toMatchObject({ state: "preparing" });
    expect(jobSharingOf(testJob(), listed).state).toBe("not_shared");
    expect(jobSharingOf(realJob(), teamJobAccess(realJob(), CONTEXT), { internalTestCompany: true }).state).toBe("visible");
  });
});

describe("the outbox's rule for a test job's row", () => {
  it("only a kind the pair uses, only to exactly the configured inbox", () => {
    for (const kind of ["robot_team_new_task", "job_clarification", "company_simulation_ready", "company_answered",
      "introduction_made_company", "introduction_made_site"]) {
      expect(internalTestRowMayBeDelivered({ kind, to: INBOX }), kind).toBe(true);
      expect(internalTestRowMayBeDelivered({ kind, to: ` ${INBOX.toUpperCase()}` }), kind).toBe(true);
      expect(internalTestRowMayBeDelivered({ kind, to: "someone@example.com" }), kind).toBe(false);
      expect(internalTestRowMayBeDelivered({ kind, to: `${INBOX}.example.com` }), kind).toBe(false);
    }
    for (const kind of ["task_received", "job_sent", "site_action_needed", "job_outcome_question", "site_reply_reminder",
      "job_withdrawn_company", "robot_team_access_approved", "scene_ready"])
      expect(internalTestRowMayBeDelivered({ kind, to: INBOX }), kind).toBe(false);
    vi.stubEnv(SETTING, "");
    expect(internalTestRowMayBeDelivered({ kind: "robot_team_new_task", to: INBOX })).toBe(false);
    expect(internalTestRowMayBeDelivered({ kind: "robot_team_new_task", to: "" })).toBe(false);
  });
});

/* ----------------------------------------------------------------- money */

type Row = Record<string, any>;
/** A tiny store keyed by full document path ("a/b/c/d"), as `owner-totals.test.ts` reads one. */
function fakeStore(docs: Record<string, Row>) {
  const read = (row: Row, field: string) => field.split(".").reduce<any>((v, k) => (v == null ? undefined : v[k]), row);
  const refOf = (full: string): any => {
    const parts = full.split("/");
    return { id: parts.at(-1), path: full, parent: { id: parts.at(-2), parent: parts.length > 2 ? refOf(parts.slice(0, -2).join("/")) : null } };
  };
  const snap = (full: string) => ({ id: full.split("/").at(-1), ref: refOf(full), exists: full in docs, data: () => docs[full] });
  const query = (match: (full: string) => boolean, filters: Array<(row: Row) => boolean>): any => ({
    where: (field: string, _op: string, value: unknown) => query(match, [...filters, row => read(row, field) === value]),
    select: () => query(match, filters),
    get: async () => ({ docs: Object.keys(docs).filter(p => match(p) && filters.every(f => f(docs[p]))).map(snap) }),
    count: () => ({ get: async () => ({ data: () => ({ count: Object.keys(docs).filter(p => match(p) && filters.every(f => f(docs[p]))).length }) }) }),
  });
  return {
    collection: (name: string) => ({ doc: (id: string) => refOf(`${name}/${id}`), ...query(p => p.split("/").length === 2 && p.startsWith(`${name}/`), []) }),
    collectionGroup: (name: string) => query(p => { const s = p.split("/"); return s.length >= 2 && s.at(-2) === name; }, []),
    getAll: async (...refs: any[]) => refs.filter(ref => ref && ref.path).map(ref => snap(ref.path)),
  } as any;
}

describe("a test introduction is a test event, never billable", () => {
  it("is written with its own status, and no billable rule counts it", () => {
    const event = buildIntroductionBillableEvent("itest-1", "c1", "2026-11-25T12:00:00.000Z", 0, { test: true });
    expect(event).toEqual({ kind: "introduction", requestId: "itest-1", companyId: "c1", atIso: "2026-11-25T12:00:00.000Z",
      priceUsd: null, status: "test_no_charge", testEvent: true });
    expect(buildIntroductionBillableEvent("a", "c1", "2026-11-25T12:00:00.000Z")).toEqual({ kind: "introduction", requestId: "a",
      companyId: "c1", atIso: "2026-11-25T12:00:00.000Z", priceUsd: null, status: "recorded_no_price" });
    const made = { ...event, madeAtIso: "2026-11-25T12:05:00.000Z" };
    expect(isTestBillableEvent(made)).toBe(true);
    expect(isMadeBillableEvent(made)).toBe(false);
    expect(isUnmadeBillableEvent(event)).toBe(false);
    // Marked void later, it is still a test event; a forged ordinary status beside the mark counts for nothing.
    expect(isTestBillableEvent({ status: "void", testEvent: true })).toBe(true);
    expect(isMadeBillableEvent({ status: "recorded_no_price", testEvent: true, madeAtIso: "2026-11-25T12:05:00.000Z" })).toBe(false);
  });

  it("the owner's totals and the CSV leave it out", async () => {
    const NOW = new Date("2026-11-25T18:00:00.000Z");
    const site = (extra: Row = {}) => ({ createdAt: "2026-11-25T00:00:00.000Z", request: { buyerType: "site_operator" }, ...extra });
    const store = fakeStore({
      "inboundRequests/a": site(),
      "inboundRequests/itest-1": site({ internal_test: TEST_MARKER }),
      "inboundRequests/a/introductions/c1": { outcomes: [] },
      "inboundRequests/itest-1/introductions/t1": { outcomes: [] },
      "inboundRequests/itest-1/robotTeamInterest/t1": { state: "interested" },
      "inboundRequests/itest-1/companySends/system-t1": { companyId: "t1" },
      "captureOutbox/real": { kind: "introduction_made_company", status: "sent", requestId: "a" },
      "captureOutbox/test": { kind: "introduction_made_company", status: "sent", requestId: "itest-1" },
      "billableEvents/introduction-a-c1": { kind: "introduction", requestId: "a", companyId: "c1", atIso: "2026-11-25T10:00:00.000Z",
        madeAtIso: "2026-11-25T10:05:00.000Z", status: "recorded_no_price" },
      "billableEvents/introduction-itest-1-t1": { kind: "introduction", requestId: "itest-1", companyId: "t1",
        atIso: "2026-11-25T11:00:00.000Z", madeAtIso: "2026-11-25T11:05:00.000Z", status: "test_no_charge", testEvent: true },
      "billableEvents/introduction-itest-1-t1-a1": { kind: "introduction", requestId: "itest-1", companyId: "t1",
        atIso: "2026-11-25T12:00:00.000Z", status: "void", testEvent: true },
    });
    expect(await loadJobTotals(NOW, store)).toEqual({ siteJobs: 1, siteJobsThisWeek: 1, withVideo: 0, shownToCompanies: 0, answered: 0,
      introductionsAsked: 1, introductionsMade: 1, outcomeAnswers: 0, billableEvents: 1, billableEventsNotMade: 0 });
    expect(await tallyStandingBillableEvents(store)).toEqual({ made: 1, notMade: 0 });
    const csv = await billableEventsCsv(store);
    expect(csv.split("\r\n")).toEqual([BILLABLE_EVENTS_CSV_HEADER.map(h => `"${h}"`).join(","),
      '"introduction-a-c1","a","c1","2026-11-25T10:00:00.000Z","2026-11-25T10:05:00.000Z","recorded_no_price"', ""]);
    expect(csv).not.toMatch(/itest|test_no_charge/);
  });
});
