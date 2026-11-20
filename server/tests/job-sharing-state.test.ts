// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { listedTaskCard } from "./helpers/listedTaskCard";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, default: null }));
const { jobSharingOf } = await import("../utils/siteAnswer");
const { teamJobAccess } = await import("../utils/teamJobAccess");
const { buildJobSharedListing, recordingConsentWrite } = await import("../utils/jobSharedListing");

/**
 * The job page's "Deployment companies" section (sharing is the service, 2026-11-12). A job is shared if, and only if,
 * its site accepted recording statement v4 and its listing record was written. "Visible" is decided by the same
 * predicate that decides what a company can see (`teamJobAccess(...).listed`). A job under an older statement is not
 * shared, and its page offers v4 once (`olderStatement`).
 */
const AT = "2026-11-12T10:00:00.000Z";
const grant = (version: string) => ({ granted: true, statement_version: version, recorded_at_iso: AT });
const site = (extra: Record<string, unknown> = {}, request: Record<string, unknown> = {}) =>
  ({ request: { buyerType: "site_operator", ...request }, ...extra });
const shared = (extra: Record<string, unknown> = {}) => site({
  public_task_listing: buildJobSharedListing({ taskStatement: "Move totes between two stations", atIso: AT }),
  capture_privacy_screen: { proceeded: true, eligibility: "eligible" }, ...extra }, { consent_attestation: grant("2026-11-12.v4") });

