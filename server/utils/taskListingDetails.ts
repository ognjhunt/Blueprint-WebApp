import { z } from "zod";
import type { TaskListingDetails } from "../../client/src/types/taskBrowse";

export const listingConsentVersion = "public-task-card-v1";
export const taskListingSchema = z.object({
  title: z.string().trim().min(8).max(160),
  taskFamily: z.string().trim().min(2).max(60),
  siteType: z.string().trim().max(80),
  region: z.string().trim().max(80),
  objects: z.string().trim().max(160),
  cycleTarget: z.string().trim().max(80),
  pilotTiming: z.string().trim().max(80),
  pilotBudget: z.string().trim().max(80),
  pilotPriceStatus: z.enum(["site_offer", "target_budget"]).optional(),
  pilotConditions: z.string().trim().max(320).optional(),
  ongoingTarget: z.string().trim().max(80).optional(),
  opportunity: z.enum(["open", "past", "not_seeking"]),
}).strict().refine(details => details.pilotPriceStatus !== "site_offer" || Boolean(details.pilotBudget), {
  message: "A proposed site price needs an amount.", path: ["pilotBudget"],
});

export function approvedTaskDetails(record: unknown): TaskListingDetails | null {
  const grant = (record as { public_task_listing?: Record<string, unknown> })?.public_task_listing;
  if (!grant || grant.enabled !== true || grant.consentVersion !== listingConsentVersion
      || typeof grant.approvedAtIso !== "string" || !Number.isFinite(Date.parse(grant.approvedAtIso))) return null;
  const parsed = taskListingSchema.safeParse(grant.details);
  return parsed.success ? parsed.data : null;
}
