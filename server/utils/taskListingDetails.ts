import { listingTargetingSchema } from "../../client/src/types/updatePreferences";
import { z } from "zod";
import { anonymizedOpportunityDraft, type TaskListingDetails } from "../../client/src/types/taskBrowse";
import type { SiteTaskBriefRecord } from "./siteTaskBrief";

export const listingConsentVersion = "public-task-card-v1";
/** The older card statement, kept as a record name; no card under it is listed any more (E2). */
/** Private suggestions only. Publication still needs the owner's exact review. */
export function taskListingDraft(brief: SiteTaskBriefRecord | null) {
  const details: TaskListingDetails = {
    title: (brief?.summary ?? "").slice(0, 160), taskFamily: "Recurring work", siteType: "", region: "", objects: "",
    cycleTarget: brief?.successCriteria?.cycleTimeSeconds != null ? `${brief.successCriteria.cycleTimeSeconds} seconds (site target)` : "",
    pilotTiming: "", pilotBudget: "", pilotPriceStatus: "target_budget", pilotConditions: "", ongoingTarget: "", opportunity: "not_seeking",
  };
  return { details, sources: {
    ...(brief ? { title: { record: `siteTaskBriefs/${brief.requestId}`, field: "summary", basis: "supplied_description" } } : {}),
    ...(details.cycleTarget ? { cycleTarget: { record: `siteTaskBriefs/${brief!.requestId}`, field: "successCriteria.cycleTimeSeconds", basis: "site_target" } } : {}),
  } };
}
export const taskListingSchema = z.object({
  targeting: listingTargetingSchema.optional(),
  title: z.string().trim().min(8).max(160),
  taskFamily: z.string().trim().min(2).max(60),
  siteType: z.string().trim().max(80),
  region: z.string().trim().max(80),
  objects: z.string().trim().max(160),
  cycleTarget: z.string().trim().max(80),
  pilotTiming: z.string().trim().max(80),
  pilotBudget: z.string().trim().max(80).default(""),
  pilotPriceStatus: z.enum(["site_offer", "target_budget"]).optional(),
  pilotConditions: z.string().trim().max(320).optional(),
  ongoingTarget: z.string().trim().max(80).optional(),
  opportunity: z.enum(["open", "past", "not_seeking"]),
}).strict();

export function approvedTaskDetails(record: unknown): TaskListingDetails | null {
  const grant = (record as { public_task_listing?: Record<string, unknown> })?.public_task_listing;
  if (!grant || grant.enabled !== true || !LISTING_CONSENT_VERSIONS.includes(String(grant.consentVersion))
      || typeof grant.approvedAtIso !== "string" || !Number.isFinite(Date.parse(grant.approvedAtIso))) return null;
  const parsed = taskListingSchema.safeParse(grant.details);
  return parsed.success ? parsed.data : null;
}

/**
 * The listing record written when a site accepts recording statement `2026-11-12.v4` (package D/E, 2026-11-12): the job
 * is shared with every approved deployment company. It has no text of its own; it records that the job is shared under
 * that statement (`approvedBy: "recording_statement"`). It is the only listing version `teamJobAccess` accepts, so a
 * card recorded under an older version (`LISTING_CONSENT_VERSIONS`) drops out with no data change.
 */
export const JOB_SHARED_LISTING_VERSION = "job-shared-2026-11-12";
/** Every listing version a card may be listed under: only the current one. */
export const LISTING_CONSENT_VERSIONS: readonly string[] = [JOB_SHARED_LISTING_VERSION];

/**
 * The shared job's listing record, or null. Its `details` are the category-only draft the start form writes
 * (`anonymizedOpportunityDraft`); a record without readable details gets the neutral category, never free text.
 */
export function sharedJobListing(record: unknown): { details: TaskListingDetails; approvedAtIso: string } | null {
  const grant = (record as { public_task_listing?: Record<string, unknown> })?.public_task_listing;
  if (!grant || grant.enabled !== true || grant.consentVersion !== JOB_SHARED_LISTING_VERSION
      || typeof grant.approvedAtIso !== "string" || !Number.isFinite(Date.parse(grant.approvedAtIso))) return null;
  const parsed = taskListingSchema.safeParse(grant.details);
  // Free-text fields a site could once type (region, targeting) are never carried: country comes from the job page payload.
  const { targeting: _targeting, ...details } = parsed.success ? parsed.data : anonymizedOpportunityDraft("");
  return { details: { ...details, region: "" }, approvedAtIso: grant.approvedAtIso };
}