describe("where a site's job stands with deployment companies", () => {
  it("is not shared without a statement, and offers nothing", () => {
    expect(jobSharingOf(site())).toEqual({ state: "not_shared", sharedAtIso: null });
  });

  it.each(["2026-09-18.v1", "2026-11-02.v2", "2026-11-11.v3"])("is not shared under the older statement %s, even with an older card, and offers v4", version => {
    for (const card of [undefined, listedTaskCard(), { ...listedTaskCard(), consentVersion: "public-task-card-with-answer-v3" }]) {
      const record = site(card ? { public_task_listing: card, introduction_request: { requested_at_iso: AT } } : {}, { consent_attestation: grant(version) });
      expect(teamJobAccess(record).listed).toBe(false);
      expect(jobSharingOf(record)).toEqual({ state: "not_shared", sharedAtIso: null, olderStatement: true });
    }
  });

  it("is shared and visible under v4 with its listing record, dated when the site agreed", () => {
    const record = shared();
    expect(teamJobAccess(record).listed).toBe(true);
    expect(jobSharingOf(record)).toEqual({ state: "visible", sharedAtIso: AT });
  });

  it("is visible without any upload-time privacy record: no screen holds a video", () => {
    expect(jobSharingOf(shared({ capture_privacy_screen: undefined }))).toEqual({ state: "visible", sharedAtIso: AT });
    expect(jobSharingOf(shared({ capture_privacy_screen: { proceeded: false, eligibility: "pending" } })))
      .toEqual({ state: "visible", sharedAtIso: AT });
  });

  it.each([
    ["held by Blueprint (the operator hold)", { operator_listing_hold: { held: true, atIso: AT, by: "admin-1" } }],
    ["under a rights hold", { evaluation_readiness: { rights_review_status: "needs_review" } }],
    ["closed by the site", { website_run_closures: { "walkthrough-1": { closed_at_iso: AT } } }],
  ])("is shared but not visible when %s", (_, extra) => {
    const record = shared(extra);
    expect(teamJobAccess(record).listed).toBe(false);
    expect(jobSharingOf(record)).toEqual({ state: "not_visible", sharedAtIso: AT });
  });

  it("is not shared once withdrawn, and offers nothing", () => {
    const record = shared({ consent_revoked: true });
    expect(jobSharingOf({ ...record, request: { ...record.request, consent_attestation: { ...grant("2026-11-12.v4"), revoked_at_iso: AT } } }))
      .toEqual({ state: "not_shared", sharedAtIso: null });
  });

  it("a job sent without a video under description v5 is listed with no video yet, and visible", () => {
    const v5 = { ...grant("2026-11-12.v5") };
    const record = site({ public_task_listing: buildJobSharedListing({ taskStatement: "Move totes", atIso: AT,
      descriptionStatementVersion: "2026-11-12.v5" }) }, { description_authority: v5, consent_attestation: null });
    expect(teamJobAccess(record)).toMatchObject({ listed: true, evaluationAvailable: false, reason: "no_video_yet" });
    expect(jobSharingOf(record)).toEqual({ state: "visible", sharedAtIso: AT });
    // Its site has not said what the job is yet: shared, preparing.
    expect(teamJobAccess(record, { brief: { summary: "Your site task" } })).toMatchObject({ listed: false, reason: "no_job_sentence" });
    // An older description statement does not share it, nor does v5 once a recording grant under an older statement exists.
    expect(teamJobAccess(site({ public_task_listing: record.public_task_listing },
      { description_authority: grant("2026-11-11.v3"), consent_attestation: null }))).toMatchObject({ listed: false, reason: "older_statement" });
    expect(teamJobAccess(site({ public_task_listing: record.public_task_listing },
      { description_authority: v5, consent_attestation: grant("2026-11-11.v3") }))).toMatchObject({ listed: false, reason: "older_statement" });
    // A withdrawal takes it from every company's view at once, and it is no longer shared.
    const withdrawn = { ...record, consent_revoked: true, capture_withdrawal: { state: "uploads_stopped_cleanup_pending" },
      request: { ...record.request, consent_attestation: { granted: false, revoked_at_iso: AT } } };
    expect(teamJobAccess(withdrawn)).toMatchObject({ listed: false, reason: "consent_withdrawn" });
    expect(jobSharingOf(withdrawn)).toEqual({ state: "not_shared", sharedAtIso: null });
    // Accepting v4 on its page later lists it with its video like any other: no second listing record.
    const write = recordingConsentWrite({ record, statementVersion: "2026-11-12.v4", atIso: AT, taskStatement: "Move totes",
      hasCurrentGrant: false, canGrantInitial: true, revoked: false });
    expect(write).toMatchObject({ outcome: "granted", listing: null });
    if (write.outcome === "held") return;
    const after = { ...record, request: { ...record.request, ...write.request } };
    expect(teamJobAccess(after).reason).not.toBe("no_video_yet");
    expect(teamJobAccess(after).listed).toBe(true);
  });

  it("accepting v4 on an older job's page makes it shared like any other", () => {
    const record = site({ public_task_listing: listedTaskCard() }, { consent_attestation: grant("2026-11-11.v3") });
    const write = recordingConsentWrite({ record, statementVersion: "2026-11-12.v4", atIso: AT, taskStatement: "Move totes",
      hasCurrentGrant: true, canGrantInitial: false, revoked: false });
    expect(write.outcome).toBe("upgraded");
    if (write.outcome === "held") return;
    const after = { ...record, ...write.listing, capture_privacy_screen: { proceeded: true, eligibility: "eligible" },
      request: { ...record.request, ...write.request } };
    expect(jobSharingOf(after)).toEqual({ state: "visible", sharedAtIso: AT });
    // The listing record replaces the older card whole: none of its free text survives.
    expect(JSON.stringify(after.public_task_listing)).not.toMatch(/Warehouse|"US"|Totes/);
  });

  // Journey audit, 2026-11-20: a job started with a video alone was shared before its site typed a sentence, so its
  // card and page said "Work assessment opportunity" / "To be determined" for good. Its category now comes from the
  // sentence on its brief, a closed category only; a stored category is kept; words naming no category read plainly.
  it("titles a job shared before its sentence by the category of the sentence it has now", () => {
    const videoOnly = site({ public_task_listing: buildJobSharedListing({ taskStatement: "", atIso: AT }),
      capture_privacy_screen: { proceeded: true, eligibility: "eligible" } }, { consent_attestation: grant("2026-11-12.v4") });
    expect(videoOnly.public_task_listing.details).toMatchObject({ title: "Job opportunity", taskFamily: "Other" });
    const access = teamJobAccess(videoOnly, { brief: { summary: "Acme Foods: pick up the sealed carton and place it on the cart." } });
    expect(access.details).toMatchObject({ title: "Material handling opportunity", taskFamily: "Material handling" });
    expect(JSON.stringify(access.details)).not.toMatch(/Acme|carton|cart\b/);
    // A listing stored under an older neutral title reads the same way.
    const older = { ...videoOnly, public_task_listing: { ...videoOnly.public_task_listing,
      details: { ...videoOnly.public_task_listing.details, title: "Work assessment opportunity", taskFamily: "To be determined" } } };
    expect(teamJobAccess(older, { brief: { summary: "Stack the dish racks on the shelf." } }).details)
      .toMatchObject({ title: "Dish handling opportunity", taskFamily: "Dish handling" });
    // A sentence that names no category: plain words, never "To be determined".
    expect(teamJobAccess(videoOnly, { brief: { summary: "Wipe each table after the lunch rush." } }).details)
      .toMatchObject({ title: "Job opportunity", taskFamily: "Other" });
    // A category stored from the typed sentence is kept.
    expect(teamJobAccess(shared(), { brief: { summary: "Inspect each part before it ships." } }).details)
      .toMatchObject({ title: "Material handling opportunity" });
  });
});
