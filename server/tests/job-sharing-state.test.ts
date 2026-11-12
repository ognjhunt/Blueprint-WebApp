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

  it("is shared and preparing while its video has not passed the privacy check", () => {
    const record = shared({ capture_privacy_screen: undefined });
    expect(jobSharingOf(record)).toEqual({ state: "preparing", sharedAtIso: AT });
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
});
