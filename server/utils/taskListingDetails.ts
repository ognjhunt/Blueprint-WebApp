import { listingTargetingSchema } from "../../client/src/types/updatePreferences";
import { z } from "zod";
import type { TaskListingDetails } from "../../client/src/types/taskBrowse";
import type { SiteTaskBriefRecord } from "./siteTaskBrief";

export const listingConsentVersion = "public-task-card-v1";
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
  if (!grant || grant.enabled !== true || grant.consentVersion !== listingConsentVersion
      || typeof grant.approvedAtIso !== "string" || !Number.isFinite(Date.parse(grant.approvedAtIso))) return null;
  const parsed = taskListingSchema.safeParse(grant.details);
  return parsed.success ? parsed.data : null;
}
