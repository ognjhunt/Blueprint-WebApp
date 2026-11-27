// @vitest-environment node
/**
 * Outreach audit, 2026-11-27: the site's journey, proved on the real functions.
 * - Step 6: every reason `teamJobAccess` gives for a job not shown to companies, and the sharing state the site's page
 *   then receives (`jobSharingOf`); the older-statement path a site takes with "Agree and send my job".
 * - Step 7: the outlook after a simulation package is delivered and the job's window ends.
 * - Steps 4 and 8: the site's emails, word for word.
 *
 * Tests named "GAP:" use `it.fails`: they state what should hold and pass only while it does not. When fixed they turn
 * red; then change `it.fails` to `it` and keep them.
 */
import { describe, expect, it, vi } from "vitest";
import { sharedCompanyClip } from "./helpers/sharedJob";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, default: null, storageAdmin: null, authAdmin: null }));
const { teamJobAccess } = await import("../utils/teamJobAccess");
const { jobSharingOf } = await import("../utils/siteAnswer");
const { buildJobSharedListing, recordingConsentWrite } = await import("../utils/jobSharedListing");
const { sealWebsiteJobNoGrantEnding, WEBSITE_JOB_NO_GRANT_ENDING_FIELD } = await import("../utils/websiteJobWindowEnding");
const { jobOutlook } = await import("../utils/jobOutlook");
const { buildTaskLifecycleNotification, introductionMadeSiteCopy } = await import("../utils/taskLifecycleNotifications");

const AT = "2026-11-27T01:00:00.000Z";
const ID = "outreach-site-proof-1";
const grant = (version: string) => ({ granted: true, statement_version: version, recorded_at_iso: AT });
const shared = (extra: Record<string, unknown> = {}, request: Record<string, unknown> = {}) => ({
  requestId: ID,
  request: { buyerType: "site_operator", consent_attestation: grant("2026-11-23.v6"), ...request },
  public_task_listing: buildJobSharedListing({ taskStatement: "Move the carton to the cart", atIso: AT, recordingStatementVersion: "2026-11-23.v6" }),
  ...extra,
});
const BRIEF = { summary: "Move the carton from the table to the cart.", confirmedAtIso: AT };
const READY = { brief: BRIEF, companyVideoReady: true, companySimulationReady: true };

describe("step 6: why a job is not shown to companies, and the state the site's page gets", () => {
  const noGrantEnding = sealWebsiteJobNoGrantEnding({ request_id: ID, waiting_on: "site", waiting_since_epoch: 1_790_000_000,
    ended_at_epoch: 1_790_600_000, recorded_at_iso: AT, notice: "queued" });
  const cases: Array<[string, Record<string, unknown>, Record<string, unknown>, string, string]> = [
    // [reason, record, context, sharing state, why]
    ["internal_test_job", shared({ internal_test: { label: "x" } }), READY, "not_visible", "a Blueprint test job"],
    ["not_a_site_job", { ...shared(), request: { consent_attestation: grant("2026-11-23.v6") } }, READY, "not_visible", "no buyer type"],
    ["pipeline_placeholder", shared({ debug: { autoCreatedByPipeline: true } }), READY, "not_visible", "Pipeline placeholder"],
    ["consent_withdrawn", shared({ capture_withdrawal: { state: "uploads_stopped_cleanup_pending" } }), READY, "not_visible", "withdrawn (page shows Nothing is shared)"],
    ["blueprint_hold", shared({ operator_listing_hold: { held: true, atIso: AT } }), READY, "not_visible", "Blueprint's hold"],
    ["rights_blocked", shared({ pipeline: { rights_review_status: "blocked" } }), READY, "not_visible", "rights review"],
    ["rights_needs_review", shared({ evaluation_readiness: { rights_review_status: "needs_review" } }), READY, "not_visible", "rights review"],
    ["closed_by_site", shared({ website_run_closures: { c: { at: AT } } }), READY, "not_visible", "the site closed it"],
    ["job_ended", shared({ [WEBSITE_JOB_NO_GRANT_ENDING_FIELD]: noGrantEnding }), READY, "not_visible", "the site's step never came"],
    ["development_only", shared({ evidence_tier: "development_only" }), READY, "not_visible", "development capture"],
    ["older_statement", shared({}, { consent_attestation: grant("2026-09-18.v1") }), READY, "not_shared", "older statement"],
    ["not_listed", { ...shared(), public_task_listing: undefined }, READY, "not_shared", "no listing record"],
    ["no_job_sentence", shared(), { ...READY, brief: { summary: "Your site task" } }, "preparing", "no sentence yet"],
    ["video_required", shared(), { ...READY, companyVideoReady: false }, "preparing", "no sound-free video yet"],
  ];
  it.each(cases.map(([reason, record, context, state, why]) => [reason, state, why, record, context] as const))(
    "%s: the site's page gets %s (%s)", (reason, state, _why, record, context) => {
    const access = teamJobAccess(record, context as never);
    expect(access.listed).toBe(false);
    expect(access.reason).toBe(reason);
    expect(jobSharingOf(record as never, access).state).toBe(state);
  });

  it("listed with no simulation yet: visible, and a company sees it", () => {
    const access = teamJobAccess(shared(), { ...READY, companySimulationReady: false });
    expect(access).toMatchObject({ listed: true, evaluationAvailable: false, reason: "simulation_not_ready" });
    expect(jobSharingOf(shared() as never, access).state).toBe("visible");
  });

  it("an older job: the page offers v6; agreeing writes the listing, and the job waits for its sound-free video", () => {
    const older = { requestId: ID, request: { buyerType: "site_operator", consent_attestation: grant("2026-09-18.v1") } };
    expect(jobSharingOf(older as never)).toEqual({ state: "not_shared", sharedAtIso: null, olderStatement: true });
    const write = recordingConsentWrite({ record: older, statementVersion: "2026-11-23.v6", atIso: AT, taskStatement: "Move the carton",
      hasCurrentGrant: true, canGrantInitial: false, revoked: false });
    expect(write.outcome).toBe("upgraded");
    if (write.outcome === "held") return;
    const after = { ...older, ...write.listing, request: { ...older.request, ...write.request } };
    // No older job holds a company clip (production read 2026-11-27: 0 of 42); the Pipeline makes it only after a recheck.
    const waiting = teamJobAccess(after, { brief: BRIEF, companyVideoReady: false });
    expect(waiting).toMatchObject({ listed: false, reason: "video_required" });
    expect(jobSharingOf(after as never, waiting).state).toBe("preparing");
    // Once the Pipeline stores the clip it is listed like any other job.
    expect(sharedCompanyClip(`walkthrough-${ID}`).statement_version).toBe("2026-11-12.v4");
    expect(teamJobAccess(after, { brief: BRIEF, companyVideoReady: true }).listed).toBe(true);
  });

  it("an older job with no sentence on its brief stays preparing after agreeing", () => {
    const older = { requestId: ID, request: { buyerType: "site_operator", consent_attestation: grant("2026-11-02.v2") } };
    const write = recordingConsentWrite({ record: older, statementVersion: "2026-11-23.v6", atIso: AT, taskStatement: null,
      hasCurrentGrant: true, canGrantInitial: false, revoked: false });
    if (write.outcome === "held") throw new Error("held");
    const after = { ...older, ...write.listing, request: { ...older.request, ...write.request } };
    expect(teamJobAccess(after, { brief: null, companyVideoReady: true })).toMatchObject({ listed: false, reason: "no_job_sentence" });
  });
});

