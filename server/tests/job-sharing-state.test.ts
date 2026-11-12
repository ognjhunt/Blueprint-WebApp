// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { listedTaskCard } from "./helpers/listedTaskCard";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, default: null }));
const { jobSharingOf } = await import("../utils/siteAnswer");
const { teamJobAccess } = await import("../utils/teamJobAccess");

/**
 * The job page's "Deployment companies" section (review, 2026-11-12) says what is true of the card: not shared;
 * shared and visible to approved companies; or shared but not visible right now. "Visible" is decided by the same
 * predicate that decides what a company can see (`teamJobAccess(...).listed`), never by the stored switch alone.
 */
const site = (extra: Record<string, unknown> = {}) => ({ request: { buyerType: "site_operator" }, ...extra });

describe("where a site's job summary stands with deployment companies", () => {
  it("is not shared without a card", () => {
    expect(jobSharingOf(site())).toEqual({ state: "not_shared", sharedAtIso: null });
    expect(jobSharingOf(site({ public_task_listing: { ...listedTaskCard(), enabled: false } }))).toEqual({ state: "not_shared", sharedAtIso: null });
  });

  it("is shared and visible when the site opted in on the start form, dated when it chose to", () => {
    const record = site({ public_task_listing: { ...listedTaskCard(), approvedBy: "initial_submission" } });
    expect(teamJobAccess(record).listed).toBe(true);
    expect(jobSharingOf(record)).toMatchObject({ state: "visible", sharedAtIso: "2026-09-19T00:00:00.000Z" });
  });

  it("is dated by the site's own press of Share my job when there was one", () => {
    expect(jobSharingOf(site({ public_task_listing: listedTaskCard(),
      introduction_request: { requested_at_iso: "2026-11-10T09:00:00.000Z" } }))).toMatchObject({ state: "visible", sharedAtIso: "2026-11-10T09:00:00.000Z" });
  });

  it.each([
    ["paused by the site", { workspace_task: { paused: true } }],
    ["closed by the site", { workspace_task: { archived: true } }],
    ["held by Blueprint (the operator hold)", { operator_listing_hold: { held: true, atIso: "2026-11-12T00:00:00.000Z", by: "admin-1" } }],
    ["under a rights hold", { evaluation_readiness: { rights_review_status: "needs_review" } }],
    ["kept narrower by an older choice", { request: { buyerType: "site_operator", pilotOpportunity: { requested: true, visibility: "private" } } }],
  ])("is shared but not visible when %s", (_, extra) => {
    const record = site({ public_task_listing: listedTaskCard(), ...extra });
    expect(teamJobAccess(record).listed).toBe(false);
    expect(jobSharingOf(record)).toMatchObject({ state: "not_visible", sharedAtIso: "2026-09-19T00:00:00.000Z" });
  });

  // Review, 2026-11-12: what the shared summary leaves out under the statement the site agreed to.
  it.each([
    ["the start form's opt-in", {}, "public-task-card-v1", { firstLook: true, trialResult: true }],
    ["the button under v1", { statement_version: "public-task-card-with-answer-v1" }, "public-task-card-with-answer-v1", { firstLook: false, trialResult: true }],
    ["the button under v2", { statement_version: "public-task-card-with-answer-v2" }, "public-task-card-with-answer-v2", { firstLook: false, trialResult: true }],
    ["the button under v3", { statement_version: "public-task-card-with-answer-v3" }, "public-task-card-with-answer-v3", { firstLook: false, trialResult: false }],
  ])("says what a summary shared through %s leaves out", (_, intro, consentVersion, leavesOut) => {
    const record = site({ public_task_listing: { ...listedTaskCard(), consentVersion },
      ...(Object.keys(intro).length ? { introduction_request: { requested_at_iso: "2026-11-10T09:00:00.000Z", ...intro } } : {}) });
    expect(jobSharingOf(record).leavesOut).toEqual(leavesOut);
  });
});