describe("step 7: the outlook once a simulation package is delivered", () => {
  const base = { consentRevoked: false, closedByOwner: false, answer: { state: "ready" as const, unsized: false, reason: null },
    windowEnded: false, noGrantEnded: false, preparation: { state: "handed_off", geometryOnlyEnd: false }, scene: { state: "in_progress" },
    proof: null, simulationDelivered: true };
  it("a delivered package, room only or full, is 'ready'", () => {
    expect(jobOutlook(base)).toEqual({ phase: "simulation_ready", reason: null, sentence: null });
  });
  it("the window ending outranks the delivered package: the site reads that time ran out", () => {
    expect(jobOutlook({ ...base, windowEnded: true })).toMatchObject({ phase: "no_test", reason: "window_expired",
      sentence: "The time for this job ran out." });
  });
  it.fails("GAP: a delivered package stays 'ready' after the job's window ends (a company still downloads it)", () => {
    expect(jobOutlook({ ...base, windowEnded: true }).phase).toBe("simulation_ready");
  });
  it("the job's spending cap outranks the delivered package too", () => {
    expect(jobOutlook({ ...base, scene: { state: "ended", endingKind: "spending_cap_reached" } }).reason).toBe("spending_cap_reached");
  });
});

describe("steps 4 and 8: the site's emails, word for word", () => {
  const url = "https://tryblueprint.io/capture-upload/token";
  const body = (params: Partial<Parameters<typeof buildTaskLifecycleNotification>[0]>) =>
    buildTaskLifecycleNotification({ requestId: ID, to: "site@example.test", milestone: "task_received", captureUrl: url, ...params }).body;

  it("the job link email, video in: says the job goes to approved companies, whether or not any is approved", () => {
    const text = body({ videoIn: true });
    expect(text).toContain("Your job goes to approved deployment companies.");
    expect(text).toContain("This link opens your job without a password, so please don't forward it.");
    expect(text).not.toMatch(/simulation|first look|no approved|not approved/i);
  });
  it("the job link email, no video yet", () => {
    expect(body({ videoIn: false })).toContain("A video is required to post your job.");
  });
  it("the job link email outside the United States", () => {
    expect(body({ captureRegion: "non_us" })).toMatch(/We can only take videos from sites in the United States for now/);
  });
  it.each([
    ["interested", "A deployment company applied to your job. To meet them, press Accept on your job page.", true],
    ["declined", "A deployment company answered \"Not a fit\" about your job. Your job page has the details.", false],
  ])("company answered %s", (state, sentence, introductionOffered) => {
    const text = body({ milestone: "company_answered", companyAnswerState: state as never, introductionOffered });
    expect(text.startsWith(sentence)).toBe(true);
  });
  it("company needs more details", () => {
    expect(body({ milestone: "company_answered", companyAnswerState: "needs_something", questionOnPage: true }))
      .toMatch(/^A deployment company needs more details about your job\. Read their question and answer it on your job page\./);
  });
  it("after Accept: the site gets the company's details", () => {
    const { subject, body: text } = introductionMadeSiteCopy({ name: "Example Robotics", email: "hello@example.test" }, url, "Applied");
    expect(subject).toBe("Meet Example Robotics");
    expect(text).toContain("Example Robotics applied to your job, and you accepted them.");
  });
  it("no email ever tells the site its simulation is ready or what it holds", () => {
    for (const milestone of ["task_received", "company_answered", "introduction_made_site"] as const) {
      const text = body({ milestone, companyAnswerState: "interested", videoIn: true });
      expect(text).not.toMatch(/simulation/i);
    }
  });
});
